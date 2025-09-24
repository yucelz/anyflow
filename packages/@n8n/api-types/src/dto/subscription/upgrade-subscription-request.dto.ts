import { z } from 'zod';

export const upgradeSubscriptionRequestSchema = z.object({
	planSlug: z.string().min(1, 'Plan slug is required'),
});

export type UpgradeSubscriptionRequestDto = z.infer<typeof upgradeSubscriptionRequestSchema>;
