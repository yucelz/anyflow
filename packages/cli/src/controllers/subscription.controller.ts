import { Response } from 'express';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, Post, Put, Delete, RestController } from '@n8n/decorators';
import { SubscriptionRequest } from '@/requests';
import { SubscriptionService } from '@/services/subscription.service';

@RestController('/subscriptions')
export class SubscriptionController {
	constructor(private subscriptionService: SubscriptionService) {}

	@Get('/plans')
	async getPlans(_req: AuthenticatedRequest, res: Response) {
		try {
			const plans = await this.subscriptionService.getAvailablePlans();
			return res.json(plans);
		} catch (error) {
			return res.status(500).json({ error: 'Failed to fetch subscription plans' });
		}
	}

	@Post('/subscribe')
	async createSubscription(req: SubscriptionRequest.Create, res: Response) {
		const { planSlug, billingCycle, paymentMethodId } = req.body;
		const userId = req.user.id;
		const userEmail = req.user.email;
		const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

		try {
			const subscription = await this.subscriptionService.createSubscription({
				userId,
				planSlug,
				billingCycle,
				paymentMethodId,
				userEmail,
				userName,
			});

			return res.json(subscription);
		} catch (error) {
			return res.status(400).json({ error: error.message });
		}
	}

	@Get('/current')
	async getCurrentSubscription(req: AuthenticatedRequest, res: Response) {
		const userId = req.user.id;

		try {
			const subscription = await this.subscriptionService.getCurrentSubscription(userId);
			return res.json(subscription);
		} catch (error) {
			return res.status(500).json({ error: 'Failed to fetch current subscription' });
		}
	}

	@Put('/:id/upgrade')
	async upgradeSubscription(req: SubscriptionRequest.Upgrade, res: Response) {
		const { planSlug } = req.body;
		const userId = req.user.id;

		try {
			const subscription = await this.subscriptionService.upgradeSubscription(userId, planSlug);
			return res.json(subscription);
		} catch (error) {
			return res.status(400).json({ error: error.message });
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
			return res.json(subscription);
		} catch (error) {
			return res.status(400).json({ error: error.message });
		}
	}

	@Get('/usage')
	async getUsageLimits(req: AuthenticatedRequest, res: Response) {
		const userId = req.user.id;

		try {
			const usage = await this.subscriptionService.getUsageLimits(userId);
			return res.json(usage);
		} catch (error) {
			return res.status(500).json({ error: 'Failed to fetch usage limits' });
		}
	}
}
