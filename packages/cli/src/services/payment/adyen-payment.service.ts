import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';

import { IPaymentService } from './payment-service.interface';

@Service()
export class AdyenPaymentService implements IPaymentService {
	private client: any;
	private checkout: any;
	private recurring: any;

	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
	) {
		// Initialize Adyen only if enabled and configured
		if (this.subscriptionConfig.subscriptionEnabled && this.subscriptionConfig.adyenApiKey) {
			try {
				void this.initializeAdyen();
			} catch (error) {
				this.logger.warn(
					'Adyen not available. Install @adyen/api-library package to enable Adyen payments.',
				);
			}
		}
	}

	private async initializeAdyen() {
		try {
			const { Client, CheckoutAPI, RecurringAPI, ManagementAPI } = await import(
				'@adyen/api-library'
			);
			this.client = new Client({
				apiKey: this.subscriptionConfig.adyenApiKey,
				environment: (this.subscriptionConfig.adyenEnvironment as any) || 'TEST',
			});
			this.checkout = new CheckoutAPI(this.client);
			this.recurring = new RecurringAPI(this.client);
		} catch (error) {
			this.logger.error('Failed to initialize Adyen:', error);
			throw error;
		}
	}

	async createCustomer(user: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<string> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Adyen doesn't have a separate customer creation endpoint
		// We'll use the user ID as the shopper reference
		return user.id;
	}

	async updateCustomer(
		customerId: string,
		data: Partial<{ email: string; name: string }>,
	): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Adyen customer updates are handled through payment requests
		// Store the updated data for future payment requests
		this.logger.info(`Customer ${customerId} data updated`, data);
	}

	async deleteCustomer(customerId: string): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		try {
			// Disable all recurring contracts for this shopper
			await this.recurring.disable({
				merchantAccount: this.subscriptionConfig.adyenMerchantAccount,
				shopperReference: customerId,
			});
		} catch (error) {
			this.logger.warn(`Failed to disable recurring contracts for customer ${customerId}:`, error);
		}
	}

	async createSubscription(params: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialDays?: number;
	}) {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// For Adyen, we need to create a recurring payment
		// This is a simplified implementation - in practice, you'd need to:
		// 1. Create initial payment to establish recurring contract
		// 2. Set up recurring payments schedule

		const now = new Date();
		const currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

		// Mock subscription creation for now
		const subscriptionId = `adyen_sub_${Date.now()}`;

		return {
			id: subscriptionId,
			status: 'active',
			currentPeriodStart: now,
			currentPeriodEnd,
			trialStart: params.trialDays ? now : undefined,
			trialEnd: params.trialDays
				? new Date(now.getTime() + params.trialDays * 24 * 60 * 60 * 1000)
				: undefined,
		};
	}

	async updateSubscription(
		subscriptionId: string,
		params: {
			priceId?: string;
			paymentMethodId?: string;
		},
	): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Update subscription logic would go here
		this.logger.info(`Subscription ${subscriptionId} updated`, params);
	}

	async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Cancel subscription logic would go here
		this.logger.info(`Subscription ${subscriptionId} canceled`, { cancelAtPeriodEnd });
	}

	async createPaymentMethod(customerId: string, paymentData: any) {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Create payment method through Adyen's tokenization
		const response = await this.checkout.payments({
			amount: { currency: 'USD', value: 0 }, // Zero-auth to tokenize
			merchantAccount: this.subscriptionConfig.adyenMerchantAccount,
			shopperReference: customerId,
			storePaymentMethod: true,
			...paymentData,
		});

		return {
			id: response.recurringDetailReference || response.pspReference || '',
			type: paymentData.paymentMethod?.type || 'card',
			last4: paymentData.paymentMethod?.encryptedCardNumber?.slice(-4),
			brand: paymentData.paymentMethod?.brand,
		};
	}

	async listPaymentMethods(customerId: string): Promise<any[]> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		try {
			const response = await this.recurring.listRecurringDetails({
				merchantAccount: this.subscriptionConfig.adyenMerchantAccount,
				shopperReference: customerId,
			});

			return response.details || [];
		} catch (error) {
			this.logger.error('Failed to list payment methods:', error);
			return [];
		}
	}

	async deletePaymentMethod(paymentMethodId: string): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		await this.recurring.disable({
			merchantAccount: this.subscriptionConfig.adyenMerchantAccount,
			recurringDetailReference: paymentMethodId,
		});
	}

	async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Adyen doesn't have a concept of default payment method
		// This would be handled in your application logic
		this.logger.info(`Default payment method set for customer ${customerId}: ${paymentMethodId}`);
	}

	async createInvoice(
		customerId: string,
		items: Array<{
			description: string;
			amount: number;
			quantity?: number;
		}>,
	) {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		const total = items.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0);
		const invoiceId = `adyen_inv_${Date.now()}`;

		// Adyen doesn't have built-in invoicing - this would be handled separately
		return {
			id: invoiceId,
			invoiceNumber: invoiceId,
			status: 'draft',
			total,
			currency: 'USD',
			dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		};
	}

	async handleWebhook(payload: any, signature: string) {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Verify webhook signature
		const hmacValidator = require('@adyen/api-library').HmacValidator;
		const validator = new hmacValidator();

		const isValid = validator.validateHMAC(
			payload,
			this.subscriptionConfig.adyenWebhookSecret,
			signature,
		);

		if (!isValid) {
			throw new Error('Invalid webhook signature');
		}

		return {
			type: payload.eventCode,
			data: payload,
		};
	}

	async getSubscription(subscriptionId: string): Promise<any> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Mock subscription retrieval
		return {
			id: subscriptionId,
			status: 'active',
		};
	}

	async getCustomer(_customerId: string): Promise<any> {
		if (!this.client) {
			throw new Error('Adyen not initialized');
		}

		// Mock customer retrieval
		return {
			id: _customerId,
			shopperReference: _customerId,
		};
	}
}
