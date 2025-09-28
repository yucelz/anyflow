import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { LicenseRepository } from '@n8n/db';
import { LicenseEntity, LicenseFeatures, LicenseLimits } from '@n8n/db';

export interface ValidationResult {
	isValid: boolean;
	error?: string;
	details?: Record<string, any>;
}

export interface UsageData {
	activeWorkflows?: number;
	executionsThisMonth?: number;
	totalUsers?: number;
	dataSize?: number;
	requestsPerMinute?: number;
}

@Service()
export class LicenseValidationService {
	constructor(
		private readonly logger: Logger,
		private readonly licenseRepository: LicenseRepository,
	) {}

	async validateLicenseKey(licenseKey: string): Promise<ValidationResult> {
		this.logger.debug('Validating license key', { licenseKey });

		try {
			const license = await this.licenseRepository.findByLicenseKey(licenseKey);

			if (!license) {
				return {
					isValid: false,
					error: 'License not found',
				};
			}

			return this.validateLicense(license);
		} catch (error) {
			this.logger.error('Error validating license key', { error, licenseKey });
			return {
				isValid: false,
				error: 'Validation error',
			};
		}
	}

	async validateLicenseFeatures(licenseId: string, features: string[]): Promise<boolean> {
		this.logger.debug('Validating license features', { licenseId, features });

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			return false;
		}

		const validation = this.validateLicense(license);
		if (!validation.isValid) {
			return false;
		}

		// Check if all requested features are available
		for (const feature of features) {
			if (!this.hasFeature(license.features, feature)) {
				return false;
			}
		}

		return true;
	}

	async validateLicenseLimits(licenseId: string, usage: UsageData): Promise<ValidationResult> {
		this.logger.debug('Validating license limits', { licenseId, usage });

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			return {
				isValid: false,
				error: 'License not found',
			};
		}

		const validation = this.validateLicense(license);
		if (!validation.isValid) {
			return validation;
		}

		return this.checkLimits(license.limits, usage);
	}

	async validateLicenseStatus(licenseId: string): Promise<boolean> {
		this.logger.debug('Validating license status', { licenseId });

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			return false;
		}

		return this.validateLicense(license).isValid;
	}

	private validateLicense(license: LicenseEntity): ValidationResult {
		// Check approval status
		if (license.approvalStatus !== 'approved') {
			return {
				isValid: false,
				error: 'License is not approved',
				details: { approvalStatus: license.approvalStatus },
			};
		}

		// Check license status
		if (license.status !== 'active') {
			return {
				isValid: false,
				error: `License is ${license.status}`,
				details: { status: license.status },
			};
		}

		// Check validity dates
		const now = new Date();
		if (license.validFrom > now) {
			return {
				isValid: false,
				error: 'License is not yet valid',
				details: { validFrom: license.validFrom },
			};
		}

		if (license.validUntil < now) {
			return {
				isValid: false,
				error: 'License has expired',
				details: { validUntil: license.validUntil },
			};
		}

		return {
			isValid: true,
			details: {
				licenseType: license.licenseType,
				validFrom: license.validFrom,
				validUntil: license.validUntil,
				features: license.features,
				limits: license.limits,
			},
		};
	}

	private hasFeature(licenseFeatures: LicenseFeatures, feature: string): boolean {
		// Check if feature exists and is enabled
		const featureValue = licenseFeatures[feature];

		if (typeof featureValue === 'boolean') {
			return featureValue;
		}

		if (typeof featureValue === 'number') {
			return featureValue > 0;
		}

		return featureValue !== undefined && featureValue !== null;
	}

	private checkLimits(licenseLimits: LicenseLimits, usage: UsageData): ValidationResult {
		const violations: string[] = [];

		// Check workflow limits
		if (licenseLimits.maxWorkflowsPerUser && usage.activeWorkflows) {
			if (usage.activeWorkflows > licenseLimits.maxWorkflowsPerUser) {
				violations.push(
					`Active workflows (${usage.activeWorkflows}) exceeds limit (${licenseLimits.maxWorkflowsPerUser})`,
				);
			}
		}

		// Check execution limits
		if (licenseLimits.maxExecutionsPerMonth && usage.executionsThisMonth) {
			if (usage.executionsThisMonth > licenseLimits.maxExecutionsPerMonth) {
				violations.push(
					`Monthly executions (${usage.executionsThisMonth}) exceeds limit (${licenseLimits.maxExecutionsPerMonth})`,
				);
			}
		}

		// Check user limits
		if (licenseLimits.maxUsers && usage.totalUsers) {
			if (usage.totalUsers > licenseLimits.maxUsers) {
				violations.push(
					`Total users (${usage.totalUsers}) exceeds limit (${licenseLimits.maxUsers})`,
				);
			}
		}

		// Check data size limits
		if (licenseLimits.maxExecutionDataSize && usage.dataSize) {
			if (usage.dataSize > licenseLimits.maxExecutionDataSize) {
				violations.push(
					`Data size (${usage.dataSize}) exceeds limit (${licenseLimits.maxExecutionDataSize})`,
				);
			}
		}

		// Check rate limits
		if (licenseLimits.rateLimitPerMinute && usage.requestsPerMinute) {
			if (usage.requestsPerMinute > licenseLimits.rateLimitPerMinute) {
				violations.push(
					`Requests per minute (${usage.requestsPerMinute}) exceeds limit (${licenseLimits.rateLimitPerMinute})`,
				);
			}
		}

		if (violations.length > 0) {
			return {
				isValid: false,
				error: 'License limits exceeded',
				details: { violations },
			};
		}

		return {
			isValid: true,
			details: { limits: licenseLimits, usage },
		};
	}

	async getActiveLicenseForUser(userId: string): Promise<LicenseEntity | null> {
		const licenses = await this.licenseRepository.findByUserId(userId);

		for (const license of licenses) {
			const validation = this.validateLicense(license);
			if (validation.isValid) {
				return license;
			}
		}

		return null;
	}

	async getLicenseUsageInfo(licenseId: string): Promise<Record<string, any> | null> {
		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			return null;
		}

		const validation = this.validateLicense(license);

		return {
			licenseId,
			isValid: validation.isValid,
			status: license.status,
			approvalStatus: license.approvalStatus,
			validFrom: license.validFrom,
			validUntil: license.validUntil,
			daysUntilExpiry: Math.ceil(
				(license.validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
			),
			features: license.features,
			limits: license.limits,
			error: validation.error,
		};
	}
}
