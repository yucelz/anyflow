import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { UserSubscription } from '../entities/user-subscription';

@Service()
export class UserSubscriptionRepository extends Repository<UserSubscription> {
	constructor(dataSource: DataSource) {
		super(UserSubscription, dataSource.manager);
	}

	async findActiveByUserId(userId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				userId,
				status: 'active',
			},
			relations: ['plan'],
		});
	}

	async findByUserIdWithPlan(userId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				userId,
			},
			relations: ['plan'],
			order: {
				createdAt: 'DESC',
			},
		});
	}

	async findByUserId(userId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				userId,
			},
			order: {
				createdAt: 'DESC',
			},
		});
	}

	async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				stripeSubscriptionId,
			},
			relations: ['plan'],
		});
	}

	async findByPaypalSubscriptionId(paypalSubscriptionId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				paypalSubscriptionId,
			},
			relations: ['plan'],
		});
	}

	async findBySquareSubscriptionId(squareSubscriptionId: string): Promise<UserSubscription | null> {
		return await this.findOne({
			where: {
				squareSubscriptionId,
			},
			relations: ['plan'],
		});
	}

	async findExpiringSoon(days: number = 7): Promise<UserSubscription[]> {
		const expirationDate = new Date();
		expirationDate.setDate(expirationDate.getDate() + days);

		return await this.createQueryBuilder('subscription')
			.leftJoinAndSelect('subscription.plan', 'plan')
			.where('subscription.currentPeriodEnd <= :expirationDate', { expirationDate })
			.andWhere('subscription.status = :status', { status: 'active' })
			.getMany();
	}

	async countActiveSubscriptions(): Promise<number> {
		return await this.count({
			where: {
				status: 'active',
			},
		});
	}
}
