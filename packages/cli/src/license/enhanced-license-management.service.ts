import { Service } from '@n8n/di';
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
	ApprovalStatus,
	LicenseFeatures,
	LicenseLimits,
	LicenseApprovalEntity,
	ApprovalType,
	ApprovalPriority,
	LicenseTemplateEntity,
} from '@n8n/db';
import { LicenseAuditAction } from '@n8n/db';
import { generateNanoId } from '@n8n/db';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { LicenseValidationService } from './license-validation.service';
import { OwnerAccessControlService } from './owner-access-control.service';

export interface CreateLicenseRequest {
	templateId?: string;
	licenseType: LicenseType;
	issuedTo: string;
	validityDays?: number;
	features?: LicenseFeatures;
	limits?: LicenseLimits;
	metadata?: Record<string, any>;
	subscriptionId?: string;
	parentLicenseId?: string;
	skipApproval?: boolean;
}

export interface LicenseRequest {
	templateId?: string;
	licenseType: LicenseType;
	requestedFeatures?: LicenseFeatures;
	requestedLimits?: LicenseLimits;
	justification?: string;
	priority?: ApprovalPriority;
	validityDays?: number;
}

export interface ApprovalDecision {
	decision: 'approve' | 'reject';
	reason?: string;
}

export interface LicenseReport {
	totalLicenses: number;
	activeLicenses: number;
	expiredLicenses: number;
	pendingApprovals: number;
	licensesByType: Record<LicenseType, number>;
	licensesByStatus: Record<LicenseStatus, number>;
	recentActivity: any[];
}

@Service()
export class EnhancedLicenseManagementService {
	constructor(
		private readonly logger: Logger,
		private readonly licenseRepository: LicenseRepository,
		private readonly approvalRepository: LicenseApprovalRepository,
		private readonly auditRepository: LicenseAuditLogRepository,
		private readonly templateRepository: LicenseTemplateRepository,
		private readonly ownerRepository: OwnerManagementRepository,
		private readonly userRepository: UserRepository,
		private readonly approvalWorkflow: ApprovalWorkflowService,
		private readonly validationService: LicenseValidationService,
		private readonly accessControl: OwnerAccessControlService,
	) {}

	async createLicense(request: CreateLicenseRequest, createdBy: string): Promise<LicenseEntity> {
		this.logger.info('Creating new license', { request, createdBy });

		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(createdBy, 'canCreateLicenses');

		// Get template if specified
		let template: LicenseTemplateEntity | null = null;
		if (request.templateId) {
			template = await this.templateRepository.findOne({ where: { id: request.templateId } });
			if (!template) {
				throw new BadRequestError('License template not found');
			}
		}

		// Generate license key
		const licenseKey = this.generateLicenseKey(request.licenseType);

		// Calculate validity dates
		const validFrom = new Date();
		const validUntil = new Date();
		const validityDays = request.validityDays || template?.defaultValidityDays || 365;
		validUntil.setDate(validFrom.getDate() + validityDays);

		// Create license entity
		const license = this.licenseRepository.create({
			id: generateNanoId(),
			licenseKey,
			licenseType: request.licenseType,
			status: 'pending',
			issuedTo: request.issuedTo,
			issuedBy: createdBy,
			validFrom,
			validUntil,
			features: request.features || template?.defaultFeatures || {},
			limits: request.limits || template?.defaultLimits || {},
			metadata: request.metadata || {},
			approvalStatus: 'pending',
			subscriptionId: request.subscriptionId,
			parentLicenseId: request.parentLicenseId,
		});

		// Save license
		const savedLicense = await this.licenseRepository.save(license);

		// Create audit log
		await this.createAuditLog(
			savedLicense.id,
			'created',
			createdBy,
			{},
			savedLicense,
			'License created',
		);

		// Handle approval workflow
		if (!request.skipApproval && template?.requiresApproval !== false) {
			await this.approvalWorkflow.submitApproval({
				licenseId: savedLicense.id,
				requestedBy: createdBy,
				approvalType: 'creation',
				requestData: request,
				priority: 'medium',
			});
		} else {
			// Auto-approve if no approval required
			await this.approveLicense(savedLicense.id, createdBy, 'Auto-approved');
		}

		this.logger.info('License created successfully', { licenseId: savedLicense.id });
		return savedLicense;
	}

	async activateLicense(licenseKey: string, userId: string): Promise<void> {
		this.logger.info('Activating license', { licenseKey, userId });

		const license = await this.licenseRepository.findByLicenseKey(licenseKey);
		if (!license) {
			throw new BadRequestError('License not found');
		}

		// Validate license
		const validation = await this.validationService.validateLicenseKey(licenseKey);
		if (!validation.isValid) {
			throw new BadRequestError(validation.error || 'Invalid license');
		}

		// Check if license is approved
		if (license.approvalStatus !== 'approved') {
			throw new BadRequestError('License is not approved');
		}

		// Update license status
		const previousState = { ...license };
		await this.licenseRepository.updateStatus(license.id, 'active');

		// Create audit log
		await this.createAuditLog(
			license.id,
			'activated',
			userId,
			previousState,
			{ ...license, status: 'active' },
			'License activated',
		);

		this.logger.info('License activated successfully', { licenseId: license.id });
	}

	async renewLicense(licenseId: string, renewedBy: string): Promise<LicenseEntity> {
		this.logger.info('Renewing license', { licenseId, renewedBy });

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			throw new BadRequestError('License not found');
		}

		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(renewedBy, 'canCreateLicenses');

		// Calculate new validity dates
		const newValidFrom = new Date();
		const newValidUntil = new Date();
		const validityDays = 365; // Default renewal period
		newValidUntil.setDate(newValidFrom.getDate() + validityDays);

		const previousState = { ...license };

		// Update license
		await this.licenseRepository.update(licenseId, {
			validFrom: newValidFrom,
			validUntil: newValidUntil,
			status: 'active',
			updatedAt: new Date(),
		});

		// Create audit log
		await this.createAuditLog(
			licenseId,
			'renewed',
			renewedBy,
			previousState,
			{ ...license, validFrom: newValidFrom, validUntil: newValidUntil },
			'License renewed',
		);

		const renewedLicense = await this.licenseRepository.findOne({ where: { id: licenseId } });
		this.logger.info('License renewed successfully', { licenseId });
		return renewedLicense!;
	}

	async suspendLicense(licenseId: string, suspendedBy: string, reason: string): Promise<void> {
		this.logger.info('Suspending license', { licenseId, suspendedBy, reason });

		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(suspendedBy, 'canRevokeLicenses');

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			throw new BadRequestError('License not found');
		}

		const previousState = { ...license };
		await this.licenseRepository.updateStatus(licenseId, 'suspended');

		// Create audit log
		await this.createAuditLog(
			licenseId,
			'suspended',
			suspendedBy,
			previousState,
			{ ...license, status: 'suspended' },
			reason,
		);

		this.logger.info('License suspended successfully', { licenseId });
	}

	async revokeLicense(licenseId: string, revokedBy: string, reason: string): Promise<void> {
		this.logger.info('Revoking license', { licenseId, revokedBy, reason });

		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(revokedBy, 'canRevokeLicenses');

		const license = await this.licenseRepository.findOne({ where: { id: licenseId } });
		if (!license) {
			throw new BadRequestError('License not found');
		}

		const previousState = { ...license };
		await this.licenseRepository.updateStatus(licenseId, 'revoked');

		// Create audit log
		await this.createAuditLog(
			licenseId,
			'revoked',
			revokedBy,
			previousState,
			{ ...license, status: 'revoked' },
			reason,
		);

		this.logger.info('License revoked successfully', { licenseId });
	}

	async submitLicenseRequest(
		request: LicenseRequest,
		requestedBy: string,
	): Promise<LicenseApprovalEntity> {
		this.logger.info('Submitting license request', { request, requestedBy });

		return await this.approvalWorkflow.submitApproval({
			licenseId: generateNanoId(), // Temporary ID for new license requests
			requestedBy,
			approvalType: 'creation',
			requestData: request,
			priority: request.priority || 'medium',
		});
	}

	async processApproval(
		approvalId: string,
		decision: ApprovalDecision,
		processedBy: string,
	): Promise<void> {
		this.logger.info('Processing approval', { approvalId, decision, processedBy });

		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(processedBy, 'canApproveLicenses');

		await this.approvalWorkflow.processApproval(approvalId, {
			...decision,
			processedBy,
		});
	}

	async getApprovalQueue(ownerId: string): Promise<LicenseApprovalEntity[]> {
		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(ownerId, 'canApproveLicenses');

		return await this.approvalRepository.findPendingApprovals();
	}

	async generateLicenseReport(ownerId: string): Promise<LicenseReport> {
		// Validate owner permissions
		await this.accessControl.validateOwnerPermission(ownerId, 'canViewAuditLogs');

		const [totalLicenses, activeLicenses, expiredLicenses, pendingApprovals, recentActivity] =
			await Promise.all([
				this.licenseRepository.count({}),
				this.licenseRepository.countByStatus('active'),
				this.licenseRepository.countByStatus('expired'),
				this.approvalRepository.countByStatus('pending'),
				this.auditRepository.findRecentActivity(20),
			]);

		// Get counts by type and status
		const licensesByType: Record<LicenseType, number> = {
			community: await this.licenseRepository.countByType('community'),
			trial: await this.licenseRepository.countByType('trial'),
			enterprise: await this.licenseRepository.countByType('enterprise'),
			custom: await this.licenseRepository.countByType('custom'),
		};

		const licensesByStatus: Record<LicenseStatus, number> = {
			pending: await this.licenseRepository.countByStatus('pending'),
			active: activeLicenses,
			suspended: await this.licenseRepository.countByStatus('suspended'),
			expired: expiredLicenses,
			revoked: await this.licenseRepository.countByStatus('revoked'),
		};

		return {
			totalLicenses,
			activeLicenses,
			expiredLicenses,
			pendingApprovals,
			licensesByType,
			licensesByStatus,
			recentActivity,
		};
	}

	private async approveLicense(
		licenseId: string,
		approvedBy: string,
		reason?: string,
	): Promise<void> {
		await this.licenseRepository.updateApprovalStatus(licenseId, 'approved', approvedBy);

		// Create audit log
		await this.createAuditLog(
			licenseId,
			'approved',
			approvedBy,
			{ approvalStatus: 'pending' },
			{ approvalStatus: 'approved' },
			reason || 'License approved',
		);
	}

	private async createAuditLog(
		licenseId: string,
		action: LicenseAuditAction,
		performedBy: string,
		previousState: any,
		newState: any,
		reason?: string,
	): Promise<void> {
		await this.auditRepository.createAuditLog({
			licenseId,
			action,
			performedBy,
			previousState,
			newState,
			reason,
			metadata: {},
		});
	}

	private generateLicenseKey(licenseType: LicenseType): string {
		const prefix = licenseType.toUpperCase().substring(0, 3);
		const timestamp = Date.now().toString(36);
		const random = generateNanoId();
		return `${prefix}-${timestamp}-${random}`.toUpperCase();
	}
}
