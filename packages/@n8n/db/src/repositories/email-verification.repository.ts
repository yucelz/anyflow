import { Service } from '@n8n/di';
import type { EntityManager } from '@n8n/typeorm';
import { DataSource, Repository, LessThan } from '@n8n/typeorm';

import { EmailVerification } from '../entities/email-verification';

@Service()
export class EmailVerificationRepository extends Repository<EmailVerification> {
	constructor(dataSource: DataSource) {
		super(EmailVerification, dataSource.manager);
	}

	/**
	 * Find the most recent valid verification for an email
	 */
	async findValidVerificationByEmail(email: string): Promise<EmailVerification | null> {
		return await this.findOne({
			where: {
				email: email.toLowerCase(),
				isUsed: false,
			},
			order: {
				createdAt: 'DESC',
			},
		});
	}

	/**
	 * Find verification by email and code
	 */
	async findByEmailAndCode(email: string, code: string): Promise<EmailVerification | null> {
		return await this.findOne({
			where: {
				email: email.toLowerCase(),
				code,
				isUsed: false,
			},
		});
	}

	/**
	 * Create a new verification record
	 */
	async createVerification(
		email: string,
		code: string,
		expiresAt: Date,
		transactionManager?: EntityManager,
	): Promise<EmailVerification> {
		const verification = this.create({
			email: email.toLowerCase(),
			code,
			expiresAt,
		});

		if (transactionManager) {
			return await transactionManager.save(EmailVerification, verification);
		}

		return await this.save(verification);
	}

	/**
	 * Mark all previous verifications for an email as used
	 */
	async invalidatePreviousVerifications(
		email: string,
		transactionManager?: EntityManager,
	): Promise<void> {
		const updateData = { isUsed: true };
		const whereCondition = {
			email: email.toLowerCase(),
			isUsed: false,
		};

		if (transactionManager) {
			await transactionManager.update(EmailVerification, whereCondition, updateData);
		} else {
			await this.update(whereCondition, updateData);
		}
	}

	/**
	 * Clean up expired verification codes
	 */
	async cleanupExpiredVerifications(): Promise<number> {
		const result = await this.delete({
			expiresAt: LessThan(new Date()),
		});

		return result.affected || 0;
	}

	/**
	 * Count verification attempts for an email in the last hour
	 */
	async countRecentAttempts(email: string, withinMinutes: number = 60): Promise<number> {
		const since = new Date(Date.now() - withinMinutes * 60 * 1000);

		return await this.count({
			where: {
				email: email.toLowerCase(),
				createdAt: LessThan(since),
			},
		});
	}

	/**
	 * Check if email has been verified recently
	 */
	async hasRecentVerification(email: string, withinMinutes: number = 10): Promise<boolean> {
		const since = new Date(Date.now() - withinMinutes * 60 * 1000);

		const count = await this.count({
			where: {
				email: email.toLowerCase(),
				verifiedAt: LessThan(since),
			},
		});

		return count > 0;
	}
}
