import type { LicenseProvider } from '@n8n/backend-common';
import { Logger } from '@n8n/backend-common';
import { GlobalConfig } from '@n8n/config';
import {
	LICENSE_FEATURES,
	LICENSE_QUOTAS,
	Time,
	UNLIMITED_LICENSE_QUOTA,
	type BooleanLicenseFeature,
	type NumericLicenseFeature,
} from '@n8n/constants';
import { SettingsRepository } from '@n8n/db';
import { OnLeaderStepdown, OnLeaderTakeover, OnPubSubEvent, OnShutdown } from '@n8n/decorators';
import { Container, Service } from '@n8n/di';
import type { TEntitlement, TLicenseBlock } from '@n8n_io/license-sdk';
import { LicenseManager } from '@n8n_io/license-sdk';
import { InstanceSettings } from 'n8n-core';

import config from '@/config';
import { LicenseMetricsService } from '@/metrics/license-metrics.service';

import { N8N_VERSION, SETTINGS_LICENSE_CERT_KEY } from './constants';

const LICENSE_RENEWAL_DISABLED_WARNING =
	'Automatic license renewal is disabled. The license will not renew automatically, and access to licensed features may be lost!';

export type FeatureReturnType = Partial<
	{
		planName: string;
	} & { [K in NumericLicenseFeature]: number } & { [K in BooleanLicenseFeature]: boolean }
>;

@Service()
export class License implements LicenseProvider {
	private manager: LicenseManager | undefined;

	private isShuttingDown = false;

	private localLicenseData: any = null;

	constructor(
		private readonly logger: Logger,
		private readonly instanceSettings: InstanceSettings,
		private readonly settingsRepository: SettingsRepository,
		private readonly licenseMetricsService: LicenseMetricsService,
		private readonly globalConfig: GlobalConfig,
	) {
		this.logger = this.logger.scoped('license');
	}

	async init({
		forceRecreate = false,
		isCli = false,
	}: { forceRecreate?: boolean; isCli?: boolean } = {}) {
		if (this.manager && !forceRecreate) {
			this.logger.warn('License manager already initialized or shutting down');
			return;
		}
		if (this.isShuttingDown) {
			this.logger.warn('License manager already shutting down');
			return;
		}

		// Load local license data first
		await this.loadLocalLicenseData();

		const { instanceType } = this.instanceSettings;
		const isMainInstance = instanceType === 'main';
		const server = this.globalConfig.license.serverUrl;
		const offlineMode = !isMainInstance;
		const autoRenewOffset = 72 * Time.hours.toSeconds;
		const saveCertStr = isMainInstance
			? async (value: TLicenseBlock) => await this.saveCertStr(value)
			: async () => {};
		const onFeatureChange = isMainInstance
			? async () => await this.onFeatureChange()
			: async () => {};
		const onLicenseRenewed = isMainInstance
			? async () => await this.onLicenseRenewed()
			: async () => {};
		const collectUsageMetrics = isMainInstance
			? async () => await this.licenseMetricsService.collectUsageMetrics()
			: async () => [];
		const collectPassthroughData = isMainInstance
			? async () => await this.licenseMetricsService.collectPassthroughData()
			: async () => ({});
		const onExpirySoon = !this.instanceSettings.isLeader ? () => this.onExpirySoon() : undefined;
		const expirySoonOffsetMins = !this.instanceSettings.isLeader ? 120 : undefined;

		const { isLeader } = this.instanceSettings;
		const { autoRenewalEnabled } = this.globalConfig.license;
		const eligibleToRenew = isCli || isLeader;

		const shouldRenew = eligibleToRenew && autoRenewalEnabled;

		if (eligibleToRenew && !autoRenewalEnabled) {
			this.logger.warn(LICENSE_RENEWAL_DISABLED_WARNING);
		}

		try {
			this.manager = new LicenseManager({
				server,
				tenantId: this.globalConfig.license.tenantId,
				productIdentifier: `n8n-${N8N_VERSION}`,
				autoRenewEnabled: shouldRenew,
				renewOnInit: shouldRenew,
				autoRenewOffset,
				detachFloatingOnShutdown: this.globalConfig.license.detachFloatingOnShutdown,
				offlineMode,
				logger: this.logger,
				loadCertStr: async () => await this.loadCertStr(),
				saveCertStr,
				deviceFingerprint: () => this.instanceSettings.instanceId,
				collectUsageMetrics,
				collectPassthroughData,
				onFeatureChange,
				onLicenseRenewed,
				onExpirySoon,
				expirySoonOffsetMins,
			});

			await this.manager.initialize();

			this.logger.debug('License initialized');
		} catch (error: unknown) {
			if (error instanceof Error) {
				this.logger.error('Could not initialize license manager sdk', { error });
			}
		}
	}

	async loadCertStr(): Promise<TLicenseBlock> {
		// if we have an ephemeral license, we don't want to load it from the database
		const ephemeralLicense = this.globalConfig.license.cert;
		if (ephemeralLicense) {
			return ephemeralLicense;
		}
		const databaseSettings = await this.settingsRepository.findOne({
			where: {
				key: SETTINGS_LICENSE_CERT_KEY,
			},
		});

		return databaseSettings?.value ?? '';
	}

	private async onFeatureChange() {
		void this.broadcastReloadLicenseCommand();
	}

	private async onLicenseRenewed() {
		void this.broadcastReloadLicenseCommand();
	}

	private async broadcastReloadLicenseCommand() {
		if (config.getEnv('executions.mode') === 'queue' && this.instanceSettings.isLeader) {
			const { Publisher } = await import('@/scaling/pubsub/publisher.service');
			await Container.get(Publisher).publishCommand({ command: 'reload-license' });
		}
	}

	async saveCertStr(value: TLicenseBlock): Promise<void> {
		// if we have an ephemeral license, we don't want to save it to the database
		if (this.globalConfig.license.cert) return;
		await this.settingsRepository.upsert(
			{
				key: SETTINGS_LICENSE_CERT_KEY,
				value,
				loadOnStartup: false,
			},
			['key'],
		);
	}

	async activate(activationKey: string): Promise<void> {
		// Check if this is a locally generated license key
		if (this.isLocalLicenseKey(activationKey)) {
			await this.activateLocalLicense(activationKey);
			return;
		}

		// Use SDK for external/cloud licenses
		if (!this.manager) {
			return;
		}

		await this.manager.activate(activationKey);
		this.logger.debug('License activated via SDK');
	}

	@OnPubSubEvent('reload-license')
	async reload(): Promise<void> {
		if (!this.manager) {
			return;
		}
		await this.manager.reload();
		this.logger.debug('License reloaded');
	}

	async renew() {
		if (!this.manager) {
			return;
		}

		await this.manager.renew();
		this.logger.debug('License renewed');
	}

	async clear() {
		if (!this.manager) {
			return;
		}

		await this.manager.clear();
		this.logger.info('License cleared');
	}

	@OnShutdown()
	async shutdown() {
		// Shut down License manager to unclaim any floating entitlements
		// Note: While this saves a new license cert to DB, the previous entitlements are still kept in memory so that the shutdown process can complete
		this.isShuttingDown = true;

		if (!this.manager) {
			return;
		}

		await this.manager.shutdown();
		this.logger.debug('License shut down');
	}

	/** @deprecated Use `LicenseState.isSharingLicensed` instead. */
	isSharingEnabled() {
		return this.isLicensed(LICENSE_FEATURES.SHARING);
	}

	/** @deprecated Use `LicenseState.isLogStreamingLicensed` instead. */
	isLogStreamingEnabled() {
		return this.isLicensed(LICENSE_FEATURES.LOG_STREAMING);
	}

	/** @deprecated Use `LicenseState.isLdapLicensed` instead. */
	isLdapEnabled() {
		return this.isLicensed(LICENSE_FEATURES.LDAP);
	}

	/** @deprecated Use `LicenseState.isSamlLicensed` instead. */
	isSamlEnabled() {
		return this.isLicensed(LICENSE_FEATURES.SAML);
	}

	/** @deprecated Use `LicenseState.isApiKeyScopesLicensed` instead. */
	isApiKeyScopesEnabled() {
		return this.isLicensed(LICENSE_FEATURES.API_KEY_SCOPES);
	}

	/** @deprecated Use `LicenseState.isAiAssistantLicensed` instead. */
	isAiAssistantEnabled() {
		return this.isLicensed(LICENSE_FEATURES.AI_ASSISTANT);
	}

	/** @deprecated Use `LicenseState.isAskAiLicensed` instead. */
	isAskAiEnabled() {
		return this.isLicensed(LICENSE_FEATURES.ASK_AI);
	}

	/** @deprecated Use `LicenseState.isAiCreditsLicensed` instead. */
	isAiCreditsEnabled() {
		return this.isLicensed(LICENSE_FEATURES.AI_CREDITS);
	}

	/** @deprecated Use `LicenseState.isAdvancedExecutionFiltersLicensed` instead. */
	isAdvancedExecutionFiltersEnabled() {
		return this.isLicensed(LICENSE_FEATURES.ADVANCED_EXECUTION_FILTERS);
	}

	/** @deprecated Use `LicenseState.isAdvancedPermissionsLicensed` instead. */
	isAdvancedPermissionsLicensed() {
		return this.isLicensed(LICENSE_FEATURES.ADVANCED_PERMISSIONS);
	}

	/** @deprecated Use `LicenseState.isDebugInEditorLicensed` instead. */
	isDebugInEditorLicensed() {
		return this.isLicensed(LICENSE_FEATURES.DEBUG_IN_EDITOR);
	}

	/** @deprecated Use `LicenseState.isBinaryDataS3Licensed` instead. */
	isBinaryDataS3Licensed() {
		return this.isLicensed(LICENSE_FEATURES.BINARY_DATA_S3);
	}

	/** @deprecated Use `LicenseState.isMultiMainLicensed` instead. */
	isMultiMainLicensed() {
		return this.isLicensed(LICENSE_FEATURES.MULTIPLE_MAIN_INSTANCES);
	}

	/** @deprecated Use `LicenseState.isVariablesLicensed` instead. */
	isVariablesEnabled() {
		return this.isLicensed(LICENSE_FEATURES.VARIABLES);
	}

	/** @deprecated Use `LicenseState.isSourceControlLicensed` instead. */
	isSourceControlLicensed() {
		return this.isLicensed(LICENSE_FEATURES.SOURCE_CONTROL);
	}

	/** @deprecated Use `LicenseState.isExternalSecretsLicensed` instead. */
	isExternalSecretsEnabled() {
		return this.isLicensed(LICENSE_FEATURES.EXTERNAL_SECRETS);
	}

	/** @deprecated Use `LicenseState.isWorkflowHistoryLicensed` instead. */
	isWorkflowHistoryLicensed() {
		return this.isLicensed(LICENSE_FEATURES.WORKFLOW_HISTORY);
	}

	/** @deprecated Use `LicenseState.isAPIDisabled` instead. */
	isAPIDisabled() {
		return this.isLicensed(LICENSE_FEATURES.API_DISABLED);
	}

	/** @deprecated Use `LicenseState.isWorkerViewLicensed` instead. */
	isWorkerViewLicensed() {
		return this.isLicensed(LICENSE_FEATURES.WORKER_VIEW);
	}

	/** @deprecated Use `LicenseState.isProjectRoleAdminLicensed` instead. */
	isProjectRoleAdminLicensed() {
		return this.isLicensed(LICENSE_FEATURES.PROJECT_ROLE_ADMIN);
	}

	/** @deprecated Use `LicenseState.isProjectRoleEditorLicensed` instead. */
	isProjectRoleEditorLicensed() {
		return this.isLicensed(LICENSE_FEATURES.PROJECT_ROLE_EDITOR);
	}

	/** @deprecated Use `LicenseState.isProjectRoleViewerLicensed` instead. */
	isProjectRoleViewerLicensed() {
		return this.isLicensed(LICENSE_FEATURES.PROJECT_ROLE_VIEWER);
	}

	/** @deprecated Use `LicenseState.isCustomNpmRegistryLicensed` instead. */
	isCustomNpmRegistryEnabled() {
		return this.isLicensed(LICENSE_FEATURES.COMMUNITY_NODES_CUSTOM_REGISTRY);
	}

	/** @deprecated Use `LicenseState.isFoldersLicensed` instead. */
	isFoldersEnabled() {
		return this.isLicensed(LICENSE_FEATURES.FOLDERS);
	}

	getValue<T extends keyof FeatureReturnType>(feature: T): FeatureReturnType[T] {
		return this.manager?.getFeatureValue(feature) as FeatureReturnType[T];
	}

	getManagementJwt(): string {
		if (!this.manager) {
			return '';
		}
		return this.manager.getManagementJwt();
	}

	/**
	 * Helper function to get the latest main plan for a license
	 */
	getMainPlan(): TEntitlement | undefined {
		if (!this.manager) {
			return undefined;
		}

		const entitlements = this.getCurrentEntitlements();
		if (!entitlements.length) {
			return undefined;
		}

		entitlements.sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());

		return entitlements.find(
			(entitlement) => (entitlement.productMetadata?.terms as { isMainPlan?: boolean })?.isMainPlan,
		);
	}

	getConsumerId() {
		return this.manager?.getConsumerId() ?? 'unknown';
	}

	// Helper functions for computed data

	/** @deprecated Use `LicenseState` instead. */
	getUsersLimit() {
		return this.getValue(LICENSE_QUOTAS.USERS_LIMIT) ?? UNLIMITED_LICENSE_QUOTA;
	}

	/** @deprecated Use `LicenseState` instead. */
	getTriggerLimit() {
		return this.getValue(LICENSE_QUOTAS.TRIGGER_LIMIT) ?? UNLIMITED_LICENSE_QUOTA;
	}

	/** @deprecated Use `LicenseState` instead. */
	getVariablesLimit() {
		return this.getValue(LICENSE_QUOTAS.VARIABLES_LIMIT) ?? UNLIMITED_LICENSE_QUOTA;
	}

	/** @deprecated Use `LicenseState` instead. */
	getAiCredits() {
		return this.getValue(LICENSE_QUOTAS.AI_CREDITS) ?? 0;
	}

	/** @deprecated Use `LicenseState` instead. */
	getWorkflowHistoryPruneLimit() {
		return this.getValue(LICENSE_QUOTAS.WORKFLOW_HISTORY_PRUNE_LIMIT) ?? UNLIMITED_LICENSE_QUOTA;
	}

	/** @deprecated Use `LicenseState` instead. */
	getTeamProjectLimit() {
		return this.getValue(LICENSE_QUOTAS.TEAM_PROJECT_LIMIT) ?? 0;
	}

	getInfo(): string {
		if (!this.manager) {
			return 'n/a';
		}

		return this.manager.toString();
	}

	/** @deprecated Use `LicenseState` instead. */
	isWithinUsersLimit() {
		return this.getUsersLimit() === UNLIMITED_LICENSE_QUOTA;
	}

	@OnLeaderTakeover()
	enableAutoRenewals() {
		this.manager?.enableAutoRenewals();
	}

	@OnLeaderStepdown()
	disableAutoRenewals() {
		this.manager?.disableAutoRenewals();
	}

	private onExpirySoon() {
		this.logger.info('License is about to expire soon, reloading license...');

		// reload in background to avoid blocking SDK

		void this.reload()
			.then(() => {
				this.logger.info('Reloaded license on expiry soon');
			})
			.catch((error) => {
				this.logger.error('Failed to reload license on expiry soon', {
					error: error instanceof Error ? error.message : error,
				});
			});
	}

	/**
	 * Check if a license key is locally generated
	 */
	private isLocalLicenseKey(licenseKey: string): boolean {
		if (!licenseKey || typeof licenseKey !== 'string') {
			return false;
		}

		const localPrefixes = ['ENT-', 'TRIAL-', 'COMM-'];
		return localPrefixes.some((prefix) => licenseKey.startsWith(prefix));
	}

	/**
	 * Activate a locally generated license key
	 */
	private async activateLocalLicense(activationKey: string): Promise<void> {
		try {
			this.logger.info('Activating local license key', { key: activationKey });

			// Validate local license key format
			const validation = this.validateLocalLicenseKey(activationKey);
			if (!validation.valid) {
				throw new Error(`Invalid local license key format: ${validation.error}`);
			}

			// Get local license API service
			const { LocalLicenseApiService } = await import('./license/local-license-api.service');
			const localLicenseApi = Container.get(LocalLicenseApiService);

			// Get license information
			const licenseInfo = await localLicenseApi.getLicenseInfo(activationKey);

			// Store local license data
			this.localLicenseData = {
				licenseKey: activationKey,
				type: licenseInfo.type,
				planName: licenseInfo.planName,
				features: licenseInfo.features,
				isActive: true,
				expiresAt: licenseInfo.expiresAt,
				activatedAt: new Date(),
			};

			// Save to database for persistence
			await this.saveLocalLicenseData(this.localLicenseData);

			this.logger.info('Local license activated successfully', {
				key: activationKey,
				type: licenseInfo.type,
				planName: licenseInfo.planName,
			});
		} catch (error) {
			this.logger.error('Failed to activate local license', {
				error: error instanceof Error ? error.message : error,
				key: activationKey,
			});
			throw error;
		}
	}

	/**
	 * Validate local license key format
	 */
	private validateLocalLicenseKey(licenseKey: string): {
		valid: boolean;
		type?: string;
		error?: string;
	} {
		if (!licenseKey || typeof licenseKey !== 'string') {
			return { valid: false, error: 'License key is required and must be a string' };
		}

		const parts = licenseKey.split('-');
		if (parts.length < 3) {
			return { valid: false, error: 'License key must have at least 3 parts separated by dashes' };
		}

		const prefix = parts[0];
		switch (prefix) {
			case 'ENT':
				return { valid: parts.length >= 4, type: 'enterprise' };
			case 'TRIAL':
				return { valid: parts.length === 3, type: 'trial' };
			case 'COMM':
				return { valid: parts.length === 3, type: 'community' };
			default:
				return { valid: false, error: `Unknown license key prefix: ${prefix}` };
		}
	}

	/**
	 * Save local license data to database
	 */
	private async saveLocalLicenseData(licenseData: any): Promise<void> {
		try {
			await this.settingsRepository.upsert(
				{
					key: 'local_license_data',
					value: JSON.stringify(licenseData),
					loadOnStartup: true,
				},
				['key'],
			);
		} catch (error) {
			this.logger.warn('Failed to save local license data to database', { error });
		}
	}

	/**
	 * Load local license data from database
	 */
	private async loadLocalLicenseData(): Promise<void> {
		try {
			const setting = await this.settingsRepository.findOne({
				where: { key: 'local_license_data' },
			});

			if (setting?.value) {
				this.localLicenseData = JSON.parse(setting.value);
				this.logger.debug('Loaded local license data from database');
			}
		} catch (error) {
			this.logger.warn('Failed to load local license data from database', { error });
		}
	}

	/**
	 * Override feature checks to include local license features
	 */
	isLicensed(feature: BooleanLicenseFeature): boolean {
		// Check local license first
		if (this.localLicenseData?.features?.[feature]) {
			return true;
		}

		// Fall back to SDK license
		return this.manager?.hasFeatureEnabled(feature) ?? false;
	}

	/**
	 * Override plan name to include local license
	 */
	getPlanName(): string {
		if (this.localLicenseData?.planName) {
			return this.localLicenseData.planName;
		}

		return this.getValue('planName') ?? 'Community';
	}

	/**
	 * Override getCurrentEntitlements to include local license
	 */
	getCurrentEntitlements(): TEntitlement[] {
		const sdkEntitlements = this.manager?.getCurrentEntitlements() ?? [];

		// Add local license as entitlement if available
		if (this.localLicenseData?.isActive) {
			const localEntitlement = {
				id: this.localLicenseData.licenseKey || 'local-license',
				productId: this.localLicenseData.type,
				productMetadata: {
					terms: { isMainPlan: true },
				},
				validFrom: new Date(this.localLicenseData.activatedAt),
				validTo: this.localLicenseData.expiresAt
					? new Date(this.localLicenseData.expiresAt)
					: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				validUntil: this.localLicenseData.expiresAt
					? new Date(this.localLicenseData.expiresAt)
					: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
				features: this.localLicenseData.features,
				featureOverrides: {},
				isFloatable: false,
			} as TEntitlement;

			return [localEntitlement, ...sdkEntitlements];
		}

		return sdkEntitlements;
	}
}
