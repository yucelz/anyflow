import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';

import { WithTimestamps } from './abstract-entity';
import type { User } from './user';

@Entity()
@Index(['userId', 'date'], { unique: true })
export class UsageTracking extends WithTimestamps {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne('User', { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user: User;

	@Column()
	@Index()
	userId: string;

	@Column({ type: 'date' })
	@Index()
	date: Date;

	@Column('int', { default: 0 })
	executionsCount: number;

	@Column('int', { default: 0 })
	activeWorkflowsCount: number;

	@Column('int', { default: 0 })
	credentialsCount: number;

	@Column('int', { default: 0 })
	usersCount: number;

	@Column('bigint', { default: 0 })
	storageUsed: number; // in bytes
}
