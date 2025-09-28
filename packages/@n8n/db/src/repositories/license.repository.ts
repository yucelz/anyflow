import { Service } from '@n8n/di';
import { DataSource, Repository, FindOptionsWhere, Between, In } from '@n8n/typeorm';
import {
	LicenseEntity,
	LicenseStatus,
	LicenseType,
	ApprovalStatus,
} from '../entities/license.entity';

export interface LicenseFilters {
	status?: LicenseStatus | LicenseStatus[];
	licenseType?: LicenseType | LicenseType[];
	approvalStatus?: ApprovalStatus | ApprovalStatus[];
	issuedTo?: string;
	issuedBy?: string;
	validFrom?: Date;
	validUntil?: Date;
	subscriptionId?: string;
}

@Service()
export class LicenseRepository extends Repository<LicenseEntity> {
	constructor(dataSource: DataSource) {
		super(LicenseEntity, dataSource.manager);
	}

	async findByLicenseKey(licenseKey: string): Promise<LicenseEntity | null> {
		return await this.findOne({
			where: { licenseKey },
			relations: ['issuedToUser', 'issuedByUser', 'approvedByUser', 'subscription'],
		});
	}

	async findByUserId(userId: string): Promise<LicenseEntity[]> {
		return await this.find({
			where: { issuedTo: userId },
			relations: ['issuedByUser', 'approvedByUser', 'subscription'],
			order: { createdAt: 'DESC' },
		});
	}

	async findActiveLicenses(): Promise<LicenseEntity[]> {
		const now = new Date();
		return await this.find({
			where: {
				status: 'active',
				approvalStatus: 'approved',
				validFrom: Between(new Date(0), now),
				validUntil: Between(now, new Date('2099-12-31')),
			},
			relations: ['issuedToUser', 'subscription'],
		});
	}

	async findExpiredLicenses(): Promise<LicenseEntity[]> {
		const now = new Date();
		return await this.find({
			where: {
				status: In(['active', 'pending']),
				validUntil: Between(new Date(0), now),
			},
			relations: ['issuedToUser'],
		});
	}

	async findPendingApprovals(): Promise<LicenseEntity[]> {
		return await this.find({
			where: { approvalStatus: 'pending' },
			relations: ['issuedToUser', 'issuedByUser'],
			order: { createdAt: 'ASC' },
		});
	}

	async findWithFilters(filters: LicenseFilters): Promise<LicenseEntity[]> {
		const where: FindOptionsWhere<LicenseEntity> = {};

		if (filters.status) {
			where.status = Array.isArray(filters.status) ? In(filters.status) : filters.status;
		}

		if (filters.licenseType) {
			where.licenseType = Array.isArray(filters.licenseType)
				? In(filters.licenseType)
				: filters.licenseType;
		}

		if (filters.approvalStatus) {
			where.approvalStatus = Array.isArray(filters.approvalStatus)
				? In(filters.approvalStatus)
				: filters.approvalStatus;
		}

		if (filters.issuedTo) {
			where.issuedTo = filters.issuedTo;
		}

		if (filters.issuedBy) {
			where.issuedBy = filters.issuedBy;
		}

		if (filters.subscriptionId) {
			where.subscriptionId = filters.subscriptionId;
		}

		if (filters.validFrom && filters.validUntil) {
			where.validFrom = Between(filters.validFrom, filters.validUntil);
		}

		return await this.find({
			where,
			relations: ['issuedToUser', 'issuedByUser', 'approvedByUser', 'subscription'],
			order: { createdAt: 'DESC' },
		});
	}

	async countByStatus(status: LicenseStatus): Promise<number> {
		return await this.count({ where: { status } });
	}

	async countByType(licenseType: LicenseType): Promise<number> {
		return await this.count({ where: { licenseType } });
	}

	async findBySubscriptionId(subscriptionId: string): Promise<LicenseEntity[]> {
		return await this.find({
			where: { subscriptionId },
			relations: ['issuedToUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async updateStatus(licenseId: string, status: LicenseStatus): Promise<void> {
		await this.update(licenseId, { status, updatedAt: new Date() });
	}

	async updateApprovalStatus(
		licenseId: string,
		approvalStatus: ApprovalStatus,
		approvedBy?: string,
		rejectionReason?: string,
	): Promise<void> {
		const updateData: Partial<LicenseEntity> = {
			approvalStatus,
			updatedAt: new Date(),
		};

		if (approvalStatus === 'approved' && approvedBy) {
			updateData.approvedBy = approvedBy;
			updateData.approvedAt = new Date();
		}

		if (approvalStatus === 'rejected' && rejectionReason) {
			updateData.rejectionReason = rejectionReason;
		}

		await this.update(licenseId, updateData);
	}
}
