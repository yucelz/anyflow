import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateSubscriptionTables1740500000000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// Create subscription_plan table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}subscription_plan (
				id varchar PRIMARY KEY,
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
				features text,
				is_active boolean DEFAULT 1,
				is_popular boolean DEFAULT 0,
				sort_order integer DEFAULT 0,
				trial_days integer DEFAULT 14,
				created_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				updated_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW'))
			);
		`);

		// Create user_subscription table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}user_subscription (
				id varchar PRIMARY KEY,
				user_id varchar NOT NULL,
				plan_id varchar NOT NULL,
				status varchar(20) NOT NULL,
				billing_cycle varchar(10) NOT NULL,
				amount decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				current_period_start datetime NOT NULL,
				current_period_end datetime NOT NULL,
				trial_start datetime,
				trial_end datetime,
				canceled_at datetime,
				cancel_at_period_end boolean DEFAULT 0,
				stripe_subscription_id varchar(255),
				paypal_subscription_id varchar(255),
				square_subscription_id varchar(255),
				stripe_customer_id varchar(255),
				paypal_customer_id varchar(255),
				square_customer_id varchar(255),
				metadata text,
				created_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				updated_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				FOREIGN KEY (user_id) REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
				FOREIGN KEY (plan_id) REFERENCES ${tablePrefix}subscription_plan(id)
			);
		`);

		// Create payment_method table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}payment_method (
				id varchar PRIMARY KEY,
				user_id varchar NOT NULL,
				provider varchar(20) NOT NULL,
				type varchar(20) NOT NULL,
				last4 varchar(4),
				brand varchar(20),
				expiry_month integer,
				expiry_year integer,
				is_default boolean DEFAULT 0,
				provider_payment_method_id varchar(255) NOT NULL,
				billing_address text,
				is_active boolean DEFAULT 1,
				created_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				updated_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				FOREIGN KEY (user_id) REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE
			);
		`);

		// Create invoice table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}invoice (
				id varchar PRIMARY KEY,
				invoice_number varchar(50) UNIQUE NOT NULL,
				user_id varchar NOT NULL,
				subscription_id varchar,
				status varchar(20) NOT NULL,
				subtotal decimal(10,2) NOT NULL,
				tax decimal(10,2) DEFAULT 0,
				total decimal(10,2) NOT NULL,
				currency varchar(3) NOT NULL,
				due_date datetime NOT NULL,
				paid_at datetime,
				line_items text NOT NULL,
				stripe_invoice_id varchar(255),
				paypal_invoice_id varchar(255),
				square_invoice_id varchar(255),
				metadata text,
				created_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				updated_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				FOREIGN KEY (user_id) REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
				FOREIGN KEY (subscription_id) REFERENCES ${tablePrefix}user_subscription(id)
			);
		`);

		// Create usage_tracking table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}usage_tracking (
				id varchar PRIMARY KEY,
				user_id varchar NOT NULL,
				date date NOT NULL,
				executions_count integer DEFAULT 0,
				active_workflows_count integer DEFAULT 0,
				credentials_count integer DEFAULT 0,
				users_count integer DEFAULT 0,
				storage_used integer DEFAULT 0,
				created_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				updated_at datetime DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%f', 'NOW')),
				UNIQUE(user_id, date),
				FOREIGN KEY (user_id) REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE
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
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}usage_tracking;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}invoice;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}payment_method;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}user_subscription;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}subscription_plan;`);
	}
}
