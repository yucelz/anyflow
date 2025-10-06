export interface IPaymentService {
	// Customer management
	createCustomer(user: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<{ id: string }>;
	updateCustomer(customerId: string, data: Partial<{ email: string; name: string }>): Promise<void>;
	deleteCustomer(customerId: string): Promise<void>;

	// Setup intents for payment collection
	createSetupIntent(params: {
		customerId: string;
		metadata?: Record<string, string>;
	}): Promise<{
		client_secret: string;
		id: string;
	}>;

	// Subscription management
	createSubscription(params: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialDays?: number;
		metadata?: Record<string, string>;
	}): Promise<{
		id: string;
		status: string;
		currentPeriodStart: Date;
		currentPeriodEnd: Date;
		trialStart?: Date;
		trialEnd?: Date;
		current_period_start?: number;
		current_period_end?: number;
		trial_start?: number;
		trial_end?: number;
	}>;

	updateSubscription(
		subscriptionId: string,
		params: {
			priceId?: string;
			paymentMethodId?: string;
		},
	): Promise<void>;

	cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void>;

	// Payment method management
	attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<void>;

	createPaymentMethod(
		customerId: string,
		paymentData: any,
	): Promise<{
		id: string;
		type: string;
		last4?: string;
		brand?: string;
		expiryMonth?: number;
		expiryYear?: number;
	}>;

	listPaymentMethods(customerId: string): Promise<any[]>;
	deletePaymentMethod(paymentMethodId: string): Promise<void>;
	setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

	// Invoice management
	createInvoice(
		customerId: string,
		items: Array<{
			description: string;
			amount: number;
			quantity?: number;
		}>,
	): Promise<{
		id: string;
		invoiceNumber: string;
		status: string;
		total: number;
		currency: string;
		dueDate: Date;
	}>;

	// Webhook handling
	handleWebhook(
		payload: any,
		signature: string,
	): Promise<{
		type: string;
		data: any;
	}>;

	// Utility methods
	getSubscription(subscriptionId: string): Promise<any>;
	getCustomer(customerId: string): Promise<any>;
}
