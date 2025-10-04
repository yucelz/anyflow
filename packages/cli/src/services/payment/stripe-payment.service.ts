import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';

import { IPaymentService } from './payment-service.interface';

@Service()
export class StripePaymentService implements IPaymentService {
	private stripe: any;

	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
	) {
		// Initialize Stripe only if enabled and configured
		if (this.subscriptionConfig.subscriptionEnabled && this.subscriptionConfig.stripeSecretKey) {
			try {
				void this.initializeStripe();
			} catch (error) {
				this.logger.warn('Stripe not available. Install stripe package to enable Stripe payments.');
			}
		}
	}

	private async initializeStripe() {
		try {
			const Stripe = await import('stripe');
			this.stripe = new Stripe.default(this.subscriptionConfig.stripeSecretKey, {
				typescript: true,
			});
		} catch (error) {
			this.logger.error('Failed to initialize Stripe:', error);
			throw error;
		}
	}

	async createCustomer(user: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<string> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const customer = await this.stripe.customers.create({
				email: user.email,
				name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
				metadata: {
					userId: user.id,
				},
			});

			return customer.id;
		} catch (error) {
			this.logger.error('Failed to create Stripe customer:', error);
			throw error;
		}
	}

	async updateCustomer(
		customerId: string,
		data: Partial<{ email: string; name: string }>,
	): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			await this.stripe.customers.update(customerId, {
				email: data.email,
				name: data.name,
			});
		} catch (error) {
			this.logger.error(`Failed to update Stripe customer ${customerId}:`, error);
			throw error;
		}
	}

	async deleteCustomer(customerId: string): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			await this.stripe.customers.del(customerId);
		} catch (error) {
			this.logger.warn(`Failed to delete Stripe customer ${customerId}:`, error);
			throw error;
		}
	}

	async createSubscription(params: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialDays?: number;
	}) {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const subscriptionData: any = {
				customer: params.customerId,
				items: [{ price: params.priceId }],
				payment_behavior: 'default_incomplete',
				payment_settings: { save_default_payment_method: 'on_subscription' },
				expand: ['latest_invoice.payment_intent'],
			};

			// Add default payment method if provided
			if (params.paymentMethodId) {
				subscriptionData.default_payment_method = params.paymentMethodId;
			}

			// Add trial period if specified
			if (params.trialDays && params.trialDays > 0) {
				const trialEnd = Math.floor(Date.now() / 1000) + params.trialDays * 24 * 60 * 60;
				subscriptionData.trial_end = trialEnd;
			}

			const subscription = await this.stripe.subscriptions.create(subscriptionData);

			return {
				id: subscription.id,
				status: subscription.status,
				currentPeriodStart: new Date(subscription.current_period_start * 1000),
				currentPeriodEnd: new Date(subscription.current_period_end * 1000),
				trialStart: subscription.trial_start
					? new Date(subscription.trial_start * 1000)
					: undefined,
				trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe subscription:', error);
			throw error;
		}
	}

	async updateSubscription(
		subscriptionId: string,
		params: {
			priceId?: string;
			paymentMethodId?: string;
		},
	): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const updateData: any = {};

			// Update payment method
			if (params.paymentMethodId) {
				updateData.default_payment_method = params.paymentMethodId;
			}

			// Update price (requires subscription item update)
			if (params.priceId) {
				const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
				const subscriptionItemId = subscription.items.data[0].id;

				updateData.items = [
					{
						id: subscriptionItemId,
						price: params.priceId,
					},
				];
				updateData.proration_behavior = 'always_invoice';
			}

			await this.stripe.subscriptions.update(subscriptionId, updateData);
		} catch (error) {
			this.logger.error(`Failed to update Stripe subscription ${subscriptionId}:`, error);
			throw error;
		}
	}

	async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			if (cancelAtPeriodEnd) {
				// Cancel at period end
				await this.stripe.subscriptions.update(subscriptionId, {
					cancel_at_period_end: true,
				});
			} else {
				// Cancel immediately
				await this.stripe.subscriptions.cancel(subscriptionId);
			}
		} catch (error) {
			this.logger.error(`Failed to cancel Stripe subscription ${subscriptionId}:`, error);
			throw error;
		}
	}

	async createPaymentMethod(customerId: string, paymentData: any) {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			// Create payment method
			const paymentMethod = await this.stripe.paymentMethods.create({
				type: 'card',
				card: paymentData.card,
			});

			// Attach to customer
			await this.stripe.paymentMethods.attach(paymentMethod.id, {
				customer: customerId,
			});

			return {
				id: paymentMethod.id,
				type: paymentMethod.type,
				last4: paymentMethod.card?.last4,
				brand: paymentMethod.card?.brand,
				expiryMonth: paymentMethod.card?.exp_month,
				expiryYear: paymentMethod.card?.exp_year,
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe payment method:', error);
			throw error;
		}
	}

	async listPaymentMethods(customerId: string): Promise<any[]> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const paymentMethods = await this.stripe.paymentMethods.list({
				customer: customerId,
				type: 'card',
			});

			return paymentMethods.data.map((pm: any) => ({
				id: pm.id,
				type: pm.type,
				last4: pm.card?.last4,
				brand: pm.card?.brand,
				expiryMonth: pm.card?.exp_month,
				expiryYear: pm.card?.exp_year,
			}));
		} catch (error) {
			this.logger.error('Failed to list Stripe payment methods:', error);
			return [];
		}
	}

	async deletePaymentMethod(paymentMethodId: string): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			await this.stripe.paymentMethods.detach(paymentMethodId);
		} catch (error) {
			this.logger.error(`Failed to delete Stripe payment method ${paymentMethodId}:`, error);
			throw error;
		}
	}

	async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			// Update customer's default payment method
			await this.stripe.customers.update(customerId, {
				invoice_settings: {
					default_payment_method: paymentMethodId,
				},
			});
		} catch (error) {
			this.logger.error(`Failed to set default payment method for customer ${customerId}:`, error);
			throw error;
		}
	}

	async createInvoice(
		customerId: string,
		items: Array<{
			description: string;
			amount: number;
			quantity?: number;
		}>,
	) {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			// Create invoice items
			for (const item of items) {
				await this.stripe.invoiceItems.create({
					customer: customerId,
					description: item.description,
					amount: Math.round(item.amount * 100), // Convert to cents
					quantity: item.quantity || 1,
					currency: this.subscriptionConfig.defaultCurrency.toLowerCase(),
				});
			}

			// Create and finalize invoice
			const invoice = await this.stripe.invoices.create({
				customer: customerId,
				auto_advance: false, // Don't auto-charge
			});

			await this.stripe.invoices.finalizeInvoice(invoice.id);

			const total = items.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0);

			return {
				id: invoice.id,
				invoiceNumber: invoice.number || invoice.id,
				status: invoice.status,
				total,
				currency: this.subscriptionConfig.defaultCurrency,
				dueDate: new Date(
					invoice.due_date ? invoice.due_date * 1000 : Date.now() + 30 * 24 * 60 * 60 * 1000,
				),
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe invoice:', error);
			throw error;
		}
	}

	async handleWebhook(payload: any, signature: string) {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			// Verify webhook signature
			const event = this.stripe.webhooks.constructEvent(
				payload,
				signature,
				this.subscriptionConfig.stripeWebhookSecret,
			);

			return {
				type: event.type,
				data: event.data,
			};
		} catch (error) {
			this.logger.error('Failed to verify Stripe webhook:', error);
			throw new Error('Invalid webhook signature');
		}
	}

	async getSubscription(subscriptionId: string): Promise<any> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
			return {
				id: subscription.id,
				status: subscription.status,
				currentPeriodStart: new Date(subscription.current_period_start * 1000),
				currentPeriodEnd: new Date(subscription.current_period_end * 1000),
				trialStart: subscription.trial_start
					? new Date(subscription.trial_start * 1000)
					: undefined,
				trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
				customerId: subscription.customer,
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve Stripe subscription ${subscriptionId}:`, error);
			throw error;
		}
	}

	async getCustomer(customerId: string): Promise<any> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const customer = await this.stripe.customers.retrieve(customerId);
			return {
				id: customer.id,
				email: customer.email,
				name: customer.name,
				metadata: customer.metadata,
			};
		} catch (error) {
			this.logger.error(`Failed to retrieve Stripe customer ${customerId}:`, error);
			throw error;
		}
	}
}
