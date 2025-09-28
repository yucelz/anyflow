import { CommunityRegisteredRequestDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, Post, RestController, GlobalScope, Body } from '@n8n/decorators';
import type { AxiosError } from 'axios';
import { InstanceSettings } from 'n8n-core';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { LicenseRequest } from '@/requests';
import { UrlService } from '@/services/url.service';

import { LicenseService } from './license.service';
import { LocalLicenseApiService } from './local-license-api.service';
import { OwnerAccessControlService } from './owner-access-control.service';

@RestController('/license')
export class LicenseController {
	constructor(
		private readonly licenseService: LicenseService,
		private readonly instanceSettings: InstanceSettings,
		private readonly urlService: UrlService,
		private readonly localLicenseApiService: LocalLicenseApiService,
		private readonly ownerAccessControlService: OwnerAccessControlService,
	) {}

	@Get('/')
	async getLicenseData() {
		return await this.licenseService.getLicenseData();
	}

	@Post('/enterprise/request_trial')
	@GlobalScope('license:manage')
	async requestEnterpriseTrial(req: AuthenticatedRequest) {
		// Use OwnerAccessControlService for consistent access control
		await this.ownerAccessControlService.validateOwnerPermission(req.user.id, 'canCreateLicenses');

		try {
			await this.licenseService.requestEnterpriseTrial(req.user);
		} catch (error: unknown) {
			if (error instanceof Error) {
				const errorMsg =
					(error as AxiosError<{ message: string }>).response?.data?.message ?? error.message;

				throw new BadRequestError(errorMsg);
			} else {
				throw new BadRequestError('Failed to request trial');
			}
		}
	}

	@Post('/enterprise/community-registered')
	async registerCommunityEdition(
		req: AuthenticatedRequest,
		_res: Response,
		@Body payload: CommunityRegisteredRequestDto,
	) {
		return await this.licenseService.registerCommunityEdition({
			userId: req.user.id,
			email: payload.email,
			instanceId: this.instanceSettings.instanceId,
			instanceUrl: this.urlService.getInstanceBaseUrl(),
			licenseType: 'community-registered',
		});
	}

	@Post('/activate')
	@GlobalScope('license:manage')
	async activateLicense(req: LicenseRequest.Activate) {
		// Use OwnerAccessControlService for consistent access control
		await this.ownerAccessControlService.validateOwnerPermission(req.user.id, 'canCreateLicenses');

		const { activationKey } = req.body;
		await this.licenseService.activateLicense(activationKey);
		return await this.getTokenAndData();
	}

	@Post('/renew')
	@GlobalScope('license:manage')
	async renewLicense(req: AuthenticatedRequest) {
		// Use OwnerAccessControlService for consistent access control
		await this.ownerAccessControlService.validateOwnerPermission(req.user.id, 'canCreateLicenses');

		await this.licenseService.renewLicense();
		return await this.getTokenAndData();
	}

	@Get('/plans')
	async getAvailablePlans() {
		return await this.localLicenseApiService.getAvailablePlansWithEndpoints();
	}

	@Post('/enterprise-trial')
	@GlobalScope('license:manage')
	async requestEnterpriseTrialLocal(req: AuthenticatedRequest) {
		// Use OwnerAccessControlService for consistent access control
		await this.ownerAccessControlService.validateOwnerPermission(req.user.id, 'canCreateLicenses');

		try {
			await this.localLicenseApiService.requestEnterpriseTrial({
				licenseType: 'enterprise',
				firstName: req.user.firstName,
				lastName: req.user.lastName,
				email: req.user.email,
				instanceUrl: this.urlService.getWebhookBaseUrl(),
			});
			return { success: true, message: 'Enterprise trial request processed successfully' };
		} catch (error: unknown) {
			if (error instanceof Error) {
				throw new BadRequestError(error.message);
			} else {
				throw new BadRequestError('Failed to request trial');
			}
		}
	}

	@Post('/community-registered')
	async registerCommunityEditionLocal(
		req: AuthenticatedRequest,
		_res: Response,
		@Body payload: CommunityRegisteredRequestDto,
	) {
		return await this.localLicenseApiService.registerCommunityEdition({
			email: payload.email,
			instanceId: this.instanceSettings.instanceId,
			instanceUrl: this.urlService.getInstanceBaseUrl(),
			licenseType: 'community-registered',
		});
	}

	@Post('/generate-enterprise-owner')
	@GlobalScope('license:manage')
	async generateEnterpriseOwnerLicense(req: AuthenticatedRequest) {
		// Use OwnerAccessControlService for consistent access control
		await this.ownerAccessControlService.validateOwnerPermission(req.user.id, 'canCreateLicenses');

		try {
			const licenseKey = await this.localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced(
				req.user,
			);

			return {
				success: true,
				message: 'Enterprise license generated successfully for global:owner',
				licenseKey,
				owner: 'global:owner',
				user: {
					id: req.user.id,
					email: req.user.email,
					role: req.user.role,
				},
			};
		} catch (error: unknown) {
			if (error instanceof Error) {
				throw new BadRequestError(
					`Failed to generate enterprise license for global:owner: ${error.message}`,
				);
			} else {
				throw new BadRequestError(
					'Failed to generate enterprise license for global:owner - Unknown error',
				);
			}
		}
	}

	@Get('/info/:licenseKey')
	async getLicenseInfo(req: { params: { licenseKey: string } }) {
		return await this.localLicenseApiService.getLicenseInfo(req.params.licenseKey);
	}

	@Post('/validate')
	async validateLicenseKey(@Body body: { licenseKey: string }) {
		const validation = this.localLicenseApiService.validateLicenseKey(body.licenseKey);
		return validation;
	}

	@Get('/debug/plans')
	async getDebugPlans() {
		try {
			const plans = await this.localLicenseApiService.getAvailablePlansWithEndpoints();
			return {
				success: true,
				plansCount: plans.length,
				plans: plans.map((plan) => ({
					id: plan.id,
					slug: plan.slug,
					name: plan.name,
					isActive: plan.isActive,
				})),
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	private async getTokenAndData() {
		const managementToken = this.licenseService.getManagementJwt();
		const data = await this.licenseService.getLicenseData();
		return { ...data, managementToken };
	}
}
