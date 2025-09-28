import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateLicenseManagementTables1740500002000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// Create license table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"licenseKey" varchar(500) UNIQUE NOT NULL,
				"licenseType" varchar(50) NOT NULL,
				status varchar(50) DEFAULT 'pending',
				"issuedTo" uuid NOT NULL,
				"issuedBy" uuid NOT NULL,
				"validFrom" timestamp NOT NULL,
				"validUntil" timestamp NOT NULL,
				features jsonb,
				limits jsonb,
				metadata jsonb,
				"approvalStatus" varchar(50) DEFAULT 'pending',
				"approvedBy" uuid,
				"approvedAt" timestamp,
				"rejectionReason" text,
				"subscriptionId" uuid,
				"parentLicenseId" uuid,
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
				"licenseType" varchar(50) NOT NULL,
				"defaultFeatures" jsonb,
				"defaultLimits" jsonb,
				"defaultValidityDays" integer DEFAULT 365,
				"requiresApproval" boolean DEFAULT true,
				"isActive" boolean DEFAULT true,
				"createdBy" uuid NOT NULL,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create license_approval table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license_approval (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"licenseId" uuid NOT NULL,
				"requestedBy" uuid NOT NULL,
				"approvalType" varchar(50) NOT NULL,
				"requestData" jsonb,
				status varchar(50) DEFAULT 'pending',
				"approvedBy" uuid,
				"approvedAt" timestamp,
				"rejectedBy" uuid,
				"rejectedAt" timestamp,
				"rejectionReason" text,
				"expiresAt" timestamp NOT NULL,
				priority varchar(50) DEFAULT 'medium',
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create license_audit_log table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}license_audit_log (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"licenseId" uuid NOT NULL,
				action varchar(50) NOT NULL,
				"performedBy" uuid NOT NULL,
				"previousState" jsonb,
				"newState" jsonb NOT NULL,
				reason text,
				"ipAddress" varchar(45),
				"userAgent" text,
				metadata jsonb,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create owner_management table
		await queryRunner.query(`
			CREATE TABLE ${tablePrefix}owner_management (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				"ownerId" uuid UNIQUE NOT NULL,
				permissions jsonb NOT NULL,
				"delegatedUsers" jsonb,
				settings jsonb NOT NULL,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
			);
		`);

		// Create indexes for license table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_license_key ON ${tablePrefix}license("licenseKey");`,
		);
		await queryRunner.query(`CREATE INDEX idx_license_status ON ${tablePrefix}license(status);`);
		await queryRunner.query(
			`CREATE INDEX idx_license_type ON ${tablePrefix}license("licenseType");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_validity ON ${tablePrefix}license("validFrom", "validUntil");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_status ON ${tablePrefix}license("approvalStatus");`,
		);

		// Create indexes for license_template table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_license_template_name ON ${tablePrefix}license_template(name);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_type ON ${tablePrefix}license_template("licenseType");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_active ON ${tablePrefix}license_template("isActive");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_template_created_by ON ${tablePrefix}license_template("createdBy");`,
		);

		// Create indexes for license_approval table
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_license_id ON ${tablePrefix}license_approval("licenseId");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_request_status ON ${tablePrefix}license_approval(status);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_type ON ${tablePrefix}license_approval("approvalType");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_requested_by ON ${tablePrefix}license_approval("requestedBy");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_expires_at ON ${tablePrefix}license_approval("expiresAt");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_approval_priority ON ${tablePrefix}license_approval(priority);`,
		);

		// Create indexes for license_audit_log table
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_license_id ON ${tablePrefix}license_audit_log("licenseId");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_action ON ${tablePrefix}license_audit_log(action);`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_performed_by ON ${tablePrefix}license_audit_log("performedBy");`,
		);
		await queryRunner.query(
			`CREATE INDEX idx_license_audit_log_createdAt ON ${tablePrefix}license_audit_log("createdAt");`,
		);

		// Create indexes for owner_management table
		await queryRunner.query(
			`CREATE UNIQUE INDEX idx_owner_management_owner_id ON ${tablePrefix}owner_management("ownerId");`,
		);

		// Add foreign key constraints
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_issued_to_user
			FOREIGN KEY ("issuedTo") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_issued_by_user
			FOREIGN KEY ("issuedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_approved_by_user
			FOREIGN KEY ("approvedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_subscription
			FOREIGN KEY ("subscriptionId") REFERENCES "${tablePrefix}user_subscription"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license
			ADD CONSTRAINT fk_license_parent
			FOREIGN KEY ("parentLicenseId") REFERENCES ${tablePrefix}license(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_template
			ADD CONSTRAINT fk_license_template_created_by_user
			FOREIGN KEY ("createdBy") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_license
			FOREIGN KEY ("licenseId") REFERENCES ${tablePrefix}license(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_requested_by_user
			FOREIGN KEY ("requestedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_approved_by_user
			FOREIGN KEY ("approvedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_approval
			ADD CONSTRAINT fk_license_approval_rejected_by_user
			FOREIGN KEY ("rejectedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE SET NULL;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_audit_log
			ADD CONSTRAINT fk_license_audit_log_license
			FOREIGN KEY ("licenseId") REFERENCES ${tablePrefix}license(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}license_audit_log
			ADD CONSTRAINT fk_license_audit_log_performed_by_user
			FOREIGN KEY ("performedBy") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
		`);

		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}owner_management
			ADD CONSTRAINT fk_owner_management_owner_user
			FOREIGN KEY ("ownerId") REFERENCES "${tablePrefix}user"(id) ON DELETE CASCADE;
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
