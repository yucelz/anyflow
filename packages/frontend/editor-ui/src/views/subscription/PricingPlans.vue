<template>
	<div class="pricing-plans-container">
		<!-- Header -->
		<div class="pricing-header">
			<h1>Simple, Transparent Pricing</h1>
			<p>Choose the perfect plan for your workflow automation needs</p>

			<!-- Billing Toggle -->
			<div class="billing-toggle">
				<button
					@click="
						billingCycle = 'monthly';
						updatePricing();
					"
					:class="{ active: billingCycle === 'monthly' }"
					class="toggle-button"
				>
					Monthly
				</button>
				<button
					@click="
						billingCycle = 'yearly';
						updatePricing();
					"
					:class="{ active: billingCycle === 'yearly' }"
					class="toggle-button"
				>
					Annual
					<span class="savings-badge">Save up to 20%</span>
				</button>
			</div>
		</div>

		<!-- Loading State -->
		<div v-if="subscriptionStore.isLoading" class="loading-container">
			<n8n-spinner size="large" />
		</div>

		<!-- Plans Grid -->
		<div v-else class="plans-grid">
			<div
				v-for="plan in availablePlans"
				:key="plan.id"
				class="plan-card"
				:class="{
					popular: plan.isPopular,
					current: isCurrentPlan(plan),
					disabled: isProcessing,
				}"
			>
				<!-- Popular Badge -->
				<div v-if="plan.isPopular" class="popular-badge">
					{{ plan.isPopular ? 'Most Popular' : '' }}
				</div>

				<div class="plan-header">
					<div class="plan-icon">
						<n8n-icon :icon="getPlanIcon(plan)" :class="{ 'popular-icon': plan.isPopular }" />
					</div>
					<h3>{{ plan.name }}</h3>
					<p class="plan-description">{{ getPlanDescription(plan) }}</p>
				</div>

				<div class="plan-pricing">
					<div class="price-display">
						<span class="currency">$</span>
						<span class="amount">{{ getPlanPrice(plan) }}</span>
						<span class="period">/{{ billingCycle === 'yearly' ? 'year' : 'month' }}</span>
					</div>
					<div v-if="billingCycle === 'yearly' && getYearlySavings(plan) > 0" class="savings">
						Save {{ getSavingsPercentage(plan) }}% with annual billing
					</div>
				</div>

				<!-- Action Button -->
				<div class="plan-action">
					<n8n-button
						v-if="isCurrentPlan(plan)"
						:disabled="true"
						size="large"
						:class="['action-button', { 'current-plan': true }]"
					>
						Current Plan
					</n8n-button>
					<n8n-button
						v-else-if="isDowngrade(plan)"
						@click="confirmDowngrade(plan)"
						size="large"
						:disabled="isProcessing"
						type="secondary"
						class="action-button"
					>
						Downgrade
					</n8n-button>
					<n8n-button
						v-else
						@click="selectPlan(plan)"
						size="large"
						:loading="isProcessing"
						:type="plan.isPopular ? 'primary' : 'secondary'"
						:class="['action-button', { 'popular-button': plan.isPopular }]"
					>
						{{ hasNeverSubscribed ? 'Get Started' : isUpgrade(plan) ? 'Upgrade' : 'Select Plan' }}
					</n8n-button>
				</div>

				<!-- Features List -->
				<div class="plan-features">
					<div class="feature-item" v-for="feature in getPlanFeatures(plan)" :key="feature">
						<n8n-icon icon="check" class="check-icon" />
						<span>{{ feature }}</span>
					</div>
				</div>

				<!-- Trial Info -->
				<div v-if="plan.trialDays > 0" class="trial-info">{{ plan.trialDays }}-day free trial</div>
			</div>
		</div>

		<!-- FAQ Section -->
		<div class="faq-section">
			<h2>Frequently Asked Questions</h2>
			<p>Have questions? We're here to help.</p>
			<n8n-button @click="showComparison = true" type="secondary" class="faq-button">
				View Detailed Comparison
			</n8n-button>
		</div>

		<!-- Feature Comparison -->
		<div class="feature-comparison">
			<n8n-button
				@click="showComparison = !showComparison"
				type="tertiary"
				class="comparison-toggle"
			>
				{{ showComparison ? 'Hide' : 'Show' }} detailed comparison
			</n8n-button>

			<div v-if="showComparison" class="comparison-table">
				<PlanComparisonTable :plans="availablePlans" />
			</div>
		</div>

		<!-- Downgrade Confirmation Modal -->
		<Modal
			v-if="showDowngradeModal"
			:name="'subscription-downgrade'"
			:title="'Confirm Downgrade'"
			@close="showDowngradeModal = false"
		>
			<template #content>
				<div class="downgrade-modal-content">
					<p>Are you sure you want to downgrade to {{ selectedPlanForDowngrade?.name }}?</p>
					<p>This change will take effect at the end of your current billing period.</p>
				</div>
			</template>
			<template #footer>
				<n8n-button @click="showDowngradeModal = false" type="secondary"> Cancel </n8n-button>
				<n8n-button @click="proceedWithDowngrade" type="primary" :loading="isProcessing">
					Confirm Downgrade
				</n8n-button>
			</template>
		</Modal>
	</div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useToast } from '@/composables/useToast';
import type { SubscriptionPlan } from '@/types/subscription';
import Modal from '@/components/Modal.vue';
import PlanComparisonTable from './PlanComparisonTable.vue';

const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const toast = useToast();

const billingCycle = ref<'monthly' | 'yearly'>('monthly');
const showComparison = ref(false);
const isProcessing = ref(false);
const showDowngradeModal = ref(false);
const selectedPlanForDowngrade = ref<SubscriptionPlan | null>(null);

const currentSubscription = computed(() => subscriptionStore.currentSubscription);
const hasNeverSubscribed = computed(() => !currentSubscription.value);
const availablePlans = computed(() => {
	console.log(
		'🔍 DEBUG availablePlans computed - subscriptionStore.availablePlans:',
		subscriptionStore.availablePlans,
	);
	console.log(
		'🔍 DEBUG availablePlans computed - length:',
		subscriptionStore.availablePlans?.length,
	);

	// Sort plans by sortOrder, then by price for consistent display
	const sortedPlans = [...subscriptionStore.availablePlans].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}
		return a.monthlyPrice - b.monthlyPrice;
	});

	console.log('🔍 DEBUG availablePlans computed - sortedPlans:', sortedPlans);
	return sortedPlans;
});

onMounted(async () => {
	console.log('🔍 DEBUG onMounted - Starting to load plans and subscription data');
	try {
		// Load both plans and current subscription in parallel
		console.log('🔍 DEBUG onMounted - Calling loadAvailablePlans and loadCurrentSubscription');
		await Promise.all([
			subscriptionStore.loadAvailablePlans(),
			subscriptionStore.loadCurrentSubscription(),
		]);

		console.log(
			'🔍 DEBUG onMounted - After loading, availablePlans:',
			subscriptionStore.availablePlans,
		);
		console.log(
			'🔍 DEBUG onMounted - After loading, currentSubscription:',
			subscriptionStore.currentSubscription,
		);
		console.log(
			'🔍 DEBUG onMounted - currentSubscription with currentPeriodEnd:',
			currentSubscription.value?.currentPeriodEnd,
		);

		// Set default billing cycle based on current subscription if exists
		if (currentSubscription.value?.billingCycle) {
			console.log(
				'🔍 DEBUG onMounted - Setting billingCycle to:',
				currentSubscription.value.billingCycle,
			);
			billingCycle.value = currentSubscription.value.billingCycle;
		}
	} catch (error) {
		console.error('🔍 DEBUG onMounted - Error loading data:', error);
		toast.showError(error, 'Failed to load pricing information');
	}
});

const updatePricing = () => {
	// This is called when billing cycle changes
	// Could add analytics tracking here
};

const getPlanPrice = (plan: SubscriptionPlan) => {
	return billingCycle.value === 'yearly'
		? plan.yearlyPrice.toString()
		: plan.monthlyPrice.toString();
};

const getYearlySavings = (plan: SubscriptionPlan) => {
	const monthlyTotal = plan.monthlyPrice * 12;
	return monthlyTotal - plan.yearlyPrice;
};

const getSavingsPercentage = (plan: SubscriptionPlan) => {
	const monthlyTotal = plan.monthlyPrice * 12;
	const savings = monthlyTotal - plan.yearlyPrice;
	return Math.round((savings / monthlyTotal) * 100);
};

const getPlanIcon = (plan: SubscriptionPlan) => {
	const planName = plan.name.toLowerCase();
	if (planName.includes('starter') || planName.includes('basic')) return 'bolt-filled';
	if (planName.includes('professional') || planName.includes('pro')) return 'users';
	if (planName.includes('enterprise')) return 'globe';
	return 'play';
};

const getPlanDescription = (plan: SubscriptionPlan) => {
	// Use the description from the database if available
	if (plan.description) {
		return plan.description;
	}

	// Fallback to dynamic descriptions based on plan name
	const planName = plan.name.toLowerCase();
	if (planName.includes('starter') || planName.includes('basic'))
		return 'Perfect for small projects and personal use';
	if (planName.includes('professional') || planName.includes('pro'))
		return 'Best for growing businesses and teams';
	if (planName.includes('enterprise')) return 'For large organizations with custom needs';
	return 'Powerful workflow automation for your needs';
};

const getPlanFeatures = (plan: SubscriptionPlan) => {
	console.log('🔍 DEBUG getPlanFeatures - plan:', plan);
	const features = [];

	// Core features based on plan limits
	if (plan.monthlyExecutionsLimit === -1) {
		features.push('Unlimited executions');
	} else if (plan.monthlyExecutionsLimit > 0) {
		features.push(`${formatNumber(plan.monthlyExecutionsLimit)} executions/month`);
	}

	if (plan.activeWorkflowsLimit > 0) {
		features.push(`${formatNumber(plan.activeWorkflowsLimit)} active workflows`);
	}

	if (plan.credentialsLimit > 0) {
		features.push(`${formatNumber(plan.credentialsLimit)} credentials`);
	}

	if (plan.usersLimit > 0) {
		const userText = plan.usersLimit === 1 ? 'user' : 'team members';
		features.push(`${formatNumber(plan.usersLimit)} ${userText}`);
	}

	// Premium features from database
	if (plan.features) {
		if (plan.features.advancedNodes) features.push('Advanced nodes');
		if (plan.features.prioritySupport) features.push('Priority support');
		if (plan.features.sso) features.push('Single Sign-On (SSO)');
		if (plan.features.auditLogs) features.push('Audit logs');
		if (plan.features.customIntegrations) features.push('Custom integrations');
		if (plan.features.onPremise) features.push('On-premise deployment');
	}

	console.log('🔍 DEBUG getPlanFeatures - features:', features);
	return features;
};

const isCurrentPlan = (plan: SubscriptionPlan) => {
	console.log('Current Subscription:', currentSubscription.value);
	return currentSubscription.value?.planId === plan.id;
};

const isUpgrade = (plan: SubscriptionPlan) => {
	// If user has never subscribed, all paid plans are considered upgrades
	if (hasNeverSubscribed.value) {
		return plan.monthlyPrice > 0 || plan.yearlyPrice > 0;
	}

	if (!currentSubscription.value) return false;

	// Compare plan pricing to determine if it's an upgrade
	const currentPrice = getCurrentPlanPrice();
	const newPrice = billingCycle.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice * 12;
	return newPrice > currentPrice;
};

const isDowngrade = (plan: SubscriptionPlan) => {
	// Users who never subscribed cannot downgrade
	if (hasNeverSubscribed.value) return false;

	if (!currentSubscription.value) return false;

	const currentPrice = getCurrentPlanPrice();
	const newPrice = billingCycle.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice * 12;
	return newPrice < currentPrice;
};

const getCurrentPlanPrice = () => {
	if (!currentSubscription.value || !subscriptionStore.currentPlan) return 0;

	return currentSubscription.value.billingCycle === 'yearly'
		? subscriptionStore.currentPlan.yearlyPrice
		: subscriptionStore.currentPlan.monthlyPrice * 12;
};

const selectPlan = async (plan: SubscriptionPlan) => {
	if (isProcessing.value) return;

	isProcessing.value = true;

	try {
		// For users who never subscribed or need to upgrade, go to checkout
		if (hasNeverSubscribed.value || isUpgrade(plan)) {
			await router.push({
				name: 'subscription-checkout',
				query: {
					planId: plan.id,
					billingCycle: billingCycle.value,
					planSlug: plan.slug, // Include slug for easier backend processing
				},
			});
		} else {
			// Handle other cases (should not normally reach here due to button logic)
			toast.showMessage({
				title: 'Plan selection not available',
				message: 'Please contact support for assistance.',
				type: 'info',
			});
		}
	} catch (error) {
		console.error('Failed to proceed to checkout:', error);
		toast.showError(error, 'Failed to proceed to checkout');
	} finally {
		isProcessing.value = false;
	}
};

const confirmDowngrade = (plan: SubscriptionPlan) => {
	selectedPlanForDowngrade.value = plan;
	showDowngradeModal.value = true;
};

const proceedWithDowngrade = async () => {
	if (!selectedPlanForDowngrade.value) return;

	isProcessing.value = true;

	try {
		await subscriptionStore.upgradeSubscription(selectedPlanForDowngrade.value.slug);
		toast.showMessage({
			title: 'Subscription downgrade scheduled for end of billing period',
			type: 'success',
		});
		showDowngradeModal.value = false;
	} catch (error) {
		toast.showError(error, 'Failed to downgrade subscription');
	} finally {
		isProcessing.value = false;
		selectedPlanForDowngrade.value = null;
	}
};

const formatNumber = (num: number) => {
	if (num >= 1000000) {
		return (num / 1000000).toFixed(1) + 'M';
	} else if (num >= 1000) {
		return (num / 1000).toFixed(0) + 'K';
	}
	return num.toString();
};
</script>

<style lang="scss" scoped>
.pricing-plans-container {
	max-width: 1200px;
	margin: 0 auto;
	padding: 2rem;

	.pricing-header {
		text-align: center;
		margin-bottom: 3rem;

		h1 {
			font-size: 2.5rem;
			font-weight: 700;
			margin-bottom: 1rem;
			color: var(--color-text-dark);
		}

		p {
			font-size: 1.125rem;
			color: var(--color-text-light);
			margin-bottom: 2rem;
		}
	}

	.billing-toggle {
		display: inline-flex;
		align-items: center;
		background: var(--color-foreground-xlight);
		backdrop-filter: blur(10px);
		border-radius: 50px;
		padding: 0.25rem;
		border: 1px solid var(--color-foreground-light);
		margin-bottom: 2rem;

		.toggle-button {
			position: relative;
			padding: 0.75rem 1.5rem;
			border-radius: 50px;
			transition: all 0.3s;
			background: transparent;
			border: none;
			cursor: pointer;
			font-weight: 500;
			color: var(--color-text-light);

			&.active {
				background: var(--color-primary);
				color: white;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			}

			&:hover:not(.active) {
				color: var(--color-text-dark);
			}

			.savings-badge {
				position: absolute;
				top: -2rem;
				left: 50%;
				transform: translateX(-50%);
				background: var(--color-success);
				color: white;
				font-size: 0.75rem;
				font-weight: 600;
				padding: 0.25rem 0.5rem;
				border-radius: 50px;
				white-space: nowrap;
			}
		}
	}

	.loading-container {
		display: flex;
		justify-content: center;
		padding: 4rem 0;
	}

	.plans-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
		margin-bottom: 3rem;
	}

	.plan-card {
		border: 1px solid var(--color-foreground-light);
		border-radius: 1rem;
		padding: 2rem;
		position: relative;
		transition: all 0.3s ease;
		background: var(--color-background-base);
		backdrop-filter: blur(10px);

		&:hover:not(.disabled) {
			border-color: var(--color-primary-light);
			transform: translateY(-4px);
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
		}

		&.popular {
			border-color: var(--color-primary);
			background: linear-gradient(
				135deg,
				var(--color-primary-tint-3) 0%,
				var(--color-background-base) 100%
			);
			transform: scale(1.05);
			box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
			border-width: 2px;

			&:hover {
				transform: scale(1.05) translateY(-4px);
			}
		}

		&.current {
			border-color: var(--color-success);
			background-color: var(--color-success-tint-3);
		}

		&.disabled {
			opacity: 0.6;
			pointer-events: none;
		}

		.popular-badge {
			position: absolute;
			top: -1rem;
			left: 50%;
			transform: translateX(-50%);
			background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-warning-dark) 100%);
			color: var(--color-text-dark);
			padding: 0.5rem 1.5rem;
			border-radius: 50px;
			font-size: 0.875rem;
			font-weight: 700;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		}
	}

	.plan-header {
		text-align: center;
		margin-bottom: 2rem;

		.plan-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 4rem;
			height: 4rem;
			border-radius: 1rem;
			margin-bottom: 1rem;
			background: var(--color-primary-tint-3);

			.popular & {
				background: rgba(255, 255, 255, 0.2);
			}

			.n8n-icon {
				font-size: 2rem;
				color: var(--color-primary);

				&.popular-icon {
					color: white;
				}
			}
		}

		h3 {
			font-size: 1.5rem;
			font-weight: 700;
			margin-bottom: 0.5rem;
			color: var(--color-text-dark);

			.popular & {
				color: var(--color-primary);
			}
		}

		.plan-description {
			font-size: 0.875rem;
			color: var(--color-text-light);
			margin-bottom: 0;

			.popular & {
				color: var(--color-text-base);
			}
		}
	}

	.plan-pricing {
		text-align: center;
		margin-bottom: 2rem;

		.price-display {
			display: flex;
			align-items: baseline;
			justify-content: center;
			gap: 0.25rem;
			margin-bottom: 0.5rem;

			.currency {
				font-size: 1.5rem;
				color: var(--color-text-light);

				.popular & {
					color: var(--color-primary);
				}
			}

			.amount {
				font-size: 3rem;
				font-weight: 700;
				color: var(--color-primary);

				.popular & {
					color: var(--color-primary-dark);
				}
			}

			.period {
				font-size: 1rem;
				color: var(--color-text-light);

				.popular & {
					color: var(--color-text-base);
				}
			}
		}

		.savings {
			color: var(--color-success);
			font-size: 0.875rem;
			font-weight: 500;

			.popular & {
				color: var(--color-success-dark);
			}
		}
	}

	.plan-features {
		margin-bottom: 2rem;

		.feature-item {
			display: flex;
			align-items: flex-start;
			gap: 0.75rem;
			padding: 0.75rem 0;

			&:last-child {
				border-bottom: none;
			}

			.check-icon {
				color: var(--color-success);
				width: 1.25rem;
				height: 1.25rem;
				flex-shrink: 0;
				margin-top: 0.125rem;

				.popular & {
					color: var(--color-success-dark);
				}
			}

			span {
				font-size: 0.875rem;
				color: var(--color-text-base);

				.popular & {
					color: var(--color-text-dark);
				}
			}
		}
	}

	.plan-action {
		text-align: center;
		margin-bottom: 1rem;

		.action-button {
			width: 100%;
			font-weight: 600;
			padding: 0.875rem 1.5rem;
			border-radius: 0.5rem;
			transition: all 0.3s ease;

			&.current-plan {
				background: var(--color-success);
				border-color: var(--color-success);
			}

			&.popular-button {
				background: white;
				color: var(--color-primary);
				border-color: white;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

				&:hover {
					background: var(--color-primary-tint-1);
					color: white;
				}
			}
		}
	}

	.trial-info {
		text-align: center;
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.faq-section {
		text-align: center;
		margin-top: 5rem;

		h2 {
			font-size: 1.875rem;
			font-weight: 700;
			margin-bottom: 1rem;
			color: var(--color-text-dark);
		}

		p {
			font-size: 1rem;
			color: var(--color-text-light);
			margin-bottom: 2rem;
		}

		.faq-button {
			background: var(--color-primary);
			color: white;
			padding: 0.75rem 2rem;
			border-radius: 0.5rem;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			transition: all 0.3s ease;

			&:hover {
				background: var(--color-primary-dark);
				transform: translateY(-2px);
			}
		}
	}

	.feature-comparison {
		text-align: center;
		margin-top: 3rem;

		.comparison-toggle {
			margin-bottom: 2rem;
		}

		.comparison-table {
			background: var(--color-background-light);
			border-radius: 8px;
			padding: 2rem;
		}
	}
}

.downgrade-modal-content {
	p {
		margin-bottom: 1rem;

		&:last-child {
			margin-bottom: 0;
		}
	}
}
</style>
