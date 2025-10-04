#!/usr/bin/env node

const { Client } = require('pg');
require('dotenv').config();

async function checkDatabasePlans() {
	const client = new Client({
		host: process.env.DB_POSTGRESDB_HOST,
		port: process.env.DB_POSTGRESDB_PORT,
		database: process.env.DB_POSTGRESDB_DATABASE,
		user: process.env.DB_POSTGRESDB_USER,
		password: process.env.DB_POSTGRESDB_PASSWORD,
	});

	try {
		await client.connect();
		console.log('📊 Current Subscription Plans in Database:\n');

		const result = await client.query(`
      SELECT slug, name, "monthlyPrice", "yearlyPrice", "isActive", "isPopular", "trialDays"
      FROM subscription_plan
      ORDER BY "sortOrder"
    `);

		if (result.rows.length === 0) {
			console.log('❌ No subscription plans found in database');
			console.log('💡 You may need to run database migrations first');
			return;
		}

		result.rows.forEach((plan) => {
			console.log(`--- ${plan.name} (${plan.slug}) ---`);
			console.log(`  Monthly: $${plan.monthlyPrice}`);
			console.log(`  Yearly: $${plan.yearlyPrice}`);
			console.log(`  Active: ${plan.isActive}`);
			console.log(`  Popular: ${plan.isPopular}`);
			console.log(`  Trial Days: ${plan.trialDays}`);
			console.log('');
		});

		console.log('✅ Database plans retrieved successfully!');
	} catch (error) {
		console.error('❌ Database connection error:', error.message);
		console.log('💡 Make sure PostgreSQL is running and credentials are correct');
	} finally {
		await client.end();
	}
}

// Run the check
checkDatabasePlans();
