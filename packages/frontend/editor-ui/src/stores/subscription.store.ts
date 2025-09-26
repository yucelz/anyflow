import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useSettingsStore } from '@/stores/settings.store';
import { subscriptionsApi } from '@n8n/rest-api-client/api/subscriptions';
import type {
	ISubscriptionPlan,
	IUserSubscription,
	IUsageLimits,
} from '@n8n/rest-api-client/api/subscriptions';

export const useSubscriptionStore = defineStore('subscription', () => {
	const rootStore = useRootStore();
	const settingsStore = useSettingsStore();

	// State
	const isLoading = ref(false);
	const plans = ref<ISubscriptionPlan[]>([]);
	const currentSubscription = ref<IUserSubscription | null>(null);
	const usageLimits = ref<IUsageLimits | null>(null);

	// Getters
	const isSubscriptionEnabled = computed(() => {
		return settingsStore.settings.subscriptionEnabled === true;
	});

	const currentPlan = computed(() => {
		if (!currentSubscription.value) return null;
		return plans.value.find((plan) => plan.id === currentSubscription.value?.planId) || null;
	});

	const isFreePlan = computed(() => {
		return !currentSubscription.value || currentPlan.value?.slug === 'free';
	});

	const isProPlan = computed(() => {
		return currentPlan.value?.slug === 'pro';
	});

	const isTrialing = computed(() => {
		return currentSubscription.value?.status === 'trialing';
	});

	const trialDaysLeft = computed(() => {
		if (!currentSubscription.value?.trialEnd) return 0;
		const now = new Date();
		const trialEnd = new Date(currentSubscription.value.trialEnd);
		const diffTime = trialEnd.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.max(0, diffDays);
	});

	const renewalDate = computed(() => {
		if (!currentSubscription.value?.currentPeriodEnd) return null;
		return new Date(currentSubscription.value.currentPeriodEnd);
	});

	const daysUntilRenewal = computed(() => {
		if (!renewalDate.value) return 0;
		const now = new Date();
		const diffTime = renewalDate.value.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return Math.max(0, diffDays);
	});

	// Actions
	const setLoading = (loading: boolean) => {
		isLoading.value = loading;
	};

	const fetchPlans = async () => {
		try {
			setLoading(true);
			const response = await subscriptionsApi.getPlans(rootStore.restApiContext);
			plans.value = response;
		} catch (error) {
			console.error('Failed to fetch subscription plans:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const fetchCurrentSubscription = async () => {
		try {
			setLoading(true);
			const response = await subscriptionsApi.getCurrentSubscription(rootStore.restApiContext);
			currentSubscription.value = response;
		} catch (error) {
			console.error('Failed to fetch current subscription:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const fetchUsageLimits = async () => {
		try {
			const response = await subscriptionsApi.getUsageLimits(rootStore.restApiContext);
			usageLimits.value = response;
		} catch (error) {
			console.error('Failed to fetch usage limits:', error);
			throw error;
		}
	};

	const createSubscription = async (params: {
		planSlug: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId?: string;
	}) => {
		try {
			setLoading(true);
			const response = await subscriptionsApi.createSubscription(rootStore.restApiContext, params);
			currentSubscription.value = response;
			await fetchUsageLimits();
			return response;
		} catch (error) {
			console.error('Failed to create subscription:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const upgradeSubscription = async (planSlug: string) => {
		try {
			setLoading(true);
			const response = await subscriptionsApi.upgradeSubscription(
				rootStore.restApiContext,
				currentSubscription.value?.id || '',
				{ planSlug },
			);
			currentSubscription.value = response;
			await fetchUsageLimits();
			return response;
		} catch (error) {
			console.error('Failed to upgrade subscription:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const cancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
		try {
			setLoading(true);
			const response = await subscriptionsApi.cancelSubscription(
				rootStore.restApiContext,
				currentSubscription.value?.id || '',
				{ cancelAtPeriodEnd },
			);
			currentSubscription.value = response;
			return response;
		} catch (error) {
			console.error('Failed to cancel subscription:', error);
			throw error;
		} finally {
			setLoading(false);
		}
	};

	const initialize = async () => {
		if (!isSubscriptionEnabled.value) return;

		try {
			await Promise.all([fetchPlans(), fetchCurrentSubscription(), fetchUsageLimits()]);
		} catch (error) {
			console.error('Failed to initialize subscription store:', error);
		}
	};

	return {
		// State
		isLoading,
		plans,
		currentSubscription,
		usageLimits,

		// Getters
		isSubscriptionEnabled,
		currentPlan,
		isFreePlan,
		isProPlan,
		isTrialing,
		trialDaysLeft,
		renewalDate,
		daysUntilRenewal,

		// Actions
		setLoading,
		fetchPlans,
		fetchCurrentSubscription,
		fetchUsageLimits,
		createSubscription,
		upgradeSubscription,
		cancelSubscription,
		initialize,
	};
});
