import { Request, Response } from 'express';
import { Post, RestController } from '@n8n/decorators';
import { SubscriptionService } from '@/services/subscription.service';
import { Logger } from '@n8n/backend-common';

@RestController('/')
export class WebhookController {
	constructor(
		private subscriptionService: SubscriptionService,
		private logger: Logger,
	) {}

	@Post('/webhook')
	async handleStripeWebhook(req: Request, res: Response) {
		const signature = req.headers['stripe-signature'] as string;
		const payload = req.body;

		if (!signature) {
			this.logger.error('⚠️ Webhook signature verification failed: Missing signature');
			return res.status(400).send('Webhook Error: Missing signature');
		}

		try {
			await this.subscriptionService.handleWebhook('stripe', payload, signature);

			this.logger.info('✅ Stripe webhook processed successfully');

			return res.json({ received: true });
		} catch (error) {
			this.logger.error('⚠️ Webhook signature verification failed:', error);
			return res
				.status(400)
				.send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
