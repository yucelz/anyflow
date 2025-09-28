import { mock } from 'jest-mock-extended';
import { Logger } from '@n8n/backend-common';
import { LicenseApprovalRepository, OwnerManagementRepository } from '@n8n/db';
import { LicenseApprovalEntity, ApprovalType, ApprovalPriority } from '@n8n/db';
import { generateNanoId } from '@n8n/db';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import {
	ApprovalWorkflowService,
	SubmitApprovalRequest,
	ProcessApprovalRequest,
} from '../approval-workflow.service';

// Mock generateNanoId
jest.mock('@n8n/db', () => ({
	...jest.requireActual('@n8n/db'),
	generateNanoId: jest.fn(),
}));

describe('ApprovalWorkflowService', () => {
	const logger = mock<Logger>();
	const approvalRepository = mock<LicenseApprovalRepository>();
	const ownerRepository = mock<OwnerManagementRepository>();

	const approvalWorkflowService = new ApprovalWorkflowService(
		logger,
		approvalRepository,
		ownerRepository,
	);

	const mockApproval = mock<LicenseApprovalEntity>({
		id: 'approval-123',
		licenseId: 'license-123',
		requestedBy: 'user-123',
		approvalType: 'creation',
		requestData: { licenseType: 'enterprise' },
		status: 'pending',
		priority: 'medium',
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		createdAt: new Date(),
		updatedAt: new Date(),
		processedBy: null,
		processedAt: null,
		reason: null,
	});

	beforeEach(() => {
		jest.clearAllMocks();
		(generateNanoId as jest.Mock).mockReturnValue('approval-123');
	});

	describe('submitApproval', () => {
		const submitRequest: SubmitApprovalRequest = {
			licenseId: 'license-123',
			requestedBy: 'user-123',
			approvalType: 'creation',
			requestData: { licenseType: 'enterprise' },
			priority: 'medium',
		};

		it('should submit approval request successfully', async () => {
			approvalRepository.create.mockReturnValue(mockApproval);
			approvalRepository.save.mockResolvedValue(mockApproval);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([]);

			const result = await approvalWorkflowService.submitApproval(submitRequest);

			expect(result).toEqual(mockApproval);
			expect(approvalRepository.create).toHaveBeenCalledWith({
				id: 'approval-123',
				licenseId: 'license-123',
				requestedBy: 'user-123',
				approvalType: 'creation',
				requestData: { licenseType: 'enterprise' },
				status: 'pending',
				priority: 'medium',
				expiresAt: expect.any(Date),
			});
			expect(approvalRepository.save).toHaveBeenCalledWith(mockApproval);
			expect(logger.info).toHaveBeenCalledWith('Submitting approval request', {
				request: submitRequest,
			});
			expect(logger.info).toHaveBeenCalledWith('Approval request submitted', {
				approvalId: 'approval-123',
			});
		});

		it('should check for auto-approval', async () => {
			const mockOwner = mock({
				id: 'owner-123',
				ownerId: 'owner-123',
				permissions: {
					canCreateLicenses: true,
					canApproveLicenses: true,
					canRevokeLicenses: true,
					canViewAuditLogs: true,
					canManageSettings: true,
				},
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: { maxValidityDays: 365 },
				},
				delegatedUsers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			approvalRepository.create.mockReturnValue(mockApproval);
			approvalRepository.save.mockResolvedValue(mockApproval);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);
			approvalRepository.updateStatus.mockResolvedValue();

			await approvalWorkflowService.submitApproval(submitRequest);

			expect(ownerRepository.findOwnersWithAutoApproval).toHaveBeenCalled();
		});

		it('should notify owners about new approval request', async () => {
			approvalRepository.create.mockReturnValue(mockApproval);
			approvalRepository.save.mockResolvedValue(mockApproval);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([]);

			await approvalWorkflowService.submitApproval(submitRequest);

			expect(logger.info).toHaveBeenCalledWith('Notifying owners about new approval request', {
				approvalId: 'approval-123',
			});
		});
	});

	describe('processApproval', () => {
		const processRequest: ProcessApprovalRequest = {
			decision: 'approve',
			reason: 'Approved for testing',
			processedBy: 'owner-123',
		};

		it('should process approval successfully', async () => {
			approvalRepository.findOne.mockResolvedValue(mockApproval);
			approvalRepository.updateStatus.mockResolvedValue();

			await approvalWorkflowService.processApproval('approval-123', processRequest);

			expect(approvalRepository.findOne).toHaveBeenCalledWith({
				where: { id: 'approval-123' },
				relations: ['license', 'requestedByUser'],
			});
			expect(approvalRepository.updateStatus).toHaveBeenCalledWith(
				'approval-123',
				'approved',
				'owner-123',
				'Approved for testing',
			);
			expect(logger.info).toHaveBeenCalledWith('Processing approval', {
				approvalId: 'approval-123',
				request: processRequest,
			});
			expect(logger.info).toHaveBeenCalledWith('Approval processed', {
				approvalId: 'approval-123',
				status: 'approved',
			});
		});

		it('should handle rejection', async () => {
			const rejectRequest: ProcessApprovalRequest = {
				decision: 'reject',
				reason: 'Insufficient justification',
				processedBy: 'owner-123',
			};

			approvalRepository.findOne.mockResolvedValue(mockApproval);
			approvalRepository.updateStatus.mockResolvedValue();

			await approvalWorkflowService.processApproval('approval-123', rejectRequest);

			expect(approvalRepository.updateStatus).toHaveBeenCalledWith(
				'approval-123',
				'rejected',
				'owner-123',
				'Insufficient justification',
			);
		});

		it('should throw error if approval not found', async () => {
			approvalRepository.findOne.mockResolvedValue(null);

			await expect(
				approvalWorkflowService.processApproval('approval-123', processRequest),
			).rejects.toThrow(new BadRequestError('Approval request not found'));

			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});

		it('should throw error if approval is not pending', async () => {
			const processedApproval = mock<LicenseApprovalEntity>({
				...mockApproval,
				status: 'approved',
			});
			approvalRepository.findOne.mockResolvedValue(processedApproval);

			await expect(
				approvalWorkflowService.processApproval('approval-123', processRequest),
			).rejects.toThrow(new BadRequestError('Approval request is not pending'));

			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});

		it('should throw error if approval has expired', async () => {
			const expiredApproval = mock<LicenseApprovalEntity>({
				...mockApproval,
				expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
			});
			approvalRepository.findOne.mockResolvedValue(expiredApproval);

			await expect(
				approvalWorkflowService.processApproval('approval-123', processRequest),
			).rejects.toThrow(new BadRequestError('Approval request has expired'));

			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});
	});

	describe('getApprovalQueue', () => {
		it('should return pending approvals', async () => {
			const pendingApprovals = [mockApproval];
			approvalRepository.findPendingApprovals.mockResolvedValue(pendingApprovals);

			const result = await approvalWorkflowService.getApprovalQueue();

			expect(result).toEqual(pendingApprovals);
			expect(approvalRepository.findPendingApprovals).toHaveBeenCalled();
		});
	});

	describe('expireOldApprovals', () => {
		it('should expire old approvals and return count', async () => {
			approvalRepository.expireOldApprovals.mockResolvedValue(5);

			const result = await approvalWorkflowService.expireOldApprovals();

			expect(result).toBe(5);
			expect(approvalRepository.expireOldApprovals).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith('Expiring old approvals');
			expect(logger.info).toHaveBeenCalledWith('Expired old approvals', { count: 5 });
		});
	});

	describe('autoProcessApprovals', () => {
		it('should auto-process pending approvals', async () => {
			const pendingApprovals = [mockApproval];
			approvalRepository.findPendingApprovals.mockResolvedValue(pendingApprovals);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([]);

			await approvalWorkflowService.autoProcessApprovals();

			expect(approvalRepository.findPendingApprovals).toHaveBeenCalled();
			expect(logger.info).toHaveBeenCalledWith('Auto-processing approvals');
			expect(logger.info).toHaveBeenCalledWith('Auto-processing completed', { processed: 1 });
		});

		it('should auto-approve when criteria are met', async () => {
			const mockOwner = mock({
				id: 'owner-123',
				ownerId: 'owner-123',
				permissions: {
					canCreateLicenses: true,
					canApproveLicenses: true,
					canRevokeLicenses: true,
					canViewAuditLogs: true,
					canManageSettings: true,
				},
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: { maxValidityDays: 365, allowedLicenseTypes: ['enterprise'] },
				},
				delegatedUsers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const approvalWithValidData = mock<LicenseApprovalEntity>({
				...mockApproval,
				requestData: { licenseType: 'enterprise', validityDays: 30 },
			});

			approvalRepository.findPendingApprovals.mockResolvedValue([approvalWithValidData]);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);
			approvalRepository.updateStatus.mockResolvedValue();

			await approvalWorkflowService.autoProcessApprovals();

			expect(approvalRepository.updateStatus).toHaveBeenCalledWith(
				'approval-123',
				'approved',
				'owner-123',
				'Auto-approved based on criteria',
			);
			expect(logger.info).toHaveBeenCalledWith('Auto-approved approval', {
				approvalId: 'approval-123',
				ownerId: 'owner-123',
			});
		});
	});

	describe('meetsAutoApprovalCriteria', () => {
		it('should return false if validity days exceed limit', async () => {
			const mockOwner = mock({
				ownerId: 'owner-123',
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: { maxValidityDays: 30 },
				},
			});

			const approvalWithLongValidity = mock<LicenseApprovalEntity>({
				...mockApproval,
				requestData: { validityDays: 365 },
			});

			approvalRepository.findPendingApprovals.mockResolvedValue([approvalWithLongValidity]);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);

			await approvalWorkflowService.autoProcessApprovals();

			// Should not auto-approve
			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});

		it('should return false if license type is not allowed', async () => {
			const mockOwner = mock({
				ownerId: 'owner-123',
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: { allowedLicenseTypes: ['community'] },
				},
			});

			const approvalWithDisallowedType = mock<LicenseApprovalEntity>({
				...mockApproval,
				requestData: { licenseType: 'enterprise' },
			});

			approvalRepository.findPendingApprovals.mockResolvedValue([approvalWithDisallowedType]);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);

			await approvalWorkflowService.autoProcessApprovals();

			// Should not auto-approve
			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});

		it('should return false if priority exceeds maximum', async () => {
			const mockOwner = mock({
				ownerId: 'owner-123',
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: { maxPriority: 'low' },
				},
			});

			const highPriorityApproval = mock<LicenseApprovalEntity>({
				...mockApproval,
				priority: 'high',
			});

			approvalRepository.findPendingApprovals.mockResolvedValue([highPriorityApproval]);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);

			await approvalWorkflowService.autoProcessApprovals();

			// Should not auto-approve
			expect(approvalRepository.updateStatus).not.toHaveBeenCalled();
		});

		it('should return true when all criteria are met', async () => {
			const mockOwner = mock({
				ownerId: 'owner-123',
				settings: {
					autoApprovalEnabled: true,
					autoApprovalCriteria: {
						maxValidityDays: 365,
						allowedLicenseTypes: ['enterprise'],
						maxPriority: 'high',
					},
				},
			});

			const validApproval = mock<LicenseApprovalEntity>({
				...mockApproval,
				requestData: { licenseType: 'enterprise', validityDays: 30 },
				priority: 'medium',
			});

			approvalRepository.findPendingApprovals.mockResolvedValue([validApproval]);
			ownerRepository.findOwnersWithAutoApproval.mockResolvedValue([mockOwner]);
			approvalRepository.updateStatus.mockResolvedValue();

			await approvalWorkflowService.autoProcessApprovals();

			expect(approvalRepository.updateStatus).toHaveBeenCalledWith(
				'approval-123',
				'approved',
				'owner-123',
				'Auto-approved based on criteria',
			);
		});
	});
});
