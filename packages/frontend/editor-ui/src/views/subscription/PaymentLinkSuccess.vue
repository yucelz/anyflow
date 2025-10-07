<template>
	<div class="payment-success-container">
		<div v-if="isLoading" class="loading-container">
			<n8n-spinner size="large" />
			<p>Processing your subscription...</p>
		</div>

		<div v-else-if="subscription" class="success-container">
			<div class="success-message">
				<i class="fas fa-check-circle success-icon"></i>
				<h1>Welcome to {{ subscription.plan?.name }}!</h1>
				<p>Your subscription has been successfully activated.</p>

				<div class="subscription-details">
					<h3>Subscription Details</h3>
					<div class="detail-item">
						<span>Plan:</span>
						<span>{{ subscription.plan?.name }}</span>
					</div>
					<div class="detail-item">
						<span>Billing Cycle:</span>
						<span>{{ subscription.billingCycle }}</span>
					</div>
					<div class="detail-item">
						<span>Next Billing Date:</span>
						<span>{{ formatDate(subscription.currentPeriodEnd) }}</span>
					</div>
					<div v-if="subscription.trialEnd" class="detail-item">
						<span>Trial Ends:</span>
						<span>{{ formatDate(subscription.trialEnd) }}</span>
					</div>
				</div>

				<div class="action-buttons">
					<n8n-button
						@click="redirectToApplication"
						type="primary"
						size="large"
						class="continue-button"
					>
						Continue to Application
					</n8n-button>

					<n8n-button @click="goToSettings" type="secondary" size="large" class="settings-button">
						View Subscription Settings
					</n8n-button>
				</div>
			</div>
		</div>

		<div v-else class="error-container">
			<div class="error-message">
				<h2>Processing Error</h2>
				<p>We're having trouble processing your subscription. Please contact support.</p>
				<n8n-button @click="$router.push('/subscription/plans')" type="secondary">
					Back to Plans
				</n8n-button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';
import type { UserSubscription } from '@/types/subscription';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();

// State
const isLoading = ref(true);
const subscription = ref<UserSubscription | null>(null);

onMounted(async () => {
	await processSuccess();
});

const processSuccess = async () => {
	try {
		const sessionId = route.query.session_id as string;

		if (sessionId) {
			// Wait a bit for webhooks to process
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Fetch current subscription
		await subscriptionStore.loadCurrentSubscription();
		subscription.value = subscriptionStore.currentSubscription;
	} catch (error) {
		console.error('Failed to process success:', error);
	} finally {
		isLoading.value = false;
	}
};

const formatDate = (date: string | Date) => {
	return new Date(date).toLocaleDateString();
};

const redirectToApplication = () => {
	router.push('/workflows');
};

const goToSettings = () => {
	router.push('/settings/usage-and-plan');
};
</script>

<style lang="scss" scoped>
.payment-success-container {
	max-width: 600px;
	margin: 0 auto;
	padding: 2rem;

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

	.success-container {
		text-align: center;

		.success-message {
			.success-icon {
				font-size: 4rem;
				color: var(--color-success);
				margin-bottom: 1rem;
			}

			h1 {
				font-size: 2.5rem;
				font-weight: 600;
				margin-bottom: 1rem;
				color: var(--color-text-dark);
			}

			p {
				font-size: 1.25rem;
				color: var(--color-text-light);
				margin-bottom: 2rem;
			}
		}

		.subscription-details {
			background: var(--color-background-light);
			border: 1px solid var(--color-foreground-base);
			border-radius: 8px;
			padding: 2rem;
			margin-bottom: 2rem;
			text-align: left;

			h3 {
				margin-bottom: 1rem;
				color: var(--color-text-dark);
			}

			.detail-item {
				display: flex;
				justify-content: space-between;
				padding: 0.75rem 0;
				border-bottom: 1px solid var(--color-foreground-light);

				&:last-child {
					border-bottom: none;
				}

				span:first-child {
					font-weight: 500;
					color: var(--color-text-base);
				}

				span:last-child {
					color: var(--color-text-dark);
				}
			}
		}

		.action-buttons {
			display: flex;
			gap: 1rem;
			justify-content: center;

			.continue-button,
			.settings-button {
				min-width: 200px;
			}

			@media (max-width: 768px) {
				flex-direction: column;
				align-items: center;

				.continue-button,
				.settings-button {
					width: 100%;
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
