import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class CreateEmailVerificationTable1740445074053 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(
			`CREATE TABLE ${tablePrefix}email_verification (
				"id" uuid NOT NULL DEFAULT gen_random_uuid(),
				"email" character varying(254) NOT NULL,
				"code" character varying(6) NOT NULL,
				"expiresAt" TIMESTAMP NOT NULL,
				"verifiedAt" TIMESTAMP NULL,
				"attempts" integer NOT NULL DEFAULT 0,
				"maxAttempts" integer NOT NULL DEFAULT 3,
				"isUsed" boolean NOT NULL DEFAULT false,
				"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
				CONSTRAINT "PK_${tablePrefix}email_verification" PRIMARY KEY ("id")
			)`,
		);

		// Create indexes for performance
		await queryRunner.query(
			`CREATE INDEX "IDX_${tablePrefix}email_verification_email" ON ${tablePrefix}email_verification ("email")`,
		);

		await queryRunner.query(
			`CREATE INDEX "IDX_${tablePrefix}email_verification_email_code" ON ${tablePrefix}email_verification ("email", "code")`,
		);

		await queryRunner.query(
			`CREATE INDEX "IDX_${tablePrefix}email_verification_expires_at" ON ${tablePrefix}email_verification ("expiresAt")`,
		);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		await queryRunner.query(`DROP INDEX "IDX_${tablePrefix}email_verification_expires_at"`);
		await queryRunner.query(`DROP INDEX "IDX_${tablePrefix}email_verification_email_code"`);
		await queryRunner.query(`DROP INDEX "IDX_${tablePrefix}email_verification_email"`);
		await queryRunner.query(`DROP TABLE ${tablePrefix}email_verification`);
	}
}
