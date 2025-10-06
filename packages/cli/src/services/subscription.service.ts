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

	async getPlanById(id: string) {
		return await this.subscriptionPlanRepository.findActiveById(id);
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

		// Handle free plan subscription
		if (planSlug.toLowerCase() === 'free') {
			return await this.createFreeSubscription(userId, plan, billingCycle);
		}

		// Handle paid plan subscription
		try {
			// Validate payment method for paid plans
			if (!paymentMethodId) {
				throw new Error('Payment method is required for paid plans');
			}

			// Create customer in payment provider
			const customer = await this.paymentService.createCustomer({
				id: userId,
				email: userEmail,
				firstName: userName?.split(' ')[0],
				lastName: userName?.split(' ').slice(1).join(' '),
			});
			const customerId = customer.id;

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

			// Helper function to safely convert dates
			const safeDateConversion = (date: Date | undefined): Date | undefined => {
				return date && !isNaN(date.getTime()) ? date : undefined;
			};

			// Helper function to calculate proper period end based on billing cycle
			const calculatePeriodEnd = (startDate: Date, cycle: 'monthly' | 'yearly'): Date => {
				const periodStart = new Date(startDate);
				if (cycle === 'yearly') {
					periodStart.setFullYear(periodStart.getFullYear() + 1);
				} else {
					// Monthly billing - add 1 month
					periodStart.setMonth(periodStart.getMonth() + 1);
				}
				return periodStart;
			};

			const currentPeriodStart =
				safeDateConversion(providerSubscription.currentPeriodStart) || new Date();
			const currentPeriodEnd =
				safeDateConversion(providerSubscription.currentPeriodEnd) ||
				calculatePeriodEnd(currentPeriodStart, billingCycle);

			console.log(
				`🔍 DEBUG createSubscription - billingCycle: ${billingCycle}, currentPeriodStart: ${currentPeriodStart}, currentPeriodEnd: ${currentPeriodEnd}`,
			);

			// Create subscription record in database
			const subscription = this.userSubscriptionRepository.create({
				userId,
				planId: plan.id,
				status: providerSubscription.status as any,
				billingCycle,
				amount,
				currency: 'USD',
				currentPeriodStart,
				currentPeriodEnd,
				trialStart: safeDateConversion(providerSubscription.trialStart),
				trialEnd: safeDateConversion(providerSubscription.trialEnd),
				stripeSubscriptionId: providerSubscription.id,
				stripeCustomerId: customerId,
				metadata: {
					createdAt: new Date().toISOString(),
				},
			});

			const savedSubscription = await this.userSubscriptionRepository.save(subscription);

			this.logger.info(`Paid subscription created for user ${userId}`, {
				subscriptionId: savedSubscription.id,
				planSlug,
				billingCycle,
				amount,
			});

			return savedSubscription;
		} catch (error) {
			this.logger.error('Failed to create paid subscription:', error);
			throw error; // Pass the original error instead of generic message
		}
	}

	private async createFreeSubscription(
		userId: string,
		plan: any,
		billingCycle: 'monthly' | 'yearly',
	) {
		try {
			const now = new Date();
			const oneYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

			// Create free subscription record in database without payment processing
			const subscriptionData = {
				userId,
				planId: plan.id,
				status: 'active' as const,
				billingCycle,
				amount: 0, // Free plan has no cost
				currency: 'USD',
				currentPeriodStart: now,
				currentPeriodEnd: oneYear, // Free subscriptions last indefinitely or for a year
				trialStart: undefined,
				trialEnd: undefined,
				metadata: {
					isFree: true,
					createdAt: now.toISOString(),
				},
			};

			const subscription = this.userSubscriptionRepository.create(subscriptionData);
			const savedSubscription = await this.userSubscriptionRepository.save(subscription);

			this.logger.info(`Free subscription created for user ${userId}`, {
				subscriptionId: savedSubscription.id,
				planSlug: plan.slug,
				billingCycle,
				amount: 0,
			});

			return savedSubscription;
		} catch (error) {
			this.logger.error('Failed to create free subscription:', error);
			throw new Error('Failed to create free subscription');
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

	async createSubscriptionSetup(params: {
		userId: string;
		planId: string;
		billingCycle: 'monthly' | 'yearly';
		userEmail: string;
	}) {
		const { userId, planId, billingCycle, userEmail } = params;

		const plan = await this.subscriptionPlanRepository.findActiveById(planId);
		if (!plan) {
			throw new Error('Plan not found');
		}

		// Get the Stripe price ID based on billing cycle
		const stripePriceId = billingCycle === 'yearly' ? plan.PriceIdYearly : plan.PriceIdMonthly;

		if (!stripePriceId) {
			throw new Error(
				`No Stripe price ID configured for plan '${plan.slug}' with ${billingCycle} billing`,
			);
		}

		// Create or get Stripe customer
		const customerId = await this.getOrCreateStripeCustomer(userId, userEmail);

		// Create setup intent for collecting payment method
		const setupIntent = await this.paymentService.createSetupIntent({
			customerId,
			metadata: {
				userId,
				planId,
				billingCycle,
				stripePriceId,
			},
		});

		return {
			clientSecret: setupIntent.client_secret,
			customerId,
			stripePriceId,
			planName: plan.name,
			amount: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice,
		};
	}

	async createRecurringSubscription(params: {
		userId: string;
		planId: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId: string;
	}) {
		const { userId, planId, billingCycle, paymentMethodId } = params;

		const plan = await this.subscriptionPlanRepository.findActiveById(planId);
		if (!plan) {
			throw new Error('Plan not found');
		}

		// Check if user already has an active subscription
		const existingSubscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
		if (existingSubscription) {
			throw new Error('User already has an active subscription');
		}

		// Get the Stripe price ID based on billing cycle
		const stripePriceId = billingCycle === 'yearly' ? plan.PriceIdYearly : plan.PriceIdMonthly;

		if (!stripePriceId) {
			throw new Error(
				`No Stripe price ID configured for plan '${plan.slug}' with ${billingCycle} billing`,
			);
		}

		try {
			// Get or create Stripe customer
			const customerId = await this.getOrCreateStripeCustomer(userId, '');

			// Attach payment method to customer
			await this.paymentService.attachPaymentMethod(paymentMethodId, customerId);

			// Create recurring subscription in Stripe
			const stripeSubscription = await this.paymentService.createSubscription({
				customerId,
				priceId: stripePriceId,
				paymentMethodId,
				trialDays: plan.trialDays || undefined,
				metadata: {
					userId,
					planId,
				},
			});

			// Create subscription record in database
			const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

			// Helper function to safely convert timestamps to dates
			const safeTimestampToDate = (timestamp: number | undefined): Date | undefined => {
				return timestamp ? new Date(timestamp * 1000) : undefined;
			};

			const safeDateConversion = (date: Date | undefined): Date | undefined => {
				return date && !isNaN(date.getTime()) ? date : undefined;
			};

			// Helper function to calculate proper period end based on billing cycle
			const calculatePeriodEnd = (startDate: Date, cycle: 'monthly' | 'yearly'): Date => {
				const periodStart = new Date(startDate);
				if (cycle === 'yearly') {
					periodStart.setFullYear(periodStart.getFullYear() + 1);
				} else {
					// Monthly billing - add 1 month
					periodStart.setMonth(periodStart.getMonth() + 1);
				}
				return periodStart;
			};

			const currentPeriodStart = stripeSubscription.current_period_start
				? safeTimestampToDate(stripeSubscription.current_period_start) || new Date()
				: safeDateConversion(stripeSubscription.currentPeriodStart) || new Date();

			const currentPeriodEnd = stripeSubscription.current_period_end
				? safeTimestampToDate(stripeSubscription.current_period_end) ||
					calculatePeriodEnd(currentPeriodStart, billingCycle)
				: safeDateConversion(stripeSubscription.currentPeriodEnd) ||
					calculatePeriodEnd(currentPeriodStart, billingCycle);

			console.log(
				`🔍 DEBUG createRecurringSubscription - billingCycle: ${billingCycle}, currentPeriodStart: ${currentPeriodStart}, currentPeriodEnd: ${currentPeriodEnd}`,
			);

			const subscriptionData = {
				userId,
				planId: plan.id,
				status: stripeSubscription.status as any,
				billingCycle,
				amount,
				currency: 'USD' as const,
				currentPeriodStart,
				currentPeriodEnd,
				trialStart: stripeSubscription.trial_start
					? safeTimestampToDate(stripeSubscription.trial_start)
					: safeDateConversion(stripeSubscription.trialStart),
				trialEnd: stripeSubscription.trial_end
					? safeTimestampToDate(stripeSubscription.trial_end)
					: safeDateConversion(stripeSubscription.trialEnd),
				metadata: {
					stripeSubscriptionId: stripeSubscription.id,
					stripeCustomerId: customerId,
				},
			};

			const savedSubscription = await this.userSubscriptionRepository.save(subscriptionData);

			this.logger.info(`Recurring subscription created for user ${userId}`, {
				subscriptionId: savedSubscription.id,
				stripeSubscriptionId: stripeSubscription.id,
				planSlug: plan.slug,
				billingCycle,
				amount,
			});

			return savedSubscription;
		} catch (error) {
			this.logger.error('Failed to create recurring subscription:', error);
			throw error;
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

	private async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
		// Check if user already has a Stripe customer ID
		const existingSubscription = await this.userSubscriptionRepository.findByUserId(userId);

		if (existingSubscription?.metadata?.stripeCustomerId) {
			return existingSubscription.metadata.stripeCustomerId as string;
		}

		// Create new Stripe customer
		const customer = await this.paymentService.createCustomer({
			id: userId,
			email,
		});

		return customer.id;
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
