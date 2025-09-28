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

@RestController('/license')
export class EnhancedLicenseController {
	constructor(
		private readonly licenseService: LicenseService,
		private readonly instanceSettings: InstanceSettings,
		private readonly urlService: UrlService,
		private readonly localLicenseApiService: LocalLicenseApiService,
	) {}

	@Get('/')
	async getLicenseData() {
		return await this.licenseService.getLicenseData();
	}

	@Post('/enterprise/request_trial')
	@GlobalScope('license:manage')
	async requestEnterpriseTrial(req: AuthenticatedRequest) {
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
		const { activationKey } = req.body;
		await this.licenseService.activateLicense(activationKey);
		return await this.getTokenAndData();
	}

	@Post('/renew')
	@GlobalScope('license:manage')
	async renewLicense() {
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
		// Check if user is the global owner
		// Handle both object format (role.slug) and string format (role)
		const userRole = typeof req.user.role === 'string' ? req.user.role : req.user.role?.slug;
		if (userRole !== 'global:owner') {
			throw new BadRequestError('Only the global owner can generate enterprise licenses');
		}

		try {
			// Enhanced error handling and logging
			console.log('Starting enterprise license generation for global:owner');
			console.log('User details:', {
				id: req.user.id,
				email: req.user.email,
				role: userRole,
			});

			const licenseKey = await this.localLicenseApiService.generateEnterpriseOwnerLicenseEnhanced(
				req.user,
			);

			console.log('Enterprise license generated successfully:', licenseKey);

			return {
				success: true,
				message: 'Enterprise license generated successfully for global:owner',
				licenseKey,
				owner: 'global:owner',
				user: {
					id: req.user.id,
					email: req.user.email,
					role: userRole,
				},
			};
		} catch (error: unknown) {
			console.error('Failed to generate enterprise license:', error);

			if (error instanceof Error) {
				// Provide more detailed error information
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
			console.error('Debug plans error:', error);
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
