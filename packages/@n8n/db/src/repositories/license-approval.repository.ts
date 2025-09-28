import { Service } from '@n8n/di';
import { DataSource, Repository, FindOptionsWhere, LessThan, In } from '@n8n/typeorm';
import {
	LicenseApprovalEntity,
	ApprovalType,
	ApprovalStatus,
	ApprovalPriority,
} from '../entities/license-approval.entity';

export interface ApprovalFilters {
	status?: ApprovalStatus | ApprovalStatus[];
	approvalType?: ApprovalType | ApprovalType[];
	priority?: ApprovalPriority | ApprovalPriority[];
	requestedBy?: string;
	licenseId?: string;
	expiresAfter?: Date;
	expiresBefore?: Date;
}

@Service()
export class LicenseApprovalRepository extends Repository<LicenseApprovalEntity> {
	constructor(dataSource: DataSource) {
		super(LicenseApprovalEntity, dataSource.manager);
	}

	async findPendingApprovals(): Promise<LicenseApprovalEntity[]> {
		return await this.find({
			where: { status: 'pending' },
			relations: ['license', 'requestedByUser'],
			order: { priority: 'DESC', createdAt: 'ASC' },
		});
	}

	async findByLicenseId(licenseId: string): Promise<LicenseApprovalEntity[]> {
		return await this.find({
			where: { licenseId },
			relations: ['requestedByUser', 'approvedByUser', 'rejectedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findByRequestedBy(userId: string): Promise<LicenseApprovalEntity[]> {
		return await this.find({
			where: { requestedBy: userId },
			relations: ['license', 'approvedByUser', 'rejectedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findExpiredApprovals(): Promise<LicenseApprovalEntity[]> {
		const now = new Date();
		return await this.find({
			where: {
				status: 'pending',
				expiresAt: LessThan(now),
			},
			relations: ['license', 'requestedByUser'],
		});
	}

	async findWithFilters(filters: ApprovalFilters): Promise<LicenseApprovalEntity[]> {
		const where: FindOptionsWhere<LicenseApprovalEntity> = {};

		if (filters.status) {
			where.status = Array.isArray(filters.status) ? In(filters.status) : filters.status;
		}

		if (filters.approvalType) {
			where.approvalType = Array.isArray(filters.approvalType)
				? In(filters.approvalType)
				: filters.approvalType;
		}

		if (filters.priority) {
			where.priority = Array.isArray(filters.priority) ? In(filters.priority) : filters.priority;
		}

		if (filters.requestedBy) {
			where.requestedBy = filters.requestedBy;
		}

		if (filters.licenseId) {
			where.licenseId = filters.licenseId;
		}

		if (filters.expiresBefore) {
			where.expiresAt = LessThan(filters.expiresBefore);
		}

		return await this.find({
			where,
			relations: ['license', 'requestedByUser', 'approvedByUser', 'rejectedByUser'],
			order: { priority: 'DESC', createdAt: 'ASC' },
		});
	}

	async countByStatus(status: ApprovalStatus): Promise<number> {
		return await this.count({ where: { status } });
	}

	async countByType(approvalType: ApprovalType): Promise<number> {
		return await this.count({ where: { approvalType } });
	}

	async countPendingByPriority(priority: ApprovalPriority): Promise<number> {
		return await this.count({
			where: {
				status: 'pending',
				priority,
			},
		});
	}

	async updateStatus(
		approvalId: string,
		status: ApprovalStatus,
		processedBy?: string,
		rejectionReason?: string,
	): Promise<void> {
		const updateData: Partial<LicenseApprovalEntity> = {
			status,
			updatedAt: new Date(),
		};

		if (status === 'approved' && processedBy) {
			updateData.approvedBy = processedBy;
			updateData.approvedAt = new Date();
		}

		if (status === 'rejected' && processedBy) {
			updateData.rejectedBy = processedBy;
			updateData.rejectedAt = new Date();
			if (rejectionReason) {
				updateData.rejectionReason = rejectionReason;
			}
		}

		await this.update(approvalId, updateData);
	}

	async expireOldApprovals(): Promise<number> {
		const now = new Date();
		const result = await this.update(
			{
				status: 'pending',
				expiresAt: LessThan(now),
			},
			{
				status: 'expired',
				updatedAt: now,
			},
		);

		return result.affected || 0;
	}

	async findHighPriorityPending(): Promise<LicenseApprovalEntity[]> {
		return await this.find({
			where: {
				status: 'pending',
				priority: In(['high', 'critical']),
			},
			relations: ['license', 'requestedByUser'],
			order: { priority: 'DESC', createdAt: 'ASC' },
		});
	}
}
