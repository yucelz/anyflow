import { Column, Entity, Index, JoinColumn, ManyToOne } from '@n8n/typeorm';
import { WithTimestampsAndStringId } from './abstract-entity';
import { User } from './user';
import { LicenseEntity } from './license.entity';

export type ApprovalType = 'creation' | 'modification' | 'renewal' | 'revocation';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ApprovalPriority = 'low' | 'medium' | 'high' | 'critical';

@Entity('license_approval')
@Index(['licenseId'])
@Index(['status'])
@Index(['approvalType'])
@Index(['requestedBy'])
@Index(['expiresAt'])
@Index(['priority'])
export class LicenseApprovalEntity extends WithTimestampsAndStringId {
	@Column({ type: 'uuid' })
	licenseId: string;

	@Column({ type: 'uuid' })
	requestedBy: string; // User ID

	@Column({ type: 'varchar', length: 50 })
	approvalType: ApprovalType;

	@Column({ type: 'json', nullable: true })
	requestData: Record<string, any>;

	@Column({ type: 'varchar', length: 50, default: 'pending' })
	status: ApprovalStatus;

	@Column({ type: 'uuid', nullable: true })
	approvedBy?: string; // Owner user ID

	@Column({ type: 'timestamp', nullable: true })
	approvedAt?: Date;

	@Column({ type: 'uuid', nullable: true })
	rejectedBy?: string; // Owner user ID

	@Column({ type: 'timestamp', nullable: true })
	rejectedAt?: Date;

	@Column({ type: 'text', nullable: true })
	rejectionReason?: string;

	@Column({ type: 'timestamp' })
	expiresAt: Date;

	@Column({ type: 'varchar', length: 50, default: 'medium' })
	priority: ApprovalPriority;

	// Relations
	@ManyToOne(() => LicenseEntity, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'licenseId' })
	license: LicenseEntity;

	@ManyToOne(() => User, { nullable: false })
	@JoinColumn({ name: 'requestedBy' })
	requestedByUser: User;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'approvedBy' })
	approvedByUser?: User;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'rejectedBy' })
	rejectedByUser?: User;
}
