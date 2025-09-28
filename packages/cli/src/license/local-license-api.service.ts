import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionPlanRepository, UserSubscriptionRepository } from '@n8n/db';
import type { User } from '@n8n/db';
import { EventService } from '@/events/event.service';
import { UrlService } from '@/services/url.service';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import { randomBytes } from 'crypto';

interface EnterpriseTrialRequest {
	licenseType: 'enterprise';
	firstName: string;
	lastName: string;
	email: string;
	instanceUrl: string;
}

interface CommunityRegistrationRequest {
	email: string;
	instanceId: string;
	instanceUrl: string;
	licenseType: string;
}

export interface CommunityRegistrationResponse {
	title: string;
	text: string;
	licenseKey: string;
}

@Service()
export class LocalLicenseApiService {
	constructor(
		private readonly logger: Logger,
		private readonly subscriptionPlanRepository: SubscriptionPlanRepository,
		private readonly userSubscriptionRepository: UserSubscriptionRepository,
		private readonly eventService: EventService,
		private readonly urlService: UrlService,
	) {}

	/**
	 * Local implementation of enterprise trial request
	 * Replaces: https://enterprise.n8n.io/enterprise-trial
	 */
	async requestEnterpriseTrial(request: EnterpriseTrialRequest): Promise<void> {
		this.logger.info('Processing enterprise trial request', {
			email: request.email,
			instanceUrl: request.instanceUrl,
		});

		try {
			// Find or create enterprise trial plan
			let enterprisePlan =
				await this.subscriptionPlanRepository.findActiveBySlug('enterprise-trial');

			if (!enterprisePlan) {
				// Create a default enterprise trial plan if it doesn't exist
				enterprisePlan = this.subscriptionPlanRepository.create({
					slug: 'enterprise-trial',
					name: 'Enterprise Trial',
					description: '30-day enterprise trial with full features',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: 100000,
					activeWorkflowsLimit: 1000,
					credentialsLimit: 1000,
					usersLimit: 50,
					storageLimit: 100,
					trialDays: 30,
					isActive: true,
					isPopular: false,
					sortOrder: 0,
					features: {
						advancedNodes: true,
						prioritySupport: true,
						sso: true,
						auditLogs: true,
						customBranding: true,
						apiAccess: true,
						webhooks: true,
						customDomains: true,
						advancedSecurity: true,
						workersView: true,
						logStreaming: true,
						externalSecrets: true,
						sourceControl: true,
						variables: true,
						ldapAuth: true,
						advancedInsights: true,
					},
				});

				await this.subscriptionPlanRepository.save(enterprisePlan);
				this.logger.info('Created enterprise trial plan');
			}

			// Generate a trial license key
			const trialLicenseKey = this.generateTrialLicenseKey();

			// Log trial request for audit purposes
			this.logger.info('Enterprise trial license generated', {
				email: request.email,
				firstName: request.firstName,
				lastName: request.lastName,
				instanceUrl: request.instanceUrl,
				licenseKey: trialLicenseKey,
				planId: enterprisePlan.id,
			});

			this.logger.info('Enterprise trial request processed successfully', {
				email: request.email,
				licenseKey: trialLicenseKey,
			});
		} catch (error) {
			this.logger.error('Failed to process enterprise trial request', { error });
			throw new BadRequestError('Failed to process enterprise trial request');
		}
	}

	/**
	 * Local implementation of community edition registration
	 * Replaces: https://enterprise.n8n.io/community-registered
	 */
	async registerCommunityEdition(
		request: CommunityRegistrationRequest,
	): Promise<CommunityRegistrationResponse> {
		this.logger.info('Processing community edition registration', {
			email: request.email,
			instanceId: request.instanceId,
		});

		try {
			// Find or create community plan
			let communityPlan = await this.subscriptionPlanRepository.findActiveBySlug('community');

			if (!communityPlan) {
				// Create a default community plan if it doesn't exist
				communityPlan = this.subscriptionPlanRepository.create({
					slug: 'community',
					name: 'Community',
					description: 'Free community edition with basic features',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: 5000,
					activeWorkflowsLimit: 5,
					credentialsLimit: 5,
					usersLimit: 1,
					storageLimit: 1,
					trialDays: 0,
					isActive: true,
					isPopular: false,
					sortOrder: 1,
					features: {
						advancedNodes: false,
						prioritySupport: false,
						sso: false,
						auditLogs: false,
						customBranding: false,
						apiAccess: true,
						webhooks: true,
						customDomains: false,
						advancedSecurity: false,
						workersView: false,
						logStreaming: false,
						externalSecrets: false,
						sourceControl: false,
						variables: false,
						ldapAuth: false,
						advancedInsights: false,
					},
				});

				await this.subscriptionPlanRepository.save(communityPlan);
				this.logger.info('Created community plan');
			}

			// Generate a community license key
			const licenseKey = this.generateCommunityLicenseKey(request.instanceId);

			// Log community registration for audit purposes
			this.logger.info('Community license generated', {
				email: request.email,
				instanceId: request.instanceId,
				instanceUrl: request.instanceUrl,
				licenseKey,
				planId: communityPlan.id,
			});

			const response: CommunityRegistrationResponse = {
				title: 'Welcome to n8n Community!',
				text: 'Thank you for registering your n8n community instance. Your license has been activated.',
				licenseKey,
			};

			this.logger.info('Community edition registration processed successfully', {
				email: request.email,
				instanceId: request.instanceId,
				licenseKey,
			});

			return response;
		} catch (error) {
			this.logger.error('Failed to process community edition registration', { error });
			throw new BadRequestError('Failed to register community edition');
		}
	}

	/**
	 * Get available license plans with their API endpoints
	 */
	async getAvailablePlansWithEndpoints() {
		const plans = await this.subscriptionPlanRepository.findAllActive();
		const baseUrl = this.urlService.getInstanceBaseUrl();

		return plans.map((plan) => ({
			...plan,
			apiEndpoints: {
				trial: plan.slug.includes('enterprise')
					? `${baseUrl}/api/v1/license/enterprise-trial`
					: null,
				registration: `${baseUrl}/api/v1/license/community-registered`,
				activation: `${baseUrl}/api/v1/license/activate`,
				renewal: `${baseUrl}/api/v1/license/renew`,
				generateEnterpriseOwner: `${baseUrl}/api/v1/license/generate-enterprise-owner`,
			},
			urls: {
				upgrade: `${baseUrl}/subscription/upgrade`,
				support: `${baseUrl}/support`,
				documentation: `${baseUrl}/docs`,
			},
		}));
	}

	/**
	 * Generate a trial license key for enterprise trials
	 */
	private generateTrialLicenseKey(): string {
		const prefix = 'TRIAL';
		const timestamp = Date.now().toString(36).toUpperCase();
		const random = randomBytes(8).toString('hex').toUpperCase();
		return `${prefix}-${timestamp}-${random}`;
	}

	/**
	 * Generate a community license key
	 */
	private generateCommunityLicenseKey(instanceId: string): string {
		const prefix = 'COMM';
		const instanceHash = Buffer.from(instanceId).toString('base64').slice(0, 8).toUpperCase();
		const random = randomBytes(6).toString('hex').toUpperCase();
		return `${prefix}-${instanceHash}-${random}`;
	}

	/**
	 * Generate an automatic enterprise license key for global:owner
	 */
	async generateEnterpriseOwnerLicense(): Promise<string> {
		this.logger.info('Generating automatic enterprise license for global:owner');

		try {
			// Find or create enterprise plan
			let enterprisePlan = await this.subscriptionPlanRepository.findActiveBySlug('enterprise');

			if (!enterprisePlan) {
				// Create a default enterprise plan if it doesn't exist
				enterprisePlan = this.subscriptionPlanRepository.create({
					slug: 'enterprise',
					name: 'Enterprise',
					description: 'Full enterprise features with unlimited access',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: -1, // Unlimited
					activeWorkflowsLimit: -1, // Unlimited
					credentialsLimit: -1, // Unlimited
					usersLimit: -1, // Unlimited
					storageLimit: -1, // Unlimited
					trialDays: 0,
					isActive: true,
					isPopular: true,
					sortOrder: 0,
					features: {
						advancedNodes: true,
						prioritySupport: true,
						sso: true,
						auditLogs: true,
						customBranding: true,
						apiAccess: true,
						webhooks: true,
						customDomains: true,
						advancedSecurity: true,
						workersView: true,
						logStreaming: true,
						externalSecrets: true,
						sourceControl: true,
						variables: true,
						ldapAuth: true,
						advancedInsights: true,
					},
				});

				await this.subscriptionPlanRepository.save(enterprisePlan);
				this.logger.info('Created enterprise plan for global:owner');
			}

			// Generate enterprise license key for global:owner
			const enterpriseLicenseKey = this.generateEnterpriseLicenseKey();

			// Log enterprise license generation for audit purposes
			this.logger.info('Enterprise license generated for global:owner', {
				owner: 'global:owner',
				licenseKey: enterpriseLicenseKey,
				planId: enterprisePlan.id,
				features: enterprisePlan.features,
			});

			return enterpriseLicenseKey;
		} catch (error) {
			this.logger.error('Failed to generate enterprise license for global:owner', { error });
			throw new BadRequestError('Failed to generate enterprise license for global:owner');
		}
	}

	/**
	 * Enhanced version with better error handling and debugging
	 */
	async generateEnterpriseOwnerLicenseEnhanced(user: User): Promise<string> {
		this.logger.info('Generating enhanced enterprise license for global:owner', {
			userId: user.id,
			email: user.email,
		});

		try {
			// First, let's check if we can connect to the database
			console.log('Checking database connection...');
			const allPlans = await this.subscriptionPlanRepository.findAllActive();
			console.log(`Found ${allPlans.length} active plans in database`);

			// Log existing plans for debugging
			allPlans.forEach((plan) => {
				console.log(`Plan: ${plan.slug} - ${plan.name} (Active: ${plan.isActive})`);
			});

			// Find or create enterprise plan with enhanced error handling
			let enterprisePlan = await this.subscriptionPlanRepository.findActiveBySlug('enterprise');
			console.log('Enterprise plan lookup result:', enterprisePlan ? 'Found' : 'Not found');

			if (!enterprisePlan) {
				console.log('Creating new enterprise plan...');

				// Create a default enterprise plan if it doesn't exist
				const newPlan = {
					slug: 'enterprise',
					name: 'Enterprise',
					description: 'Full enterprise features with unlimited access',
					monthlyPrice: 0,
					yearlyPrice: 0,
					monthlyExecutionsLimit: -1, // Unlimited
					activeWorkflowsLimit: -1, // Unlimited
					credentialsLimit: -1, // Unlimited
					usersLimit: -1, // Unlimited
					storageLimit: -1, // Unlimited
					trialDays: 0,
					isActive: true,
					isPopular: true,
					sortOrder: 0,
					features: {
						advancedNodes: true,
						prioritySupport: true,
						sso: true,
						auditLogs: true,
						customBranding: true,
						apiAccess: true,
						webhooks: true,
						customDomains: true,
						advancedSecurity: true,
						workersView: true,
						logStreaming: true,
						externalSecrets: true,
						sourceControl: true,
						variables: true,
						ldapAuth: true,
						advancedInsights: true,
					},
				};

				console.log('Plan data to create:', JSON.stringify(newPlan, null, 2));

				try {
					enterprisePlan = this.subscriptionPlanRepository.create(newPlan);
					console.log('Plan entity created, attempting to save...');

					await this.subscriptionPlanRepository.save(enterprisePlan);
					console.log('Enterprise plan saved successfully with ID:', enterprisePlan.id);

					this.logger.info('Created enterprise plan for global:owner', {
						planId: enterprisePlan.id,
						slug: enterprisePlan.slug,
					});
				} catch (saveError) {
					console.error('Failed to save enterprise plan:', saveError);
					this.logger.error('Failed to save enterprise plan', { error: saveError });

					// Try to provide more specific error information
					if (saveError instanceof Error) {
						throw new BadRequestError(`Failed to create enterprise plan: ${saveError.message}`);
					} else {
						throw new BadRequestError('Failed to create enterprise plan: Unknown database error');
					}
				}
			} else {
				console.log('Using existing enterprise plan:', {
					id: enterprisePlan.id,
					slug: enterprisePlan.slug,
					name: enterprisePlan.name,
				});
			}

			// Generate enterprise license key for global:owner
			console.log('Generating license key...');
			const enterpriseLicenseKey = this.generateEnterpriseLicenseKey();
			console.log('License key generated:', enterpriseLicenseKey);

			// Log enterprise license generation for audit purposes
			this.logger.info('Enhanced enterprise license generated for global:owner', {
				userId: user.id,
				email: user.email,
				owner: 'global:owner',
				licenseKey: enterpriseLicenseKey,
				planId: enterprisePlan.id,
				features: enterprisePlan.features,
			});

			return enterpriseLicenseKey;
		} catch (error) {
			console.error('Enhanced license generation failed:', error);
			this.logger.error('Failed to generate enhanced enterprise license for global:owner', {
				error,
				userId: user.id,
				email: user.email,
			});

			// Provide detailed error information
			if (error instanceof BadRequestError) {
				throw error; // Re-throw BadRequestError as-is
			} else if (error instanceof Error) {
				throw new BadRequestError(`Enhanced license generation failed: ${error.message}`);
			} else {
				throw new BadRequestError('Enhanced license generation failed: Unknown error');
			}
		}
	}

	/**
	 * Generate an enterprise license key
	 */
	private generateEnterpriseLicenseKey(): string {
		const prefix = 'ENT';
		const timestamp = Date.now().toString(36).toUpperCase();
		const random = randomBytes(12).toString('hex').toUpperCase();
		const ownerHash = Buffer.from('global:owner').toString('base64').slice(0, 8).toUpperCase();
		return `${prefix}-${ownerHash}-${timestamp}-${random}`;
	}

	/**
	 * Validate a license key format
	 */
	validateLicenseKey(licenseKey: string): {
		valid: boolean;
		type: 'trial' | 'community' | 'enterprise' | 'unknown';
	} {
		if (!licenseKey || typeof licenseKey !== 'string') {
			return { valid: false, type: 'unknown' };
		}

		const parts = licenseKey.split('-');
		if (parts.length < 3) {
			return { valid: false, type: 'unknown' };
		}

		const prefix = parts[0];
		switch (prefix) {
			case 'TRIAL':
				return { valid: parts.length === 3, type: 'trial' };
			case 'COMM':
				return { valid: parts.length === 3, type: 'community' };
			case 'ENT':
				return { valid: parts.length >= 3, type: 'enterprise' };
			default:
				return { valid: false, type: 'unknown' };
		}
	}

	/**
	 * Get license information from a license key
	 */
	async getLicenseInfo(licenseKey: string) {
		const validation = this.validateLicenseKey(licenseKey);

		if (!validation.valid) {
			throw new BadRequestError('Invalid license key format');
		}

		// For local implementation, we'll return basic info based on the key type
		const baseInfo = {
			licenseKey,
			type: validation.type,
			isValid: true,
			isActive: true,
		};

		switch (validation.type) {
			case 'trial':
				return {
					...baseInfo,
					planName: 'Enterprise Trial',
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
					features: await this.getEnterpriseFeatures(),
				};
			case 'community':
				return {
					...baseInfo,
					planName: 'Community',
					expiresAt: null, // Community licenses don't expire
					features: await this.getCommunityFeatures(),
				};
			case 'enterprise':
				return {
					...baseInfo,
					planName: 'Enterprise',
					expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
					features: await this.getEnterpriseFeatures(),
				};
			default:
				throw new BadRequestError('Unknown license type');
		}
	}

	private async getEnterpriseFeatures() {
		const enterprisePlan =
			(await this.subscriptionPlanRepository.findActiveBySlug('enterprise-trial')) ||
			(await this.subscriptionPlanRepository.findActiveBySlug('enterprise'));

		return (
			enterprisePlan?.features || {
				advancedNodes: true,
				prioritySupport: true,
				sso: true,
				auditLogs: true,
				customBranding: true,
				apiAccess: true,
				webhooks: true,
				customDomains: true,
				advancedSecurity: true,
				workersView: true,
				logStreaming: true,
				externalSecrets: true,
				sourceControl: true,
				variables: true,
				ldapAuth: true,
				advancedInsights: true,
			}
		);
	}

	private async getCommunityFeatures() {
		const communityPlan = await this.subscriptionPlanRepository.findActiveBySlug('community');

		return (
			communityPlan?.features || {
				advancedNodes: false,
				prioritySupport: false,
				sso: false,
				auditLogs: false,
				customBranding: false,
				apiAccess: true,
				webhooks: true,
				customDomains: false,
				advancedSecurity: false,
				workersView: false,
				logStreaming: false,
				externalSecrets: false,
				sourceControl: false,
				variables: false,
				ldapAuth: false,
				advancedInsights: false,
			}
		);
	}
}
