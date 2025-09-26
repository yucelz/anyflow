import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { SubscriptionPlan } from '../entities/subscription-plan';

@Service()
export class SubscriptionPlanRepository extends Repository<SubscriptionPlan> {
	constructor(dataSource: DataSource) {
		super(SubscriptionPlan, dataSource.manager);
	}

	async findActiveBySlug(slug: string): Promise<SubscriptionPlan | null> {
		return await this.findOne({
			where: {
				slug,
				isActive: true,
			},
		});
	}

	async findAllActive(): Promise<SubscriptionPlan[]> {
		return await this.find({
			where: {
				isActive: true,
			},
			order: {
				monthlyPrice: 'ASC',
			},
		});
	}

	async findPopular(): Promise<SubscriptionPlan | null> {
		return await this.findOne({
			where: {
				isActive: true,
				isPopular: true,
			},
		});
	}
}
