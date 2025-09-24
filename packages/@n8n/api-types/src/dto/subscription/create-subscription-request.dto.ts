import { z } from 'zod';

export const createSubscriptionRequestSchema = z.object({
	planSlug: z.string().min(1, 'Plan slug is required'),
	billingCycle: z.enum(['monthly', 'yearly']),
	paymentMethodId: z.string().optional(),
});

export type CreateSubscriptionRequestDto = z.infer<typeof createSubscriptionRequestSchema>;
