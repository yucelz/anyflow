import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';
import {
	OwnerManagementEntity,
	OwnerPermissions,
	OwnerSettings,
} from '../entities/owner-management.entity';

@Service()
export class OwnerManagementRepository extends Repository<OwnerManagementEntity> {
	constructor(dataSource: DataSource) {
		super(OwnerManagementEntity, dataSource.manager);
	}

	async findByOwnerId(ownerId: string): Promise<OwnerManagementEntity | null> {
		return await this.findOne({
			where: { ownerId },
			relations: ['owner'],
		});
	}

	async findAllOwners(): Promise<OwnerManagementEntity[]> {
		return await this.find({
			relations: ['owner'],
			order: { createdAt: 'ASC' },
		});
	}

	async createOwnerManagement(
		ownerId: string,
		permissions?: Partial<OwnerPermissions>,
		settings?: Partial<OwnerSettings>,
	): Promise<OwnerManagementEntity> {
		const defaultPermissions: OwnerPermissions = {
			canCreateLicenses: true,
			canApproveLicenses: true,
			canRevokeLicenses: true,
			canManageTemplates: true,
			canDelegatePermissions: true,
			canViewAuditLogs: true,
			canManageSubscriptions: true,
		};

		const defaultSettings: OwnerSettings = {
			autoApprovalEnabled: false,
			autoApprovalCriteria: {},
			notificationPreferences: {
				emailOnApprovalRequest: true,
				emailOnLicenseExpiry: true,
				emailOnSuspiciousActivity: true,
			},
			approvalTimeoutDays: 7,
		};

		const ownerManagement = this.create({
			ownerId,
			permissions: { ...defaultPermissions, ...permissions },
			settings: { ...defaultSettings, ...settings },
			delegatedUsers: [],
		});

		return await this.save(ownerManagement);
	}

	async updatePermissions(ownerId: string, permissions: Partial<OwnerPermissions>): Promise<void> {
		const existing = await this.findByOwnerId(ownerId);
		if (!existing) {
			throw new Error('Owner management record not found');
		}

		await this.update(ownerId, {
			permissions: { ...existing.permissions, ...permissions },
			updatedAt: new Date(),
		});
	}

	async updateSettings(ownerId: string, settings: Partial<OwnerSettings>): Promise<void> {
		const existing = await this.findByOwnerId(ownerId);
		if (!existing) {
			throw new Error('Owner management record not found');
		}

		await this.update(ownerId, {
			settings: { ...existing.settings, ...settings },
			updatedAt: new Date(),
		});
	}

	async addDelegatedUser(ownerId: string, userId: string): Promise<void> {
		const existing = await this.findByOwnerId(ownerId);
		if (!existing) {
			throw new Error('Owner management record not found');
		}

		const delegatedUsers = existing.delegatedUsers || [];
		if (!delegatedUsers.includes(userId)) {
			delegatedUsers.push(userId);
			await this.update(ownerId, {
				delegatedUsers,
				updatedAt: new Date(),
			});
		}
	}

	async removeDelegatedUser(ownerId: string, userId: string): Promise<void> {
		const existing = await this.findByOwnerId(ownerId);
		if (!existing) {
			throw new Error('Owner management record not found');
		}

		const delegatedUsers = (existing.delegatedUsers || []).filter((id) => id !== userId);
		await this.update(ownerId, {
			delegatedUsers,
			updatedAt: new Date(),
		});
	}

	async getDelegatedUsers(ownerId: string): Promise<string[]> {
		const existing = await this.findByOwnerId(ownerId);
		return existing?.delegatedUsers || [];
	}

	async hasPermission(ownerId: string, permission: keyof OwnerPermissions): Promise<boolean> {
		const existing = await this.findByOwnerId(ownerId);
		return existing?.permissions[permission] || false;
	}

	async isUserDelegated(ownerId: string, userId: string): Promise<boolean> {
		const existing = await this.findByOwnerId(ownerId);
		return existing?.delegatedUsers?.includes(userId) || false;
	}

	async getAutoApprovalSettings(ownerId: string): Promise<OwnerSettings | null> {
		const existing = await this.findByOwnerId(ownerId);
		return existing?.settings || null;
	}

	async enableAutoApproval(ownerId: string, criteria: Record<string, any>): Promise<void> {
		await this.updateSettings(ownerId, {
			autoApprovalEnabled: true,
			autoApprovalCriteria: criteria,
		});
	}

	async disableAutoApproval(ownerId: string): Promise<void> {
		await this.updateSettings(ownerId, {
			autoApprovalEnabled: false,
			autoApprovalCriteria: {},
		});
	}

	async updateNotificationPreferences(
		ownerId: string,
		preferences: Record<string, boolean>,
	): Promise<void> {
		const existing = await this.findByOwnerId(ownerId);
		if (!existing) {
			throw new Error('Owner management record not found');
		}

		const updatedSettings = {
			...existing.settings,
			notificationPreferences: {
				...existing.settings.notificationPreferences,
				...preferences,
			},
		};

		await this.updateSettings(ownerId, updatedSettings);
	}

	async setApprovalTimeout(ownerId: string, timeoutDays: number): Promise<void> {
		await this.updateSettings(ownerId, {
			approvalTimeoutDays: timeoutDays,
		});
	}

	async findOwnersWithAutoApproval(): Promise<OwnerManagementEntity[]> {
		return await this.find({
			where: {
				settings: {
					autoApprovalEnabled: true,
				} as any, // TypeORM doesn't handle nested JSON queries well
			},
			relations: ['owner'],
		});
	}
}
