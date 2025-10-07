import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { UserSubscription } from './user-subscription';

export interface SubscriptionPlanFeatures {
	advancedNodes: boolean;
	prioritySupport: boolean;
	sso: boolean;
	auditLogs: boolean;
	customBranding: boolean;
	apiAccess: boolean;
	webhooks: boolean;
	customDomains: boolean;
	advancedSecurity: boolean;
	workersView: boolean;
	logStreaming: boolean;
	externalSecrets: boolean;
	sourceControl: boolean;
	variables: boolean;
	ldapAuth: boolean;
	advancedInsights: boolean;
}

@Entity()
export class SubscriptionPlan extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'varchar', unique: true, length: 50 })
	@Index()
	slug: string; // 'starter', 'pro', 'enterprise'

	@Column({ type: 'varchar', length: 100 })
	name: string;

	@Column({ type: 'text', nullable: true })
	description: string;

	@Column({ type: 'decimal', precision: 10, scale: 2 })
	monthlyPrice: number;

	@Column({ type: 'decimal', precision: 10, scale: 2 })
	yearlyPrice: number;

	@Column({ type: 'int' })
	monthlyExecutionsLimit: number;

	@Column({ type: 'int' })
	activeWorkflowsLimit: number;

	@Column({ type: 'int' })
	credentialsLimit: number;

	@Column({ type: 'int' })
	usersLimit: number;

	@Column({ type: 'int', default: 0 })
	storageLimit: number; // in GB

	@JsonColumn({ nullable: true })
	features: SubscriptionPlanFeatures | null;

	@Column({ type: 'boolean', default: true })
	isActive: boolean;

	@Column({ type: 'boolean', default: false })
	isPopular: boolean;

	@Column({ type: 'int', default: 0 })
	sortOrder: number;

	@Column({ type: 'int', default: 14 })
	trialDays: number;

	@OneToMany('UserSubscription', 'plan')
	subscriptions: UserSubscription[];

	// Computed properties
	get yearlyDiscount(): number {
		const monthlyTotal = this.monthlyPrice * 12;
		return Math.round(((monthlyTotal - this.yearlyPrice) / monthlyTotal) * 100);
	}

	get isFreePlan(): boolean {
		return this.monthlyPrice === 0 && this.yearlyPrice === 0;
	}
}
