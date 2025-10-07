import { Service } from '@n8n/di';
import { Logger } from '@n8n/backend-common';
import { SubscriptionConfig } from '@n8n/config';
import { UserSubscriptionRepository } from '@n8n/db';

import { IPaymentService } from './payment-service.interface';

@Service()
export class StripePaymentService implements IPaymentService {
	private stripe: any;

	constructor(
		private logger: Logger,
		private subscriptionConfig: SubscriptionConfig,
		private userSubscriptionRepository: UserSubscriptionRepository,
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
	}): Promise<{ id: string }> {
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

			return { id: customer.id };
		} catch (error) {
			this.logger.error('Failed to create Stripe customer:', error);
			throw error;
		}
	}

	async createSetupIntent(params: {
		customerId: string;
		metadata?: Record<string, string>;
	}): Promise<{ client_secret: string; id: string }> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const setupIntent = await this.stripe.setupIntents.create({
				customer: params.customerId,
				payment_method_types: ['card'],
				usage: 'off_session',
				metadata: params.metadata || {},
			});

			return {
				client_secret: setupIntent.client_secret,
				id: setupIntent.id,
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe setup intent:', error);
			throw error;
		}
	}

	async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			await this.stripe.paymentMethods.attach(paymentMethodId, {
				customer: customerId,
			});
		} catch (error) {
			this.logger.error('Failed to attach payment method to customer:', error);
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

	async createStripeSubscription(params: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialDays?: number;
		metadata?: Record<string, string>;
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

			// Add metadata if provided
			if (params.metadata) {
				subscriptionData.metadata = params.metadata;
			}

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
				current_period_start: subscription.current_period_start,
				current_period_end: subscription.current_period_end,
				trial_start: subscription.trial_start,
				trial_end: subscription.trial_end,
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

	async getPaymentMethod(paymentMethodId: string): Promise<any> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			return await this.stripe.paymentMethods.retrieve(paymentMethodId);
		} catch (error) {
			this.logger.error(`Failed to retrieve Stripe payment method ${paymentMethodId}:`, error);
			throw error;
		}
	}

	async createPaymentLink(params: {
		priceId: string;
		quantity?: number;
		metadata?: Record<string, string>;
		successUrl: string;
		cancelUrl?: string;
		trialDays?: number;
		allowPromotionCodes?: boolean;
		collectBillingAddress?: boolean;
		collectShippingAddress?: boolean;
		invoiceCreation?: boolean;
		customText?: {
			shipping_address?: { message: string };
			submit?: { message: string };
		};
	}): Promise<{ id: string; url: string }> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const paymentLinkData: any = {
				line_items: [
					{
						price: params.priceId,
						quantity: params.quantity || 1,
					},
				],
				after_completion: {
					type: 'redirect',
					redirect: {
						url: params.successUrl,
					},
				},
				metadata: params.metadata || {},
			};

			// Add optional features based on Stripe Payment Links API
			if (params.allowPromotionCodes !== undefined) {
				paymentLinkData.allow_promotion_codes = params.allowPromotionCodes;
			}

			if (params.collectBillingAddress !== undefined) {
				paymentLinkData.billing_address_collection = params.collectBillingAddress
					? 'required'
					: 'auto';
			}

			if (params.collectShippingAddress !== undefined) {
				paymentLinkData.shipping_address_collection = {
					allowed_countries: [
						'US',
						'GB',
						'CA',
						'AU',
						'DE',
						'FR',
						'IT',
						'ES',
						'NL',
						'BE',
						'AT',
						'CH',
						'SE',
						'NO',
						'DK',
						'FI',
					],
				};
			}

			if (params.customText) {
				paymentLinkData.custom_text = params.customText;
			}

			if (params.invoiceCreation) {
				paymentLinkData.invoice_creation = {
					enabled: true,
				};
			}

			// Add subscription configuration for recurring prices
			if (params.trialDays && params.trialDays > 0) {
				paymentLinkData.subscription_data = {
					trial_period_days: params.trialDays,
				};
			}

			const paymentLink = await this.stripe.paymentLinks.create(paymentLinkData);

			return {
				id: paymentLink.id,
				url: paymentLink.url,
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe payment link:', error);
			throw error;
		}
	}

	async updatePaymentLink(
		linkId: string,
		params: {
			active?: boolean;
			metadata?: Record<string, string>;
		},
	): Promise<void> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			await this.stripe.paymentLinks.update(linkId, params);
		} catch (error) {
			this.logger.error(`Failed to update Stripe payment link ${linkId}:`, error);
			throw error;
		}
	}

	async retrievePaymentLink(linkId: string): Promise<any> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			return await this.stripe.paymentLinks.retrieve(linkId);
		} catch (error) {
			this.logger.error(`Failed to retrieve Stripe payment link ${linkId}:`, error);
			throw error;
		}
	}

	async listPaymentLinks(params?: {
		limit?: number;
		starting_after?: string;
		ending_before?: string;
		active?: boolean;
	}): Promise<any> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			return await this.stripe.paymentLinks.list(params);
		} catch (error) {
			this.logger.error('Failed to list Stripe payment links:', error);
			throw error;
		}
	}

	async createCheckoutSession(params: {
		priceId: string;
		successUrl?: string;
		cancelUrl?: string;
		metadata?: Record<string, string>;
		mode?: 'payment' | 'subscription' | 'setup';
		customerId?: string;
		trialPeriodDays?: number;
		allowPromotionCodes?: boolean;
		billingAddressCollection?: 'required' | 'auto';
		userId?: string;
		planId?: string;
		billingCycle?: 'monthly' | 'yearly';
	}): Promise<{ id: string; url: string }> {
		if (!this.stripe) {
			throw new Error('Stripe not initialized');
		}

		try {
			const baseUrl =
				this.subscriptionConfig.stripeCheckoutBaseUrl || 'https://checkout.stripe.com';

			const checkoutData: any = {
				line_items: [
					{
						price: params.priceId,
						quantity: 1,
					},
				],
				mode: params.mode || 'subscription',
				success_url: params.successUrl || `${baseUrl}/success`,
				cancel_url: params.cancelUrl || `${baseUrl}/cancel`,
				metadata: {
					...params.metadata,
					...(params.userId && { userId: params.userId }),
					...(params.planId && { planId: params.planId }),
					...(params.billingCycle && { billingCycle: params.billingCycle }),
				},
			};

			// Add customer if provided
			if (params.customerId) {
				checkoutData.customer = params.customerId;
			}

			// Add trial period for subscriptions
			if (params.mode === 'subscription' && params.trialPeriodDays && params.trialPeriodDays > 0) {
				checkoutData.subscription_data = {
					trial_period_days: params.trialPeriodDays,
				};
			}

			// Add promotion codes support - default to true for business logic
			checkoutData.allow_promotion_codes = params.allowPromotionCodes ?? true;

			// Add billing address collection - default to auto for business logic
			checkoutData.billing_address_collection = params.billingAddressCollection || 'auto';

			const session = await this.stripe.checkout.sessions.create(checkoutData);

			this.logger.info(`Checkout session created: ${session.id}`, {
				priceId: params.priceId,
				userId: params.userId,
				planId: params.planId,
			});

			return {
				id: session.id,
				url: session.url,
			};
		} catch (error) {
			this.logger.error('Failed to create Stripe checkout session:', error);
			throw new Error('Failed to create checkout session');
		}
	}

	/**
	 * Get existing Stripe customer ID from database or create new one
	 */
	async getOrCreateStripeCustomer(
		userId: string,
		email: string,
		firstName?: string,
		lastName?: string,
	): Promise<string> {
		try {
			// Check if user already has a Stripe customer ID
			const existingSubscription = await this.userSubscriptionRepository.findByUserId(userId);

			if (existingSubscription?.metadata?.stripeCustomerId) {
				return existingSubscription.metadata.stripeCustomerId as string;
			}

			// Create new Stripe customer
			const customer = await this.createCustomer({
				id: userId,
				email,
				firstName,
				lastName,
			});

			this.logger.info(`Stripe customer created for user ${userId}`, {
				customerId: customer.id,
			});

			return customer.id;
		} catch (error) {
			this.logger.error(`Failed to get or create Stripe customer for user ${userId}:`, error);
			throw error;
		}
	}
}
