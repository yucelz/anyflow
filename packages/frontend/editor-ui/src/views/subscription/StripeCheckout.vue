<template>
	<div class="stripe-checkout-container">
		<div class="checkout-header">
			<h1>Complete Your Subscription</h1>
			<p v-if="selectedPlan">{{ selectedPlan.name }} - {{ billingCycleDisplay }}</p>
		</div>

		<!-- Loading State -->
		<div v-if="isLoading" class="loading-container">
			<n8n-spinner size="large" />
			<p>Setting up your checkout...</p>
		</div>

		<!-- Order Summary and Redirect -->
		<div v-else-if="selectedPlan && !checkoutError" class="checkout-form">
			<!-- Order Summary -->
			<div class="order-summary">
				<h3>Order Summary</h3>
				<div class="summary-item">
					<span>{{ selectedPlan.name }}</span>
					<span>${{ planPrice }}</span>
				</div>
				<div class="summary-item total">
					<span>Total {{ billingCycleDisplay.toLowerCase() }}</span>
					<span>${{ planPrice }}</span>
				</div>
				<div v-if="selectedPlan.trialDays > 0" class="trial-notice">
					Your {{ selectedPlan.trialDays }}-day trial starts now. You won't be charged until
					{{ trialEndDate }}.
				</div>
			</div>

			<!-- Checkout Actions -->
			<div class="checkout-actions">
				<h3>Payment</h3>
				<p class="checkout-description">
					You'll be redirected to Stripe's secure payment page to complete your subscription.
				</p>

				<div class="submit-section">
					<n8n-button
						@click="proceedToCheckout"
						:loading="isProcessing"
						:disabled="isProcessing"
						type="primary"
						size="large"
						class="checkout-button"
					>
						{{ isProcessing ? 'Redirecting...' : `Subscribe for $${planPrice}/${billingCycle}` }}
					</n8n-button>

					<p class="terms-notice">
						By subscribing, you agree to our Terms of Service and Privacy Policy. You can cancel at
						any time.
					</p>
				</div>
			</div>
		</div>

		<!-- Error State -->
		<div v-else-if="checkoutError" class="error-container">
			<div class="error-message">
				<h2>Checkout Error</h2>
				<p>{{ checkoutError }}</p>
				<n8n-button @click="$router.push('/subscription/plans')" type="secondary">
					Back to Plans
				</n8n-button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useToast } from '@/composables/useToast';
import type { SubscriptionPlan } from '@/types/subscription';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const toast = useToast();

// State
const isLoading = ref(true);
const isProcessing = ref(false);
const checkoutError = ref<string>('');
const selectedPlan = ref<SubscriptionPlan | null>(null);

// Query params
const planId = computed(() => route.query.planId as string);
const billingCycle = computed(
	() => (route.query.billingCycle as 'monthly' | 'yearly') || 'monthly',
);

// Computed
const billingCycleDisplay = computed(() => {
	return billingCycle.value === 'yearly' ? 'Yearly' : 'Monthly';
});

const planPrice = computed(() => {
	if (!selectedPlan.value) return '0';
	return billingCycle.value === 'yearly'
		? Math.floor(selectedPlan.value.yearlyPrice / 12).toString()
		: selectedPlan.value.monthlyPrice.toString();
});

const trialEndDate = computed(() => {
	if (!selectedPlan.value?.trialDays) return '';
	const date = new Date();
	date.setDate(date.getDate() + selectedPlan.value.trialDays);
	return date.toLocaleDateString();
});

// Get the price ID based on billing cycle
const stripePriceId = computed(() => {
	if (!selectedPlan.value) return '';
	// Use the correct property names from the SubscriptionPlan type
	return billingCycle.value === 'yearly'
		? selectedPlan.value.PriceIdYearly
		: selectedPlan.value.PriceIdMonthly;
});

onMounted(async () => {
	await initializeCheckout();
});

const initializeCheckout = async () => {
	try {
		isLoading.value = true;

		// Validate required parameters
		if (!planId.value) {
			checkoutError.value = 'Plan ID is required';
			return;
		}

		// Load plan details
		selectedPlan.value = await subscriptionStore.getPlanById(planId.value);
		if (!selectedPlan.value) {
			checkoutError.value = 'Selected plan not found';
			return;
		}

		// Validate that we have a stripe price ID
		if (!stripePriceId.value) {
			checkoutError.value = 'Plan pricing configuration is missing';
			return;
		}
	} catch (error) {
		console.error('Failed to initialize checkout:', error);
		checkoutError.value = error instanceof Error ? error.message : 'Failed to initialize checkout';
	} finally {
		isLoading.value = false;
	}
};

const proceedToCheckout = async () => {
	if (isProcessing.value) return;

	isProcessing.value = true;

	try {
		// Create checkout session using the new endpoint
		const priceId = stripePriceId.value;
		if (!priceId) {
			throw new Error('Price ID is required for checkout');
		}

		const response = await subscriptionStore.createCheckoutSession({
			priceId,
		});

		if (response?.url) {
			// Redirect to Stripe checkout
			window.location.href = response.url;
		} else {
			throw new Error('No checkout URL received from server');
		}
	} catch (error) {
		console.error('Checkout failed:', error);
		checkoutError.value = error instanceof Error ? error.message : 'Checkout failed';
		toast.showError(error, 'Checkout Failed');
		isProcessing.value = false;
	}
};
</script>

<style lang="scss" scoped>
.stripe-checkout-container {
	max-width: 800px;
	margin: 0 auto;
	padding: 2rem;

	.checkout-header {
		text-align: center;
		margin-bottom: 3rem;

		h1 {
			font-size: 2rem;
			font-weight: 600;
			margin-bottom: 0.5rem;
			color: var(--color-text-dark);
		}

		p {
			font-size: 1.125rem;
			color: var(--color-text-light);
		}
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 0;

		p {
			color: var(--color-text-light);
		}
	}

	.checkout-form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3rem;
		align-items: start;

		@media (max-width: 768px) {
			grid-template-columns: 1fr;
			gap: 2rem;
		}
	}

	.order-summary {
		background: var(--color-background-light);
		border: 1px solid var(--color-foreground-base);
		border-radius: 8px;
		padding: 2rem;

		h3 {
			font-size: 1.25rem;
			font-weight: 600;
			margin-bottom: 1.5rem;
			color: var(--color-text-dark);
		}

		.summary-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.75rem 0;
			border-bottom: 1px solid var(--color-foreground-light);

			&.total {
				border-bottom: none;
				font-weight: 600;
				font-size: 1.125rem;
				margin-top: 0.5rem;
				padding-top: 1rem;
				border-top: 2px solid var(--color-foreground-base);
			}
		}

		.trial-notice {
			background: var(--color-success-tint-3);
			color: var(--color-success-shade-1);
			padding: 1rem;
			border-radius: 4px;
			font-size: 0.875rem;
			margin-top: 1rem;
		}
	}

	.checkout-actions {
		h3 {
			font-size: 1.25rem;
			font-weight: 600;
			margin-bottom: 1rem;
			color: var(--color-text-dark);
		}

		.checkout-description {
			color: var(--color-text-light);
			margin-bottom: 2rem;
			line-height: 1.5;
		}
	}

	.submit-section {
		.checkout-button {
			width: 100%;
			margin-bottom: 1rem;
		}

		.terms-notice {
			font-size: 0.8125rem;
			color: var(--color-text-light);
			text-align: center;
			line-height: 1.4;
		}
	}

	.error-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 300px;

		.error-message {
			text-align: center;
			max-width: 400px;

			h2 {
				font-size: 1.5rem;
				color: var(--color-danger);
				margin-bottom: 1rem;
			}

			p {
				color: var(--color-text-light);
				margin-bottom: 2rem;
			}
		}
	}
}
</style>
