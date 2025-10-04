import { Response } from 'express';
import { Logger } from '@n8n/backend-common';
import { Post, RestController } from '@n8n/decorators';
import { WebhookRequest } from '@/requests';
import { SubscriptionService } from '@/services/subscription.service';

@RestController('/webhooks')
export class WebhookController {
	constructor(
		private subscriptionService: SubscriptionService,
		private logger: Logger,
	) {}

	@Post('/stripe', { skipAuth: true })
	async handleStripeWebhook(req: WebhookRequest.StripeWebhook, res: Response) {
		const signature = req.headers['stripe-signature'] as string;
		const payload = req.body;

		if (!signature) {
			this.logger.warn('Stripe webhook received without signature');
			return res.status(400).json({ error: 'Missing signature' });
		}

		try {
			this.logger.info('Processing Stripe webhook', {
				eventType: payload.type,
				eventId: payload.id,
			});

			const result = await this.subscriptionService.handleWebhook('stripe', payload, signature);

			this.logger.info('Stripe webhook processed successfully', {
				eventType: payload.type,
				eventId: payload.id,
			});

			return res.json({ received: true });
		} catch (error) {
			this.logger.error('Failed to process Stripe webhook', {
				error: error.message,
				eventType: payload.type,
				eventId: payload.id,
			});

			return res.status(400).json({ error: 'Webhook processing failed' });
		}
	}

	@Post('/subscription-events', { skipAuth: true })
	async handleSubscriptionEvents(req: WebhookRequest.SubscriptionEvent, res: Response) {
		const { eventType, data } = req.body;

		try {
			this.logger.info('Processing subscription event', { eventType, data });

			// Handle internal subscription events
			switch (eventType) {
				case 'subscription.created':
					this.logger.info('Subscription created', { subscriptionId: data.id });
					break;
				case 'subscription.updated':
					this.logger.info('Subscription updated', { subscriptionId: data.id });
					break;
				case 'subscription.canceled':
					this.logger.info('Subscription canceled', { subscriptionId: data.id });
					break;
				case 'payment.succeeded':
					this.logger.info('Payment succeeded', { subscriptionId: data.subscriptionId });
					break;
				case 'payment.failed':
					this.logger.warn('Payment failed', { subscriptionId: data.subscriptionId });
					break;
				default:
					this.logger.info('Unhandled subscription event', { eventType });
			}

			return res.json({ success: true });
		} catch (error) {
			this.logger.error('Failed to process subscription event', {
				error: error.message,
				eventType,
			});

			return res.status(500).json({ error: 'Event processing failed' });
		}
	}
}
