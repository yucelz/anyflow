<template>
	<div class="payment-links-container">
		<div class="payment-header">
			<h1>Complete Your Subscription</h1>
			<p v-if="selectedPlan">{{ selectedPlan.name }} - {{ billingCycleDisplay }}</p>
		</div>

		<!-- Loading State -->
		<div v-if="isLoading" class="loading-container">
			<n8n-spinner size="large" />
			<p>Preparing your checkout...</p>
		</div>

		<!-- Payment Link Ready -->
		<div v-else-if="paymentLinkUrl" class="payment-link-ready">
			<div class="checkout-options">
				<h3>Choose Your Checkout Method</h3>

				<!-- Payment Link Option -->
				<div class="checkout-option">
					<h4>Quick Checkout (Recommended)</h4>
					<p>Complete your purchase using Stripe's secure checkout page.</p>
					<n8n-button
						@click="redirectToPaymentLink"
						type="primary"
						size="large"
						class="checkout-button"
					>
						<i class="fas fa-external-link-alt"></i>
						Continue to Checkout
					</n8n-button>
				</div>

				<!-- Traditional Checkout Option -->
				<div class="checkout-option">
					<h4>Traditional Checkout</h4>
					<p>Complete your purchase directly on our site.</p>
					<n8n-button
						@click="useTraditionalCheckout"
						type="secondary"
						size="large"
						class="checkout-button"
					>
						Use Traditional Checkout
					</n8n-button>
				</div>
			</div>
		</div>

		<!-- Error State -->
		<div v-else-if="error" class="error-container">
			<div class="error-message">
				<h2>Setup Error</h2>
				<p>{{ error }}</p>
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
const error = ref<string>('');
const paymentLinkUrl = ref<string>('');
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

onMounted(async () => {
	await initializePaymentLink();
});

const initializePaymentLink = async () => {
	try {
		isLoading.value = true;

		// Validate required parameters
		if (!planId.value) {
			error.value = 'Plan ID is required';
			return;
		}

		// Load plan details
		selectedPlan.value = await subscriptionStore.getPlanById(planId.value);
		if (!selectedPlan.value) {
			error.value = 'Selected plan not found';
			return;
		}

		// Create payment link
		const response = await subscriptionStore.createPaymentLink({
			planId: planId.value,
			billingCycle: billingCycle.value,
		});

		paymentLinkUrl.value = response.url;
	} catch (err) {
		console.error('Failed to initialize payment link:', err);
		error.value = err instanceof Error ? err.message : 'Failed to initialize payment link';
	} finally {
		isLoading.value = false;
	}
};

const redirectToPaymentLink = () => {
	if (paymentLinkUrl.value) {
		window.location.href = paymentLinkUrl.value;
	}
};

const useTraditionalCheckout = () => {
	router.push({
		path: '/subscription/checkout',
		query: {
			planId: planId.value,
			billingCycle: billingCycle.value,
		},
	});
};
</script>

<style lang="scss" scoped>
.payment-links-container {
	max-width: 600px;
	margin: 0 auto;
	padding: 2rem;

	.payment-header {
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

	.payment-link-ready {
		.checkout-options {
			h3 {
				text-align: center;
				margin-bottom: 2rem;
				color: var(--color-text-dark);
			}
		}

		.checkout-option {
			border: 1px solid var(--color-foreground-base);
			border-radius: 8px;
			padding: 2rem;
			margin-bottom: 1.5rem;
			text-align: center;

			h4 {
				margin-bottom: 0.5rem;
				color: var(--color-text-dark);
			}

			p {
				color: var(--color-text-light);
				margin-bottom: 1.5rem;
			}

			.checkout-button {
				width: 100%;

				i {
					margin-right: 0.5rem;
				}
			}
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
