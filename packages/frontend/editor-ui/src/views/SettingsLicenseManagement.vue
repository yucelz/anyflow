<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useUsersStore } from '@/stores/users.store';
import { useLicenseApi } from '@/api/license';

const toast = useToast();
const usersStore = useUsersStore();
const licenseApi = useLicenseApi();

// Reactive data
const loading = ref(false);
const plans = ref<any[]>([]);
const licenseKeys = ref<string[]>([]);
const newLicenseKey = ref('');
const validationResult = ref<any>(null);
const licenseInfo = ref<any>(null);

// Computed properties
const isGlobalOwner = computed(() => {
	return usersStore.isInstanceOwner;
});

const canManageLicenses = computed(() => {
	return isGlobalOwner.value;
});

// Methods
const loadPlans = async () => {
	try {
		loading.value = true;
		const response = await licenseApi.getAvailablePlans();
		plans.value = response;
	} catch (error) {
		toast.showError(error, 'Failed to load license plans');
	} finally {
		loading.value = false;
	}
};

const generateEnterpriseOwnerLicense = async () => {
	if (!isGlobalOwner.value) {
		toast.showError(null, 'Only the global owner can generate enterprise licenses');
		return;
	}

	try {
		loading.value = true;
		const response = await licenseApi.generateEnterpriseOwnerLicense();

		if (response.success) {
			licenseKeys.value.push(response.licenseKey);
			toast.showToast({
				title: 'Success',
				message: 'Enterprise license generated successfully!',
				type: 'success',
			});

			// Automatically validate the new license
			await validateLicense(response.licenseKey);
		}
	} catch (error) {
		toast.showError(error, 'Failed to generate enterprise license');
	} finally {
		loading.value = false;
	}
};

const validateLicense = async (licenseKey?: string) => {
	const keyToValidate = licenseKey || newLicenseKey.value;

	if (!keyToValidate.trim()) {
		toast.showError(null, 'Please enter a license key to validate');
		return;
	}

	try {
		loading.value = true;
		const response = await licenseApi.validateLicenseKey(keyToValidate);
		validationResult.value = response;

		if (response.valid) {
			toast.showToast({
				title: 'Success',
				message: `Valid ${response.type} license key`,
				type: 'success',
			});

			// Get detailed license info
			const info = await licenseApi.getLicenseInfo(keyToValidate);
			licenseInfo.value = info;
		} else {
			toast.showError(null, 'Invalid license key format');
		}
	} catch (error) {
		toast.showError(error, 'Failed to validate license key');
		validationResult.value = null;
		licenseInfo.value = null;
	} finally {
		loading.value = false;
	}
};

const activateLicense = async () => {
	if (!newLicenseKey.value.trim()) {
		toast.showError(null, 'Please enter a license key to activate');
		return;
	}

	try {
		loading.value = true;
		await licenseApi.activateLicense(newLicenseKey.value);
		toast.showToast({
			title: 'Success',
			message: 'License activated successfully!',
			type: 'success',
		});
		newLicenseKey.value = '';
		validationResult.value = null;
		licenseInfo.value = null;

		// Reload plans to reflect changes
		await loadPlans();
	} catch (error) {
		toast.showError(error, 'Failed to activate license');
	} finally {
		loading.value = false;
	}
};

const requestEnterpriseTrial = async () => {
	try {
		loading.value = true;
		const response = await licenseApi.requestEnterpriseTrial();

		if (response.success) {
			toast.showToast({
				title: 'Success',
				message: 'Enterprise trial request processed successfully!',
				type: 'success',
			});
			await loadPlans();
		}
	} catch (error) {
		toast.showError(error, 'Failed to request enterprise trial');
	} finally {
		loading.value = false;
	}
};

const copyToClipboard = async (text: string) => {
	try {
		await navigator.clipboard.writeText(text);
		toast.showToast({
			title: 'Success',
			message: 'Copied to clipboard!',
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, 'Failed to copy to clipboard');
	}
};

const formatDate = (date: string | null) => {
	if (!date) return 'Never expires';
	return new Date(date).toLocaleDateString();
};

const getLicenseTypeColor = (type: string) => {
	switch (type) {
		case 'enterprise':
			return 'success';
		case 'trial':
			return 'warning';
		case 'community':
			return 'primary';
		default:
			return 'secondary';
	}
};

// Lifecycle
onMounted(() => {
	if (canManageLicenses.value) {
		loadPlans();
	}
});
</script>

<template>
	<div>
		<n8n-heading size="2xlarge" tag="h1" class="mb-2xl"> License Management </n8n-heading>

		<div v-if="!canManageLicenses" class="mb-2xl">
			<n8n-callout theme="warning" icon="info">
				<template #header>Access Restricted</template>
				Only the global owner can access license management features.
			</n8n-callout>
		</div>

		<div v-else>
			<!-- Enterprise License Generation Section -->
			<n8n-card class="mb-2xl">
				<template #header>
					<n8n-heading size="large">Generate Enterprise License</n8n-heading>
				</template>
				<div class="mb-l">
					<p class="mb-m">
						As the global owner, you can generate an automatic enterprise license with full features
						and unlimited access.
					</p>
					<n8n-button
						:loading="loading"
						type="primary"
						size="large"
						@click="generateEnterpriseOwnerLicense"
					>
						Generate Enterprise License
					</n8n-button>
				</div>
			</n8n-card>

			<!-- Generated License Keys Section -->
			<n8n-card v-if="licenseKeys.length > 0" class="mb-2xl">
				<template #header>
					<n8n-heading size="large">Generated License Keys</n8n-heading>
				</template>
				<div class="license-keys">
					<div v-for="(key, index) in licenseKeys" :key="index" class="license-key-item mb-m">
						<n8n-input :model-value="key" readonly class="license-key-input" />
						<n8n-button type="tertiary" size="small" icon="copy" @click="copyToClipboard(key)">
							Copy
						</n8n-button>
					</div>
				</div>
			</n8n-card>

			<!-- License Validation Section -->
			<n8n-card class="mb-2xl">
				<template #header>
					<n8n-heading size="large">Validate License Key</n8n-heading>
				</template>
				<div class="mb-l">
					<n8n-input
						v-model="newLicenseKey"
						placeholder="Enter license key to validate..."
						class="mb-m"
					/>
					<div class="button-group">
						<n8n-button :loading="loading" type="secondary" @click="validateLicense()">
							Validate License
						</n8n-button>
						<n8n-button :loading="loading" type="primary" @click="activateLicense">
							Activate License
						</n8n-button>
					</div>
				</div>

				<!-- Validation Result -->
				<div v-if="validationResult" class="validation-result mb-l">
					<n8n-callout
						:theme="validationResult.valid ? 'success' : 'danger'"
						:icon="validationResult.valid ? 'circle' : 'circle'"
					>
						<template #header>
							{{ validationResult.valid ? 'Valid License' : 'Invalid License' }}
						</template>
						<p>
							<strong>Type:</strong>
							<n8n-badge :theme="getLicenseTypeColor(validationResult.type)">
								{{ validationResult.type.toUpperCase() }}
							</n8n-badge>
						</p>
					</n8n-callout>
				</div>

				<!-- License Info -->
				<div v-if="licenseInfo" class="license-info">
					<n8n-heading size="medium" class="mb-m">License Details</n8n-heading>
					<div class="info-grid">
						<div class="info-item"><strong>Plan:</strong> {{ licenseInfo.planName }}</div>
						<div class="info-item">
							<strong>Type:</strong>
							<n8n-badge :theme="getLicenseTypeColor(licenseInfo.type)">
								{{ licenseInfo.type.toUpperCase() }}
							</n8n-badge>
						</div>
						<div class="info-item">
							<strong>Status:</strong>
							<n8n-badge :theme="licenseInfo.isActive ? 'success' : 'danger'">
								{{ licenseInfo.isActive ? 'Active' : 'Inactive' }}
							</n8n-badge>
						</div>
						<div class="info-item">
							<strong>Expires:</strong> {{ formatDate(licenseInfo.expiresAt) }}
						</div>
					</div>

					<!-- Features -->
					<div v-if="licenseInfo.features" class="features-section mt-l">
						<n8n-heading size="medium" class="mb-m">Available Features</n8n-heading>
						<div class="features-grid">
							<div
								v-for="(enabled, feature) in licenseInfo.features"
								:key="feature"
								class="feature-item"
							>
								<n8n-icon
									:icon="enabled ? 'circle' : 'circle'"
									:class="enabled ? 'feature-enabled' : 'feature-disabled'"
								/>
								<span>{{
									String(feature)
										.replace(/([A-Z])/g, ' $1')
										.replace(/^./, (str: string) => str.toUpperCase())
								}}</span>
							</div>
						</div>
					</div>
				</div>
			</n8n-card>

			<!-- Enterprise Trial Section -->
			<n8n-card class="mb-2xl">
				<template #header>
					<n8n-heading size="large">Enterprise Trial</n8n-heading>
				</template>
				<div class="mb-l">
					<p class="mb-m">
						Request a 30-day enterprise trial with full features to evaluate n8n's enterprise
						capabilities.
					</p>
					<n8n-button :loading="loading" type="secondary" @click="requestEnterpriseTrial">
						Request Enterprise Trial
					</n8n-button>
				</div>
			</n8n-card>

			<!-- Available Plans Section -->
			<n8n-card v-if="plans.length > 0">
				<template #header>
					<n8n-heading size="large">Available License Plans</n8n-heading>
				</template>
				<div class="plans-grid">
					<div v-for="plan in plans" :key="plan.id" class="plan-card">
						<n8n-card>
							<template #header>
								<div class="plan-header">
									<n8n-heading size="medium">{{ plan.name }}</n8n-heading>
									<n8n-badge v-if="plan.isPopular" theme="success"> Popular </n8n-badge>
								</div>
							</template>
							<div class="plan-content">
								<p class="plan-description">{{ plan.description }}</p>

								<div class="plan-limits">
									<div class="limit-item">
										<strong>Monthly Executions:</strong>
										{{
											plan.monthlyExecutionsLimit === -1
												? 'Unlimited'
												: plan.monthlyExecutionsLimit.toLocaleString()
										}}
									</div>
									<div class="limit-item">
										<strong>Active Workflows:</strong>
										{{ plan.activeWorkflowsLimit === -1 ? 'Unlimited' : plan.activeWorkflowsLimit }}
									</div>
									<div class="limit-item">
										<strong>Users:</strong>
										{{ plan.usersLimit === -1 ? 'Unlimited' : plan.usersLimit }}
									</div>
								</div>

								<div v-if="plan.apiEndpoints" class="api-endpoints mt-m">
									<n8n-heading size="small" class="mb-s">API Endpoints</n8n-heading>
									<div class="endpoint-list">
										<div v-if="plan.apiEndpoints.trial" class="endpoint-item">
											<code>{{ plan.apiEndpoints.trial }}</code>
										</div>
										<div v-if="plan.apiEndpoints.registration" class="endpoint-item">
											<code>{{ plan.apiEndpoints.registration }}</code>
										</div>
										<div v-if="plan.apiEndpoints.generateEnterpriseOwner" class="endpoint-item">
											<code>{{ plan.apiEndpoints.generateEnterpriseOwner }}</code>
										</div>
									</div>
								</div>
							</div>
						</n8n-card>
					</div>
				</div>
			</n8n-card>
		</div>
	</div>
</template>

<style lang="scss" scoped>
.license-keys {
	.license-key-item {
		display: flex;
		gap: var(--spacing-s);
		align-items: center;

		.license-key-input {
			flex: 1;
		}
	}
}

.button-group {
	display: flex;
	gap: var(--spacing-s);
}

.validation-result {
	border-radius: var(--border-radius-base);
}

.info-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: var(--spacing-m);

	.info-item {
		padding: var(--spacing-s);
		background: var(--color-background-light);
		border-radius: var(--border-radius-base);
	}
}

.features-section {
	.features-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-s);

		.feature-item {
			display: flex;
			align-items: center;
			gap: var(--spacing-xs);
			padding: var(--spacing-xs);

			.feature-enabled {
				color: var(--color-success);
			}

			.feature-disabled {
				color: var(--color-danger);
			}
		}
	}
}

.plans-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	gap: var(--spacing-l);
}

.plan-card {
	.plan-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.plan-content {
		.plan-description {
			margin-bottom: var(--spacing-m);
			color: var(--color-text-base);
		}

		.plan-limits {
			.limit-item {
				margin-bottom: var(--spacing-xs);
				padding: var(--spacing-xs);
				background: var(--color-background-xlight);
				border-radius: var(--border-radius-small);
			}
		}

		.api-endpoints {
			.endpoint-list {
				.endpoint-item {
					margin-bottom: var(--spacing-xs);

					code {
						display: block;
						padding: var(--spacing-xs);
						background: var(--color-background-dark);
						color: var(--color-text-light);
						border-radius: var(--border-radius-small);
						font-size: var(--font-size-2xs);
						word-break: break-all;
					}
				}
			}
		}
	}
}
</style>
