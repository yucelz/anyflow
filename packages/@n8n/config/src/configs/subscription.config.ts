import { Config, Env } from '../decorators';

@Config
export class SubscriptionConfig {
	/** Adyen Configuration */
	@Env('ADYEN_API_KEY')
	adyenApiKey: string = '';

	@Env('ADYEN_MERCHANT_ACCOUNT')
	adyenMerchantAccount: string = '';

	@Env('ADYEN_WEBHOOK_SECRET')
	adyenWebhookSecret: string = '';

	@Env('ADYEN_ENVIRONMENT')
	adyenEnvironment: 'TEST' | 'LIVE' = 'TEST';

	/** General Subscription Settings */
	@Env('DEFAULT_CURRENCY')
	defaultCurrency: string = 'USD';

	@Env('TRIAL_PERIOD_DAYS')
	trialPeriodDays: number = 14;

	@Env('SUBSCRIPTION_ENABLED')
	subscriptionEnabled: boolean = false;

	@Env('DEFAULT_PAYMENT_PROVIDER')
	defaultPaymentProvider: 'adyen' = 'adyen';

	/** Usage Limits for Free Plan */
	@Env('FREE_PLAN_EXECUTIONS_LIMIT')
	freePlanExecutionsLimit: number = 5000;

	@Env('FREE_PLAN_WORKFLOWS_LIMIT')
	freePlanWorkflowsLimit: number = 5;

	@Env('FREE_PLAN_CREDENTIALS_LIMIT')
	freePlanCredentialsLimit: number = 10;
}
