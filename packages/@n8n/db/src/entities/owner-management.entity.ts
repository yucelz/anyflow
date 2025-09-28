import { Column, Entity, Index, JoinColumn, ManyToOne } from '@n8n/typeorm';
import { WithTimestampsAndStringId } from './abstract-entity';
import { User } from './user';

export interface OwnerPermissions {
	canCreateLicenses: boolean;
	canApproveLicenses: boolean;
	canRevokeLicenses: boolean;
	canManageTemplates: boolean;
	canDelegatePermissions: boolean;
	canViewAuditLogs: boolean;
	canManageSubscriptions: boolean;
}

export interface OwnerSettings {
	autoApprovalEnabled: boolean;
	autoApprovalCriteria: Record<string, any>;
	notificationPreferences: Record<string, boolean>;
	approvalTimeoutDays: number;
}

@Entity('owner_management')
@Index(['ownerId'], { unique: true })
export class OwnerManagementEntity extends WithTimestampsAndStringId {
	@Column({ type: 'uuid', unique: true })
	ownerId: string; // User ID with global:owner role

	@Column({ type: 'json' })
	permissions: OwnerPermissions;

	@Column({ type: 'json', nullable: true })
	delegatedUsers: string[]; // User IDs with delegated permissions

	@Column({ type: 'json' })
	settings: OwnerSettings;

	// Relations
	@ManyToOne(() => User, { nullable: false })
	@JoinColumn({ name: 'ownerId' })
	owner: User;
}
