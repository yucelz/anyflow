import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class SeedSubscriptionPlans1740500001000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// Insert default subscription plans
		await queryRunner.query(`
			INSERT INTO ${tablePrefix}subscription_plan (
				slug, name, description, "monthlyPrice", "yearlyPrice",
				"monthlyExecutionsLimit", "activeWorkflowsLimit", "credentialsLimit", "usersLimit",
				"storageLimit", features, "isActive", "isPopular", "sortOrder", "trialDays"
			) VALUES
			(
				'free',
				'Free',
				'Perfect for getting started with n8n',
				0.00, 0.00,
				5000, 5, 10, 1, 1,
				'{"advancedNodes": false, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": false, "webhooks": true, "customDomains": false, "advancedSecurity": false, "workersView": false, "logStreaming": false, "externalSecrets": false, "sourceControl": false, "variables": false, "ldapAuth": false, "advancedInsights": false}',
				true, false, 1, 0
			),
			(
				'starter',
				'Starter',
				'Great for small teams and growing businesses',
				20.00, 200.00,
				50000, 25, 50, 3, 10,
				'{"advancedNodes": true, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": true, "webhooks": true, "customDomains": false, "advancedSecurity": false, "workersView": false, "logStreaming": false, "externalSecrets": false, "sourceControl": false, "variables": true, "ldapAuth": false, "advancedInsights": false}',
				true, false, 2, 14
			),
			(
				'pro',
				'Pro',
				'Perfect for growing teams with advanced needs',
				50.00, 500.00,
				200000, 100, 200, 10, 50,
				'{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true, "workersView": false, "logStreaming": false, "externalSecrets": false, "sourceControl": false, "variables": true, "ldapAuth": false, "advancedInsights": true}',
				true, true, 3, 14
			),
			(
				'enterprise',
				'Enterprise',
				'For large organizations with custom requirements',
				200.00, 2000.00,
				-1, -1, -1, -1, -1,
				'{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true, "workersView": true, "logStreaming": true, "externalSecrets": true, "sourceControl": true, "variables": true, "ldapAuth": true, "advancedInsights": true}',
				true, false, 4, 14
			);
		`);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(
			`DELETE FROM ${tablePrefix}subscription_plan WHERE slug IN ('free', 'starter', 'pro', 'enterprise');`,
		);
	}
}
