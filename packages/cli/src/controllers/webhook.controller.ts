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

	@Post('/adyen', { skipAuth: true })
	async handleAdyenWebhook(req: WebhookRequest.AdyenWebhook, res: Response) {
		const signature = req.headers['x-adyen-hmac-signature'] as string;
		const payload = req.body;

		if (!signature) {
			this.logger.warn('Adyen webhook received without signature');
			return res.status(400).json({ error: 'Missing signature' });
		}

		try {
			this.logger.info('Processing Adyen webhook', {
				eventCode: payload.eventCode,
				pspReference: payload.pspReference,
			});

			const result = await this.subscriptionService.handleWebhook('adyen', payload, signature);

			this.logger.info('Adyen webhook processed successfully', {
				eventCode: payload.eventCode,
				pspReference: payload.pspReference,
			});

			return res.json(result);
		} catch (error) {
			this.logger.error('Failed to process Adyen webhook', {
				error: error.message,
				eventCode: payload.eventCode,
				pspReference: payload.pspReference,
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
