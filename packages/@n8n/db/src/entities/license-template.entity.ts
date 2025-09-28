import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { WithTimestamps } from './abstract-entity';
import { User } from './user';
import { LicenseFeatures, LicenseLimits, LicenseType } from './license.entity';

@Entity('license_template')
@Index(['name'], { unique: true })
@Index(['licenseType'])
@Index(['isActive'])
@Index(['createdBy'])
export class LicenseTemplateEntity extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;
	@Column({ type: 'varchar', length: 255, unique: true })
	name: string;

	@Column({ type: 'text', nullable: true })
	description: string;

	@Column({ type: 'varchar', length: 50 })
	licenseType: LicenseType;

	@Column({ type: 'json', nullable: true })
	defaultFeatures: LicenseFeatures;

	@Column({ type: 'json', nullable: true })
	defaultLimits: LicenseLimits;

	@Column({ type: 'integer', default: 365 })
	defaultValidityDays: number;

	@Column({ type: 'boolean', default: true })
	requiresApproval: boolean;

	@Column({ type: 'boolean', default: true })
	isActive: boolean;

	@Column({ type: 'uuid' })
	createdBy: string; // Owner user ID

	// Relations
	@ManyToOne(() => User, { nullable: false })
	@JoinColumn({ name: 'createdBy' })
	createdByUser: User;
}
