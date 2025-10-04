import { Config, Env } from '../decorators';

@Config
export class SubscriptionConfig {
	/** Stripe Configuration */
	@Env('STRIPE_PUBLISHABLE_KEY')
	stripePublishableKey: string = '';

	@Env('STRIPE_SECRET_KEY')
	stripeSecretKey: string = '';

	@Env('STRIPE_WEBHOOK_SECRET')
	stripeWebhookSecret: string = '';

	@Env('STRIPE_ENVIRONMENT')
	stripeEnvironment: string = '';

	/** General Subscription Settings */
	@Env('DEFAULT_CURRENCY')
	defaultCurrency: string = '';

	@Env('TRIAL_PERIOD_DAYS')
	trialPeriodDays: number = 14;

	@Env('SUBSCRIPTION_ENABLED')
	subscriptionEnabled: boolean = false;

	@Env('DEFAULT_PAYMENT_PROVIDER')
	defaultPaymentProvider: string = '';

	/** Usage Limits for Free Plan */
	@Env('FREE_PLAN_EXECUTIONS_LIMIT')
	freePlanExecutionsLimit: number = 5000;

	@Env('FREE_PLAN_WORKFLOWS_LIMIT')
	freePlanWorkflowsLimit: number = 5;

	@Env('FREE_PLAN_CREDENTIALS_LIMIT')
	freePlanCredentialsLimit: number = 10;
}
