import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class SeedSubscriptionPlans1740500001000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`
			INSERT INTO ${tablePrefix}subscription_plan (
				slug, name, description, monthly_price, yearly_price,
				monthly_executions_limit, active_workflows_limit, credentials_limit, users_limit,
				storage_limit, features, is_active, is_popular, sort_order, trial_days
			) VALUES
			('free', 'Free', 'Perfect for getting started with workflow automation', 0.00, 0.00, 5000, 5, 10, 1, 1, '{"advancedNodes": false, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": false, "webhooks": true, "customDomains": false, "advancedSecurity": false, "workersView": false, "logStreaming": false, "externalSecrets": false, "sourceControl": false, "variables": false, "ldapAuth": false, "advancedInsights": false}', 1, 0, 1, 0),
			('starter', 'Starter', 'Great for small teams and growing businesses', 20.00, 200.00, 20000, 20, 50, 3, 5, '{"advancedNodes": true, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": true, "webhooks": true, "customDomains": false, "advancedSecurity": false, "workersView": false, "logStreaming": false, "externalSecrets": false, "sourceControl": false, "variables": true, "ldapAuth": false, "advancedInsights": false}', 1, 1, 2, 14),
			('pro', 'Pro', 'Advanced features for professional teams', 50.00, 500.00, 100000, 100, 200, 10, 20, '{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true, "workersView": true, "logStreaming": true, "externalSecrets": true, "sourceControl": true, "variables": true, "ldapAuth": true, "advancedInsights": true}', 1, 0, 3, 14),
			('enterprise', 'Enterprise', 'Full-featured solution for large organizations', 200.00, 2000.00, 1000000, 1000, 1000, 100, 100, '{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true, "workersView": true, "logStreaming": true, "externalSecrets": true, "sourceControl": true, "variables": true, "ldapAuth": true, "advancedInsights": true}', 1, 0, 4, 14);
		`);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(
			`DELETE FROM ${tablePrefix}subscription_plan WHERE slug IN ('free', 'starter', 'pro', 'enterprise');`,
		);
	}
}
