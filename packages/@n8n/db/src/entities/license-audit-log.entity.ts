import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { WithTimestamps } from './abstract-entity';
import { User } from './user';
import { LicenseEntity } from './license.entity';

export type LicenseAuditAction =
	| 'created'
	| 'activated'
	| 'suspended'
	| 'renewed'
	| 'revoked'
	| 'modified'
	| 'approved'
	| 'rejected';

@Entity('license_audit_log')
@Index(['licenseId'])
@Index(['action'])
@Index(['performedBy'])
//@Index(['createdAt'])
export class LicenseAuditLogEntity extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;
	@Column({ type: 'uuid' })
	licenseId: string;

	@Column({ type: 'varchar', length: 50 })
	action: LicenseAuditAction;

	@Column({ type: 'uuid' })
	performedBy: string; // User ID

	@Column({ type: 'json', nullable: true })
	previousState?: Record<string, any>;

	@Column({ type: 'json' })
	newState: Record<string, any>;

	@Column({ type: 'text', nullable: true })
	reason?: string;

	@Column({ type: 'varchar', length: 45, nullable: true })
	ipAddress?: string;

	@Column({ type: 'text', nullable: true })
	userAgent?: string;

	@Column({ type: 'json', nullable: true })
	metadata: Record<string, any>;

	// Relations
	@ManyToOne(() => LicenseEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'licenseId' })
	license: LicenseEntity;

	@ManyToOne(() => User, { nullable: false })
	@JoinColumn({ name: 'performedBy' })
	performedByUser: User;
}
