import { z } from 'zod';

export const subscriptionEventRequestSchema = z.object({
	eventType: z.enum([
		'subscription.created',
		'subscription.updated',
		'subscription.canceled',
		'payment.succeeded',
		'payment.failed',
	]),
	data: z.object({
		id: z.string(),
		subscriptionId: z.string().optional(),
	}),
});

export type SubscriptionEventRequestDto = z.infer<typeof subscriptionEventRequestSchema>;
