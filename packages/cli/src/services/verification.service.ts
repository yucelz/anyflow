import { Logger } from '@n8n/backend-common';
import { EmailVerificationRepository } from '@n8n/db';
import { Service } from '@n8n/di';
import { randomBytes } from 'crypto';

import { UserManagementMailer } from '@/user-management/email';

@Service()
export class VerificationService {
	constructor(
		private readonly logger: Logger,
		private readonly mailer: UserManagementMailer,
		private readonly emailVerificationRepository: EmailVerificationRepository,
	) {
		// Clean up expired codes every 5 minutes
		setInterval(
			() => {
				void this.cleanupExpiredCodes();
			},
			5 * 60 * 1000,
		);
	}

	/**
	 * Generate a secure 6-digit verification code
	 */
	private generateCode(): string {
		// Use crypto.randomBytes for secure random generation
		const buffer = randomBytes(3);
		const num = buffer.readUIntBE(0, 3) % 900000;
		return (100000 + num).toString();
	}

	/**
	 * Check rate limiting for verification email requests
	 */
	private async checkRateLimit(email: string): Promise<void> {
		const recentAttempts = await this.emailVerificationRepository.countRecentAttempts(email, 60);

		if (recentAttempts >= 5) {
			throw new Error('Too many verification attempts. Please try again later.');
		}

		// Check if there's a recent verification (within 2 minutes)
		const hasRecent = await this.emailVerificationRepository.hasRecentVerification(email, 2);
		if (hasRecent) {
			throw new Error(
				'Verification email was sent recently. Please wait before requesting another.',
			);
		}
	}

	/**
	 * Send verification email with 6-digit code
	 */
	async sendVerificationEmail(email: string): Promise<void> {
		if (!this.mailer.isEmailSetUp) {
			this.logger.warn('Email is not set up, cannot send verification code');
			throw new Error('Email service is not configured');
		}

		// Check rate limiting
		await this.checkRateLimit(email);

		const code = this.generateCode();
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes expiry

		try {
			// Invalidate any previous verification codes for this email
			await this.emailVerificationRepository.invalidatePreviousVerifications(email);

			// Store the new verification code in database
			await this.emailVerificationRepository.createVerification(email, code, expiresAt);

			// Send email with verification code
			const template = await this.mailer.getTemplate('verification-code');
			await this.mailer.mailer?.sendMail({
				emailRecipients: email,
				subject: 'Your n8n verification code',
				body: template({
					...this.mailer['basePayload'],
					email,
					verificationCode: code,
				}),
			});

			this.logger.info('Verification code sent successfully', { email });
		} catch (error) {
			this.logger.error('Failed to send verification email', { email, error: error.message });
			throw new Error('Failed to send verification email');
		}
	}

	/**
	 * Verify the provided code against stored code
	 */
	async verifyCode(email: string, providedCode: string): Promise<boolean> {
		try {
			const verification = await this.emailVerificationRepository.findByEmailAndCode(
				email,
				providedCode,
			);

			if (!verification) {
				this.logger.debug('No verification code found for email and code', { email });
				return false;
			}

			// Check if verification is still valid
			if (!verification.isValid) {
				this.logger.debug('Verification code is invalid or expired', {
					email,
					isExpired: verification.isExpired,
					isUsed: verification.isUsed,
					attempts: verification.attempts,
					maxAttempts: verification.maxAttempts,
				});

				// Increment attempts if not expired
				if (!verification.isExpired) {
					verification.incrementAttempts();
					await this.emailVerificationRepository.save(verification);
				}

				return false;
			}

			// Code is valid, mark it as used
			verification.markAsUsed();
			await this.emailVerificationRepository.save(verification);

			this.logger.info('Verification code verified successfully', { email });
			return true;
		} catch (error) {
			this.logger.error('Error verifying code', { email, error: error.message });
			return false;
		}
	}

	/**
	 * Clean up expired verification codes from database
	 */
	private async cleanupExpiredCodes(): Promise<void> {
		try {
			const cleanedCount = await this.emailVerificationRepository.cleanupExpiredVerifications();

			if (cleanedCount > 0) {
				this.logger.debug(`Cleaned up ${cleanedCount} expired verification codes`);
			}
		} catch (error) {
			this.logger.error('Error cleaning up expired verification codes', { error: error.message });
		}
	}

	/**
	 * Check if a verification code exists for an email (for testing purposes)
	 */
	async hasVerificationCode(email: string): Promise<boolean> {
		try {
			const verification =
				await this.emailVerificationRepository.findValidVerificationByEmail(email);
			return verification !== null && verification.isValid;
		} catch (error) {
			this.logger.error('Error checking verification code existence', {
				email,
				error: error.message,
			});
			return false;
		}
	}

	/**
	 * Check if an email has been recently verified
	 */
	async isEmailRecentlyVerified(email: string, withinMinutes: number = 10): Promise<boolean> {
		try {
			return await this.emailVerificationRepository.hasRecentVerification(email, withinMinutes);
		} catch (error) {
			this.logger.error('Error checking recent verification', { email, error: error.message });
			return false;
		}
	}
}
