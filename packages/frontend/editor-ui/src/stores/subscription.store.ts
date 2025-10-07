import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useRootStore } from '@n8n/stores/useRootStore';
import { subscriptionsApi } from '@n8n/rest-api-client/api/subscriptions';
import type {
	SubscriptionPlan,
	UserSubscription,
	PaymentMethod,
	Invoice,
} from '@/types/subscription';

export interface SubscriptionSetupResponse {
	clientSecret: string;
	customerId: string;
	stripePriceId: string;
	planName: string;
	amount: number;
}

export const useSubscriptionStore = defineStore('subscription', () => {
	// Get root store for API context
	const rootStore = useRootStore();

	// State
	const currentSubscription = ref<UserSubscription | null>(null);
	const availablePlans = ref<SubscriptionPlan[]>([]);
	const paymentMethods = ref<PaymentMethod[]>([]);
	const invoices = ref<Invoice[]>([]);
	const usage = ref<any>(null);
	const isLoading = ref(false);

	// Getters
	const isSubscribed = computed(() => {
		return currentSubscription.value?.isActive ?? false;
	});

	const currentPlan = computed(() => {
		return currentSubscription.value?.plan;
	});

	const trialDaysRemaining = computed(() => {
		if (!currentSubscription.value?.isTrialing) return 0;
		const now = new Date();
		const trialEnd = new Date(currentSubscription.value.trialEnd!);
		const diffTime = trialEnd.getTime() - now.getTime();
		return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
	});

	// Actions
	const loadAvailablePlans = async () => {
		try {
			console.log('🔍 DEBUG loadAvailablePlans - Starting to load plans');
			isLoading.value = true;
			const plans = await subscriptionsApi.getPlans(rootStore.restApiContext);
			console.log('🔍 DEBUG loadAvailablePlans - API response:', plans);
			// Ensure we always have an array, even if API returns null/undefined
			availablePlans.value = Array.isArray(plans) ? (plans as SubscriptionPlan[]) : [];
			console.log(
				'🔍 DEBUG loadAvailablePlans - Final availablePlans.value:',
				availablePlans.value,
			);
		} catch (error) {
			console.error('🔍 DEBUG loadAvailablePlans - Error:', error);
			// Keep availablePlans as empty array on error
			availablePlans.value = [];
		} finally {
			isLoading.value = false;
		}
	};

	const loadCurrentSubscription = async () => {
		try {
			const subscription = await subscriptionsApi.getCurrentSubscription(rootStore.restApiContext);
			// Handle null response gracefully
			currentSubscription.value = subscription
				? (subscription as unknown as UserSubscription)
				: null;
		} catch (error) {
			console.error('Failed to load current subscription:', error);
			// Explicitly set to null on error
			currentSubscription.value = null;
		}
	};

	const getPlanById = async (planId: string) => {
		const plan = availablePlans.value.find((p) => p.id === planId);
		if (plan) return plan;

		// If not in cache, fetch from API
		try {
			const fetchedPlan = await subscriptionsApi.getPlanById(rootStore.restApiContext, planId);
			return fetchedPlan as SubscriptionPlan;
		} catch (error) {
			console.error('Failed to get plan:', error);
			return null;
		}
	};

	const createSubscriptionSetup = async (params: {
		planId: string;
		billingCycle: 'monthly' | 'yearly';
	}): Promise<SubscriptionSetupResponse> => {
		try {
			const result = await subscriptionsApi.createSubscriptionSetup(
				rootStore.restApiContext,
				params,
			);
			return result as SubscriptionSetupResponse;
		} catch (error) {
			console.error('Failed to create subscription setup:', error);
			throw error;
		}
	};

	const createRecurringSubscription = async (params: {
		planId: string;
		billingCycle: 'monthly' | 'yearly';
		paymentMethodId: string;
	}) => {
		try {
			const result = await subscriptionsApi.createRecurringSubscription(
				rootStore.restApiContext,
				params,
			);
			currentSubscription.value = result as unknown as UserSubscription;
			return currentSubscription.value;
		} catch (error) {
			console.error('Failed to create subscription:', error);
			throw error;
		}
	};

	const upgradeSubscription = async (planSlug: string) => {
		try {
			if (!currentSubscription.value?.id) {
				throw new Error('No current subscription found');
			}
			const result = await subscriptionsApi.upgradeSubscription(
				rootStore.restApiContext,
				currentSubscription.value.id,
				{ planSlug },
			);
			currentSubscription.value = result as unknown as UserSubscription;
			return currentSubscription.value;
		} catch (error) {
			console.error('Failed to upgrade subscription:', error);
			throw error;
		}
	};

	const cancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
		try {
			if (!currentSubscription.value?.id) {
				throw new Error('No current subscription found');
			}
			const result = await subscriptionsApi.cancelSubscription(
				rootStore.restApiContext,
				currentSubscription.value.id,
				{ cancelAtPeriodEnd },
			);
			currentSubscription.value = result as unknown as UserSubscription;
			return currentSubscription.value;
		} catch (error) {
			console.error('Failed to cancel subscription:', error);
			throw error;
		}
	};

	const loadUsageData = async () => {
		try {
			usage.value = await subscriptionsApi.getUsageLimits(rootStore.restApiContext);
		} catch (error) {
			console.error('Failed to load usage data:', error);
		}
	};

	const loadPaymentMethods = async () => {
		try {
			const methods = await subscriptionsApi.getPaymentMethods(rootStore.restApiContext);
			paymentMethods.value = methods as PaymentMethod[];
		} catch (error) {
			console.error('Failed to load payment methods:', error);
		}
	};

	const loadInvoices = async () => {
		try {
			const invoiceList = await subscriptionsApi.getInvoices(rootStore.restApiContext);
			invoices.value = invoiceList as unknown as Invoice[];
		} catch (error) {
			console.error('Failed to load invoices:', error);
		}
	};

	const createPaymentLink = async (params: {
		planId: string;
		billingCycle: 'monthly' | 'yearly';
	}): Promise<{ paymentLinkId: string; url: string }> => {
		try {
			const result = await subscriptionsApi.createPaymentLink(rootStore.restApiContext, params);
			return result as { paymentLinkId: string; url: string };
		} catch (error) {
			console.error('Failed to create payment link:', error);
			throw error;
		}
	};

	const createCheckoutSession = async (params: {
		priceId: string;
	}): Promise<{ url: string }> => {
		try {
			const result = await subscriptionsApi.createCheckoutSession(rootStore.restApiContext, params);
			return result as { url: string };
		} catch (error) {
			console.error('Failed to create checkout session:', error);
			throw error;
		}
	};

	return {
		// State
		currentSubscription,
		availablePlans,
		paymentMethods,
		invoices,
		usage,
		isLoading,

		// Getters
		isSubscribed,
		currentPlan,
		trialDaysRemaining,

		// Actions
		loadAvailablePlans,
		loadCurrentSubscription,
		getPlanById,
		createSubscriptionSetup,
		createRecurringSubscription,
		upgradeSubscription,
		cancelSubscription,
		loadUsageData,
		loadPaymentMethods,
		loadInvoices,
		createPaymentLink,
		createCheckoutSession,
	};
});
