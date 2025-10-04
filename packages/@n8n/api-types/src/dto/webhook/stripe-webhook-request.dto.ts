import { z } from 'zod';

export const stripeWebhookRequestSchema = z.object({
	id: z.string(),
	object: z.literal('event'),
	api_version: z.string(),
	created: z.number(),
	data: z.object({
		object: z.any(),
		previous_attributes: z.any().optional(),
	}),
	livemode: z.boolean(),
	pending_webhooks: z.number(),
	request: z
		.object({
			id: z.string().nullable(),
			idempotency_key: z.string().nullable(),
		})
		.nullable(),
	type: z.string(),
});

export type StripeWebhookRequestDto = z.infer<typeof stripeWebhookRequestSchema>;
