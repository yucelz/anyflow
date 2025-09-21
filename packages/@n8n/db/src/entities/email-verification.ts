import {
	Column,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	BeforeInsert,
	BeforeUpdate,
} from '@n8n/typeorm';

import { WithTimestamps } from './abstract-entity';
import { lowerCaser } from '../utils/transformers';

@Entity()
@Index(['email', 'code'])
@Index(['expiresAt'])
export class EmailVerification extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({
		length: 254,
		nullable: false,
		transformer: lowerCaser,
	})
	@Index()
	email: string;

	@Column({ length: 6, nullable: false })
	code: string;

	@Column({ type: 'timestamp', nullable: false })
	expiresAt: Date;

	@Column({ type: 'timestamp', nullable: true })
	verifiedAt: Date | null;

	@Column({ type: 'integer', default: 0 })
	attempts: number;

	@Column({ type: 'integer', default: 3 })
	maxAttempts: number;

	@Column({ type: 'boolean', default: false })
	isUsed: boolean;

	@BeforeInsert()
	@BeforeUpdate()
	preUpsertHook(): void {
		this.email = this.email?.toLowerCase() ?? null;
	}

	get isExpired(): boolean {
		return new Date() > this.expiresAt;
	}

	get isValid(): boolean {
		return !this.isExpired && !this.isUsed && this.attempts < this.maxAttempts;
	}

	markAsUsed(): void {
		this.isUsed = true;
		this.verifiedAt = new Date();
	}

	incrementAttempts(): void {
		this.attempts += 1;
	}
}
