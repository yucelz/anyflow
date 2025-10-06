import { Request, Response } from 'express';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, Post, Put, Delete, RestController } from '@n8n/decorators';
import { SubscriptionRequest } from '@/requests';
import { SubscriptionService } from '@/services/subscription.service';
import { Logger } from '@n8n/backend-common';

// Custom error types for better error handling
class ValidationError extends Error {
	constructor(
		message: string,
		public field?: string,
	) {
		super(message);
		this.name = 'ValidationError';
	}
}

class BusinessLogicError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BusinessLogicError';
	}
}

class PaymentError extends Error {
	constructor(
		message: string,
		public code?: string,
	) {
		super(message);
		this.name = 'PaymentError';
	}
}

@RestController('/subscriptions')
export class SubscriptionController {
	constructor(
		private subscriptionService: SubscriptionService,
		private logger: Logger,
	) {}

	private handleError(
		error: any,
		operation: string,
	): { status: number; message: string; code?: string } {
		this.logger.error(`SubscriptionController.${operation} failed:`, {
			error: error.message,
			stack: error.stack,
			name: error.name,
		});

		if (error instanceof ValidationError) {
			return {
				status: 400,
				message: error.message,
				code: 'VALIDATION_ERROR',
			};
		}

		if (error instanceof BusinessLogicError) {
			return {
				status: 409,
				message: error.message,
				code: 'BUSINESS_LOGIC_ERROR',
			};
		}

		if (error instanceof PaymentError) {
			return {
				status: 402,
				message: error.message,
				code: error.code || 'PAYMENT_ERROR',
			};
		}

		// Handle specific known error messages
		if (error.message?.includes('not found')) {
			return {
				status: 404,
				message: error.message,
				code: 'RESOURCE_NOT_FOUND',
			};
		}

		if (error.message?.includes('already has an active subscription')) {
			return {
				status: 409,
				message: error.message,
				code: 'SUBSCRIPTION_ALREADY_EXISTS',
			};
		}

		if (error.message?.includes('payment') || error.message?.includes('stripe')) {
			return {
				status: 402,
				message: 'Payment processing failed',
				code: 'PAYMENT_PROCESSING_ERROR',
			};
		}

		// Default server error
		return {
			status: 500,
			message: 'Internal server error',
			code: 'INTERNAL_SERVER_ERROR',
		};
	}

	@Get('/plans')
	async getPlans(_req: AuthenticatedRequest, res: Response) {
		try {
			const plans = await this.subscriptionService.getAvailablePlans();
			// Ensure we always return an array, never null, wrapped in data key as expected by frontend
			return res.json({ data: plans || [] });
		} catch (error) {
			this.logger.warn('Non-critical error fetching subscription plans:', error);
			// Return empty array on error to prevent frontend null iteration errors
			return res.status(200).json({ data: [] });
		}
	}

	@Post('/subscribe')
	async createSubscription(req: SubscriptionRequest.Create, res: Response) {
		const { planSlug, billingCycle, paymentMethodId } = req.body;
		const userId = req.user.id;
		const userEmail = req.user.email;
		const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

		// Input validation
		if (!planSlug) {
			const errorDetails = this.handleError(
				new ValidationError('Plan slug is required', 'planSlug'),
				'createSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
			const errorDetails = this.handleError(
				new ValidationError('Invalid billing cycle. Must be monthly or yearly', 'billingCycle'),
				'createSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		if (!userEmail) {
			const errorDetails = this.handleError(
				new ValidationError('User email is required', 'userEmail'),
				'createSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			const subscription = await this.subscriptionService.createSubscription({
				userId,
				planSlug,
				billingCycle,
				paymentMethodId,
				userEmail,
				userName,
			});

			this.logger.info(`Subscription created successfully for user ${userId}`, {
				planSlug,
				billingCycle,
				subscriptionId: Array.isArray(subscription) ? subscription[0]?.id : subscription.id,
			});

			return res.json(subscription);
		} catch (error) {
			const errorDetails = this.handleError(error, 'createSubscription');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Get('/current')
	async getCurrentSubscription(req: AuthenticatedRequest, res: Response) {
		const userId = req.user.id;

		try {
			const subscription = await this.subscriptionService.getCurrentSubscription(userId);
			// Return null explicitly if no subscription found (frontend handles this)
			return res.json(subscription || null);
		} catch (error) {
			this.logger.warn('Non-critical error fetching current subscription:', error);
			// Return null instead of error to prevent frontend crashes
			return res.status(200).json(null);
		}
	}

	@Put('/:id/upgrade')
	async upgradeSubscription(req: SubscriptionRequest.Upgrade, res: Response) {
		const { planSlug } = req.body;
		const userId = req.user.id;

		// Input validation
		if (!planSlug) {
			const errorDetails = this.handleError(
				new ValidationError('Plan slug is required', 'planSlug'),
				'upgradeSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			const subscription = await this.subscriptionService.upgradeSubscription(userId, planSlug);

			this.logger.info(`Subscription upgraded successfully for user ${userId}`, {
				planSlug,
				subscriptionId: subscription.id,
			});

			return res.json(subscription);
		} catch (error) {
			const errorDetails = this.handleError(error, 'upgradeSubscription');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Delete('/:id')
	async cancelSubscription(req: SubscriptionRequest.Cancel, res: Response) {
		const { cancelAtPeriodEnd = true } = req.body;
		const userId = req.user.id;

		try {
			const subscription = await this.subscriptionService.cancelSubscription(
				userId,
				cancelAtPeriodEnd,
			);

			this.logger.info(`Subscription canceled successfully for user ${userId}`, {
				subscriptionId: subscription.id,
				cancelAtPeriodEnd,
			});

			return res.json(subscription);
		} catch (error) {
			const errorDetails = this.handleError(error, 'cancelSubscription');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Get('/usage')
	async getUsageLimits(req: AuthenticatedRequest, res: Response) {
		const userId = req.user.id;

		try {
			const usage = await this.subscriptionService.getUsageLimits(userId);
			return res.json(usage);
		} catch (error) {
			const errorDetails = this.handleError(error, 'getUsageLimits');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Post('/create-setup')
	async createSubscriptionSetup(req: SubscriptionRequest.CreateSetup, res: Response) {
		const { planId, billingCycle } = req.body;
		const userId = req.user.id;
		const userEmail = req.user.email;

		// Input validation
		if (!planId) {
			const errorDetails = this.handleError(
				new ValidationError('Plan ID is required', 'planId'),
				'createSubscriptionSetup',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
			const errorDetails = this.handleError(
				new ValidationError('Invalid billing cycle. Must be monthly or yearly', 'billingCycle'),
				'createSubscriptionSetup',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			const setup = await this.subscriptionService.createSubscriptionSetup({
				userId,
				planId,
				billingCycle,
				userEmail,
			});

			this.logger.info(`Subscription setup created successfully for user ${userId}`, {
				planId,
				billingCycle,
			});

			return res.json(setup);
		} catch (error) {
			const errorDetails = this.handleError(error, 'createSubscriptionSetup');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Post('/create-recurring')
	async createRecurringSubscription(req: SubscriptionRequest.CreateRecurring, res: Response) {
		const { planId, billingCycle, paymentMethodId } = req.body;
		const userId = req.user.id;

		// Input validation
		if (!planId) {
			const errorDetails = this.handleError(
				new ValidationError('Plan ID is required', 'planId'),
				'createRecurringSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
			const errorDetails = this.handleError(
				new ValidationError('Invalid billing cycle. Must be monthly or yearly', 'billingCycle'),
				'createRecurringSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		if (!paymentMethodId) {
			const errorDetails = this.handleError(
				new ValidationError('Payment method ID is required', 'paymentMethodId'),
				'createRecurringSubscription',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			const subscription = await this.subscriptionService.createRecurringSubscription({
				userId,
				planId,
				billingCycle,
				paymentMethodId,
			});

			this.logger.info(`Recurring subscription created successfully for user ${userId}`, {
				planId,
				billingCycle,
				subscriptionId: subscription.id,
			});

			return res.json(subscription);
		} catch (error) {
			const errorDetails = this.handleError(error, 'createRecurringSubscription');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Get('/plans/:id')
	async getPlanById(req: AuthenticatedRequest<{ id: string }>, res: Response) {
		const { id } = req.params;

		if (!id) {
			const errorDetails = this.handleError(
				new ValidationError('Plan ID is required', 'id'),
				'getPlanById',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			const plan = await this.subscriptionService.getPlanById(id);
			if (!plan) {
				const errorDetails = this.handleError(
					new BusinessLogicError('Plan not found'),
					'getPlanById',
				);
				return res.status(errorDetails.status).json({
					error: errorDetails.message,
					code: errorDetails.code,
				});
			}
			return res.json(plan);
		} catch (error) {
			const errorDetails = this.handleError(error, 'getPlanById');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}

	@Post('/webhooks/stripe')
	async handleStripeWebhook(req: Request, res: Response) {
		const signature = req.headers['stripe-signature'] as string;
		const payload = req.body;

		if (!signature) {
			const errorDetails = this.handleError(
				new ValidationError('Stripe signature is required', 'stripe-signature'),
				'handleStripeWebhook',
			);
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}

		try {
			await this.subscriptionService.handleWebhook('stripe', payload, signature);

			this.logger.info('Stripe webhook processed successfully');

			return res.json({ received: true });
		} catch (error) {
			const errorDetails = this.handleError(error, 'handleStripeWebhook');
			return res.status(errorDetails.status).json({
				error: errorDetails.message,
				code: errorDetails.code,
			});
		}
	}
}
