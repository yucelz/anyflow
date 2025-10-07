<template>
	<div class="subscription-success-container">
		<!-- Success Animation/Icon -->
		<div class="success-icon">
			<n8n-icon icon="check" size="xlarge" />
		</div>

		<!-- Success Message -->
		<div class="success-content">
			<h1>Subscription Activated!</h1>
			<p class="success-message">
				Congratulations! Your subscription has been successfully activated. You now have access to
				all the premium features.
			</p>

			<!-- Subscription Details -->
			<div v-if="currentSubscription" class="subscription-details">
				<h3>Subscription Details</h3>
				<div class="details-grid">
					<div class="detail-item">
						<span class="label">Plan:</span>
						<span class="value">{{ currentSubscription.plan?.name }}</span>
					</div>
					<div class="detail-item">
						<span class="label">Billing:</span>
						<span class="value">{{ formatBillingCycle(currentSubscription.billingCycle) }}</span>
					</div>
					<div class="detail-item">
						<span class="label">Amount:</span>
						<span class="value"
							>${{ currentSubscription.amount }}/{{
								currentSubscription.billingCycle === 'yearly' ? 'year' : 'month'
							}}</span
						>
					</div>
					<div class="detail-item">
						<span class="label">Status:</span>
						<span class="value status-active">{{ formatStatus(currentSubscription.status) }}</span>
					</div>
					<div v-if="currentSubscription.isTrialing" class="detail-item">
						<span class="label">Trial Ends:</span>
						<span class="value">{{ formatDate(currentSubscription.trialEnd!) }}</span>
					</div>
					<div class="detail-item">
						<span class="label">Next Billing:</span>
						<span class="value">{{ formatDate(currentSubscription.currentPeriodEnd) }}</span>
					</div>
				</div>
			</div>

			<!-- Features Unlocked -->
			<div class="features-unlocked">
				<h3>Features Now Available</h3>
				<div class="features-list">
					<div class="feature-item">
						<n8n-icon icon="check" />
						<span>Unlimited workflow executions</span>
					</div>
					<div class="feature-item">
						<n8n-icon icon="check" />
						<span>Advanced integrations</span>
					</div>
					<div class="feature-item">
						<n8n-icon icon="check" />
						<span>Priority support</span>
					</div>
					<div class="feature-item">
						<n8n-icon icon="check" />
						<span>Advanced workflow analytics</span>
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="action-buttons">
				<n8n-button @click="goToDashboard" type="primary" size="large" class="primary-action">
					Go to Dashboard
				</n8n-button>
				<n8n-button @click="viewSubscription" type="secondary" size="large">
					Manage Subscription
				</n8n-button>
			</div>

			<!-- Trial Notice -->
			<div v-if="currentSubscription?.isTrialing" class="trial-notice">
				<n8n-icon icon="info" />
				<div>
					<strong>Trial Period Active</strong>
					<p>
						Your {{ trialDaysRemaining }}-day trial is now active. You won't be charged until
						{{ formatDate(currentSubscription.trialEnd!) }}. You can cancel anytime before then.
					</p>
				</div>
			</div>

			<!-- Next Steps -->
			<div class="next-steps">
				<h3>What's Next?</h3>
				<ul>
					<li>Explore advanced workflow templates</li>
					<li>Set up team collaboration features</li>
					<li>Configure priority support access</li>
					<li>Check out the premium integrations catalog</li>
				</ul>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';

const router = useRouter();
const subscriptionStore = useSubscriptionStore();

const currentSubscription = computed(() => subscriptionStore.currentSubscription);

const trialDaysRemaining = computed(() => {
	if (!currentSubscription.value?.isTrialing) return 0;
	return subscriptionStore.trialDaysRemaining;
});

onMounted(async () => {
	// Refresh subscription data to get the latest status
	await subscriptionStore.loadCurrentSubscription();
});

const formatBillingCycle = (cycle: string) => {
	return cycle === 'yearly' ? 'Annual' : 'Monthly';
};

const formatStatus = (status: string) => {
	return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDate = (date: string | Date) => {
	const dateObj = typeof date === 'string' ? new Date(date) : date;
	return dateObj.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

const goToDashboard = async () => {
	await router.push('/workflows');
};

const viewSubscription = async () => {
	await router.push('/settings/subscription');
};
</script>

<style lang="scss" scoped>
.subscription-success-container {
	max-width: 600px;
	margin: 0 auto;
	padding: 3rem 2rem;
	text-align: center;

	.success-icon {
		margin-bottom: 2rem;

		.n8n-icon {
			color: var(--color-success);
			width: 80px;
			height: 80px;
			background: var(--color-success-tint-3);
			border-radius: 50%;
			padding: 20px;
		}
	}

	.success-content {
		h1 {
			font-size: 2.5rem;
			font-weight: 700;
			color: var(--color-text-dark);
			margin-bottom: 1rem;
		}

		.success-message {
			font-size: 1.125rem;
			color: var(--color-text-light);
			margin-bottom: 3rem;
			line-height: 1.6;
		}
	}

	.subscription-details {
		background: var(--color-background-light);
		border: 1px solid var(--color-foreground-base);
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 3rem;
		text-align: left;

		h3 {
			font-size: 1.25rem;
			font-weight: 600;
			margin-bottom: 1.5rem;
			color: var(--color-text-dark);
		}

		.details-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1rem;

			@media (max-width: 480px) {
				grid-template-columns: 1fr;
			}
		}

		.detail-item {
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0.5rem 0;

			.label {
				font-weight: 500;
				color: var(--color-text-light);
			}

			.value {
				font-weight: 600;
				color: var(--color-text-dark);

				&.status-active {
					color: var(--color-success);
				}
			}
		}
	}

	.features-unlocked {
		margin-bottom: 3rem;

		h3 {
			font-size: 1.25rem;
			font-weight: 600;
			margin-bottom: 1.5rem;
			color: var(--color-text-dark);
		}

		.features-list {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
			gap: 1rem;
			text-align: left;
		}

		.feature-item {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem;
			background: var(--color-success-tint-3);
			border-radius: 4px;

			.n8n-icon {
				color: var(--color-success);
				width: 20px;
				height: 20px;
				flex-shrink: 0;
			}

			span {
				color: var(--color-text-dark);
				font-weight: 500;
			}
		}
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-bottom: 3rem;

		@media (max-width: 480px) {
			flex-direction: column;
		}

		.primary-action {
			min-width: 200px;
		}
	}

	.trial-notice {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		background: var(--color-primary-tint-3);
		border: 1px solid var(--color-primary-tint-1);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 3rem;
		text-align: left;

		.n8n-icon {
			color: var(--color-primary);
			width: 24px;
			height: 24px;
			flex-shrink: 0;
			margin-top: 2px;
		}

		div {
			strong {
				display: block;
				margin-bottom: 0.5rem;
				color: var(--color-text-dark);
			}

			p {
				color: var(--color-text-light);
				margin: 0;
				line-height: 1.5;
			}
		}
	}

	.next-steps {
		text-align: left;

		h3 {
			font-size: 1.25rem;
			font-weight: 600;
			margin-bottom: 1rem;
			color: var(--color-text-dark);
		}

		ul {
			list-style: none;
			padding: 0;

			li {
				position: relative;
				padding: 0.5rem 0 0.5rem 1.5rem;
				color: var(--color-text-light);

				&::before {
					content: '•';
					position: absolute;
					left: 0;
					color: var(--color-primary);
					font-weight: 600;
				}
			}
		}
	}
}

@media (max-width: 768px) {
	.subscription-success-container {
		padding: 2rem 1rem;

		.success-content h1 {
			font-size: 2rem;
		}

		.subscription-details {
			padding: 1.5rem;
		}
	}
}
</style>
