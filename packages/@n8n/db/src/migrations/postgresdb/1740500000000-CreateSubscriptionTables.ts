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
				monthly_price decimal(10,2) NOT NULL,
				yearly_price decimal(10,2) NOT NULL,
				monthly_executions_limit integer NOT NULL,
				active_workflows_limit integer NOT NULL,
				credentials_limit integer NOT NULL,
				users_limit integer NOT NULL,
				storage_limit integer DEFAULT 0,
				features jsonb,
				is_active boolean DEFAULT true,
				is_popular boolean DEFAULT false,
				sort_order integer DEFAULT 0,
				trial_days integer DEFAULT 14,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			);
		`);

		// Create user_subscription table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}user_subscription (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id uuid NOT NULL,
				plan_id uuid NOT NULL,
				status varchar(20) NOT NULL,
				billing_cycle varchar(10) NOT NULL,
				amount decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				current_period_start timestamp NOT NULL,
				current_period_end timestamp NOT NULL,
				trial_start timestamp,
				trial_end timestamp,
				canceled_at timestamp,
				cancel_at_period_end boolean DEFAULT false,
				stripe_subscription_id varchar(255),
				paypal_subscription_id varchar(255),
				square_subscription_id varchar(255),
				stripe_customer_id varchar(255),
				paypal_customer_id varchar(255),
				square_customer_id varchar(255),
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			);
		`);

		// Create payment_method table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}payment_method (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id uuid NOT NULL,
				provider varchar(20) NOT NULL,
				type varchar(20) NOT NULL,
				last4 varchar(4),
				brand varchar(20),
				expiry_month integer,
				expiry_year integer,
				is_default boolean DEFAULT false,
				provider_payment_method_id varchar(255) NOT NULL,
				billing_address jsonb,
				is_active boolean DEFAULT true,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			);
		`);

		// Create invoice table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}invoice (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				invoice_number varchar(50) UNIQUE NOT NULL,
				user_id uuid NOT NULL,
				subscription_id uuid,
				status varchar(20) NOT NULL,
				subtotal decimal(10,2) NOT NULL,
				tax decimal(10,2) DEFAULT 0,
				total decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				due_date timestamp NOT NULL,
				paid_at timestamp,
				line_items jsonb NOT NULL,
				stripe_invoice_id varchar(255),
				paypal_invoice_id varchar(255),
				square_invoice_id varchar(255),
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
			);
		`);

		// Create usage_tracking table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}usage_tracking (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				user_id uuid NOT NULL,
				date date NOT NULL,
				executions_count integer DEFAULT 0,
				active_workflows_count integer DEFAULT 0,
				credentials_count integer DEFAULT 0,
				users_count integer DEFAULT 0,
				storage_used bigint DEFAULT 0,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				UNIQUE(user_id, date)
			);
		`);

		// Create indexes
		await queryRunner.query(
			`CREATE INDEX idx_subscription_plan_slug ON ${tablePrefix}subscription_plan(slug);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_user_subscription_user_id ON ${tablePrefix}user_subscription(user_id);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_user_subscription_status ON ${tablePrefix}user_subscription(status);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_payment_method_user_id ON ${tablePrefix}payment_method(user_id);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_payment_method_is_default ON ${tablePrefix}payment_method(is_default);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_invoice_number ON ${tablePrefix}invoice(invoice_number);`,
		);
		await queryRunner.query(`CREATE INDEX idx_invoice_user_id ON ${tablePrefix}invoice(user_id);`);
		await queryRunner.query(`CREATE INDEX idx_invoice_status ON ${tablePrefix}invoice(status);`);
		await queryRunner.query(
			`CREATE INDEX idx_usage_tracking_user_id ON ${tablePrefix}usage_tracking(user_id);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_usage_tracking_date ON ${tablePrefix}usage_tracking(date);`,
		);

		// Add foreign key constraints
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}user_subscription
			ADD CONSTRAINT fk_user_subscription_user
			FOREIGN KEY (user_id) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}user_subscription
			ADD CONSTRAINT fk_user_subscription_plan
			FOREIGN KEY (plan_id) REFERENCES ${tablePrefix}subscription_plan(id) ON DELETE RESTRICT;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}payment_method
			ADD CONSTRAINT fk_payment_method_user
			FOREIGN KEY (user_id) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}invoice
			ADD CONSTRAINT fk_invoice_user
			FOREIGN KEY (user_id) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}invoice
			ADD CONSTRAINT fk_invoice_subscription
			FOREIGN KEY (subscription_id) REFERENCES ${tablePrefix}user_subscription(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}usage_tracking
			ADD CONSTRAINT fk_usage_tracking_user
			FOREIGN KEY (user_id) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
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
