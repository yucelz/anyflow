import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateSubscriptionTables1740500000000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// Create subscription_plan table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}subscription_plan (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				slug varchar(50) UNIQUE NOT NULL,
				name varchar(100) NOT NULL,
				description text,
				"monthlyPrice" decimal(10,2) NOT NULL,
				"yearlyPrice" decimal(10,2) NOT NULL,
				"monthlyExecutionsLimit" integer NOT NULL,
				"activeWorkflowsLimit" integer NOT NULL,
				"credentialsLimit" integer NOT NULL,
				"usersLimit" integer NOT NULL,
				"storageLimit" integer DEFAULT 0,
				features jsonb,
				"isActive" boolean DEFAULT true,
				"isPopular" boolean DEFAULT false,
				"sortOrder" integer DEFAULT 0,
				"trialDays" integer DEFAULT 14,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create user_subscription table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}user_subscription (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"userId" uuid NOT NULL,
				"planId" uuid NOT NULL,
				status varchar(20) NOT NULL,
				"billingCycle" varchar(10) NOT NULL,
				amount decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				"currentPeriodStart" timestamp NOT NULL,
				"currentPeriodEnd" timestamp NOT NULL,
				"trialStart" timestamp,
				"trialEnd" timestamp,
				"canceledAt" timestamp,
				"cancelAtPeriodEnd" boolean DEFAULT false,
				"stripeSubscriptionId" varchar(255),
				"paypalSubscriptionId" varchar(255),
				"squareSubscriptionId" varchar(255),
				"stripeCustomerId" varchar(255),
				"paypalCustomerId" varchar(255),
				"squareCustomerId" varchar(255),
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create payment_method table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}payment_method (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"userId" uuid NOT NULL,
				provider varchar(20) NOT NULL,
				type varchar(20) NOT NULL,
				last4 varchar(4),
				brand varchar(20),
				"expiryMonth" integer,
				"expiryYear" integer,
				"isDefault" boolean DEFAULT false,
				"providerPaymentMethodId" varchar(255) NOT NULL,
				"billingAddress" jsonb,
				"isActive" boolean DEFAULT true,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create invoice table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}invoice (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"invoiceNumber" varchar(50) UNIQUE NOT NULL,
				"userId" uuid NOT NULL,
				"subscriptionId" uuid,
				status varchar(20) NOT NULL,
				subtotal decimal(10,2) NOT NULL,
				tax decimal(10,2) DEFAULT 0,
				total decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				"dueDate" timestamp NOT NULL,
				"paidAt" timestamp,
				"lineItems" jsonb NOT NULL,
				"stripeInvoiceId" varchar(255),
				"paypalInvoiceId" varchar(255),
				"squareInvoiceId" varchar(255),
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create usage_tracking table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}usage_tracking (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"userId" uuid NOT NULL,
				date date NOT NULL,
				"executionsCount" integer DEFAULT 0,
				"activeWorkflowsCount" integer DEFAULT 0,
				"credentialsCount" integer DEFAULT 0,
				"usersCount" integer DEFAULT 0,
				"storageUsed" bigint DEFAULT 0,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				UNIQUE("userId", date)
			);
		`);

		// Create indexes
		await queryRunner.query(
			`CREATE INDEX idx_subscription_plan_slug ON ${tablePrefix}subscription_plan(slug);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_user_subscription_user_id ON ${tablePrefix}user_subscription("userId");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_user_subscription_status ON ${tablePrefix}user_subscription(status);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_payment_method_user_id ON ${tablePrefix}payment_method("userId");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_payment_method_is_default ON ${tablePrefix}payment_method("isDefault");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_invoice_number ON ${tablePrefix}invoice("invoiceNumber");`,
		);
		await queryRunner.query(`CREATE INDEX idx_invoice_user_id ON ${tablePrefix}invoice("userId");`);
		await queryRunner.query(`CREATE INDEX idx_invoice_status ON ${tablePrefix}invoice(status);`);
		await queryRunner.query(
			`CREATE INDEX idx_usage_tracking_user_id ON ${tablePrefix}usage_tracking("userId");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_usage_tracking_date ON ${tablePrefix}usage_tracking(date);`,
		);

		// Add foreign key constraints
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}user_subscription
			ADD CONSTRAINT fk_user_subscription_user
			FOREIGN KEY ("userId") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}user_subscription
			ADD CONSTRAINT fk_user_subscription_plan
			FOREIGN KEY ("planId") REFERENCES ${tablePrefix}subscription_plan(id) ON DELETE RESTRICT;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}payment_method
			ADD CONSTRAINT fk_payment_method_user
			FOREIGN KEY ("userId") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}invoice
			ADD CONSTRAINT fk_invoice_user
			FOREIGN KEY ("userId") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}invoice
			ADD CONSTRAINT fk_invoice_subscription
			FOREIGN KEY ("subscriptionId") REFERENCES ${tablePrefix}user_subscription(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}usage_tracking
			ADD CONSTRAINT fk_usage_tracking_user
			FOREIGN KEY ("userId") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}usage_tracking;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}invoice;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}payment_method;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}user_subscription;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}subscription_plan;`);
	}
}
