import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { LicenseApprovalRepository, OwnerManagementRepository } from '@n8n/db';
import { LicenseApprovalEntity, ApprovalType, ApprovalPriority } from '@n8n/db';
import { generateNanoId } from '@n8n/db';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

export interface SubmitApprovalRequest {
	licenseId: string;
	requestedBy: string;
	approvalType: ApprovalType;
	requestData: Record<string, any>;
	priority: ApprovalPriority;
}

export interface ProcessApprovalRequest {
	decision: 'approve' | 'reject';
	reason?: string;
	processedBy: string;
}

@Service()
export class ApprovalWorkflowService {
	constructor(
		private readonly logger: Logger,
		private readonly approvalRepository: LicenseApprovalRepository,
		private readonly ownerRepository: OwnerManagementRepository,
	) {}

	async submitApproval(request: SubmitApprovalRequest): Promise<LicenseApprovalEntity> {
		this.logger.info('Submitting approval request', { request });

		// Calculate expiration date (default 7 days)
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		const approval = this.approvalRepository.create({
			id: generateNanoId(),
			licenseId: request.licenseId,
			requestedBy: request.requestedBy,
			approvalType: request.approvalType,
			requestData: request.requestData,
			status: 'pending',
			priority: request.priority,
			expiresAt,
		});

		const savedApproval = await this.approvalRepository.save(approval);

		// Check for auto-approval
		await this.checkAutoApproval(savedApproval);

		// TODO: Send notifications to owners
		await this.notifyOwners(savedApproval);

		this.logger.info('Approval request submitted', { approvalId: savedApproval.id });
		return savedApproval;
	}

	async processApproval(approvalId: string, request: ProcessApprovalRequest): Promise<void> {
		this.logger.info('Processing approval', { approvalId, request });

		const approval = await this.approvalRepository.findOne({
			where: { id: approvalId },
			relations: ['license', 'requestedByUser'],
		});

		if (!approval) {
			throw new BadRequestError('Approval request not found');
		}

		if (approval.status !== 'pending') {
			throw new BadRequestError('Approval request is not pending');
		}

		// Check if approval has expired
		if (approval.expiresAt < new Date()) {
			throw new BadRequestError('Approval request has expired');
		}

		// Update approval status
		const status = request.decision === 'approve' ? 'approved' : 'rejected';
		await this.approvalRepository.updateStatus(
			approvalId,
			status,
			request.processedBy,
			request.reason,
		);

		this.logger.info('Approval processed', { approvalId, status });
	}

	async getApprovalQueue(): Promise<LicenseApprovalEntity[]> {
		return await this.approvalRepository.findPendingApprovals();
	}

	async expireOldApprovals(): Promise<number> {
		this.logger.info('Expiring old approvals');
		const expiredCount = await this.approvalRepository.expireOldApprovals();
		this.logger.info('Expired old approvals', { count: expiredCount });
		return expiredCount;
	}

	async autoProcessApprovals(): Promise<void> {
		this.logger.info('Auto-processing approvals');

		const pendingApprovals = await this.approvalRepository.findPendingApprovals();

		for (const approval of pendingApprovals) {
			await this.checkAutoApproval(approval);
		}

		this.logger.info('Auto-processing completed', { processed: pendingApprovals.length });
	}

	private async checkAutoApproval(approval: LicenseApprovalEntity): Promise<void> {
		// Get all owners with auto-approval enabled
		const owners = await this.ownerRepository.findOwnersWithAutoApproval();

		for (const owner of owners) {
			const settings = owner.settings;

			if (!settings.autoApprovalEnabled) {
				continue;
			}

			// Check if approval meets auto-approval criteria
			if (this.meetsAutoApprovalCriteria(approval, settings.autoApprovalCriteria)) {
				await this.approvalRepository.updateStatus(
					approval.id,
					'approved',
					owner.ownerId,
					'Auto-approved based on criteria',
				);

				this.logger.info('Auto-approved approval', {
					approvalId: approval.id,
					ownerId: owner.ownerId,
				});
				break;
			}
		}
	}

	private meetsAutoApprovalCriteria(
		approval: LicenseApprovalEntity,
		criteria: Record<string, any>,
	): boolean {
		// Simple criteria matching - can be extended
		if (criteria.maxValidityDays) {
			const requestedDays = approval.requestData?.validityDays || 365;
			if (requestedDays > criteria.maxValidityDays) {
				return false;
			}
		}

		if (criteria.allowedLicenseTypes) {
			const requestedType = approval.requestData?.licenseType;
			if (!criteria.allowedLicenseTypes.includes(requestedType)) {
				return false;
			}
		}

		if (criteria.maxPriority) {
			const priorityLevels: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
			const requestedPriority = priorityLevels[approval.priority];
			const maxPriority = priorityLevels[criteria.maxPriority];

			if (requestedPriority > maxPriority) {
				return false;
			}
		}

		return true;
	}

	private async notifyOwners(approval: LicenseApprovalEntity): Promise<void> {
		// TODO: Implement notification system
		// This could send emails, push notifications, etc.
		this.logger.info('Notifying owners about new approval request', {
			approvalId: approval.id,
		});
	}
}
