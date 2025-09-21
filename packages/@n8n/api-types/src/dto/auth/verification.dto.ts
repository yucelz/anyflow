import { z } from 'zod';
import { Z } from 'zod-class';

export class SendVerificationEmailRequestDto extends Z.class({
	email: z.string().email().trim(),
}) {}

export class VerifyEmailCodeRequestDto extends Z.class({
	email: z.string().email().trim(),
	code: z.string().length(6),
}) {}
