import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';

import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';

@Entity()
export class PaymentMethod extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne('User', { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column()
	@Index()
	userId: string;

	@Column()
	provider: 'stripe' | 'paypal' | 'square';

	@Column()
	type: 'card' | 'bank_account' | 'paypal_account';

	@Column({ nullable: true, length: 4 })
	last4: string;

	@Column({ nullable: true, length: 20 })
	brand: string; // 'visa', 'mastercard', etc.

	@Column({ nullable: true })
	expiryMonth: number;

	@Column({ nullable: true })
	expiryYear: number;

	@Column({ type: 'boolean', default: false })
	@Index()
	isDefault: boolean;

	@Column()
	providerPaymentMethodId: string;

	@JsonColumn({ nullable: true })
	billingAddress: {
		line1: string;
		line2?: string;
		city: string;
		state: string;
		postalCode: string;
		country: string;
	};

	@Column({ type: 'boolean', default: true })
	isActive: boolean;
}
