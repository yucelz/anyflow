import { Service } from '@n8n/di';
import { DataSource, Repository, FindOptionsWhere } from '@n8n/typeorm';
import { LicenseTemplateEntity } from '../entities/license-template.entity';
import { LicenseType } from '../entities/license.entity';

export interface TemplateFilters {
	licenseType?: LicenseType;
	isActive?: boolean;
	createdBy?: string;
	requiresApproval?: boolean;
}

@Service()
export class LicenseTemplateRepository extends Repository<LicenseTemplateEntity> {
	constructor(dataSource: DataSource) {
		super(LicenseTemplateEntity, dataSource.manager);
	}

	async findByName(name: string): Promise<LicenseTemplateEntity | null> {
		return await this.findOne({
			where: { name },
			relations: ['createdByUser'],
		});
	}

	async findActiveTemplates(): Promise<LicenseTemplateEntity[]> {
		return await this.find({
			where: { isActive: true },
			relations: ['createdByUser'],
			order: { name: 'ASC' },
		});
	}

	async findByType(licenseType: LicenseType): Promise<LicenseTemplateEntity[]> {
		return await this.find({
			where: { licenseType, isActive: true },
			relations: ['createdByUser'],
			order: { name: 'ASC' },
		});
	}

	async findByCreatedBy(userId: string): Promise<LicenseTemplateEntity[]> {
		return await this.find({
			where: { createdBy: userId },
			relations: ['createdByUser'],
			order: { createdAt: 'DESC' },
		});
	}

	async findWithFilters(filters: TemplateFilters): Promise<LicenseTemplateEntity[]> {
		const where: FindOptionsWhere<LicenseTemplateEntity> = {};

		if (filters.licenseType) {
			where.licenseType = filters.licenseType;
		}

		if (filters.isActive !== undefined) {
			where.isActive = filters.isActive;
		}

		if (filters.createdBy) {
			where.createdBy = filters.createdBy;
		}

		if (filters.requiresApproval !== undefined) {
			where.requiresApproval = filters.requiresApproval;
		}

		return await this.find({
			where,
			relations: ['createdByUser'],
			order: { name: 'ASC' },
		});
	}

	async findTemplatesRequiringApproval(): Promise<LicenseTemplateEntity[]> {
		return await this.find({
			where: { requiresApproval: true, isActive: true },
			relations: ['createdByUser'],
			order: { name: 'ASC' },
		});
	}

	async findTemplatesNotRequiringApproval(): Promise<LicenseTemplateEntity[]> {
		return await this.find({
			where: { requiresApproval: false, isActive: true },
			relations: ['createdByUser'],
			order: { name: 'ASC' },
		});
	}

	async countByType(licenseType: LicenseType): Promise<number> {
		return await this.count({
			where: { licenseType, isActive: true },
		});
	}

	async countActiveTemplates(): Promise<number> {
		return await this.count({
			where: { isActive: true },
		});
	}

	async deactivateTemplate(templateId: string): Promise<void> {
		await this.update(templateId, {
			isActive: false,
			updatedAt: new Date(),
		});
	}

	async activateTemplate(templateId: string): Promise<void> {
		await this.update(templateId, {
			isActive: true,
			updatedAt: new Date(),
		});
	}

	async updateTemplate(templateId: string, updates: Partial<LicenseTemplateEntity>): Promise<void> {
		await this.update(templateId, {
			...updates,
			updatedAt: new Date(),
		});
	}

	async findDefaultTemplate(licenseType: LicenseType): Promise<LicenseTemplateEntity | null> {
		// Find the first active template for the given type
		// In a real implementation, you might have a 'isDefault' flag
		return await this.findOne({
			where: { licenseType, isActive: true },
			relations: ['createdByUser'],
			order: { createdAt: 'ASC' },
		});
	}

	async cloneTemplate(
		templateId: string,
		newName: string,
		createdBy: string,
	): Promise<LicenseTemplateEntity> {
		const originalTemplate = await this.findOne({
			where: { id: templateId },
		});

		if (!originalTemplate) {
			throw new Error('Template not found');
		}

		const clonedTemplate = this.create({
			name: newName,
			description: `Cloned from ${originalTemplate.name}`,
			licenseType: originalTemplate.licenseType,
			defaultFeatures: originalTemplate.defaultFeatures,
			defaultLimits: originalTemplate.defaultLimits,
			defaultValidityDays: originalTemplate.defaultValidityDays,
			requiresApproval: originalTemplate.requiresApproval,
			isActive: false, // Start as inactive
			createdBy,
		});

		return await this.save(clonedTemplate);
	}
}
