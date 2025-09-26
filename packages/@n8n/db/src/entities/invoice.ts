import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';
import type { UserSubscription } from './user-subscription';

@Entity()
export class Invoice extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ unique: true, length: 50 })
	@Index()
	invoiceNumber: string;

	@ManyToOne('User', { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column()
	@Index()
	userId: string;

	@ManyToOne('UserSubscription', { nullable: true })
	@JoinColumn({ name: 'subscriptionId' })
	subscription: UserSubscription;

	@Column({ nullable: true })
	subscriptionId: string;

	@Column()
	@Index()
	status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

	@Column('decimal', { precision: 10, scale: 2 })
	subtotal: number;

	@Column('decimal', { precision: 10, scale: 2, default: 0 })
	tax: number;

	@Column('decimal', { precision: 10, scale: 2 })
	total: number;

	@Column({ length: 3 })
	currency: string;

	@Column({ type: 'timestamp' })
	dueDate: Date;

	@Column({ type: 'timestamp', nullable: true })
	paidAt: Date;

	@JsonColumn()
	lineItems: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		amount: number;
	}>;

	@Column({ nullable: true })
	stripeInvoiceId: string;

	@Column({ nullable: true })
	paypalInvoiceId: string;

	@Column({ nullable: true })
	squareInvoiceId: string;

	@JsonColumn({ nullable: true })
	metadata: Record<string, any>;

	// Computed properties
	get isPaid(): boolean {
		return this.status === 'paid';
	}

	get isOverdue(): boolean {
		return this.status === 'open' && new Date() > this.dueDate;
	}
}
