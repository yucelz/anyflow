import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';
import { SubscriptionPlanRepository, UserSubscriptionRepository } from '@n8n/db';

import { StripePaymentService } from './payment/stripe-payment.service';
import {
	resolveStripePriceId,
	calculatePlanAmount,
	buildSubscriptionData,
	getCheckoutBaseUrl,
	parseUserName,
} from '../subscription.utils';

@Service()
export class SubscriptionService {
	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
		private subscriptionPlanRepository: SubscriptionPlanRepository,
		private userSubscriptionRepository: UserSubscriptionRepository,
		private stripePaymentService: StripePaymentService,
	) {}

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

			// Parse user name for customer creation
			const { firstName, lastName } = parseUserName(userName);

			// Create or get Stripe customer
			const customerId = await this.stripePaymentService.getOrCreateStripeCustomer(
				userId,
				userEmail,
				firstName,
				lastName,
			);

			// Calculate price and resolve Stripe price ID
			const amount = calculatePlanAmount(plan, billingCycle);
			const stripePriceId = resolveStripePriceId(plan, billingCycle);

			// Create subscription in Stripe
			const providerSubscription = await this.stripePaymentService.createStripeSubscription({
				customerId,
				priceId: stripePriceId,
				paymentMethodId,
				trialDays: plan.trialDays,
			});

			// Build subscription data using utility function
			const subscriptionData = buildSubscriptionData({
				userId,
				planId: plan.id,
				stripeSubscription: providerSubscription,
				billingCycle,
				amount,
				customerId,
			});

			// Add additional metadata
			const subscriptionWithMetadata = {
				...subscriptionData,
				metadata: {
					...subscriptionData.metadata,
					createdAt: new Date().toISOString(),
				},
			};

			// Save to database
			const subscription = this.userSubscriptionRepository.create(subscriptionWithMetadata);
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
			// Resolve Stripe price ID for the new plan
			const newStripePriceId = resolveStripePriceId(newPlan, currentSubscription.billingCycle);

			const stripeSubscriptionId = currentSubscription.metadata?.stripeSubscriptionId as string;

			if (stripeSubscriptionId) {
				await this.stripePaymentService.updateSubscription(stripeSubscriptionId, {
					priceId: newStripePriceId,
				});
			}

			// Update subscription record
			currentSubscription.planId = newPlan.id;
			currentSubscription.amount = calculatePlanAmount(newPlan, currentSubscription.billingCycle);

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
				await this.stripePaymentService.cancelSubscription(stripeSubscriptionId, cancelAtPeriodEnd);
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

		// Resolve Stripe price ID
		const stripePriceId = resolveStripePriceId(plan, billingCycle);

		// Create or get Stripe customer
		const customerId = await this.stripePaymentService.getOrCreateStripeCustomer(userId, userEmail);

		// Create setup intent for collecting payment method
		const setupIntent = await this.stripePaymentService.createSetupIntent({
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
			amount: calculatePlanAmount(plan, billingCycle),
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

		// Resolve Stripe price ID
		const stripePriceId = resolveStripePriceId(plan, billingCycle);

		try {
			// Get or create Stripe customer
			const customerId = await this.stripePaymentService.getOrCreateStripeCustomer(userId, '');

			// Attach payment method to customer
			await this.stripePaymentService.attachPaymentMethod(paymentMethodId, customerId);

			// Create recurring subscription in Stripe
			const stripeSubscription = await this.stripePaymentService.createStripeSubscription({
				customerId,
				priceId: stripePriceId,
				paymentMethodId,
				trialDays: plan.trialDays || undefined,
				metadata: {
					userId,
					planId,
				},
			});

			// Calculate amount and build subscription data
			const amount = calculatePlanAmount(plan, billingCycle);
			const subscriptionData = buildSubscriptionData({
				userId,
				planId: plan.id,
				stripeSubscription,
				billingCycle,
				amount,
				customerId,
			});

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

	async createPaymentLinkForPlan(params: {
		planId: string;
		billingCycle: 'monthly' | 'yearly';
		userId: string;
	}): Promise<{ paymentLinkId: string; url: string }> {
		const plan = await this.getPlanById(params.planId);
		if (!plan) {
			throw new Error('Plan not found');
		}

		// Resolve Stripe price ID
		const stripePriceId = resolveStripePriceId(plan, params.billingCycle);
		const baseUrl = getCheckoutBaseUrl(this.subscriptionConfig.stripeCheckoutBaseUrl);

		// Create payment link using Stripe service
		const paymentLink = await this.stripePaymentService.createPaymentLink({
			priceId: stripePriceId,
			successUrl: `${baseUrl}/success`,
			trialDays: plan.trialDays || 0,
			allowPromotionCodes: true,
			collectBillingAddress: true,
			metadata: {
				planId: params.planId,
				billingCycle: params.billingCycle,
				userId: params.userId,
				planName: plan.name,
			},
		});

		this.logger.info(`Payment link created for plan ${params.planId}`, {
			paymentLinkId: paymentLink.id,
			userId: params.userId,
			billingCycle: params.billingCycle,
		});

		return {
			paymentLinkId: paymentLink.id,
			url: paymentLink.url,
		};
	}

	async createCheckoutSession(params: {
		priceId: string;
		userId?: string;
		planId?: string;
		billingCycle?: 'monthly' | 'yearly';
	}): Promise<{ id: string; url: string }> {
		return await this.stripePaymentService.createCheckoutSession({
			priceId: params.priceId,
			userId: params.userId,
			planId: params.planId,
			billingCycle: params.billingCycle,
		});
	}

	async handleWebhook(provider: string, payload: any, signature: string) {
		try {
			// Verify and parse webhook
			const webhookData = await this.stripePaymentService.handleWebhook(payload, signature);

			this.logger.info(`Processing ${provider} webhook`, {
				type: webhookData.type,
			});

			// Handle different Stripe webhook events
			switch (webhookData.type) {
				case 'checkout.session.completed':
					await this.handleCheckoutSessionCompleted(webhookData.data.object);
					break;
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

	private async handleCheckoutSessionCompleted(session: any): Promise<void> {
		const userId = session.metadata?.userId;
		const planId = session.metadata?.planId;
		const billingCycle = session.metadata?.billingCycle;

		if (!userId || !planId || !billingCycle) {
			this.logger.warn('Missing metadata in checkout session', { sessionId: session.id });
			return;
		}

		// Check if user already has a subscription
		const existingSubscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
		if (existingSubscription) {
			this.logger.warn('User already has an active subscription', {
				userId,
				sessionId: session.id,
			});
			return;
		}

		this.logger.info('Checkout session completed', {
			userId,
			planId,
			billingCycle,
			sessionId: session.id,
		});
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
