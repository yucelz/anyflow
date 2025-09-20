import { z } from 'zod';
import { Z } from 'zod-class';

export class CloudSignupRequestDto extends Z.class({
	firstName: z.string().trim().min(1).max(32),
	lastName: z.string().trim().min(1).max(32),
	email: z.string().email().trim(),
	password: z.string().min(8),
	agree: z.boolean().optional(),
}) {}
