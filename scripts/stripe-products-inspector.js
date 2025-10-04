#!/usr/bin/env node

const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
	apiVersion: '2023-10-16',
});

async function inspectStripeProducts() {
	try {
		console.log('🔍 Inspecting Stripe Products and Prices...\n');
		console.log('Environment:', process.env.STRIPE_ENVIRONMENT);
		console.log('Currency:', process.env.DEFAULT_CURRENCY);
		console.log('');

		// Get all products
		const products = await stripe.products.list({ limit: 100 });
		console.log(`📦 Found ${products.data.length} products:`);

		for (const product of products.data) {
			console.log(`\n--- Product: ${product.name} (${product.id}) ---`);
			console.log(`Description: ${product.description || 'No description'}`);
			console.log(`Active: ${product.active}`);
			console.log(`Metadata:`, JSON.stringify(product.metadata, null, 2));

			// Get prices for this product
			const prices = await stripe.prices.list({
				product: product.id,
				limit: 100,
			});

			console.log(`💰 Prices for this product (${prices.data.length}):`);
			for (const price of prices.data) {
				const amount = price.unit_amount ? price.unit_amount / 100 : 0;
				const interval = price.recurring ? `${price.recurring.interval}ly` : 'one-time';
				console.log(`  • ID: ${price.id}`);
				console.log(`    Amount: $${amount} ${price.currency.toUpperCase()}`);
				console.log(`    Type: ${interval}`);
				console.log(`    Active: ${price.active}`);
				console.log(`    Metadata:`, JSON.stringify(price.metadata, null, 2));
				console.log('');
			}
		}

		// Also get all prices (in case some are not attached to products)
		console.log('\n🏷️  All Prices in Account:');
		const allPrices = await stripe.prices.list({ limit: 100 });

		for (const price of allPrices.data) {
			const amount = price.unit_amount ? price.unit_amount / 100 : 0;
			const interval = price.recurring ? `${price.recurring.interval}ly` : 'one-time';
			console.log(
				`ID: ${price.id} | $${amount} ${price.currency.toUpperCase()} ${interval} | Product: ${price.product} | Active: ${price.active}`,
			);
		}

		console.log('\n✅ Stripe inspection completed!');
	} catch (error) {
		console.error('❌ Error inspecting Stripe:', error.message);
		if (error.type === 'StripeAuthenticationError') {
			console.error('Please check your STRIPE_SECRET_KEY in the .env file');
		}
	}
}

// Run the inspection
inspectStripeProducts();
