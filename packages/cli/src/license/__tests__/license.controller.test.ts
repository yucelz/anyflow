import type { CommunityRegisteredRequestDto } from '@n8n/api-types';
import type { AuthenticatedRequest } from '@n8n/db';
import { mock } from 'jest-mock-extended';
import { InstanceSettings } from 'n8n-core';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import type { LicenseRequest } from '@/requests';
import { UrlService } from '@/services/url.service';

import { LicenseController } from '../license.controller';
import { LicenseService } from '../license.service';
import { LocalLicenseApiService } from '../local-license-api.service';
import { OwnerAccessControlService } from '../owner-access-control.service';

describe('LicenseController', () => {
	const licenseService = mock<LicenseService>();
	const instanceSettings = mock<InstanceSettings>();
	const urlService = mock<UrlService>();
	const localLicenseApiService = mock<LocalLicenseApiService>();
	const ownerAccessControlService = mock<OwnerAccessControlService>();

	const licenseController = new LicenseController(
		licenseService,
		instanceSettings,
		urlService,
		localLicenseApiService,
		ownerAccessControlService,
	);

	const mockUser = {
		id: 'user-123',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		role: { slug: 'global:owner' },
	};

	const mockRequest = {
		user: mockUser,
	} as AuthenticatedRequest;

	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(instanceSettings, 'instanceId', {
			value: 'instance-123',
			writable: true,
		});
		urlService.getInstanceBaseUrl.mockReturnValue('http://localhost:5678');
		urlService.getWebhookBaseUrl.mockReturnValue('http://localhost:5678');
	});

	describe('getLicenseData', () => {
		it('should return license data', async () => {
			const mockLicenseData = {
				usage: {
					activeWorkflowTriggers: { value: 5, limit: 100, warningThreshold: 0.8 },
					workflowsHavingEvaluations: { value: 2, limit: 10 },
				},
				license: { planId: 'plan-123', planName: 'Enterprise' },
			};

			licenseService.getLicenseData.mockResolvedValue(mockLicenseData);

			const result = await licenseController.getLicenseData();

			expect(result).toEqual(mockLicenseData);
			expect(licenseService.getLicenseData).toHaveBeenCalledTimes(1);
		});
	});

	describe('requestEnterpriseTrial', () => {
		it('should request enterprise trial successfully', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.requestEnterpriseTrial.mockResolvedValue();

			await licenseController.requestEnterpriseTrial(mockRequest);

			expect(ownerAccessControlService.validateOwnerPermission).toHaveBeenCalledWith(
				'user-123',
				'canCreateLicenses',
			);
			expect(licenseService.requestEnterpriseTrial).toHaveBeenCalledWith(mockUser);
		});

		it('should handle permission validation error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockRejectedValue(
				new BadRequestError('Insufficient permissions'),
			);

			await expect(licenseController.requestEnterpriseTrial(mockRequest)).rejects.toThrow(
				'Insufficient permissions',
			);

			expect(licenseService.requestEnterpriseTrial).not.toHaveBeenCalled();
		});

		it('should handle service error with axios error format', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			const axiosError = {
				response: { data: { message: 'Trial request failed' } },
				message: 'Request failed',
			};
			licenseService.requestEnterpriseTrial.mockRejectedValue(axiosError);

			await expect(licenseController.requestEnterpriseTrial(mockRequest)).rejects.toThrow(
				new BadRequestError('Trial request failed'),
			);
		});

		it('should handle service error with generic error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.requestEnterpriseTrial.mockRejectedValue(new Error('Generic error'));

			await expect(licenseController.requestEnterpriseTrial(mockRequest)).rejects.toThrow(
				new BadRequestError('Generic error'),
			);
		});

		it('should handle unknown error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.requestEnterpriseTrial.mockRejectedValue('unknown error');

			await expect(licenseController.requestEnterpriseTrial(mockRequest)).rejects.toThrow(
				new BadRequestError('Failed to request trial'),
			);
		});
	});

	describe('registerCommunityEdition', () => {
		const payload: CommunityRegisteredRequestDto = {
			email: 'test@example.com',
		};

		it('should register community edition successfully', async () => {
			const mockResponse = {
				title: 'Welcome to n8n Community!',
				text: 'Registration successful',
			};

			licenseService.registerCommunityEdition.mockResolvedValue(mockResponse);

			const result = await licenseController.registerCommunityEdition(
				mockRequest,
				{} as Response,
				payload,
			);

			expect(result).toEqual(mockResponse);
			expect(licenseService.registerCommunityEdition).toHaveBeenCalledWith({
				userId: 'user-123',
				email: 'test@example.com',
				instanceId: 'instance-123',
				instanceUrl: 'http://localhost:5678',
				licenseType: 'community-registered',
			});
		});

		it('should handle registration error', async () => {
			licenseService.registerCommunityEdition.mockRejectedValue(
				new BadRequestError('Registration failed'),
			);

			await expect(
				licenseController.registerCommunityEdition(mockRequest, {} as Response, payload),
			).rejects.toThrow('Registration failed');
		});
	});

	describe('activateLicense', () => {
		const activateRequest = {
			...mockRequest,
			body: { activationKey: 'test-key-123' },
		} as LicenseRequest.Activate;

		it('should activate license successfully', async () => {
			const mockTokenAndData = {
				usage: { activeWorkflowTriggers: { value: 5, limit: 100, warningThreshold: 0.8 } },
				license: { planId: 'plan-123', planName: 'Enterprise' },
				managementToken: 'jwt-token-123',
			};

			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.activateLicense.mockResolvedValue();
			licenseService.getManagementJwt.mockReturnValue('jwt-token-123');
			licenseService.getLicenseData.mockResolvedValue({
				usage: {
					activeWorkflowTriggers: { value: 5, limit: 100, warningThreshold: 0.8 },
					workflowsHavingEvaluations: { value: 2, limit: 10 },
				},
				license: { planId: 'plan-123', planName: 'Enterprise' },
			});

			const result = await licenseController.activateLicense(activateRequest);

			expect(result).toEqual(mockTokenAndData);
			expect(ownerAccessControlService.validateOwnerPermission).toHaveBeenCalledWith(
				'user-123',
				'canCreateLicenses',
			);
			expect(licenseService.activateLicense).toHaveBeenCalledWith('test-key-123');
		});

		it('should handle activation error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.activateLicense.mockRejectedValue(new BadRequestError('Invalid key'));

			await expect(licenseController.activateLicense(activateRequest)).rejects.toThrow(
				'Invalid key',
			);
		});
	});

	describe('renewLicense', () => {
		it('should renew license successfully', async () => {
			const mockTokenAndData = {
				usage: { activeWorkflowTriggers: { value: 5, limit: 100, warningThreshold: 0.8 } },
				license: { planId: 'plan-123', planName: 'Enterprise' },
				managementToken: 'jwt-token-123',
			};

			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.renewLicense.mockResolvedValue();
			licenseService.getManagementJwt.mockReturnValue('jwt-token-123');
			licenseService.getLicenseData.mockResolvedValue({
				usage: {
					activeWorkflowTriggers: { value: 5, limit: 100, warningThreshold: 0.8 },
					workflowsHavingEvaluations: { value: 2, limit: 10 },
				},
				license: { planId: 'plan-123', planName: 'Enterprise' },
			});

			const result = await licenseController.renewLicense(mockRequest);

			expect(result).toEqual(mockTokenAndData);
			expect(ownerAccessControlService.validateOwnerPermission).toHaveBeenCalledWith(
				'user-123',
				'canCreateLicenses',
			);
			expect(licenseService.renewLicense).toHaveBeenCalledTimes(1);
		});

		it('should handle renewal error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			licenseService.renewLicense.mockRejectedValue(new BadRequestError('Renewal failed'));

			await expect(licenseController.renewLicense(mockRequest)).rejects.toThrow('Renewal failed');
		});
	});

	describe('getAvailablePlans', () => {
		it('should return available plans', async () => {
			const mockPlans = [
				{
					id: 'plan-1',
					name: 'Community',
					slug: 'community',
					description: 'Free community plan',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: 5000,
					activeWorkflowsLimit: 5,
					credentialsLimit: 5,
					usersLimit: 1,
					storageLimit: 1,
					trialDays: 0,
					isActive: true,
					isPopular: false,
					sortOrder: 1,
					features: {
						advancedNodes: false,
						prioritySupport: false,
						sso: false,
						auditLogs: false,
						customBranding: false,
						apiAccess: true,
						webhooks: true,
						customDomains: false,
						advancedSecurity: false,
						workersView: false,
						logStreaming: false,
						externalSecrets: false,
						sourceControl: false,
						variables: false,
						ldapAuth: false,
						advancedInsights: false,
					},
					subscriptions: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					apiEndpoints: {
						trial: null,
						registration: 'http://localhost:5678/api/v1/license/community-registered',
						activation: 'http://localhost:5678/api/v1/license/activate',
						renewal: 'http://localhost:5678/api/v1/license/renew',
						generateEnterpriseOwner:
							'http://localhost:5678/api/v1/license/generate-enterprise-owner',
					},
					urls: {
						upgrade: 'http://localhost:5678/subscription/upgrade',
						support: 'http://localhost:5678/support',
						documentation: 'http://localhost:5678/docs',
					},
				},
			];

			localLicenseApiService.getAvailablePlansWithEndpoints.mockResolvedValue(mockPlans);

			const result = await licenseController.getAvailablePlans();

			expect(result).toEqual(mockPlans);
			expect(localLicenseApiService.getAvailablePlansWithEndpoints).toHaveBeenCalledTimes(1);
		});
	});

	describe('requestEnterpriseTrialLocal', () => {
		it('should request enterprise trial locally', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			localLicenseApiService.requestEnterpriseTrial.mockResolvedValue();

			const result = await licenseController.requestEnterpriseTrialLocal(mockRequest);

			expect(result).toEqual({
				success: true,
				message: 'Enterprise trial request processed successfully',
			});
			expect(localLicenseApiService.requestEnterpriseTrial).toHaveBeenCalledWith({
				licenseType: 'enterprise',
				firstName: 'John',
				lastName: 'Doe',
				email: 'test@example.com',
				instanceUrl: 'http://localhost:5678',
			});
		});

		it('should handle local trial request error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			localLicenseApiService.requestEnterpriseTrial.mockRejectedValue(
				new Error('Trial request failed'),
			);

			await expect(licenseController.requestEnterpriseTrialLocal(mockRequest)).rejects.toThrow(
				new BadRequestError('Trial request failed'),
			);
		});
	});

	describe('registerCommunityEditionLocal', () => {
		const payload: CommunityRegisteredRequestDto = {
			email: 'test@example.com',
		};

		it('should register community edition locally', async () => {
			const mockResponse = {
				title: 'Welcome!',
				text: 'Registration successful',
				licenseKey: 'COMM-ABC123-DEF456',
			};

			localLicenseApiService.registerCommunityEdition.mockResolvedValue(mockResponse);

			const result = await licenseController.registerCommunityEditionLocal(
				mockRequest,
				{} as Response,
				payload,
			);

			expect(result).toEqual(mockResponse);
			expect(localLicenseApiService.registerCommunityEdition).toHaveBeenCalledWith({
				email: 'test@example.com',
				instanceId: 'instance-123',
				instanceUrl: 'http://localhost:5678',
				licenseType: 'community-registered',
			});
		});
	});

	describe('generateEnterpriseOwnerLicense', () => {
		it('should generate enterprise owner license successfully', async () => {
			const mockLicenseKey = 'ENT-OWNER123-ABC456-DEF789';

			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced.mockResolvedValue(
				mockLicenseKey,
			);

			const result = await licenseController.generateEnterpriseOwnerLicense(mockRequest);

			expect(result).toEqual({
				success: true,
				message: 'Enterprise license generated successfully for global:owner',
				licenseKey: mockLicenseKey,
				owner: 'global:owner',
				user: {
					id: 'user-123',
					email: 'test@example.com',
					role: { slug: 'global:owner' },
				},
			});
		});

		it('should handle generation error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced.mockRejectedValue(
				new Error('Generation failed'),
			);

			await expect(licenseController.generateEnterpriseOwnerLicense(mockRequest)).rejects.toThrow(
				new BadRequestError(
					'Failed to generate enterprise license for global:owner: Generation failed',
				),
			);
		});

		it('should handle unknown error', async () => {
			ownerAccessControlService.validateOwnerPermission.mockResolvedValue();
			localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced.mockRejectedValue(
				'unknown error',
			);

			await expect(licenseController.generateEnterpriseOwnerLicense(mockRequest)).rejects.toThrow(
				new BadRequestError(
					'Failed to generate enterprise license for global:owner - Unknown error',
				),
			);
		});
	});

	describe('getLicenseInfo', () => {
		it('should return license info', async () => {
			const mockLicenseInfo = {
				licenseKey: 'test-key-123',
				type: 'enterprise' as const,
				isValid: true,
				isActive: true,
				planName: 'Enterprise',
				expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				features: {
					advancedNodes: true,
					prioritySupport: true,
					sso: true,
					auditLogs: true,
					customBranding: true,
					apiAccess: true,
					webhooks: true,
					customDomains: true,
					advancedSecurity: true,
					workersView: true,
					logStreaming: true,
					externalSecrets: true,
					sourceControl: true,
					variables: true,
					ldapAuth: true,
					advancedInsights: true,
				},
			};

			localLicenseApiService.getLicenseInfo.mockResolvedValue(mockLicenseInfo);

			const result = await licenseController.getLicenseInfo({
				params: { licenseKey: 'test-key-123' },
			});

			expect(result).toEqual(mockLicenseInfo);
			expect(localLicenseApiService.getLicenseInfo).toHaveBeenCalledWith('test-key-123');
		});
	});

	describe('validateLicenseKey', () => {
		it('should validate license key', async () => {
			const mockValidation = { valid: true, type: 'enterprise' as const };

			localLicenseApiService.validateLicenseKey.mockReturnValue(mockValidation);

			const result = await licenseController.validateLicenseKey({
				licenseKey: 'test-key-123',
			});

			expect(result).toEqual(mockValidation);
			expect(localLicenseApiService.validateLicenseKey).toHaveBeenCalledWith('test-key-123');
		});
	});

	describe('getDebugPlans', () => {
		it('should return debug plans successfully', async () => {
			const mockPlans = [
				{
					id: 'plan-1',
					slug: 'community',
					name: 'Community',
					isActive: true,
					description: 'Free community plan',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: 5000,
					activeWorkflowsLimit: 5,
					credentialsLimit: 5,
					usersLimit: 1,
					storageLimit: 1,
					trialDays: 0,
					isPopular: false,
					sortOrder: 1,
					features: {
						advancedNodes: false,
						prioritySupport: false,
						sso: false,
						auditLogs: false,
						customBranding: false,
						apiAccess: true,
						webhooks: true,
						customDomains: false,
						advancedSecurity: false,
						workersView: false,
						logStreaming: false,
						externalSecrets: false,
						sourceControl: false,
						variables: false,
						ldapAuth: false,
						advancedInsights: false,
					},
					subscriptions: [],
					createdAt: new Date(),
					updatedAt: new Date(),
					apiEndpoints: {
						trial: null,
						registration: 'http://localhost:5678/api/v1/license/community-registered',
						activation: 'http://localhost:5678/api/v1/license/activate',
						renewal: 'http://localhost:5678/api/v1/license/renew',
						generateEnterpriseOwner:
							'http://localhost:5678/api/v1/license/generate-enterprise-owner',
					},
					urls: {
						upgrade: 'http://localhost:5678/subscription/upgrade',
						support: 'http://localhost:5678/support',
						documentation: 'http://localhost:5678/docs',
					},
				},
			];

			localLicenseApiService.getAvailablePlansWithEndpoints.mockResolvedValue(mockPlans);

			const result = await licenseController.getDebugPlans();

			expect(result).toEqual({
				success: true,
				plansCount: 1,
				plans: [{ id: 'plan-1', slug: 'community', name: 'Community', isActive: true }],
			});
		});

		it('should handle error in debug plans', async () => {
			localLicenseApiService.getAvailablePlansWithEndpoints.mockRejectedValue(
				new Error('Plans fetch failed'),
			);

			const result = await licenseController.getDebugPlans();

			expect(result).toEqual({
				success: false,
				error: 'Plans fetch failed',
			});
		});

		it('should handle unknown error in debug plans', async () => {
			localLicenseApiService.getAvailablePlansWithEndpoints.mockRejectedValue('unknown error');

			const result = await licenseController.getDebugPlans();

			expect(result).toEqual({
				success: false,
				error: 'Unknown error',
			});
		});
	});
});
