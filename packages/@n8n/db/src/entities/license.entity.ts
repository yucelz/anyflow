import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from '@n8n/typeorm';
import { WithTimestampsAndStringId, DateTimeColumn } from './abstract-entity';
import { User } from './user';
import { UserSubscription } from './user-subscription';

export type LicenseType = 'community' | 'trial' | 'enterprise' | 'custom';
export type LicenseStatus = 'pending' | 'active' | 'suspended' | 'expired' | 'revoked';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface LicenseFeatures {
	maxActiveWorkflows?: number;
	maxExecutionsPerMonth?: number;
	maxUsers?: number;
	advancedExecutions?: boolean;
	ldapAuth?: boolean;
	samlAuth?: boolean;
	logStreaming?: boolean;
	advancedPermissions?: boolean;
	sourceControl?: boolean;
	externalSecrets?: boolean;
	auditLogs?: boolean;
	[key: string]: any;
}

export interface LicenseLimits {
	maxWorkflowsPerUser?: number;
	maxCredentialsPerUser?: number;
	maxExecutionTime?: number;
	maxExecutionDataSize?: number;
	rateLimitPerMinute?: number;
	[key: string]: any;
}

@Entity('license')
@Index(['licenseKey'], { unique: true })
@Index(['status'])
@Index(['licenseType'])
@Index(['validFrom', 'validUntil'])
@Index(['approvalStatus'])
export class LicenseEntity extends WithTimestampsAndStringId {
	@Column({ type: 'varchar', length: 500, unique: true })
	licenseKey: string;

	@Column({ type: 'varchar', length: 50 })
	licenseType: LicenseType;

	@Column({ type: 'varchar', length: 50, default: 'pending' })
	status: LicenseStatus;

	@Column({ type: 'uuid' })
	issuedTo: string; // User ID or organization

	@Column({ type: 'uuid' })
	issuedBy: string; // User ID (must be owner)

	@DateTimeColumn()
	validFrom: Date;

	@DateTimeColumn()
	validUntil: Date;

	@Column({ type: 'json', nullable: true })
	features: LicenseFeatures;

	@Column({ type: 'json', nullable: true })
	limits: LicenseLimits;

	@Column({ type: 'json', nullable: true })
	metadata: Record<string, any>;

	@Column({ type: 'varchar', length: 50, default: 'pending' })
	approvalStatus: ApprovalStatus;

	@Column({ type: 'uuid', nullable: true })
	approvedBy?: string; // Owner user ID

	@DateTimeColumn({ nullable: true })
	approvedAt?: Date;

	@Column({ type: 'text', nullable: true })
	rejectionReason?: string;

	@Column({ type: 'uuid', nullable: true })
	subscriptionId?: string; // Link to subscription

	@Column({ type: 'uuid', nullable: true })
	parentLicenseId?: string; // For sub-licenses

	// Relations
	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'issuedTo' })
	issuedToUser?: User;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'issuedBy' })
	issuedByUser?: User;

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: 'approvedBy' })
	approvedByUser?: User;

	@ManyToOne(() => UserSubscription, { nullable: true })
	@JoinColumn({ name: 'subscriptionId' })
	subscription?: UserSubscription;

	@ManyToOne(() => LicenseEntity, { nullable: true })
	@JoinColumn({ name: 'parentLicenseId' })
	parentLicense?: LicenseEntity;

	@OneToMany(
		() => LicenseEntity,
		(license) => license.parentLicense,
	)
	childLicenses?: LicenseEntity[];
}
