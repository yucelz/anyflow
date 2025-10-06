export interface SubscriptionPlan {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	monthlyPrice: number;
	yearlyPrice: number;
	monthlyExecutionsLimit: number;
	activeWorkflowsLimit: number;
	credentialsLimit: number;
	usersLimit: number;
	trialDays: number;
	isActive: boolean;
	isPopular: boolean;
	sortOrder: number;
	storageLimit?: number;
	PriceIdMonthly: string | null;
	PriceIdYearly: string | null;
	features?: {
		advancedNodes?: boolean;
		prioritySupport?: boolean;
		sso?: boolean;
		auditLogs?: boolean;
		customIntegrations?: boolean;
		onPremise?: boolean;
		customBranding?: boolean;
		apiAccess?: boolean;
		webhooks?: boolean;
		customDomains?: boolean;
		advancedSecurity?: boolean;
		workersView?: boolean;
		logStreaming?: boolean;
		externalSecrets?: boolean;
		sourceControl?: boolean;
		variables?: boolean;
		ldapAuth?: boolean;
		advancedInsights?: boolean;
	};
}

export interface UserSubscription {
	id: string;
	userId: string;
	planId: string;
	plan?: SubscriptionPlan;
	status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';
	billingCycle: 'monthly' | 'yearly';
	amount: number;
	currency: string;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	trialStart?: Date | null;
	trialEnd?: Date | null;
	canceledAt?: Date | null;
	cancelAtPeriodEnd: boolean;
	stripeSubscriptionId?: string | null;
	stripeCustomerId?: string | null;
	metadata: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;

	// Computed properties
	isActive: boolean;
	isTrialing: boolean;
	daysUntilRenewal: number;
}

export interface PaymentMethod {
	id: string;
	type: string;
	last4?: string;
	brand?: string;
	expiryMonth?: number;
	expiryYear?: number;
	isDefault?: boolean;
}

export interface Invoice {
	id: string;
	subscriptionId: string;
	invoiceNumber: string;
	status: string;
	subtotal: number;
	total: number;
	currency: string;
	paidAt?: Date | null;
	createdAt: Date;
	dueDate: Date;
	stripeInvoiceId?: string | null;
}

export interface UsageData {
	executionsLeft: number;
	workflowsLeft: number;
	credentialsLeft: number;
	usersLeft: number;
	executionsUsed?: number;
	workflowsUsed?: number;
	credentialsUsed?: number;
	usersUsed?: number;
}

export interface SubscriptionUpgradeFlowState {
	selectedPlan?: SubscriptionPlan;
	billingCycle: 'monthly' | 'yearly';
	paymentMethodId?: string;
	isProcessing: boolean;
	error?: string;
}
