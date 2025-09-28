import type { IRestApiContext } from '@n8n/rest-api-client';
import { makeRestApiRequest } from '@n8n/rest-api-client';

export interface LicenseValidationResponse {
	valid: boolean;
	type: 'trial' | 'community' | 'enterprise' | 'unknown';
}

export interface LicenseInfoResponse {
	licenseKey: string;
	type: string;
	isValid: boolean;
	isActive: boolean;
	planName: string;
	expiresAt: string | null;
	features: Record<string, boolean>;
}

export interface GenerateEnterpriseOwnerResponse {
	success: boolean;
	message: string;
	licenseKey: string;
	owner: string;
}

export interface EnterpriseTrialResponse {
	success: boolean;
	message: string;
}

export interface LicensePlan {
	id: string;
	slug: string;
	name: string;
	description: string;
	monthlyPrice: number;
	yearlyPrice: number;
	monthlyExecutionsLimit: number;
	activeWorkflowsLimit: number;
	credentialsLimit: number;
	usersLimit: number;
	storageLimit: number;
	trialDays: number;
	isActive: boolean;
	isPopular: boolean;
	sortOrder: number;
	features: Record<string, boolean>;
	apiEndpoints: {
		trial: string | null;
		registration: string;
		activation: string;
		renewal: string;
		generateEnterpriseOwner: string;
	};
	urls: {
		upgrade: string;
		support: string;
		documentation: string;
	};
}

export const licenseApi = {
	async getAvailablePlans(context: IRestApiContext): Promise<LicensePlan[]> {
		return await makeRestApiRequest(context, 'GET', '/license/plans');
	},

	async generateEnterpriseOwnerLicense(
		context: IRestApiContext,
	): Promise<GenerateEnterpriseOwnerResponse> {
		return await makeRestApiRequest(context, 'POST', '/license/generate-enterprise-owner');
	},

	async validateLicenseKey(
		context: IRestApiContext,
		licenseKey: string,
	): Promise<LicenseValidationResponse> {
		return await makeRestApiRequest(context, 'POST', '/license/validate', { licenseKey });
	},

	async getLicenseInfo(context: IRestApiContext, licenseKey: string): Promise<LicenseInfoResponse> {
		return await makeRestApiRequest(
			context,
			'GET',
			`/license/info/${encodeURIComponent(licenseKey)}`,
		);
	},

	async activateLicense(context: IRestApiContext, activationKey: string): Promise<void> {
		return await makeRestApiRequest(context, 'POST', '/license/activate', { activationKey });
	},

	async requestEnterpriseTrial(context: IRestApiContext): Promise<EnterpriseTrialResponse> {
		return await makeRestApiRequest(context, 'POST', '/license/enterprise-trial');
	},

	async renewLicense(context: IRestApiContext): Promise<void> {
		return await makeRestApiRequest(context, 'POST', '/license/renew');
	},

	async getLicenseData(context: IRestApiContext): Promise<any> {
		return await makeRestApiRequest(context, 'GET', '/license/');
	},
};

export const useLicenseApi = () => {
	// Import here to avoid circular dependency
	const { useRootStore } = require('@n8n/stores/useRootStore');
	const rootStore = useRootStore();

	return {
		getAvailablePlans: () => licenseApi.getAvailablePlans(rootStore.restApiContext),
		generateEnterpriseOwnerLicense: () =>
			licenseApi.generateEnterpriseOwnerLicense(rootStore.restApiContext),
		validateLicenseKey: (licenseKey: string) =>
			licenseApi.validateLicenseKey(rootStore.restApiContext, licenseKey),
		getLicenseInfo: (licenseKey: string) =>
			licenseApi.getLicenseInfo(rootStore.restApiContext, licenseKey),
		activateLicense: (activationKey: string) =>
			licenseApi.activateLicense(rootStore.restApiContext, activationKey),
		requestEnterpriseTrial: () => licenseApi.requestEnterpriseTrial(rootStore.restApiContext),
		renewLicense: () => licenseApi.renewLicense(rootStore.restApiContext),
		getLicenseData: () => licenseApi.getLicenseData(rootStore.restApiContext),
	};
};
