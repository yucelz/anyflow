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
				v-for="(plan, index) in availablePlans"
				:key="plan.id"
				class="plan-card"
				:class="{
					popular: plan.isPopular,
					current: isCurrentPlan(plan),
					disabled: isProcessing || index >= availablePlans.length - 2,
					'coming-soon': index >= availablePlans.length - 2,
				}"
			>
				<!-- Coming Soon Badge -->
				<div v-if="index >= availablePlans.length - 2" class="coming-soon-badge">Coming Soon</div>

				<!-- Popular Badge -->
				<div v-else-if="plan.isPopular" class="popular-badge">
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
						v-if="index >= availablePlans.length - 2"
						:disabled="true"
						size="large"
						class="action-button coming-soon-button"
					>
						Coming Soon
					</n8n-button>
					<n8n-button
						v-else-if="isCurrentPlan(plan)"
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
				<div v-if="plan.trialDays > 0 && index < availablePlans.length - 2" class="trial-info">
					{{ plan.trialDays }}-day free trial
				</div>
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
import { VIEWS } from '@/constants';
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
	const sortedPlans = [...subscriptionStore.availablePlans].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}
		return a.monthlyPrice - b.monthlyPrice;
	});
	return sortedPlans;
});

onMounted(async () => {
	try {
		await Promise.all([
			subscriptionStore.loadAvailablePlans(),
			subscriptionStore.loadCurrentSubscription(),
		]);

		if (currentSubscription.value?.billingCycle) {
			billingCycle.value = currentSubscription.value.billingCycle;
		}
	} catch (error) {
		toast.showError(error, 'Failed to load pricing information');
	}
});

const updatePricing = () => {};

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
	if (plan.description) {
		return plan.description;
	}

	const planName = plan.name.toLowerCase();
	if (planName.includes('starter') || planName.includes('basic'))
		return 'Perfect for small projects and personal use';
	if (planName.includes('professional') || planName.includes('pro'))
		return 'Best for growing businesses and teams';
	if (planName.includes('enterprise')) return 'For large organizations with custom needs';
	return 'Powerful workflow automation for your needs';
};

const getPlanFeatures = (plan: SubscriptionPlan) => {
	const features = [];

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

	if (plan.features) {
		if (plan.features.advancedNodes) features.push('Advanced nodes');
		if (plan.features.prioritySupport) features.push('Priority support');
		if (plan.features.sso) features.push('Single Sign-On (SSO)');
		if (plan.features.auditLogs) features.push('Audit logs');
		if (plan.features.customIntegrations) features.push('Custom integrations');
		if (plan.features.onPremise) features.push('On-premise deployment');
	}

	return features;
};

const isCurrentPlan = (plan: SubscriptionPlan) => {
	return currentSubscription.value?.planId === plan.id;
};

const isUpgrade = (plan: SubscriptionPlan) => {
	if (hasNeverSubscribed.value) {
		return plan.monthlyPrice > 0 || plan.yearlyPrice > 0;
	}

	if (!currentSubscription.value) return false;

	const currentPrice = getCurrentPlanPrice();
	const newPrice = billingCycle.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice * 12;
	return newPrice > currentPrice;
};

const isDowngrade = (plan: SubscriptionPlan) => {
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
		if (hasNeverSubscribed.value || isUpgrade(plan)) {
			await router.push({
				name: VIEWS.SUBSCRIPTION_CHECKOUT,
				query: {
					planId: plan.id,
					billingCycle: billingCycle.value,
					planSlug: plan.slug,
				},
			});
		} else {
			toast.showMessage({
				title: 'Plan selection not available',
				message: 'Please contact support for assistance.',
				type: 'info',
			});
		}
	} catch (error) {
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
	width: 100%;
	max-width: 1400px;
	margin: 0 auto;
	padding: 3rem 1rem;
	background: linear-gradient(135deg, #f5f7fa 0%, #e8eef5 100%);
	min-height: 100vh;
	box-sizing: border-box;

	@media (min-width: 768px) {
		padding: 3rem 2rem;
	}

	.pricing-header {
		text-align: center;
		margin-bottom: 4rem;
		animation: fadeInDown 0.6s ease-out;

		h1 {
			font-size: 3rem;
			font-weight: 800;
			margin-bottom: 1rem;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			letter-spacing: -0.02em;
		}

		p {
			font-size: 1.25rem;
			color: #64748b;
			margin-bottom: 2.5rem;
			font-weight: 400;
		}
	}

	.billing-toggle {
		display: inline-flex;
		align-items: center;
		background: white;
		backdrop-filter: blur(10px);
		border-radius: 50px;
		padding: 0.375rem;
		border: 2px solid #e2e8f0;
		margin-bottom: 2rem;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);

		.toggle-button {
			position: relative;
			padding: 0.875rem 2rem;
			border-radius: 50px;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			background: transparent;
			border: none;
			cursor: pointer;
			font-weight: 600;
			color: #64748b;
			font-size: 1rem;

			&.active {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				color: white;
				box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
				transform: scale(1.02);
			}

			&:hover:not(.active) {
				color: #334155;
				background: #f8fafc;
			}

			.savings-badge {
				position: absolute;
				top: -2.5rem;
				left: 50%;
				transform: translateX(-50%);
				background: linear-gradient(135deg, #10b981 0%, #059669 100%);
				color: white;
				font-size: 0.75rem;
				font-weight: 700;
				padding: 0.375rem 0.75rem;
				border-radius: 50px;
				white-space: nowrap;
				box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
			}
		}
	}

	.loading-container {
		display: flex;
		justify-content: center;
		padding: 6rem 0;
	}

	.plans-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-bottom: 4rem;
		animation: fadeInUp 0.8s ease-out;
		width: 100%;

		@media (min-width: 768px) {
			gap: 2rem;
		}

		@media (min-width: 1200px) {
			grid-template-columns: repeat(4, 1fr);
		}

		@media (min-width: 768px) and (max-width: 1199px) {
			grid-template-columns: repeat(2, 1fr);
		}

		@media (max-width: 767px) {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
	}

	.plan-card {
		border: 2px solid #e2e8f0;
		border-radius: 1.5rem;
		padding: 1.5rem;
		position: relative;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		background: white;
		backdrop-filter: blur(10px);
		overflow: hidden;
		width: 100%;
		box-sizing: border-box;
		min-height: 600px;
		display: flex;
		flex-direction: column;

		@media (min-width: 768px) {
			padding: 2rem;
		}

		@media (min-width: 1200px) {
			padding: 2.5rem;
		}

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			height: 4px;
			background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
			transform: scaleX(0);
			transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		}

		&:hover:not(.disabled):not(.coming-soon) {
			border-color: #667eea;
			transform: translateY(-8px);
			box-shadow: 0 24px 48px rgba(102, 126, 234, 0.2);

			&::before {
				transform: scaleX(1);
			}
		}

		&.popular {
			border-color: #667eea;
			background: linear-gradient(135deg, #faf5ff 0%, white 100%);
			transform: scale(1.08);
			box-shadow: 0 24px 48px rgba(102, 126, 234, 0.25);
			border-width: 3px;

			&::before {
				transform: scaleX(1);
				height: 6px;
			}

			&:hover {
				transform: scale(1.08) translateY(-8px);
				box-shadow: 0 32px 64px rgba(102, 126, 234, 0.3);
			}
		}

		&.current {
			border-color: #10b981;
			background: linear-gradient(135deg, #f0fdf4 0%, white 100%);

			&::before {
				background: linear-gradient(90deg, #10b981 0%, #059669 100%);
				transform: scaleX(1);
			}
		}

		&.coming-soon {
			opacity: 0.65;
			pointer-events: none;
			filter: grayscale(0.3);
			background: linear-gradient(135deg, #f8fafc 0%, white 100%);

			&::after {
				content: '';
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: repeating-linear-gradient(
					45deg,
					transparent,
					transparent 10px,
					rgba(148, 163, 184, 0.03) 10px,
					rgba(148, 163, 184, 0.03) 20px
				);
				pointer-events: none;
			}
		}

		&.disabled:not(.coming-soon) {
			opacity: 0.6;
			pointer-events: none;
		}

		.coming-soon-badge {
			position: absolute;
			top: -1rem;
			left: 50%;
			transform: translateX(-50%);
			background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
			color: white;
			padding: 0.5rem 1.5rem;
			border-radius: 50px;
			font-size: 0.875rem;
			font-weight: 700;
			box-shadow: 0 4px 16px rgba(100, 116, 139, 0.3);
			z-index: 10;
		}

		.popular-badge {
			position: absolute;
			top: -1rem;
			left: 50%;
			transform: translateX(-50%);
			background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
			color: white;
			padding: 0.5rem 1.75rem;
			border-radius: 50px;
			font-size: 0.875rem;
			font-weight: 700;
			box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
			z-index: 10;
		}
	}

	.plan-header {
		text-align: center;
		margin-bottom: 2.5rem;

		.plan-icon {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 5rem;
			height: 5rem;
			border-radius: 1.5rem;
			margin-bottom: 1.5rem;
			background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
			transition: all 0.3s ease;

			.plan-card:hover & {
				transform: scale(1.1) rotate(5deg);
			}

			.popular & {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
			}

			.n8n-icon {
				font-size: 2.5rem;
				color: #667eea;

				&.popular-icon {
					color: white;
				}
			}
		}

		h3 {
			font-size: 1.75rem;
			font-weight: 700;
			margin-bottom: 0.75rem;
			color: #1e293b;

			.popular & {
				color: #667eea;
			}
		}

		.plan-description {
			font-size: 0.9375rem;
			color: #64748b;
			margin-bottom: 0;
			line-height: 1.6;

			.popular & {
				color: #475569;
				font-weight: 500;
			}
		}
	}

	.plan-pricing {
		text-align: center;
		margin-bottom: 2.5rem;
		padding: 1.5rem 0;
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border-radius: 1rem;

		.popular & {
			background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
		}

		.price-display {
			display: flex;
			align-items: baseline;
			justify-content: center;
			gap: 0.375rem;
			margin-bottom: 0.75rem;

			.currency {
				font-size: 1.75rem;
				color: #64748b;
				font-weight: 600;

				.popular & {
					color: #667eea;
				}
			}

			.amount {
				font-size: 3.5rem;
				font-weight: 800;
				color: #667eea;
				letter-spacing: -0.02em;

				.popular & {
					color: #5b21b6;
				}
			}

			.period {
				font-size: 1.125rem;
				color: #64748b;
				font-weight: 500;

				.popular & {
					color: #475569;
				}
			}
		}

		.savings {
			color: #10b981;
			font-size: 0.9375rem;
			font-weight: 600;

			.popular & {
				color: #059669;
			}
		}
	}

	.plan-features {
		margin-bottom: 2rem;
		flex-grow: 1;

		.feature-item {
			display: flex;
			align-items: flex-start;
			gap: 0.875rem;
			padding: 0.875rem 0;
			transition: all 0.2s ease;

			&:hover {
				padding-left: 0.5rem;
			}

			.check-icon {
				color: #10b981;
				width: 1.375rem;
				height: 1.375rem;
				flex-shrink: 0;
				margin-top: 0.125rem;

				.popular & {
					color: #059669;
				}
			}

			span {
				font-size: 0.9375rem;
				color: #475569;
				line-height: 1.6;

				.popular & {
					color: #334155;
					font-weight: 500;
				}
			}
		}
	}

	.plan-action {
		text-align: center;
		margin-bottom: 1.5rem;
		margin-top: auto;

		.action-button {
			width: 100%;
			font-weight: 700;
			padding: 1rem 1.5rem;
			border-radius: 0.75rem;
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			font-size: 1rem;
			text-transform: uppercase;
			letter-spacing: 0.025em;

			&.current-plan {
				background: linear-gradient(135deg, #10b981 0%, #059669 100%);
				border-color: #10b981;
				box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
			}

			&.coming-soon-button {
				background: #e2e8f0;
				border-color: #cbd5e1;
				color: #64748b;
			}

			&.popular-button {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				color: white;
				border: none;
				box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);

				&:hover {
					box-shadow: 0 12px 32px rgba(102, 126, 234, 0.5);
					transform: translateY(-2px);
				}
			}
		}
	}

	.trial-info {
		text-align: center;
		color: #64748b;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.75rem;
		background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
		border-radius: 0.5rem;
	}

	.faq-section {
		text-align: center;
		margin-top: 6rem;
		padding: 4rem 2rem;
		background: white;
		border-radius: 2rem;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);

		h2 {
			font-size: 2.25rem;
			font-weight: 800;
			margin-bottom: 1rem;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			letter-spacing: -0.02em;
		}

		p {
			font-size: 1.125rem;
			color: #64748b;
			margin-bottom: 2.5rem;
			font-weight: 400;
		}

		.faq-button {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 1rem 2.5rem;
			border-radius: 0.75rem;
			box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
			transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			font-weight: 700;
			border: none;

			&:hover {
				box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
				transform: translateY(-2px);
			}
		}
	}

	.feature-comparison {
		text-align: center;
		margin-top: 3rem;

		.comparison-toggle {
			margin-bottom: 2rem;
			font-weight: 600;
			color: #667eea;

			&:hover {
				color: #764ba2;
			}
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
