import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';
import type { UsageState } from '@/Interface';
import * as usageApi from '@/api/usage';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useSettingsStore } from '@/stores/settings.store';

export type UsageTelemetry = {
	instance_id: string;
	action: 'view_plans' | 'manage_plan' | 'add_activation_key' | 'desktop_view_plans';
	plan_name_current: string;
	usage: number;
	quota: number;
};

const DEFAULT_PLAN_NAME = 'Community';
const DEFAULT_STATE: UsageState = {
	loading: true,
	data: {
		usage: {
			activeWorkflowTriggers: {
				limit: -1,
				value: 0,
				warningThreshold: 0.8,
			},
			workflowsHavingEvaluations: {
				value: 0,
				limit: 0,
			},
		},
		license: {
			planId: '',
			planName: DEFAULT_PLAN_NAME,
		},
	},
};

export const useUsageStore = defineStore('usage', () => {
	const rootStore = useRootStore();
	const settingsStore = useSettingsStore();

	const state = reactive<UsageState>({ ...DEFAULT_STATE });

	const planName = computed(() => state.data.license.planName || DEFAULT_PLAN_NAME);
	const planId = computed(() => state.data.license.planId);
	const activeWorkflowTriggersLimit = computed(() => state.data.usage.activeWorkflowTriggers.limit);
	const activeWorkflowTriggersCount = computed(() => state.data.usage.activeWorkflowTriggers.value);
	const workflowsWithEvaluationsLimit = computed(
		() => state.data.usage.workflowsHavingEvaluations.limit,
	);
	const workflowsWithEvaluationsCount = computed(
		() => state.data.usage.workflowsHavingEvaluations.value,
	);
	const executionPercentage = computed(
		() => (activeWorkflowTriggersCount.value / activeWorkflowTriggersLimit.value) * 100,
	);
	const instanceId = computed(() => settingsStore.settings.instanceId);
	const managementToken = computed(() => state.data.managementToken);
	const appVersion = computed(() => settingsStore.settings.versionCli);
	const commonSubscriptionAppUrlQueryParams = computed(
		() => `instanceid=${instanceId.value}&version=${appVersion.value}`,
	);
	const subscriptionAppUrl = computed(() => {
		const baseUrl = settingsStore.settings.n8nMetadata?.baseUrl || window.location.origin;
		return `${baseUrl}/api/v1/subscriptions`;
	});

	const setLoading = (loading: boolean) => {
		state.loading = loading;
	};

	const setData = (data: UsageState['data']) => {
		state.data = data;
	};

	const getLicenseInfo = async () => {
		const data = await usageApi.getLicense(rootStore.restApiContext);
		setData(data);
	};

	const activateLicense = async (activationKey: string) => {
		const data = await usageApi.activateLicenseKey(rootStore.restApiContext, { activationKey });
		setData(data);
		await settingsStore.getSettings();
		await settingsStore.getModuleSettings();
	};

	const refreshLicenseManagementToken = async () => {
		try {
			const data = await usageApi.renewLicense(rootStore.restApiContext);
			setData(data);
		} catch (error) {
			await getLicenseInfo();
		}
	};

	const requestEnterpriseLicenseTrial = async () => {
		await usageApi.requestLicenseTrial(rootStore.restApiContext);
	};

	const registerCommunityEdition = async (email: string) =>
		await usageApi.registerCommunityEdition(rootStore.restApiContext, { email });

	const getSubscriptionPlans = async () => {
		return await usageApi.getSubscriptionPlans(rootStore.restApiContext);
	};

	const getCurrentSubscription = async () => {
		return await usageApi.getCurrentSubscription(rootStore.restApiContext);
	};

	const createSubscription = async (data: {
		planSlug: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId?: string;
	}) => {
		return await usageApi.createSubscription(rootStore.restApiContext, data);
	};

	const upgradeSubscription = async (subscriptionId: string, planSlug: string) => {
		return await usageApi.upgradeSubscription(rootStore.restApiContext, subscriptionId, {
			planSlug,
		});
	};

	const cancelSubscription = async (subscriptionId: string, cancelAtPeriodEnd: boolean = true) => {
		return await usageApi.cancelSubscription(rootStore.restApiContext, subscriptionId, {
			cancelAtPeriodEnd,
		});
	};

	const getUsageLimits = async () => {
		return await usageApi.getUsageLimits(rootStore.restApiContext);
	};

	const requestEnterpriseTrialLocal = async () => {
		return await usageApi.requestEnterpriseTrialLocal(rootStore.restApiContext);
	};

	const registerCommunityEditionLocal = async (email: string) => {
		return await usageApi.registerCommunityEditionLocal(rootStore.restApiContext, { email });
	};

	const getLicenseInfoByKey = async (licenseKey: string) => {
		return await usageApi.getLicenseInfo(rootStore.restApiContext, licenseKey);
	};

	const validateLicenseKey = async (licenseKey: string) => {
		return await usageApi.validateLicenseKey(rootStore.restApiContext, { licenseKey });
	};

	const getAvailablePlansWithEndpoints = async () => {
		return await usageApi.getAvailablePlansWithEndpoints(rootStore.restApiContext);
	};

	return {
		setLoading,
		getLicenseInfo,
		setData,
		activateLicense,
		refreshLicenseManagementToken,
		requestEnterpriseLicenseTrial,
		registerCommunityEdition,
		getSubscriptionPlans,
		getCurrentSubscription,
		createSubscription,
		upgradeSubscription,
		cancelSubscription,
		getUsageLimits,
		requestEnterpriseTrialLocal,
		registerCommunityEditionLocal,
		getLicenseInfoByKey,
		validateLicenseKey,
		getAvailablePlansWithEndpoints,
		planName,
		planId,
		activeWorkflowTriggersLimit,
		activeWorkflowTriggersCount,
		workflowsWithEvaluationsLimit,
		workflowsWithEvaluationsCount,
		executionPercentage,
		instanceId,
		managementToken,
		appVersion,
		isCloseToLimit: computed(() =>
			state.data.usage.activeWorkflowTriggers.limit < 0
				? false
				: activeWorkflowTriggersCount.value / activeWorkflowTriggersLimit.value >=
					state.data.usage.activeWorkflowTriggers.warningThreshold,
		),
		viewPlansUrl: computed(
			() => `${subscriptionAppUrl.value}/plans?${commonSubscriptionAppUrlQueryParams.value}`,
		),
		managePlanUrl: computed(
			() =>
				`${subscriptionAppUrl.value}/current?token=${managementToken.value}&${commonSubscriptionAppUrlQueryParams.value}`,
		),
		isLoading: computed(() => state.loading),
		telemetryPayload: computed<UsageTelemetry>(() => ({
			instance_id: instanceId.value,
			action: 'view_plans',
			plan_name_current: planName.value,
			usage: activeWorkflowTriggersCount.value,
			quota: activeWorkflowTriggersLimit.value,
		})),
	};
});
