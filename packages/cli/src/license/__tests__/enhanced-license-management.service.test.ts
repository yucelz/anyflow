import { mock } from 'jest-mock-extended';
import { Logger } from '@n8n/backend-common';
import {
	LicenseRepository,
	LicenseApprovalRepository,
	LicenseAuditLogRepository,
	LicenseTemplateRepository,
	OwnerManagementRepository,
	UserRepository,
} from '@n8n/db';
import {
	LicenseEntity,
	LicenseType,
	LicenseStatus,
	LicenseFeatures,
	LicenseLimits,
	LicenseTemplateEntity,
} from '@n8n/db';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import {
	EnhancedLicenseManagementService,
	CreateLicenseRequest,
	LicenseRequest,
	ApprovalDecision,
} from '../enhanced-license-management.service';
import { ApprovalWorkflowService } from '../approval-workflow.service';
import { LicenseValidationService } from '../license-validation.service';
import { OwnerAccessControlService } from '../owner-access-control.service';

// Mock randomUUID
jest.mock('crypto', () => ({
	...jest.requireActual('crypto'),
	randomUUID: jest.fn(),
}));

describe('EnhancedLicenseManagementService', () => {
	const logger = mock<Logger>();
	const licenseRepository = mock<LicenseRepository>();
	const approvalRepository = mock<LicenseApprovalRepository>();
	const auditRepository = mock<LicenseAuditLogRepository>();
	const templateRepository = mock<LicenseTemplateRepository>();
	const ownerRepository = mock<OwnerManagementRepository>();
	const userRepository = mock<UserRepository>();
	const approvalWorkflow = mock<ApprovalWorkflowService>();
	const validationService = mock<LicenseValidationService>();
	const accessControl = mock<OwnerAccessControlService>();

	const enhancedLicenseService = new EnhancedLicenseManagementService(
		logger,
		licenseRepository,
		approvalRepository,
		auditRepository,
		templateRepository,
		ownerRepository,
		userRepository,
		approvalWorkflow,
		validationService,
		accessControl,
	);

	const mockLicense = mock<LicenseEntity>({
		id: 'license-123',
		licenseKey: 'ENT-TEST123-ABC456',
		licenseType: 'enterprise',
		status: 'active',
		issuedTo: 'user-123',
		issuedBy: 'owner-123',
		validFrom: new Date(),
		validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
		features: { advancedNodes: true },
		limits: { maxUsers: 100 },
		metadata: {},
		approvalStatus: 'approved',
		subscriptionId: undefined,
		parentLicenseId: undefined,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	const mockTemplate = mock<LicenseTemplateEntity>({
		id: 'template-123',
		name: 'Enterprise Template',
		description: 'Standard enterprise license template',
		licenseType: 'enterprise',
		defaultValidityDays: 365,
		defaultFeatures: { advancedNodes: true },
		defaultLimits: { maxUsers: 100 },
		requiresApproval: true,
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	beforeEach(() => {
		jest.clearAllMocks();
		const { randomUUID } = require('crypto');
		(randomUUID as jest.Mock).mockReturnValue('license-123');
	});

	describe('createLicense', () => {
		const createRequest: CreateLicenseRequest = {
			licenseType: 'enterprise',
			issuedTo: 'user-123',
			validityDays: 365,
			features: { advancedNodes: true },
			limits: { maxUsers: 100 },
		};

		it('should create license successfully', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.create.mockReturnValue(mockLicense);
			licenseRepository.save.mockResolvedValue(mockLicense);
			auditRepository.createAuditLog.mockResolvedValue();
			approvalWorkflow.submitApproval.mockResolvedValue(mock());

			const result = await enhancedLicenseService.createLicense(createRequest, 'owner-123');

			expect(result).toEqual(mockLicense);
			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canCreateLicenses',
			);
			expect(licenseRepository.create).toHaveBeenCalled();
			expect(licenseRepository.save).toHaveBeenCalledWith(mockLicense);
			expect(auditRepository.createAuditLog).toHaveBeenCalled();
		});

		it('should use template when specified', async () => {
			const requestWithTemplate = { ...createRequest, templateId: 'template-123' };

			accessControl.validateOwnerPermission.mockResolvedValue();
			templateRepository.findOne.mockResolvedValue(mockTemplate);
			licenseRepository.create.mockReturnValue(mockLicense);
			licenseRepository.save.mockResolvedValue(mockLicense);
			auditRepository.createAuditLog.mockResolvedValue();
			approvalWorkflow.submitApproval.mockResolvedValue(mock());

			await enhancedLicenseService.createLicense(requestWithTemplate, 'owner-123');

			expect(templateRepository.findOne).toHaveBeenCalledWith({
				where: { id: 'template-123' },
			});
		});

		it('should throw error if template not found', async () => {
			const requestWithTemplate = { ...createRequest, templateId: 'template-123' };

			accessControl.validateOwnerPermission.mockResolvedValue();
			templateRepository.findOne.mockResolvedValue(null);

			await expect(
				enhancedLicenseService.createLicense(requestWithTemplate, 'owner-123'),
			).rejects.toThrow(new BadRequestError('License template not found'));
		});

		it('should handle permission validation error', async () => {
			accessControl.validateOwnerPermission.mockRejectedValue(
				new BadRequestError('Insufficient permissions'),
			);

			await expect(
				enhancedLicenseService.createLicense(createRequest, 'owner-123'),
			).rejects.toThrow('Insufficient permissions');

			expect(licenseRepository.create).not.toHaveBeenCalled();
		});

		it('should skip approval when requested', async () => {
			const requestWithSkipApproval = { ...createRequest, skipApproval: true };

			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.create.mockReturnValue(mockLicense);
			licenseRepository.save.mockResolvedValue(mockLicense);
			licenseRepository.updateApprovalStatus.mockResolvedValue();
			auditRepository.createAuditLog.mockResolvedValue();

			await enhancedLicenseService.createLicense(requestWithSkipApproval, 'owner-123');

			expect(approvalWorkflow.submitApproval).not.toHaveBeenCalled();
			expect(licenseRepository.updateApprovalStatus).toHaveBeenCalledWith(
				'license-123',
				'approved',
				'owner-123',
			);
		});
	});

	describe('activateLicense', () => {
		it('should activate license successfully', async () => {
			licenseRepository.findByLicenseKey.mockResolvedValue(mockLicense);
			validationService.validateLicenseKey.mockResolvedValue({ isValid: true });
			licenseRepository.updateStatus.mockResolvedValue();
			auditRepository.createAuditLog.mockResolvedValue();

			await enhancedLicenseService.activateLicense('ENT-TEST123-ABC456', 'user-123');

			expect(licenseRepository.findByLicenseKey).toHaveBeenCalledWith('ENT-TEST123-ABC456');
			expect(validationService.validateLicenseKey).toHaveBeenCalledWith('ENT-TEST123-ABC456');
			expect(licenseRepository.updateStatus).toHaveBeenCalledWith('license-123', 'active');
			expect(auditRepository.createAuditLog).toHaveBeenCalled();
		});

		it('should throw error if license not found', async () => {
			licenseRepository.findByLicenseKey.mockResolvedValue(null);

			await expect(
				enhancedLicenseService.activateLicense('ENT-TEST123-ABC456', 'user-123'),
			).rejects.toThrow(new BadRequestError('License not found'));
		});

		it('should throw error if license is invalid', async () => {
			licenseRepository.findByLicenseKey.mockResolvedValue(mockLicense);
			validationService.validateLicenseKey.mockResolvedValue({
				isValid: false,
				error: 'License expired',
			});

			await expect(
				enhancedLicenseService.activateLicense('ENT-TEST123-ABC456', 'user-123'),
			).rejects.toThrow(new BadRequestError('License expired'));
		});

		it('should throw error if license is not approved', async () => {
			const unapprovedLicense = { ...mockLicense, approvalStatus: 'pending' as const };
			licenseRepository.findByLicenseKey.mockResolvedValue(unapprovedLicense);
			validationService.validateLicenseKey.mockResolvedValue({ isValid: true });

			await expect(
				enhancedLicenseService.activateLicense('ENT-TEST123-ABC456', 'user-123'),
			).rejects.toThrow(new BadRequestError('License is not approved'));
		});
	});

	describe('renewLicense', () => {
		it('should renew license successfully', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.findOne.mockResolvedValue(mockLicense);
			licenseRepository.update.mockResolvedValue(mock());
			auditRepository.createAuditLog.mockResolvedValue();

			const result = await enhancedLicenseService.renewLicense('license-123', 'owner-123');

			expect(result).toEqual(mockLicense);
			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canCreateLicenses',
			);
			expect(licenseRepository.findOne).toHaveBeenCalledWith({ where: { id: 'license-123' } });
			expect(licenseRepository.update).toHaveBeenCalled();
			expect(auditRepository.createAuditLog).toHaveBeenCalled();
		});

		it('should throw error if license not found', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.findOne.mockResolvedValue(null);

			await expect(enhancedLicenseService.renewLicense('license-123', 'owner-123')).rejects.toThrow(
				new BadRequestError('License not found'),
			);
		});
	});

	describe('suspendLicense', () => {
		it('should suspend license successfully', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.findOne.mockResolvedValue(mockLicense);
			licenseRepository.updateStatus.mockResolvedValue();
			auditRepository.createAuditLog.mockResolvedValue();

			await enhancedLicenseService.suspendLicense('license-123', 'owner-123', 'Policy violation');

			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canRevokeLicenses',
			);
			expect(licenseRepository.updateStatus).toHaveBeenCalledWith('license-123', 'suspended');
			expect(auditRepository.createAuditLog).toHaveBeenCalled();
		});

		it('should throw error if license not found', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.findOne.mockResolvedValue(null);

			await expect(
				enhancedLicenseService.suspendLicense('license-123', 'owner-123', 'Policy violation'),
			).rejects.toThrow(new BadRequestError('License not found'));
		});
	});

	describe('revokeLicense', () => {
		it('should revoke license successfully', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.findOne.mockResolvedValue(mockLicense);
			licenseRepository.updateStatus.mockResolvedValue();
			auditRepository.createAuditLog.mockResolvedValue();

			await enhancedLicenseService.revokeLicense('license-123', 'owner-123', 'Expired');

			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canRevokeLicenses',
			);
			expect(licenseRepository.updateStatus).toHaveBeenCalledWith('license-123', 'revoked');
			expect(auditRepository.createAuditLog).toHaveBeenCalled();
		});
	});

	describe('submitLicenseRequest', () => {
		const licenseRequest: LicenseRequest = {
			licenseType: 'enterprise',
			requestedFeatures: { advancedNodes: true },
			requestedLimits: { maxUsers: 100 },
			justification: 'Need enterprise features for production',
			priority: 'medium',
		};

		it('should submit license request successfully', async () => {
			const mockApproval = mock();
			approvalWorkflow.submitApproval.mockResolvedValue(mockApproval);

			const result = await enhancedLicenseService.submitLicenseRequest(licenseRequest, 'user-123');

			expect(result).toEqual(mockApproval);
			expect(approvalWorkflow.submitApproval).toHaveBeenCalledWith({
				licenseId: expect.any(String),
				requestedBy: 'user-123',
				approvalType: 'creation',
				requestData: licenseRequest,
				priority: 'medium',
			});
		});
	});

	describe('processApproval', () => {
		const decision: ApprovalDecision = {
			decision: 'approve',
			reason: 'Request approved',
		};

		it('should process approval successfully', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			approvalWorkflow.processApproval.mockResolvedValue();

			await enhancedLicenseService.processApproval('approval-123', decision, 'owner-123');

			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canApproveLicenses',
			);
			expect(approvalWorkflow.processApproval).toHaveBeenCalledWith('approval-123', {
				...decision,
				processedBy: 'owner-123',
			});
		});
	});

	describe('getApprovalQueue', () => {
		it('should return approval queue', async () => {
			const mockApprovals = [mock()];
			accessControl.validateOwnerPermission.mockResolvedValue();
			approvalRepository.findPendingApprovals.mockResolvedValue(mockApprovals);

			const result = await enhancedLicenseService.getApprovalQueue('owner-123');

			expect(result).toEqual(mockApprovals);
			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canApproveLicenses',
			);
		});
	});

	describe('generateLicenseReport', () => {
		it('should generate license report', async () => {
			accessControl.validateOwnerPermission.mockResolvedValue();
			licenseRepository.count.mockResolvedValue(100);
			licenseRepository.countByStatus.mockResolvedValue(50);
			licenseRepository.countByType.mockResolvedValue(25);
			approvalRepository.countByStatus.mockResolvedValue(5);
			auditRepository.findRecentActivity.mockResolvedValue([]);

			const result = await enhancedLicenseService.generateLicenseReport('owner-123');

			expect(result).toEqual({
				totalLicenses: 100,
				activeLicenses: 50,
				expiredLicenses: 50,
				pendingApprovals: 5,
				licensesByType: {
					community: 25,
					trial: 25,
					enterprise: 25,
					custom: 25,
				},
				licensesByStatus: {
					pending: 50,
					active: 50,
					suspended: 50,
					expired: 50,
					revoked: 50,
				},
				recentActivity: [],
			});

			expect(accessControl.validateOwnerPermission).toHaveBeenCalledWith(
				'owner-123',
				'canViewAuditLogs',
			);
		});
	});

	describe('generateLicenseKey', () => {
		it('should generate license key with correct format', () => {
			const { randomUUID } = require('crypto');
			(randomUUID as jest.Mock).mockReturnValue('12345678-1234-1234-1234-123456789abc');
			const mockDate = new Date('2023-01-01T00:00:00Z');
			jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

			// Access private method through any cast for testing
			const licenseKey = (enhancedLicenseService as any).generateLicenseKey('enterprise');

			expect(licenseKey).toMatch(/^ENT-[A-Z0-9]+-[A-Z0-9]{8}$/);
		});
	});
});
