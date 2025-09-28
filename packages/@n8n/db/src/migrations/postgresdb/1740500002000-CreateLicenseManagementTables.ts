import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateLicenseManagementTables1740500002000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// Create license table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				license_key varchar(500) UNIQUE NOT NULL,
				license_type varchar(50) NOT NULL,
				status varchar(50) DEFAULT 'pending',
				issued_to uuid NOT NULL,
				issued_by uuid NOT NULL,
				valid_from timestamp NOT NULL,
				valid_until timestamp NOT NULL,
				features jsonb,
				limits jsonb,
				metadata jsonb,
				approval_status varchar(50) DEFAULT 'pending',
				approved_by uuid,
				approved_at timestamp,
				rejection_reason text,
				subscription_id uuid,
				parent_license_id uuid,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create license_template table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license_template (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				name varchar(255) UNIQUE NOT NULL,
				description text,
				license_type varchar(50) NOT NULL,
				default_features jsonb,
				default_limits jsonb,
				default_validity_days integer DEFAULT 365,
				requires_approval boolean DEFAULT true,
				is_active boolean DEFAULT true,
				created_by uuid NOT NULL,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create license_approval table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license_approval (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				license_id uuid NOT NULL,
				requested_by uuid NOT NULL,
				approval_type varchar(50) NOT NULL,
				request_data jsonb,
				status varchar(50) DEFAULT 'pending',
				approved_by uuid,
				approved_at timestamp,
				rejected_by uuid,
				rejected_at timestamp,
				rejection_reason text,
				expires_at timestamp NOT NULL,
				priority varchar(50) DEFAULT 'medium',
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create license_audit_log table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license_audit_log (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				license_id uuid NOT NULL,
				action varchar(50) NOT NULL,
				performed_by uuid NOT NULL,
				previous_state jsonb,
				new_state jsonb NOT NULL,
				reason text,
				ip_address varchar(45),
				user_agent text,
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create owner_management table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}owner_management (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				owner_id uuid UNIQUE NOT NULL,
				permissions jsonb NOT NULL,
				delegated_users jsonb,
				settings jsonb NOT NULL,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create indexes for license table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_license_key ON ${tablePrefix}license(license_key);`,
		);
		await queryRunner.query(`CREATE INDEX idx_license_status ON ${tablePrefix}license(status);`);
		await queryRunner.query(
			`CREATE INDEX idx_license_type ON ${tablePrefix}license(license_type);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_validity ON ${tablePrefix}license(valid_from, valid_until);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_status ON ${tablePrefix}license(approval_status);`,
		);

		// Create indexes for license_template table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_license_template_name ON ${tablePrefix}license_template(name);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_type ON ${tablePrefix}license_template(license_type);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_active ON ${tablePrefix}license_template(is_active);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_created_by ON ${tablePrefix}license_template(created_by);`,
		);

		// Create indexes for license_approval table
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_license_id ON ${tablePrefix}license_approval(license_id);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_request_status ON ${tablePrefix}license_approval(status);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_type ON ${tablePrefix}license_approval(approval_type);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_requested_by ON ${tablePrefix}license_approval(requested_by);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_expires_at ON ${tablePrefix}license_approval(expires_at);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_priority ON ${tablePrefix}license_approval(priority);`,
		);

		// Create indexes for license_audit_log table
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_license_id ON ${tablePrefix}license_audit_log(license_id);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_action ON ${tablePrefix}license_audit_log(action);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_performed_by ON ${tablePrefix}license_audit_log(performed_by);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_createdAt ON ${tablePrefix}license_audit_log("createdAt");`,
		);

		// Create indexes for owner_management table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_owner_management_owner_id ON ${tablePrefix}owner_management(owner_id);`,
		);

		// Add foreign key constraints
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_issued_to_user
			FOREIGN KEY (issued_to) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_issued_by_user
			FOREIGN KEY (issued_by) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_approved_by_user
			FOREIGN KEY (approved_by) REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_subscription
			FOREIGN KEY (subscription_id) REFERENCES "${tablePrefix}user_subscription"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_parent
			FOREIGN KEY (parent_license_id) REFERENCES ${tablePrefix}license(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_template
			ADD CONSTRAINT fk_license_template_created_by_user
			FOREIGN KEY (created_by) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_license
			FOREIGN KEY (license_id) REFERENCES ${tablePrefix}license(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_requested_by_user
			FOREIGN KEY (requested_by) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_approved_by_user
			FOREIGN KEY (approved_by) REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_rejected_by_user
			FOREIGN KEY (rejected_by) REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_audit_log
			ADD CONSTRAINT fk_license_audit_log_license
			FOREIGN KEY (license_id) REFERENCES ${tablePrefix}license(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_audit_log
			ADD CONSTRAINT fk_license_audit_log_performed_by_user
			FOREIGN KEY (performed_by) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}owner_management
			ADD CONSTRAINT fk_owner_management_owner_user
			FOREIGN KEY (owner_id) REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		// Drop tables in reverse order to handle foreign key constraints
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}owner_management;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}license_audit_log;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}license_approval;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}license_template;`);
		await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}license;`);
	}
}
