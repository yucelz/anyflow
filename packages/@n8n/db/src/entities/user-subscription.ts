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
	@Index()
	planId: string;

	@Column({ type: 'varchar', length: 20 })
	@Index()
	status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';

	@Column({ type: 'varchar', length: 10 })
	billingCycle: 'monthly' | 'yearly';

	@Column({ type: 'decimal', precision: 10, scale: 2 })
	amount: number;

	@Column({ type: 'varchar', length: 3 })
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

	// Stripe integration fields
	@Column({ type: 'varchar', length: 255, nullable: true })
	@Index()
	paymentSubscriptionId: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	@Index()
	paymentCustomerId: string;

	@JsonColumn({ nullable: true })
	metadata: Record<string, any> | null;

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
