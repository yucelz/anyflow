import type { IRestApiContext } from '../types';
import { makeRestApiRequest } from '../utils';

export interface ISubscriptionPlan {
	id: string;
	slug: string;
	name: string;
	description: string;
	monthlyPrice: number;
	yearlyPrice: number;
	monthlyExecutionsLimit: number;
	activeWorkflowsLimit: number;
	credentialsLimit: number;
	usersLimit: number;
	features: {
		advancedNodes: boolean;
		prioritySupport: boolean;
		sso: boolean;
		auditLogs: boolean;
		customBranding: boolean;
		apiAccess: boolean;
		webhooks: boolean;
		customDomains: boolean;
		advancedSecurity: boolean;
		workersView: boolean;
		logStreaming: boolean;
		externalSecrets: boolean;
		sourceControl: boolean;
		variables: boolean;
		ldapAuth: boolean;
		advancedInsights: boolean;
	};
	isActive: boolean;
	isPopular: boolean;
	trialDays: number;
}

export interface IUserSubscription {
	id: string;
	userId: string;
	planId: string;
	status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';
	billingCycle: 'monthly' | 'yearly';
	amount: number;
	currency: string;
	currentPeriodStart: string;
	currentPeriodEnd: string;
	trialStart?: string;
	trialEnd?: string;
	canceledAt?: string;
	cancelAtPeriodEnd: boolean;
	plan?: ISubscriptionPlan;
}

export interface IUsageLimits {
	executionsLeft: number;
	workflowsLeft: number;
	credentialsLeft: number;
	usersLeft: number;
}

export interface ISubscriptionSetupResponse {
	clientSecret: string;
	customerId: string;
	stripePriceId: string;
	planName: string;
	amount: number;
}

export interface IPaymentMethod {
	id: string;
	type: string;
	last4?: string;
	brand?: string;
	expiryMonth?: number;
	expiryYear?: number;
	isDefault: boolean;
}

export interface IInvoice {
	id: string;
	amount: number;
	currency: string;
	status: string;
	invoiceUrl?: string;
	created: string;
	dueDate?: string;
}

export const subscriptionsApi = {
	async getPlans(context: IRestApiContext): Promise<ISubscriptionPlan[]> {
		return await makeRestApiRequest(context, 'GET', '/subscriptions/plans');
	},

	async getCurrentSubscription(context: IRestApiContext): Promise<IUserSubscription | null> {
		return await makeRestApiRequest(context, 'GET', '/subscriptions/current');
	},

	async getPlanById(context: IRestApiContext, planId: string): Promise<ISubscriptionPlan> {
		return await makeRestApiRequest(context, 'GET', `/subscriptions/plans/${planId}`);
	},

	async createSubscriptionSetup(
		context: IRestApiContext,
		params: { planId: string; billingCycle: 'monthly' | 'yearly' },
	): Promise<ISubscriptionSetupResponse> {
		return await makeRestApiRequest(context, 'POST', '/subscriptions/create-setup', params);
	},

	async createRecurringSubscription(
		context: IRestApiContext,
		params: {
			planId: string;
			billingCycle: 'monthly' | 'yearly';
			paymentMethodId: string;
		},
	): Promise<IUserSubscription> {
		return await makeRestApiRequest(context, 'POST', '/subscriptions/create-recurring', params);
	},

	async createSubscription(
		context: IRestApiContext,
		params: {
			planSlug: string;
			billingCycle: 'monthly' | 'yearly';
			paymentMethodId?: string;
		},
	): Promise<IUserSubscription> {
		return await makeRestApiRequest(context, 'POST', '/subscriptions/subscribe', params);
	},

	async upgradeSubscription(
		context: IRestApiContext,
		subscriptionId: string,
		params: { planSlug: string },
	): Promise<IUserSubscription> {
		return await makeRestApiRequest(
			context,
			'PUT',
			`/subscriptions/${subscriptionId}/upgrade`,
			params,
		);
	},

	async cancelSubscription(
		context: IRestApiContext,
		subscriptionId: string,
		params: { cancelAtPeriodEnd?: boolean },
	): Promise<IUserSubscription> {
		return await makeRestApiRequest(context, 'DELETE', `/subscriptions/${subscriptionId}`, params);
	},

	async getUsageLimits(context: IRestApiContext): Promise<IUsageLimits> {
		return await makeRestApiRequest(context, 'GET', '/subscriptions/usage');
	},

	async getPaymentMethods(context: IRestApiContext): Promise<IPaymentMethod[]> {
		return await makeRestApiRequest(context, 'GET', '/billing/payment-methods');
	},

	async getInvoices(context: IRestApiContext): Promise<IInvoice[]> {
		return await makeRestApiRequest(context, 'GET', '/billing/invoices');
	},
};
