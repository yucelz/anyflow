import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';
import { SubscriptionPlanRepository, UserSubscriptionRepository } from '@n8n/db';

import { IPaymentService } from './payment/payment-service.interface';
import { AdyenPaymentService } from './payment/adyen-payment.service';

@Service()
export class SubscriptionService {
	private paymentService: IPaymentService;

	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
		private subscriptionPlanRepository: SubscriptionPlanRepository,
		private userSubscriptionRepository: UserSubscriptionRepository,
		private adyenPaymentService: AdyenPaymentService,
	) {
		// Use Adyen as the only payment service
		this.paymentService = this.adyenPaymentService;
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

			// Create subscription in payment provider
			const providerSubscription = await this.paymentService.createSubscription({
				customerId,
				priceId: `${plan.slug}_${billingCycle}`, // Use plan slug as price identifier
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
					adyenSubscriptionId: providerSubscription.id,
					adyenCustomerId: customerId,
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
			throw new Error('Failed to create subscription');
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
			// Update subscription in payment provider
			const newPriceId = `${newPlan.slug}_${currentSubscription.billingCycle}`;
			const adyenSubscriptionId = currentSubscription.metadata?.adyenSubscriptionId as string;

			if (adyenSubscriptionId) {
				await this.paymentService.updateSubscription(adyenSubscriptionId, {
					priceId: newPriceId,
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
			const adyenSubscriptionId = subscription.metadata?.adyenSubscriptionId as string;
			if (adyenSubscriptionId) {
				await this.paymentService.cancelSubscription(adyenSubscriptionId, cancelAtPeriodEnd);
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

			// Handle different webhook events
			switch (webhookData.type) {
				case 'AUTHORISATION':
					await this.handlePaymentAuthorised(webhookData.data);
					break;
				case 'CANCELLATION':
					await this.handleSubscriptionCanceled(webhookData.data);
					break;
				case 'REFUND':
					await this.handleRefund(webhookData.data);
					break;
				case 'CHARGEBACK':
					await this.handleChargeback(webhookData.data);
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

	private async handlePaymentAuthorised(data: any) {
		this.logger.info(`Payment authorised: ${data.pspReference}`);
		// TODO: Update subscription status, create invoice record, etc.
	}

	private async handleSubscriptionCanceled(data: any) {
		this.logger.info(`Subscription canceled: ${data.pspReference}`);
		// TODO: Find subscription by reference and update status
	}

	private async handleRefund(data: any) {
		this.logger.info(`Refund processed: ${data.pspReference}`);
		// TODO: Handle refund logic
	}

	private async handleChargeback(data: any) {
		this.logger.warn(`Chargeback received: ${data.pspReference}`);
		// TODO: Handle chargeback logic
	}
}
