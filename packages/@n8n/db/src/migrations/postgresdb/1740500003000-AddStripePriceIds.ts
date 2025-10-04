import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class AddStripePriceIds1740500003000 implements ReversibleMigration {
	async up({ queryRunner, tablePrefix }: MigrationContext) {
		// First, add the Stripe price ID columns
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}subscription_plan
			ADD COLUMN "PriceIdMonthly" varchar(255),
			ADD COLUMN "PriceIdYearly" varchar(255);
		`);

		// Update existing plans with actual Stripe price IDs
		await queryRunner.query(`
			UPDATE ${tablePrefix}subscription_plan SET
				"PriceIdMonthly" = 'price_1SEXB92Rwp7nkzHffs7lpCBb',
				"PriceIdYearly" = 'price_1SEXBO2Rwp7nkzHfElTq8WB2'
			WHERE slug = 'free';
		`);

		await queryRunner.query(`
			UPDATE ${tablePrefix}subscription_plan SET
				"PriceIdMonthly" = 'price_1SEXBj2Rwp7nkzHfqqCDvNM5',
				"PriceIdYearly" = 'price_1SEXC62Rwp7nkzHfjBE9ofOy'
			WHERE slug = 'starter';
		`);

		await queryRunner.query(`
			UPDATE ${tablePrefix}subscription_plan SET
				"PriceIdMonthly" = 'price_1SEXCM2Rwp7nkzHf4oR1PI9w',
				"PriceIdYearly" = 'price_1SEXEN2Rwp7nkzHfO41vY6fa'
			WHERE slug = 'pro';
		`);

		// Note: Enterprise plan doesn't have Stripe prices yet, leaving null
		await queryRunner.query(`
			UPDATE ${tablePrefix}subscription_plan SET
				"PriceIdMonthly" = NULL,
				"PriceIdYearly" = NULL
			WHERE slug = 'enterprise';
		`);
	}

	async down({ queryRunner, tablePrefix }: MigrationContext) {
		// Remove the Stripe price ID columns
		await queryRunner.query(`
			ALTER TABLE ${tablePrefix}subscription_plan
			DROP COLUMN "PriceIdMonthly",
			DROP COLUMN "PriceIdYearly";
		`);
	}
}
