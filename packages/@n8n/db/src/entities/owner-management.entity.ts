import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	BeforeInsert,
} from '@n8n/typeorm';
import { v4 as uuid } from 'uuid';
import { WithTimestamps } from './abstract-entity';
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
export class OwnerManagementEntity extends WithTimestamps {
	@PrimaryColumn('uuid')
	id: string;

	@Column({ type: 'uuid', unique: true, name: 'owner_id' })
	ownerId: string; // User ID with global:owner role

	@Column({ type: 'json' })
	permissions: OwnerPermissions;

	@Column({ type: 'json', nullable: true, name: 'delegated_users' })
	delegatedUsers: string[]; // User IDs with delegated permissions

	@Column({ type: 'json' })
	settings: OwnerSettings;

	@BeforeInsert()
	generateId() {
		if (!this.id) {
			this.id = uuid();
		}
	}

	// Relations
	@ManyToOne(() => User, { nullable: false })
	@JoinColumn({ name: 'owner_id' })
	owner: User;
}
