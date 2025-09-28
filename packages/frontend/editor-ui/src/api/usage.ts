import type { CommunityRegisteredRequestDto } from '@n8n/api-types';
import { makeRestApiRequest } from '@n8n/rest-api-client';
import type { UsageState } from '@/Interface';
import type { IRestApiContext } from '@n8n/rest-api-client';

export const getLicense = async (context: IRestApiContext): Promise<UsageState['data']> => {
	return await makeRestApiRequest(context, 'GET', '/license');
};

export const activateLicenseKey = async (
	context: IRestApiContext,
	data: { activationKey: string },
): Promise<UsageState['data']> => {
	return await makeRestApiRequest(context, 'POST', '/license/activate', data);
};

export const renewLicense = async (context: IRestApiContext): Promise<UsageState['data']> => {
	return await makeRestApiRequest(context, 'POST', '/license/renew');
};

export const requestLicenseTrial = async (
	context: IRestApiContext,
): Promise<UsageState['data']> => {
	return await makeRestApiRequest(context, 'POST', '/license/enterprise/request_trial');
};

export const registerCommunityEdition = async (
	context: IRestApiContext,
	params: CommunityRegisteredRequestDto,
): Promise<{ title: string; text: string }> => {
	return await makeRestApiRequest(
		context,
		'POST',
		'/license/enterprise/community-registered',
		params,
	);
};

// Subscription API functions
export const getSubscriptionPlans = async (context: IRestApiContext) => {
	return await makeRestApiRequest(context, 'GET', '/subscriptions/plans');
};

export const getCurrentSubscription = async (context: IRestApiContext) => {
	return await makeRestApiRequest(context, 'GET', '/subscriptions/current');
};

export const createSubscription = async (
	context: IRestApiContext,
	data: {
		planSlug: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId?: string;
	},
) => {
	return await makeRestApiRequest(context, 'POST', '/subscriptions/subscribe', data);
};

export const upgradeSubscription = async (
	context: IRestApiContext,
	subscriptionId: string,
	data: { planSlug: string },
) => {
	return await makeRestApiRequest(context, 'PUT', `/subscriptions/${subscriptionId}/upgrade`, data);
};

export const cancelSubscription = async (
	context: IRestApiContext,
	subscriptionId: string,
	data: { cancelAtPeriodEnd?: boolean } = {},
) => {
	return await makeRestApiRequest(context, 'DELETE', `/subscriptions/${subscriptionId}`, data);
};

export const getUsageLimits = async (context: IRestApiContext) => {
	return await makeRestApiRequest(context, 'GET', '/subscriptions/usage');
};

// Local license API functions (following the pattern from license.controller.ts)
export const requestEnterpriseTrialLocal = async (context: IRestApiContext) => {
	return await makeRestApiRequest(context, 'POST', '/license/local/enterprise-trial');
};

export const registerCommunityEditionLocal = async (
	context: IRestApiContext,
	params: CommunityRegisteredRequestDto,
): Promise<{ title: string; text: string; licenseKey: string }> => {
	return await makeRestApiRequest(context, 'POST', '/license/local/community-registered', params);
};

export const getLicenseInfo = async (context: IRestApiContext, licenseKey: string) => {
	return await makeRestApiRequest(context, 'GET', `/license/info/${licenseKey}`);
};

export const validateLicenseKey = async (
	context: IRestApiContext,
	data: { licenseKey: string },
) => {
	return await makeRestApiRequest(context, 'POST', '/license/validate', data);
};

export const getAvailablePlansWithEndpoints = async (context: IRestApiContext) => {
	return await makeRestApiRequest(context, 'GET', '/license/plans');
};
