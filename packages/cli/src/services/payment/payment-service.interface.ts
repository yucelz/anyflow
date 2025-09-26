export interface IPaymentService {
	// Customer management
	createCustomer(user: {
		id: string;
		email: string;
		firstName?: string;
		lastName?: string;
	}): Promise<string>;
	updateCustomer(customerId: string, data: Partial<{ email: string; name: string }>): Promise<void>;
	deleteCustomer(customerId: string): Promise<void>;

	// Subscription management
	createSubscription(params: {
		customerId: string;
		priceId: string;
		paymentMethodId?: string;
		trialDays?: number;
	}): Promise<{
		id: string;
		status: string;
		currentPeriodStart: Date;
		currentPeriodEnd: Date;
		trialStart?: Date;
		trialEnd?: Date;
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
