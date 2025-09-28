import { Service } from '@n8n/di';
import { DataSource, Repository, FindOptionsWhere, Between, In } from '@n8n/typeorm';
import { LicenseAuditLogEntity, LicenseAuditAction } from '../entities/license-audit-log.entity';

export interface AuditLogFilters {
	licenseId?: string;
	action?: LicenseAuditAction | LicenseAuditAction[];
	performedBy?: string;
	dateFrom?: Date;
	dateTo?: Date;
	ipAddress?: string;
}

@Service()
export class LicenseAuditLogRepository extends Repository<LicenseAuditLogEntity> {
	constructor(dataSource: DataSource) {
		super(LicenseAuditLogEntity, dataSource.manager);
	}

	async findByLicenseId(licenseId: string): Promise<LicenseAuditLogEntity[]> {
		return await this.find({
			where: { licenseId },
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findByUserId(userId: string): Promise<LicenseAuditLogEntity[]> {
		return await this.find({
			where: { performedBy: userId },
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findByAction(action: LicenseAuditAction): Promise<LicenseAuditLogEntity[]> {
		return await this.find({
			where: { action },
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findWithFilters(filters: AuditLogFilters): Promise<LicenseAuditLogEntity[]> {
		const where: FindOptionsWhere<LicenseAuditLogEntity> = {};

		if (filters.licenseId) {
			where.licenseId = filters.licenseId;
		}

		if (filters.action) {
			where.action = Array.isArray(filters.action) ? In(filters.action) : filters.action;
		}

		if (filters.performedBy) {
			where.performedBy = filters.performedBy;
		}

		if (filters.ipAddress) {
			where.ipAddress = filters.ipAddress;
		}

		if (filters.dateFrom && filters.dateTo) {
			where.createdAt = Between(filters.dateFrom, filters.dateTo);
		}

		return await this.find({
			where,
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findRecentActivity(limit: number = 50): Promise<LicenseAuditLogEntity[]> {
		return await this.find({
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
			take: limit,
		});
	}

	async countByAction(action: LicenseAuditAction): Promise<number> {
		return await this.count({ where: { action } });
	}

	async countByUser(userId: string): Promise<number> {
		return await this.count({ where: { performedBy: userId } });
	}

	async findByDateRange(dateFrom: Date, dateTo: Date): Promise<LicenseAuditLogEntity[]> {
		return await this.find({
			where: {
				createdAt: Between(dateFrom, dateTo),
			},
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async createAuditLog(auditData: Partial<LicenseAuditLogEntity>): Promise<LicenseAuditLogEntity> {
		const auditLog = this.create({
			...auditData,
			createdAt: new Date(),
		});

		return await this.save(auditLog);
	}

	async findSuspiciousActivity(): Promise<LicenseAuditLogEntity[]> {
		// Find multiple failed attempts or unusual patterns
		return await this.find({
			where: {
				action: In(['revoked', 'suspended']),
			},
			relations: ['license', 'performedByUser'],
			order: { createdAt: 'DESC' },
			take: 100,
		});
	}

	async getActivitySummary(dateFrom: Date, dateTo: Date): Promise<Record<string, number>> {
		const logs = await this.findByDateRange(dateFrom, dateTo);

		const summary: Record<string, number> = {};
		logs.forEach((log) => {
			summary[log.action] = (summary[log.action] || 0) + 1;
		});

		return summary;
	}

	async cleanupOldLogs(olderThanDays: number): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		const result = await this.delete({
			createdAt: Between(new Date(0), cutoffDate),
		});

		return result.affected || 0;
	}
}
