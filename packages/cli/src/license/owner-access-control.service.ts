import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { OwnerManagementRepository, UserRepository } from '@n8n/db';
import { OwnerPermissions } from '@n8n/db/src/entities/owner-management.entity';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

@Service()
export class OwnerAccessControlService {
	constructor(
		private readonly logger: Logger,
		private readonly ownerRepository: OwnerManagementRepository,
		private readonly userRepository: UserRepository,
	) {}

	async validateOwnerPermission(userId: string, permission: keyof OwnerPermissions): Promise<void> {
		this.logger.debug('Validating owner permission', { userId, permission });

		// Check if user is global owner
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['role'],
		});

		if (!user) {
			throw new BadRequestError('User not found');
		}

		if (user.role?.slug !== 'global:owner') {
			throw new BadRequestError('Only global owners can perform this operation');
		}

		// Check specific permission
		const ownerManagement = await this.ownerRepository.findByOwnerId(userId);
		if (!ownerManagement) {
			// Initialize owner management if it doesn't exist
			await this.ownerRepository.createOwnerManagement(userId);
			return; // Default permissions allow all operations
		}

		const hasPermission = ownerManagement.permissions[permission];
		if (!hasPermission) {
			throw new BadRequestError(`Insufficient permissions: ${permission} not allowed`);
		}

		this.logger.debug('Owner permission validated', { userId, permission });
	}

	async checkOwnerPermission(userId: string, permission: keyof OwnerPermissions): Promise<boolean> {
		try {
			await this.validateOwnerPermission(userId, permission);
			return true;
		} catch {
			return false;
		}
	}

	async isGlobalOwner(userId: string): Promise<boolean> {
		const user = await this.userRepository.findOne({
			where: { id: userId },
			relations: ['role'],
		});

		return user?.role?.slug === 'global:owner';
	}

	async isDelegatedUser(ownerId: string, userId: string): Promise<boolean> {
		const ownerManagement = await this.ownerRepository.findByOwnerId(ownerId);
		return ownerManagement?.delegatedUsers?.includes(userId) || false;
	}

	async getOwnerPermissions(userId: string): Promise<OwnerPermissions | null> {
		const ownerManagement = await this.ownerRepository.findByOwnerId(userId);
		return ownerManagement?.permissions || null;
	}

	async getAllOwners(): Promise<string[]> {
		const owners = await this.ownerRepository.findAllOwners();
		return owners.map((owner) => owner.ownerId);
	}

	async canUserAccessLicense(userId: string, licenseOwnerId: string): Promise<boolean> {
		// User can access their own licenses
		if (userId === licenseOwnerId) {
			return true;
		}

		// Global owners can access all licenses
		if (await this.isGlobalOwner(userId)) {
			return true;
		}

		// Check if user is delegated by the license owner
		return await this.isDelegatedUser(licenseOwnerId, userId);
	}

	async validateLicenseAccess(userId: string, licenseOwnerId: string): Promise<void> {
		const canAccess = await this.canUserAccessLicense(userId, licenseOwnerId);
		if (!canAccess) {
			throw new BadRequestError('Access denied: insufficient permissions to access this license');
		}
	}
}
