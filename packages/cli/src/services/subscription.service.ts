import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';
import { SubscriptionPlanRepository, UserSubscriptionRepository } from '@n8n/db';

import { IPaymentService } from './payment/payment-service.interface';
import { StripePaymentService } from './payment/stripe-payment.service';

@Service()
export class SubscriptionService {
	private paymentService: IPaymentService;

	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
		private subscriptionPlanRepository: SubscriptionPlanRepository,
		private userSubscriptionRepository: UserSubscriptionRepository,
		private stripePaymentService: StripePaymentService,
	) {
		// Use Stripe as the payment service
		this.paymentService = this.stripePaymentService;
	}

	async getAvailablePlans() {
		return await this.subscriptionPlanRepository.findAllActive();
	}

	async getPlanBySlug(slug: string) {
		return await this.subscriptionPlanRepository.findActiveBySlug(slug);
	}

	async getPopularPlan() {
		return await this.subscriptionPlanRepository.findPopular();
	}

	async getCurrentSubscription(userId: string) {
		return await this.userSubscriptionRepository.findByUserIdWithPlan(userId);
	}

	async getActiveSubscription(userId: string) {
		return await this.userSubscriptionRepository.findActiveByUserId(userId);
	}

	async createSubscription(params: {
		userId: string;
		planSlug: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId?: string;
		userEmail: string;
		userName?: string;
	}) {
		const { userId, planSlug, billingCycle, paymentMethodId, userEmail, userName } = params;

		// Get the subscription plan
		const plan = await this.subscriptionPlanRepository.findActiveBySlug(planSlug);
		if (!plan) {
			throw new Error(`Subscription plan '${planSlug}' not found`);
		}

		// Check if user already has an active subscription
		const existingSubscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
		if (existingSubscription) {
			throw new Error('User already has an active subscription');
		}

		try {
			// Create customer in payment provider
			const customerId = await this.paymentService.createCustomer({
				id: userId,
				email: userEmail,
				firstName: userName?.split(' ')[0],
				lastName: userName?.split(' ').slice(1).join(' '),
			});

			// Calculate price based on billing cycle
			const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

			// Get the actual Stripe price ID from the plan
			const stripePriceId = billingCycle === 'yearly' ? plan.PriceIdYearly : plan.PriceIdMonthly;

			if (!stripePriceId) {
				throw new Error(
					`No Stripe price ID configured for plan '${plan.slug}' with ${billingCycle} billing`,
				);
			}

			// Create subscription in payment provider
			const providerSubscription = await this.paymentService.createSubscription({
				customerId,
				priceId: stripePriceId, // Use actual Stripe price ID
				paymentMethodId,
				trialDays: plan.trialDays,
			});

			// Create subscription record in database
			const subscription = this.userSubscriptionRepository.create({
				userId,
				planId: plan.id,
				status: providerSubscription.status as any,
				billingCycle,
				amount,
				currency: 'USD',
				currentPeriodStart: providerSubscription.currentPeriodStart,
				currentPeriodEnd: providerSubscription.currentPeriodEnd,
				trialStart: providerSubscription.trialStart,
				trialEnd: providerSubscription.trialEnd,
				metadata: {
					stripeSubscriptionId: providerSubscription.id,
					stripeCustomerId: customerId,
				},
			});

			const savedSubscription = await this.userSubscriptionRepository.save(subscription);

			this.logger.info(`Subscription created for user ${userId}`, {
				subscriptionId: savedSubscription.id,
				planSlug,
				billingCycle,
				amount,
			});

			return savedSubscription;
		} catch (error) {
			this.logger.error('Failed to create subscription:', error);
			throw error; // Pass the original error instead of generic message
		}
	}

	async upgradeSubscription(userId: string, newPlanSlug: string) {
		const currentSubscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
		if (!currentSubscription) {
			throw new Error('No active subscription found');
		}

		const newPlan = await this.subscriptionPlanRepository.findActiveBySlug(newPlanSlug);
		if (!newPlan) {
			throw new Error(`Subscription plan '${newPlanSlug}' not found`);
		}

		try {
			// Get the actual Stripe price ID for the new plan
			const newStripePriceId =
				currentSubscription.billingCycle === 'yearly'
					? newPlan.PriceIdYearly
					: newPlan.PriceIdMonthly;

			if (!newStripePriceId) {
				throw new Error(
					`No Stripe price ID configured for plan '${newPlan.slug}' with ${currentSubscription.billingCycle} billing`,
				);
			}

			const stripeSubscriptionId = currentSubscription.metadata?.stripeSubscriptionId as string;

			if (stripeSubscriptionId) {
				await this.paymentService.updateSubscription(stripeSubscriptionId, {
					priceId: newStripePriceId,
				});
			}

			// Update subscription record in database
			currentSubscription.planId = newPlan.id;
			currentSubscription.amount =
				currentSubscription.billingCycle === 'yearly' ? newPlan.yearlyPrice : newPlan.monthlyPrice;

			const updatedSubscription = await this.userSubscriptionRepository.save(currentSubscription);

			this.logger.info(`Subscription upgraded for user ${userId}`, {
				subscriptionId: updatedSubscription.id,
				oldPlan: currentSubscription.plan?.slug,
				newPlan: newPlanSlug,
			});

			return updatedSubscription;
		} catch (error) {
			this.logger.error('Failed to upgrade subscription:', error);
			throw new Error('Failed to upgrade subscription');
		}
	}

	async cancelSubscription(userId: string, cancelAtPeriodEnd: boolean = true) {
		const subscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
		if (!subscription) {
			throw new Error('No active subscription found');
		}

		try {
			// Cancel subscription in payment provider
			const stripeSubscriptionId = subscription.metadata?.stripeSubscriptionId as string;
			if (stripeSubscriptionId) {
				await this.paymentService.cancelSubscription(stripeSubscriptionId, cancelAtPeriodEnd);
			}

			// Update subscription record in database
			if (cancelAtPeriodEnd) {
				subscription.cancelAtPeriodEnd = true;
			} else {
				subscription.status = 'canceled';
				subscription.canceledAt = new Date();
			}

			const updatedSubscription = await this.userSubscriptionRepository.save(subscription);

			this.logger.info(`Subscription canceled for user ${userId}`, {
				subscriptionId: updatedSubscription.id,
				cancelAtPeriodEnd,
			});

			return updatedSubscription;
		} catch (error) {
			this.logger.error('Failed to cancel subscription:', error);
			throw new Error('Failed to cancel subscription');
		}
	}

	async getUsageLimits(userId: string) {
		const subscription = await this.userSubscriptionRepository.findActiveByUserId(userId);

		if (!subscription || !subscription.plan) {
			// Return free plan limits
			return {
				executionsLeft: this.subscriptionConfig.freePlanExecutionsLimit,
				workflowsLeft: this.subscriptionConfig.freePlanWorkflowsLimit,
				credentialsLeft: this.subscriptionConfig.freePlanCredentialsLimit,
				usersLeft: 1,
			};
		}

		// TODO: Implement actual usage tracking
		// For now, return mock data based on plan limits
		const plan = subscription.plan;
		return {
			executionsLeft: Math.floor(plan.monthlyExecutionsLimit * 0.9), // 90% remaining
			workflowsLeft: Math.floor(plan.activeWorkflowsLimit * 0.6), // 60% remaining
			credentialsLeft: Math.floor(plan.credentialsLimit * 0.8), // 80% remaining
			usersLeft: Math.floor(plan.usersLimit * 0.5), // 50% remaining
		};
	}

	async handleWebhook(provider: string, payload: any, signature: string) {
		try {
			// Verify and parse webhook
			const webhookData = await this.paymentService.handleWebhook(payload, signature);

			this.logger.info(`Received webhook from ${provider}`, {
				type: webhookData.type,
				data: webhookData.data,
			});

			// Handle different Stripe webhook events
			switch (webhookData.type) {
				case 'customer.subscription.created':
					await this.handleSubscriptionCreated(webhookData.data);
					break;
				case 'customer.subscription.updated':
					await this.handleSubscriptionUpdated(webhookData.data);
					break;
				case 'customer.subscription.deleted':
					await this.handleSubscriptionDeleted(webhookData.data);
					break;
				case 'invoice.payment_succeeded':
					await this.handlePaymentSucceeded(webhookData.data);
					break;
				case 'invoice.payment_failed':
					await this.handlePaymentFailed(webhookData.data);
					break;
				case 'customer.subscription.trial_will_end':
					await this.handleTrialWillEnd(webhookData.data);
					break;
				default:
					this.logger.info(`Unhandled webhook event: ${webhookData.type}`);
			}

			return { success: true };
		} catch (error) {
			this.logger.error('Failed to handle webhook:', error);
			throw error;
		}
	}

	private async handleSubscriptionCreated(data: any) {
		this.logger.info(`Stripe subscription created: ${data.object.id}`);
		// Subscription is already created in our database during the creation flow
	}

	private async handleSubscriptionUpdated(data: any) {
		this.logger.info(`Stripe subscription updated: ${data.object.id}`);
		// TODO: Update local subscription data based on Stripe changes
	}

	private async handleSubscriptionDeleted(data: any) {
		this.logger.info(`Stripe subscription deleted: ${data.object.id}`);
		// TODO: Find subscription by Stripe ID and update status to canceled
	}

	private async handlePaymentSucceeded(data: any) {
		this.logger.info(`Payment succeeded for subscription: ${data.object.subscription}`);
		// TODO: Update subscription status, create invoice record, etc.
	}

	private async handlePaymentFailed(data: any) {
		this.logger.warn(`Payment failed for subscription: ${data.object.subscription}`);
		// TODO: Handle failed payment, update subscription status if needed
	}

	private async handleTrialWillEnd(data: any) {
		this.logger.info(`Trial ending soon for subscription: ${data.object.id}`);
		// TODO: Send notification to user about trial ending
	}
}
