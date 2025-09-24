import { z } from 'zod';

export const adyenWebhookRequestSchema = z.object({
	eventCode: z.string(),
	pspReference: z.string(),
	merchantReference: z.string().optional(),
	amount: z
		.object({
			value: z.number(),
			currency: z.string(),
		})
		.optional(),
	success: z.boolean().optional(),
	reason: z.string().optional(),
	additionalData: z.record(z.string()).optional(),
});

export type AdyenWebhookRequestDto = z.infer<typeof adyenWebhookRequestSchema>;
