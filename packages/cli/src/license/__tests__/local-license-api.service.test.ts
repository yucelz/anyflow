import { mock } from 'jest-mock-extended';
import { Logger } from '@n8n/backend-common';
import { SubscriptionPlanRepository, UserSubscriptionRepository } from '@n8n/db';
import type { User } from '@n8n/db';
import { EventService } from '@/events/event.service';
import { UrlService } from '@/services/url.service';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { randomBytes } from 'crypto';

import {
	LocalLicenseApiService,
	CommunityRegistrationResponse,
} from '../local-license-api.service';

// Mock crypto
jest.mock('crypto', () => ({
	randomBytes: jest.fn(),
}));

describe('LocalLicenseApiService', () => {
	const logger = mock<Logger>();
	const subscriptionPlanRepository = mock<SubscriptionPlanRepository>();
	const userSubscriptionRepository = mock<UserSubscriptionRepository>();
	const eventService = mock<EventService>();
	const urlService = mock<UrlService>();

	const localLicenseApiService = new LocalLicenseApiService(
		logger,
		subscriptionPlanRepository,
		userSubscriptionRepository,
		eventService,
		urlService,
	);

	const mockUser: User = {
		id: 'user-123',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		password: 'hashedPassword',
		role: { slug: 'global:owner' },
		createdAt: new Date(),
		updatedAt: new Date(),
	} as User;

	const mockEnterprisePlan = {
		id: 'plan-123',
		slug: 'enterprise-trial',
		name: 'Enterprise Trial',
		description: '30-day enterprise trial with full features',
		monthlyPrice: 0,
		yearlyPrice: 0,
		monthlyExecutionsLimit: 100000,
		activeWorkflowsLimit: 1000,
		credentialsLimit: 1000,
		usersLimit: 50,
		storageLimit: 100,
		trialDays: 30,
		isActive: true,
		isPopular: false,
		sortOrder: 0,
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
		subscriptions: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockCommunityPlan = {
		id: 'plan-456',
		slug: 'community',
		name: 'Community',
		description: 'Free community edition with basic features',
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
	};

	beforeEach(() => {
		jest.clearAllMocks();
		urlService.getInstanceBaseUrl.mockReturnValue('http://localhost:5678');
		urlService.getWebhookBaseUrl.mockReturnValue('http://localhost:5678');
		(randomBytes as jest.Mock).mockReturnValue(Buffer.from('abcdef123456', 'hex'));
	});

	describe('requestEnterpriseTrial', () => {
		const trialRequest = {
			licenseType: 'enterprise' as const,
			firstName: 'John',
			lastName: 'Doe',
			email: 'test@example.com',
			instanceUrl: 'http://localhost:5678',
		};

		it('should process enterprise trial request successfully', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockEnterprisePlan);

			await localLicenseApiService.requestEnterpriseTrial(trialRequest);

			expect(subscriptionPlanRepository.findActiveBySlug).toHaveBeenCalledWith('enterprise-trial');
			expect(logger.info).toHaveBeenCalledWith('Processing enterprise trial request', {
				email: 'test@example.com',
				instanceUrl: 'http://localhost:5678',
			});
			expect(logger.info).toHaveBeenCalledWith('Enterprise trial request processed successfully', {
				email: 'test@example.com',
				licenseKey: expect.stringMatching(/^TRIAL-/),
			});
		});

		it('should create enterprise trial plan if it does not exist', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(null);
			subscriptionPlanRepository.create.mockReturnValue(mockEnterprisePlan);
			subscriptionPlanRepository.save.mockResolvedValue(mockEnterprisePlan);

			await localLicenseApiService.requestEnterpriseTrial(trialRequest);

			expect(subscriptionPlanRepository.create).toHaveBeenCalled();
			expect(subscriptionPlanRepository.save).toHaveBeenCalledWith(mockEnterprisePlan);
			expect(logger.info).toHaveBeenCalledWith('Created enterprise trial plan');
		});

		it('should handle errors during trial request', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockRejectedValue(new Error('Database error'));

			await expect(localLicenseApiService.requestEnterpriseTrial(trialRequest)).rejects.toThrow(
				new BadRequestError('Failed to process enterprise trial request'),
			);

			expect(logger.error).toHaveBeenCalledWith('Failed to process enterprise trial request', {
				error: expect.any(Error),
			});
		});
	});

	describe('registerCommunityEdition', () => {
		const registrationRequest = {
			email: 'test@example.com',
			instanceId: 'instance-123',
			instanceUrl: 'http://localhost:5678',
			licenseType: 'community-registered',
		};

		it('should register community edition successfully', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockCommunityPlan);

			const result = await localLicenseApiService.registerCommunityEdition(registrationRequest);

			expect(result).toEqual({
				title: 'Welcome to n8n Community!',
				text: 'Thank you for registering your n8n community instance. Your license has been activated.',
				licenseKey: expect.stringMatching(/^COMM-/),
			});

			expect(subscriptionPlanRepository.findActiveBySlug).toHaveBeenCalledWith('community');
			expect(logger.info).toHaveBeenCalledWith('Processing community edition registration', {
				email: 'test@example.com',
				instanceId: 'instance-123',
			});
		});

		it('should create community plan if it does not exist', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(null);
			subscriptionPlanRepository.create.mockReturnValue(mockCommunityPlan);
			subscriptionPlanRepository.save.mockResolvedValue(mockCommunityPlan);

			await localLicenseApiService.registerCommunityEdition(registrationRequest);

			expect(subscriptionPlanRepository.create).toHaveBeenCalled();
			expect(subscriptionPlanRepository.save).toHaveBeenCalledWith(mockCommunityPlan);
			expect(logger.info).toHaveBeenCalledWith('Created community plan');
		});

		it('should handle errors during community registration', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockRejectedValue(new Error('Database error'));

			await expect(
				localLicenseApiService.registerCommunityEdition(registrationRequest),
			).rejects.toThrow(new BadRequestError('Failed to register community edition'));

			expect(logger.error).toHaveBeenCalledWith(
				'Failed to process community edition registration',
				{
					error: expect.any(Error),
				},
			);
		});
	});

	describe('getAvailablePlansWithEndpoints', () => {
		it('should return plans with API endpoints', async () => {
			const plans = [mockCommunityPlan, mockEnterprisePlan];
			subscriptionPlanRepository.findAllActive.mockResolvedValue(plans);

			const result = await localLicenseApiService.getAvailablePlansWithEndpoints();

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({
				...mockCommunityPlan,
				apiEndpoints: {
					trial: null,
					registration: 'http://localhost:5678/api/v1/license/community-registered',
					activation: 'http://localhost:5678/api/v1/license/activate',
					renewal: 'http://localhost:5678/api/v1/license/renew',
					generateEnterpriseOwner: 'http://localhost:5678/api/v1/license/generate-enterprise-owner',
				},
				urls: {
					upgrade: 'http://localhost:5678/subscription/upgrade',
					support: 'http://localhost:5678/support',
					documentation: 'http://localhost:5678/docs',
				},
			});

			expect(result[1]).toEqual({
				...mockEnterprisePlan,
				apiEndpoints: {
					trial: 'http://localhost:5678/api/v1/license/enterprise-trial',
					registration: 'http://localhost:5678/api/v1/license/community-registered',
					activation: 'http://localhost:5678/api/v1/license/activate',
					renewal: 'http://localhost:5678/api/v1/license/renew',
					generateEnterpriseOwner: 'http://localhost:5678/api/v1/license/generate-enterprise-owner',
				},
				urls: {
					upgrade: 'http://localhost:5678/subscription/upgrade',
					support: 'http://localhost:5678/support',
					documentation: 'http://localhost:5678/docs',
				},
			});
		});
	});

	describe('generateEnterpriseOwnerLicense', () => {
		it('should generate enterprise owner license successfully', async () => {
			const mockEnterprisePlan = { ...mockEnterprisePlan, slug: 'enterprise' };
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockEnterprisePlan);

			const result = await localLicenseApiService.generateEnterpriseOwnerLicense();

			expect(result).toMatch(/^ENT-/);
			expect(subscriptionPlanRepository.findActiveBySlug).toHaveBeenCalledWith('enterprise');
			expect(logger.info).toHaveBeenCalledWith(
				'Generating automatic enterprise license for global:owner',
			);
		});

		it('should create enterprise plan if it does not exist', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(null);
			const newEnterprisePlan = { ...mockEnterprisePlan, slug: 'enterprise' };
			subscriptionPlanRepository.create.mockReturnValue(newEnterprisePlan);
			subscriptionPlanRepository.save.mockResolvedValue(newEnterprisePlan);

			await localLicenseApiService.generateEnterpriseOwnerLicense();

			expect(subscriptionPlanRepository.create).toHaveBeenCalled();
			expect(subscriptionPlanRepository.save).toHaveBeenCalledWith(newEnterprisePlan);
		});

		it('should handle errors during license generation', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockRejectedValue(new Error('Database error'));

			await expect(localLicenseApiService.generateEnterpriseOwnerLicense()).rejects.toThrow(
				new BadRequestError('Failed to generate enterprise license for global:owner'),
			);
		});
	});

	describe('generateEnterpriseOwnerLicenseEnhanced', () => {
		it('should generate enhanced enterprise owner license successfully', async () => {
			const mockEnterprisePlan = { ...mockEnterprisePlan, slug: 'enterprise' };
			subscriptionPlanRepository.findAllActive.mockResolvedValue([mockEnterprisePlan]);
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockEnterprisePlan);

			const result = await localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced(mockUser);

			expect(result).toMatch(/^ENT-/);
			expect(logger.info).toHaveBeenCalledWith(
				'Generating enhanced enterprise license for global:owner',
				{
					userId: 'user-123',
					email: 'test@example.com',
				},
			);
		});

		it('should handle database connection issues', async () => {
			subscriptionPlanRepository.findAllActive.mockRejectedValue(new Error('Connection failed'));

			await expect(
				localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced(mockUser),
			).rejects.toThrow(
				new BadRequestError('Enhanced license generation failed: Connection failed'),
			);
		});
	});

	describe('validateLicenseKey', () => {
		it('should validate trial license key', () => {
			const result = localLicenseApiService.validateLicenseKey('TRIAL-ABC123-DEF456');

			expect(result).toEqual({
				valid: true,
				type: 'trial',
			});
		});

		it('should validate community license key', () => {
			const result = localLicenseApiService.validateLicenseKey('COMM-ABC123-DEF456');

			expect(result).toEqual({
				valid: true,
				type: 'community',
			});
		});

		it('should validate enterprise license key', () => {
			const result = localLicenseApiService.validateLicenseKey('ENT-ABC123-DEF456-GHI789');

			expect(result).toEqual({
				valid: true,
				type: 'enterprise',
			});
		});

		it('should return invalid for malformed license key', () => {
			const result = localLicenseApiService.validateLicenseKey('INVALID-KEY');

			expect(result).toEqual({
				valid: false,
				type: 'unknown',
			});
		});

		it('should return invalid for null license key', () => {
			const result = localLicenseApiService.validateLicenseKey(null as any);

			expect(result).toEqual({
				valid: false,
				type: 'unknown',
			});
		});

		it('should return invalid for empty license key', () => {
			const result = localLicenseApiService.validateLicenseKey('');

			expect(result).toEqual({
				valid: false,
				type: 'unknown',
			});
		});
	});

	describe('getLicenseInfo', () => {
		it('should return trial license info', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockEnterprisePlan);

			const result = await localLicenseApiService.getLicenseInfo('TRIAL-ABC123-DEF456');

			expect(result).toEqual({
				licenseKey: 'TRIAL-ABC123-DEF456',
				type: 'trial',
				isValid: true,
				isActive: true,
				planName: 'Enterprise Trial',
				expiresAt: expect.any(Date),
				features: mockEnterprisePlan.features,
			});
		});

		it('should return community license info', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockCommunityPlan);

			const result = await localLicenseApiService.getLicenseInfo('COMM-ABC123-DEF456');

			expect(result).toEqual({
				licenseKey: 'COMM-ABC123-DEF456',
				type: 'community',
				isValid: true,
				isActive: true,
				planName: 'Community',
				expiresAt: null,
				features: mockCommunityPlan.features,
			});
		});

		it('should return enterprise license info', async () => {
			const enterprisePlan = { ...mockEnterprisePlan, slug: 'enterprise', name: 'Enterprise' };
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(enterprisePlan);

			const result = await localLicenseApiService.getLicenseInfo('ENT-ABC123-DEF456-GHI789');

			expect(result).toEqual({
				licenseKey: 'ENT-ABC123-DEF456-GHI789',
				type: 'enterprise',
				isValid: true,
				isActive: true,
				planName: 'Enterprise',
				expiresAt: expect.any(Date),
				features: enterprisePlan.features,
			});
		});

		it('should throw error for invalid license key format', async () => {
			await expect(localLicenseApiService.getLicenseInfo('INVALID-KEY')).rejects.toThrow(
				new BadRequestError('Invalid license key format'),
			);
		});

		it('should throw error for unknown license type', async () => {
			await expect(localLicenseApiService.getLicenseInfo('UNK-ABC123-DEF456')).rejects.toThrow(
				new BadRequestError('Unknown license type'),
			);
		});
	});

	describe('license key generation', () => {
		it('should generate trial license key with correct format', () => {
			const licenseKey = (localLicenseApiService as any).generateTrialLicenseKey();

			expect(licenseKey).toMatch(/^TRIAL-[A-Z0-9]+-[A-Z0-9]+$/);
		});

		it('should generate community license key with correct format', () => {
			const licenseKey = (localLicenseApiService as any).generateCommunityLicenseKey(
				'instance-123',
			);

			expect(licenseKey).toMatch(/^COMM-[A-Z0-9]+-[A-Z0-9]+$/);
		});

		it('should generate enterprise license key with correct format', () => {
			const licenseKey = (localLicenseApiService as any).generateEnterpriseLicenseKey();

			expect(licenseKey).toMatch(/^ENT-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/);
		});
	});

	describe('feature retrieval', () => {
		it('should get enterprise features', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockEnterprisePlan);

			const features = await (localLicenseApiService as any).getEnterpriseFeatures();

			expect(features).toEqual(mockEnterprisePlan.features);
		});

		it('should get community features', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(mockCommunityPlan);

			const features = await (localLicenseApiService as any).getCommunityFeatures();

			expect(features).toEqual(mockCommunityPlan.features);
		});

		it('should return default enterprise features if plan not found', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(null);

			const features = await (localLicenseApiService as any).getEnterpriseFeatures();

			expect(features).toEqual({
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
			});
		});

		it('should return default community features if plan not found', async () => {
			subscriptionPlanRepository.findActiveBySlug.mockResolvedValue(null);

			const features = await (localLicenseApiService as any).getCommunityFeatures();

			expect(features).toEqual({
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
			});
		});
	});
});
