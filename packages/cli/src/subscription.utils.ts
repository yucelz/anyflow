/**
 * Shared utility functions for subscription management
 */

/**
 * Safely converts a Date object to a Date, returning undefined if invalid
 */
export function safeDateConversion(date: Date | undefined): Date | undefined {
	return date && !isNaN(date.getTime()) ? date : undefined;
}

/**
 * Safely converts a Unix timestamp (seconds) to a Date object
 */
export function safeTimestampToDate(timestamp: number | undefined): Date | undefined {
	return timestamp ? new Date(timestamp * 1000) : undefined;
}

/**
 * Calculates the end date of a billing period based on start date and cycle
 */
export function calculatePeriodEnd(startDate: Date, cycle: 'monthly' | 'yearly'): Date {
	const periodStart = new Date(startDate);
	if (cycle === 'yearly') {
		periodStart.setFullYear(periodStart.getFullYear() + 1);
	} else {
		periodStart.setMonth(periodStart.getMonth() + 1);
	}
	return periodStart;
}

/**
 * Resolves the Stripe price ID based on plan and billing cycle
 */
export function resolveStripePriceId(
	plan: { PriceIdYearly?: string; PriceIdMonthly?: string; slug: string },
	billingCycle: 'monthly' | 'yearly',
): string {
	const stripePriceId = billingCycle === 'yearly' ? plan.PriceIdYearly : plan.PriceIdMonthly;

	if (!stripePriceId) {
		throw new Error(
			`No Stripe price ID configured for plan '${plan.slug}' with ${billingCycle} billing`,
		);
	}

	return stripePriceId;
}

/**
 * Calculates the amount based on plan and billing cycle
 */
export function calculatePlanAmount(
	plan: { monthlyPrice: number; yearlyPrice: number },
	billingCycle: 'monthly' | 'yearly',
): number {
	return billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
}

/**
 * Builds subscription data object from Stripe subscription response
 */
export function buildSubscriptionData(params: {
	userId: string;
	planId: string;
	stripeSubscription: any;
	billingCycle: 'monthly' | 'yearly';
	amount: number;
	customerId?: string;
}): {
	userId: string;
	planId: string;
	status: any;
	billingCycle: 'monthly' | 'yearly';
	amount: number;
	currency: 'USD';
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	trialStart?: Date;
	trialEnd?: Date;
	metadata: {
		stripeSubscriptionId?: string;
		stripeCustomerId?: string;
	};
} {
	const { userId, planId, stripeSubscription, billingCycle, amount, customerId } = params;

	// Handle both Date objects and Unix timestamps from Stripe
	const currentPeriodStart = stripeSubscription.current_period_start
		? safeTimestampToDate(stripeSubscription.current_period_start) || new Date()
		: safeDateConversion(stripeSubscription.currentPeriodStart) || new Date();

	const currentPeriodEnd = stripeSubscription.current_period_end
		? safeTimestampToDate(stripeSubscription.current_period_end) ||
			calculatePeriodEnd(currentPeriodStart, billingCycle)
		: safeDateConversion(stripeSubscription.currentPeriodEnd) ||
			calculatePeriodEnd(currentPeriodStart, billingCycle);

	const trialStart = stripeSubscription.trial_start
		? safeTimestampToDate(stripeSubscription.trial_start)
		: safeDateConversion(stripeSubscription.trialStart);

	const trialEnd = stripeSubscription.trial_end
		? safeTimestampToDate(stripeSubscription.trial_end)
		: safeDateConversion(stripeSubscription.trialEnd);

	return {
		userId,
		planId,
		status: stripeSubscription.status,
		billingCycle,
		amount,
		currency: 'USD' as const,
		currentPeriodStart,
		currentPeriodEnd,
		trialStart,
		trialEnd,
		metadata: {
			stripeSubscriptionId: stripeSubscription.id,
			...(customerId && { stripeCustomerId: customerId }),
		},
	};
}

/**
 * Parses user name into first and last name
 */
export function parseUserName(userName?: string): { firstName?: string; lastName?: string } {
	if (!userName) {
		return {};
	}

	const parts = userName.split(' ');
	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(' ') || undefined,
	};
}

/**
 * Gets base URL for checkout/payment links
 */
export function getCheckoutBaseUrl(configUrl?: string): string {
	return configUrl || 'https://checkout.stripe.com';
}
