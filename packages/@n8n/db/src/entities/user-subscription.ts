import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';
import type { SubscriptionPlan } from './subscription-plan';
import type { Invoice } from './invoice';

@Entity()
export class UserSubscription extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne('User', { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column({ type: 'uuid' })
	@Index()
	userId: string;

	@ManyToOne('SubscriptionPlan')
	@JoinColumn({ name: 'planId' })
	plan: SubscriptionPlan;

	@Column({ type: 'uuid' })
	planId: string;

	@Column()
	@Index()
	status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';

	@Column()
	billingCycle: 'monthly' | 'yearly';

	@Column('decimal', { precision: 10, scale: 2 })
	amount: number;

	@Column({ length: 3 })
	currency: string; // 'USD', 'EUR', etc.

	@Column({ type: 'timestamp' })
	currentPeriodStart: Date;

	@Column({ type: 'timestamp' })
	currentPeriodEnd: Date;

	@Column({ type: 'timestamp', nullable: true })
	trialStart: Date;

	@Column({ type: 'timestamp', nullable: true })
	trialEnd: Date;

	@Column({ type: 'timestamp', nullable: true })
	canceledAt: Date;

	@Column({ type: 'boolean', default: false })
	cancelAtPeriodEnd: boolean;

	// Payment processor specific data
	@Column({ nullable: true })
	stripeSubscriptionId: string;

	@Column({ nullable: true })
	paypalSubscriptionId: string;

	@Column({ nullable: true })
	squareSubscriptionId: string;

	@Column({ nullable: true })
	stripeCustomerId: string;

	@Column({ nullable: true })
	paypalCustomerId: string;

	@Column({ nullable: true })
	squareCustomerId: string;

	@JsonColumn({ nullable: true })
	metadata: Record<string, any>;

	@OneToMany('Invoice', 'subscription')
	invoices: Invoice[];

	// Computed properties
	get isActive(): boolean {
		return this.status === 'active' || this.status === 'trialing';
	}

	get isTrialing(): boolean {
		return this.status === 'trialing' && this.trialEnd && new Date() < this.trialEnd;
	}

	get daysUntilRenewal(): number {
		const now = new Date();
		const renewalDate = this.currentPeriodEnd;
		const diffTime = renewalDate.getTime() - now.getTime();
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}
}
