import { Get, Post, RestController } from '@n8n/decorators';
import { InternalServerError } from '@/errors/response-errors/internal-server.error';
import { GlobalConfig } from '@n8n/config';
import { randomBytes } from 'crypto';

interface CloudPlanData {
	planId: number;
	monthlyExecutionsLimit: number;
	activeWorkflowsLimit: number;
	credentialsLimit: number;
	isActive: boolean;
	displayName: string;
	expirationDate: string;
	metadata: {
		version: 'v1';
		group: 'opt-out' | 'opt-in' | 'trial';
		slug: 'pro-1' | 'pro-2' | 'starter' | 'trial-1';
		trial?: {
			length: number;
			gracePeriod: number;
		};
	};
}

interface InstanceUsage {
	timeframe?: string;
	executions: number;
	activeWorkflows: number;
}

interface CloudUserAccount {
	confirmed: boolean;
	username: string;
	email: string;
	hasEarlyAccess?: boolean;
	role?: string;
	selectedApps?: string[];
	information?: {
		[key: string]: string | string[];
	};
}

@RestController()
export class CloudController {
	constructor(private readonly globalConfig: GlobalConfig) {}

	@Get('/admin/cloud-plan')
	async getCurrentPlan(): Promise<CloudPlanData> {
		// Return mock plan data - this would typically fetch from cloud service
		return {
			planId: 1,
			monthlyExecutionsLimit: 5000,
			activeWorkflowsLimit: 20,
			credentialsLimit: 100,
			isActive: true,
			displayName: 'Starter Plan',
			expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
			metadata: {
				version: 'v1',
				group: 'opt-in',
				slug: 'starter',
			},
		};
	}

	@Get('/cloud/limits')
	async getCurrentUsage(): Promise<InstanceUsage> {
		// Return mock data for now - this would typically fetch from cloud service
		return {
			timeframe: 'current',
			executions: 0,
			activeWorkflows: 0,
		};
	}

	@Get('/cloud/proxy/user/me')
	async getCloudUserInfo(): Promise<CloudUserAccount> {
		// Return mock user data - this would typically proxy to cloud service
		return {
			confirmed: true,
			username: 'user',
			email: 'user@example.com',
			hasEarlyAccess: false,
			role: 'user',
		};
	}

	@Post('/cloud/proxy/user/resend-confirmation-email')
	async sendConfirmationEmail(): Promise<CloudUserAccount> {
		// Mock implementation - this would typically send email via cloud service
		return {
			confirmed: false,
			username: 'user',
			email: 'user@example.com',
			hasEarlyAccess: false,
			role: 'user',
		};
	}

	@Get('/cloud/proxy/login/code')
	async getAdminPanelLoginCode(): Promise<{ code: string }> {
		try {
			// Generate a secure random code for admin panel login
			const code = randomBytes(16).toString('hex');

			// In a real implementation, this code would be:
			// 1. Stored temporarily (e.g., in Redis with expiration)
			// 2. Associated with the current user session
			// 3. Used for authentication with the cloud admin panel

			return { code };
		} catch (error) {
			throw new InternalServerError('Failed to generate login code');
		}
	}
}
