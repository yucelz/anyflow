import { z } from 'zod';

export const cancelSubscriptionRequestSchema = z.object({
	cancelAtPeriodEnd: z.boolean().optional().default(true),
});

export type CancelSubscriptionRequestDto = z.infer<typeof cancelSubscriptionRequestSchema>;
