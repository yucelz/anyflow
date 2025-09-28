import { mock } from 'jest-mock-extended';
import { Logger } from '@n8n/backend-common';
import { OwnerManagementRepository, UserRepository } from '@n8n/db';
import { OwnerPermissions } from '@n8n/db/src/entities/owner-management.entity';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import { OwnerAccessControlService } from '../owner-access-control.service';

describe('OwnerAccessControlService', () => {
	const logger = mock<Logger>();
	const ownerRepository = mock<OwnerManagementRepository>();
	const userRepository = mock<UserRepository>();

	const ownerAccessControlService = new OwnerAccessControlService(
		logger,
		ownerRepository,
		userRepository,
	);

	const mockUser = {
		id: 'user-123',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		role: { slug: 'global:owner' },
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockOwnerManagement = {
		id: 'owner-123',
		ownerId: 'user-123',
		permissions: {
			canCreateLicenses: true,
			canApproveLicenses: true,
			canRevokeLicenses: true,
			canViewAuditLogs: true,
			canManageSettings: true,
		} as OwnerPermissions,
		settings: {
			autoApprovalEnabled: false,
			autoApprovalCriteria: {},
		},
		delegatedUsers: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('validateOwnerPermission', () => {
		it('should validate permission successfully for global owner', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			await ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses');

			expect(userRepository.findOne).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				relations: ['role'],
			});
			expect(ownerRepository.findByOwnerId).toHaveBeenCalledWith('user-123');
			expect(logger.debug).toHaveBeenCalledWith('Owner permission validated', {
				userId: 'user-123',
				permission: 'canCreateLicenses',
			});
		});

		it('should throw error if user not found', async () => {
			userRepository.findOne.mockResolvedValue(null);

			await expect(
				ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses'),
			).rejects.toThrow(new BadRequestError('User not found'));

			expect(ownerRepository.findByOwnerId).not.toHaveBeenCalled();
		});

		it('should throw error if user is not global owner', async () => {
			const nonOwnerUser = { ...mockUser, role: { slug: 'user' } };
			userRepository.findOne.mockResolvedValue(nonOwnerUser);

			await expect(
				ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses'),
			).rejects.toThrow(new BadRequestError('Only global owners can perform this operation'));

			expect(ownerRepository.findByOwnerId).not.toHaveBeenCalled();
		});

		it('should initialize owner management if it does not exist', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(null);
			ownerRepository.createOwnerManagement.mockResolvedValue();

			await ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses');

			expect(ownerRepository.createOwnerManagement).toHaveBeenCalledWith('user-123');
		});

		it('should throw error if permission is not allowed', async () => {
			const restrictedOwnerManagement = {
				...mockOwnerManagement,
				permissions: {
					...mockOwnerManagement.permissions,
					canCreateLicenses: false,
				},
			};

			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(restrictedOwnerManagement);

			await expect(
				ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses'),
			).rejects.toThrow(
				new BadRequestError('Insufficient permissions: canCreateLicenses not allowed'),
			);
		});

		it('should log debug information during validation', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			await ownerAccessControlService.validateOwnerPermission('user-123', 'canApproveLicenses');

			expect(logger.debug).toHaveBeenCalledWith('Validating owner permission', {
				userId: 'user-123',
				permission: 'canApproveLicenses',
			});
			expect(logger.debug).toHaveBeenCalledWith('Owner permission validated', {
				userId: 'user-123',
				permission: 'canApproveLicenses',
			});
		});
	});

	describe('checkOwnerPermission', () => {
		it('should return true for valid permission', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			const result = await ownerAccessControlService.checkOwnerPermission(
				'user-123',
				'canCreateLicenses',
			);

			expect(result).toBe(true);
		});

		it('should return false for invalid permission', async () => {
			userRepository.findOne.mockResolvedValue(null);

			const result = await ownerAccessControlService.checkOwnerPermission(
				'user-123',
				'canCreateLicenses',
			);

			expect(result).toBe(false);
		});

		it('should return false when permission is denied', async () => {
			const restrictedOwnerManagement = {
				...mockOwnerManagement,
				permissions: {
					...mockOwnerManagement.permissions,
					canRevokeLicenses: false,
				},
			};

			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(restrictedOwnerManagement);

			const result = await ownerAccessControlService.checkOwnerPermission(
				'user-123',
				'canRevokeLicenses',
			);

			expect(result).toBe(false);
		});
	});

	describe('isGlobalOwner', () => {
		it('should return true for global owner', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);

			const result = await ownerAccessControlService.isGlobalOwner('user-123');

			expect(result).toBe(true);
			expect(userRepository.findOne).toHaveBeenCalledWith({
				where: { id: 'user-123' },
				relations: ['role'],
			});
		});

		it('should return false for non-global owner', async () => {
			const nonOwnerUser = { ...mockUser, role: { slug: 'user' } };
			userRepository.findOne.mockResolvedValue(nonOwnerUser);

			const result = await ownerAccessControlService.isGlobalOwner('user-123');

			expect(result).toBe(false);
		});

		it('should return false if user not found', async () => {
			userRepository.findOne.mockResolvedValue(null);

			const result = await ownerAccessControlService.isGlobalOwner('user-123');

			expect(result).toBe(false);
		});
	});

	describe('isDelegatedUser', () => {
		it('should return true if user is delegated', async () => {
			const ownerWithDelegatedUsers = {
				...mockOwnerManagement,
				delegatedUsers: ['user-456', 'user-789'],
			};
			ownerRepository.findByOwnerId.mockResolvedValue(ownerWithDelegatedUsers);

			const result = await ownerAccessControlService.isDelegatedUser('owner-123', 'user-456');

			expect(result).toBe(true);
			expect(ownerRepository.findByOwnerId).toHaveBeenCalledWith('owner-123');
		});

		it('should return false if user is not delegated', async () => {
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			const result = await ownerAccessControlService.isDelegatedUser('owner-123', 'user-456');

			expect(result).toBe(false);
		});

		it('should return false if owner management not found', async () => {
			ownerRepository.findByOwnerId.mockResolvedValue(null);

			const result = await ownerAccessControlService.isDelegatedUser('owner-123', 'user-456');

			expect(result).toBe(false);
		});

		it('should return false if delegatedUsers is null', async () => {
			const ownerWithNullDelegatedUsers = {
				...mockOwnerManagement,
				delegatedUsers: null,
			};
			ownerRepository.findByOwnerId.mockResolvedValue(ownerWithNullDelegatedUsers);

			const result = await ownerAccessControlService.isDelegatedUser('owner-123', 'user-456');

			expect(result).toBe(false);
		});
	});

	describe('getOwnerPermissions', () => {
		it('should return owner permissions', async () => {
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			const result = await ownerAccessControlService.getOwnerPermissions('user-123');

			expect(result).toEqual(mockOwnerManagement.permissions);
			expect(ownerRepository.findByOwnerId).toHaveBeenCalledWith('user-123');
		});

		it('should return null if owner management not found', async () => {
			ownerRepository.findByOwnerId.mockResolvedValue(null);

			const result = await ownerAccessControlService.getOwnerPermissions('user-123');

			expect(result).toBeNull();
		});
	});

	describe('getAllOwners', () => {
		it('should return all owner IDs', async () => {
			const mockOwners = [{ ownerId: 'owner-1' }, { ownerId: 'owner-2' }, { ownerId: 'owner-3' }];
			ownerRepository.findAllOwners.mockResolvedValue(mockOwners);

			const result = await ownerAccessControlService.getAllOwners();

			expect(result).toEqual(['owner-1', 'owner-2', 'owner-3']);
			expect(ownerRepository.findAllOwners).toHaveBeenCalled();
		});

		it('should return empty array if no owners found', async () => {
			ownerRepository.findAllOwners.mockResolvedValue([]);

			const result = await ownerAccessControlService.getAllOwners();

			expect(result).toEqual([]);
		});
	});

	describe('canUserAccessLicense', () => {
		it('should return true if user is the license owner', async () => {
			const result = await ownerAccessControlService.canUserAccessLicense('user-123', 'user-123');

			expect(result).toBe(true);
		});

		it('should return true if user is global owner', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);

			const result = await ownerAccessControlService.canUserAccessLicense('user-123', 'user-456');

			expect(result).toBe(true);
		});

		it('should return true if user is delegated by license owner', async () => {
			const nonOwnerUser = { ...mockUser, role: { slug: 'user' } };
			userRepository.findOne.mockResolvedValue(nonOwnerUser);

			const ownerWithDelegatedUsers = {
				...mockOwnerManagement,
				delegatedUsers: ['user-123'],
			};
			ownerRepository.findByOwnerId.mockResolvedValue(ownerWithDelegatedUsers);

			const result = await ownerAccessControlService.canUserAccessLicense('user-123', 'user-456');

			expect(result).toBe(true);
		});

		it('should return false if user has no access', async () => {
			const nonOwnerUser = { ...mockUser, role: { slug: 'user' } };
			userRepository.findOne.mockResolvedValue(nonOwnerUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			const result = await ownerAccessControlService.canUserAccessLicense('user-123', 'user-456');

			expect(result).toBe(false);
		});
	});

	describe('validateLicenseAccess', () => {
		it('should not throw error if user has access', async () => {
			const result = ownerAccessControlService.validateLicenseAccess('user-123', 'user-123');

			await expect(result).resolves.toBeUndefined();
		});

		it('should throw error if user does not have access', async () => {
			const nonOwnerUser = { ...mockUser, role: { slug: 'user' } };
			userRepository.findOne.mockResolvedValue(nonOwnerUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			await expect(
				ownerAccessControlService.validateLicenseAccess('user-123', 'user-456'),
			).rejects.toThrow(
				new BadRequestError('Access denied: insufficient permissions to access this license'),
			);
		});
	});

	describe('edge cases and error handling', () => {
		it('should handle missing role in user object', async () => {
			const userWithoutRole = { ...mockUser, role: null };
			userRepository.findOne.mockResolvedValue(userWithoutRole);

			const result = await ownerAccessControlService.isGlobalOwner('user-123');

			expect(result).toBe(false);
		});

		it('should handle undefined role slug', async () => {
			const userWithUndefinedRoleSlug = { ...mockUser, role: { slug: undefined } };
			userRepository.findOne.mockResolvedValue(userWithUndefinedRoleSlug);

			const result = await ownerAccessControlService.isGlobalOwner('user-123');

			expect(result).toBe(false);
		});

		it('should handle all permission types', async () => {
			userRepository.findOne.mockResolvedValue(mockUser);
			ownerRepository.findByOwnerId.mockResolvedValue(mockOwnerManagement);

			const permissions: (keyof OwnerPermissions)[] = [
				'canCreateLicenses',
				'canApproveLicenses',
				'canRevokeLicenses',
				'canViewAuditLogs',
				'canManageSettings',
			];

			for (const permission of permissions) {
				await expect(
					ownerAccessControlService.validateOwnerPermission('user-123', permission),
				).resolves.toBeUndefined();
			}
		});

		it('should handle database errors gracefully', async () => {
			userRepository.findOne.mockRejectedValue(new Error('Database connection failed'));

			await expect(
				ownerAccessControlService.validateOwnerPermission('user-123', 'canCreateLicenses'),
			).rejects.toThrow('Database connection failed');
		});
	});
});
