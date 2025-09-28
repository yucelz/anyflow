import { mock } from 'jest-mock-extended';
import { Logger } from '@n8n/backend-common';
import { LicenseRepository } from '@n8n/db';
import { LicenseEntity, LicenseFeatures, LicenseLimits } from '@n8n/db';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import {
	LicenseValidationService,
	ValidationResult,
	UsageData,
} from '../license-validation.service';

describe('LicenseValidationService', () => {
	const logger = mock<Logger>();
	const licenseRepository = mock<LicenseRepository>();

	const validationService = new LicenseValidationService(logger, licenseRepository);

	const mockLicense = mock<LicenseEntity>({
		id: 'license-123',
		licenseKey: 'ENT-TEST123-ABC456',
		licenseType: 'enterprise',
		status: 'active',
		approvalStatus: 'approved',
		validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
		validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
		features: {
			advancedNodes: true,
			prioritySupport: true,
			sso: false,
		} as LicenseFeatures,
		limits: {
			maxWorkflowsPerUser: 100,
			maxExecutionsPerMonth: 10000,
			maxUsers: 50,
			maxExecutionDataSize: 1000000,
			rateLimitPerMinute: 1000,
		} as LicenseLimits,
		issuedTo: 'user-123',
		issuedBy: 'owner-123',
		metadata: {},
		subscriptionId: null,
		parentLicenseId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateLicenseKey', () => {
		it('should validate license key successfully', async () => {
			licenseRepository.findByLicenseKey.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: true,
				details: {
					licenseType: 'enterprise',
					validFrom: mockLicense.validFrom,
					validUntil: mockLicense.validUntil,
					features: mockLicense.features,
					limits: mockLicense.limits,
				},
			});
			expect(licenseRepository.findByLicenseKey).toHaveBeenCalledWith('ENT-TEST123-ABC456');
		});

		it('should return invalid if license not found', async () => {
			licenseRepository.findByLicenseKey.mockResolvedValue(null);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'License not found',
			});
		});

		it('should return invalid if license is not approved', async () => {
			const unapprovedLicense = { ...mockLicense, approvalStatus: 'pending' as const };
			licenseRepository.findByLicenseKey.mockResolvedValue(unapprovedLicense);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'License is not approved',
				details: { approvalStatus: 'pending' },
			});
		});

		it('should return invalid if license is not active', async () => {
			const inactiveLicense = { ...mockLicense, status: 'suspended' as const };
			licenseRepository.findByLicenseKey.mockResolvedValue(inactiveLicense);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'License is suspended',
				details: { status: 'suspended' },
			});
		});

		it('should return invalid if license is not yet valid', async () => {
			const futureLicense = {
				...mockLicense,
				validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
			};
			licenseRepository.findByLicenseKey.mockResolvedValue(futureLicense);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'License is not yet valid',
				details: { validFrom: futureLicense.validFrom },
			});
		});

		it('should return invalid if license has expired', async () => {
			const expiredLicense = {
				...mockLicense,
				validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
			};
			licenseRepository.findByLicenseKey.mockResolvedValue(expiredLicense);

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'License has expired',
				details: { validUntil: expiredLicense.validUntil },
			});
		});

		it('should handle validation error', async () => {
			licenseRepository.findByLicenseKey.mockRejectedValue(new Error('Database error'));

			const result = await validationService.validateLicenseKey('ENT-TEST123-ABC456');

			expect(result).toEqual({
				isValid: false,
				error: 'Validation error',
			});
			expect(logger.error).toHaveBeenCalledWith('Error validating license key', {
				error: expect.any(Error),
				licenseKey: 'ENT-TEST123-ABC456',
			});
		});
	});

	describe('validateLicenseFeatures', () => {
		it('should return true if all features are available', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'advancedNodes',
				'prioritySupport',
			]);

			expect(result).toBe(true);
		});

		it('should return false if license not found', async () => {
			licenseRepository.findOne.mockResolvedValue(null);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'advancedNodes',
			]);

			expect(result).toBe(false);
		});

		it('should return false if license is invalid', async () => {
			const expiredLicense = {
				...mockLicense,
				validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
			};
			licenseRepository.findOne.mockResolvedValue(expiredLicense);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'advancedNodes',
			]);

			expect(result).toBe(false);
		});

		it('should return false if feature is not available', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseFeatures('license-123', ['sso']);

			expect(result).toBe(false);
		});

		it('should handle boolean features correctly', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'advancedNodes',
			]);

			expect(result).toBe(true);
		});

		it('should handle numeric features correctly', async () => {
			const licenseWithNumericFeature = {
				...mockLicense,
				features: { ...mockLicense.features, maxConnections: 10 },
			};
			licenseRepository.findOne.mockResolvedValue(licenseWithNumericFeature);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'maxConnections',
			]);

			expect(result).toBe(true);
		});

		it('should return false for zero numeric features', async () => {
			const licenseWithZeroFeature = {
				...mockLicense,
				features: { ...mockLicense.features, maxConnections: 0 },
			};
			licenseRepository.findOne.mockResolvedValue(licenseWithZeroFeature);

			const result = await validationService.validateLicenseFeatures('license-123', [
				'maxConnections',
			]);

			expect(result).toBe(false);
		});
	});

	describe('validateLicenseLimits', () => {
		const usage: UsageData = {
			activeWorkflows: 50,
			executionsThisMonth: 5000,
			totalUsers: 25,
			dataSize: 500000,
			requestsPerMinute: 500,
		};

		it('should return valid if all limits are within bounds', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', usage);

			expect(result).toEqual({
				isValid: true,
				details: { limits: mockLicense.limits, usage },
			});
		});

		it('should return invalid if license not found', async () => {
			licenseRepository.findOne.mockResolvedValue(null);

			const result = await validationService.validateLicenseLimits('license-123', usage);

			expect(result).toEqual({
				isValid: false,
				error: 'License not found',
			});
		});

		it('should return invalid if workflow limit exceeded', async () => {
			const excessiveUsage = { ...usage, activeWorkflows: 150 };
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: ['Active workflows (150) exceeds limit (100)'],
				},
			});
		});

		it('should return invalid if execution limit exceeded', async () => {
			const excessiveUsage = { ...usage, executionsThisMonth: 15000 };
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: ['Monthly executions (15000) exceeds limit (10000)'],
				},
			});
		});

		it('should return invalid if user limit exceeded', async () => {
			const excessiveUsage = { ...usage, totalUsers: 75 };
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: ['Total users (75) exceeds limit (50)'],
				},
			});
		});

		it('should return invalid if data size limit exceeded', async () => {
			const excessiveUsage = { ...usage, dataSize: 1500000 };
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: ['Data size (1500000) exceeds limit (1000000)'],
				},
			});
		});

		it('should return invalid if rate limit exceeded', async () => {
			const excessiveUsage = { ...usage, requestsPerMinute: 1500 };
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: ['Requests per minute (1500) exceeds limit (1000)'],
				},
			});
		});

		it('should return multiple violations', async () => {
			const excessiveUsage = {
				...usage,
				activeWorkflows: 150,
				totalUsers: 75,
			};
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseLimits('license-123', excessiveUsage);

			expect(result).toEqual({
				isValid: false,
				error: 'License limits exceeded',
				details: {
					violations: [
						'Active workflows (150) exceeds limit (100)',
						'Total users (75) exceeds limit (50)',
					],
				},
			});
		});
	});

	describe('validateLicenseStatus', () => {
		it('should return true for valid license', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.validateLicenseStatus('license-123');

			expect(result).toBe(true);
		});

		it('should return false for invalid license', async () => {
			licenseRepository.findOne.mockResolvedValue(null);

			const result = await validationService.validateLicenseStatus('license-123');

			expect(result).toBe(false);
		});
	});

	describe('getActiveLicenseForUser', () => {
		it('should return active license for user', async () => {
			const userLicenses = [mockLicense];
			licenseRepository.findByUserId.mockResolvedValue(userLicenses);

			const result = await validationService.getActiveLicenseForUser('user-123');

			expect(result).toEqual(mockLicense);
			expect(licenseRepository.findByUserId).toHaveBeenCalledWith('user-123');
		});

		it('should return null if no valid license found', async () => {
			const expiredLicense = {
				...mockLicense,
				validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
			};
			licenseRepository.findByUserId.mockResolvedValue([expiredLicense]);

			const result = await validationService.getActiveLicenseForUser('user-123');

			expect(result).toBeNull();
		});

		it('should return null if no licenses found', async () => {
			licenseRepository.findByUserId.mockResolvedValue([]);

			const result = await validationService.getActiveLicenseForUser('user-123');

			expect(result).toBeNull();
		});
	});

	describe('getLicenseUsageInfo', () => {
		it('should return license usage info', async () => {
			licenseRepository.findOne.mockResolvedValue(mockLicense);

			const result = await validationService.getLicenseUsageInfo('license-123');

			expect(result).toEqual({
				licenseId: 'license-123',
				isValid: true,
				status: 'active',
				approvalStatus: 'approved',
				validFrom: mockLicense.validFrom,
				validUntil: mockLicense.validUntil,
				daysUntilExpiry: expect.any(Number),
				features: mockLicense.features,
				limits: mockLicense.limits,
				error: undefined,
			});
		});

		it('should return null if license not found', async () => {
			licenseRepository.findOne.mockResolvedValue(null);

			const result = await validationService.getLicenseUsageInfo('license-123');

			expect(result).toBeNull();
		});

		it('should include error for invalid license', async () => {
			const expiredLicense = {
				...mockLicense,
				validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000),
			};
			licenseRepository.findOne.mockResolvedValue(expiredLicense);

			const result = await validationService.getLicenseUsageInfo('license-123');

			expect(result).toEqual({
				licenseId: 'license-123',
				isValid: false,
				status: 'active',
				approvalStatus: 'approved',
				validFrom: expiredLicense.validFrom,
				validUntil: expiredLicense.validUntil,
				daysUntilExpiry: expect.any(Number),
				features: expiredLicense.features,
				limits: expiredLicense.limits,
				error: 'License has expired',
			});
		});

		it('should calculate days until expiry correctly', async () => {
			const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
			const licenseExpiringIn10Days = {
				...mockLicense,
				validUntil: futureDate,
			};
			licenseRepository.findOne.mockResolvedValue(licenseExpiringIn10Days);

			const result = await validationService.getLicenseUsageInfo('license-123');

			expect(result?.daysUntilExpiry).toBe(10);
		});
	});
});
