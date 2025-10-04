# Stripe Payment Migration Implementation Plan

## Overview
This document outlines the complete migration from Adyen to Stripe payment processing while maintaining an abstract payment service architecture that supports future payment provider integrations.

## Current State Analysis

### Existing Adyen Integrations
1. **AdyenPaymentService** (`packages/cli/src/services/payment/adyen-payment.service.ts`)
   - Implements IPaymentService interface
   - Handles customer management, subscriptions, payment methods, invoices
   - Contains Adyen-specific initialization and API calls

2. **Configuration** (`packages/@n8n/config/src/configs/subscription.config.ts`)
   - Adyen-specific environment variables (API key, merchant account, webhook secret, environment)
   - Default payment provider set to 'adyen'

3. **Webhook Handling** (`packages/cli/src/controllers/webhook.controller.ts`)
   - `/webhook/adyen` endpoint for Adyen webhooks
   - Signature verification using Adyen HMAC validator

4. **DTOs and Types**
   - `AdyenWebhookRequestDto` in api-types
   - Adyen webhook request types in requests.ts

5. **Subscription Service Integration** (`packages/cli/src/services/subscription.service.ts`)
   - Direct dependency on AdyenPaymentService
   - Stores Adyen-specific metadata (adyenSubscriptionId, adyenCustomerId)

### Database Schema Review

#### UserSubscription Entity
✅ **Well-designed for multi-provider support:**
- Contains provider-specific fields: `stripeSubscriptionId`, `stripeCustomerId`, `paypalSubscriptionId`, etc.
- Generic `metadata` JSON column for provider-specific data
- Status and billing cycle fields are provider-agnostic

#### SubscriptionPlan Entity
✅ **No changes required:**
- Provider-agnostic design
- Contains pricing, limits, and feature definitions
- Ready for Stripe integration

## Implementation Strategy

### Phase 1: Stripe Service Implementation
1. **Create StripePaymentService**
   - Implement IPaymentService interface
   - Use Stripe Node.js SDK
   - Handle all Stripe-specific operations (customers, subscriptions, payment methods, invoices)

2. **Update Configuration**
   - Add Stripe environment variables
   - Remove Adyen configuration
   - Update default payment provider

### Phase 2: Webhook Migration
1. **Create Stripe Webhook Handler**
   - New `/webhook/stripe` endpoint
   - Stripe signature verification
   - Event processing for subscription lifecycle events

2. **Remove Adyen Webhook Handler**
   - Remove `/webhook/adyen` endpoint
   - Clean up Adyen-specific DTOs and types

### Phase 3: Service Integration
1. **Update SubscriptionService**
   - Replace AdyenPaymentService dependency with StripePaymentService
   - Update metadata storage to use Stripe IDs
   - Maintain backward compatibility for existing subscriptions

### Phase 4: Cleanup
1. **Remove Adyen Dependencies**
   - Delete all Adyen-related files
   - Remove Adyen configuration
   - Clean up imports and types

2. **Database Migration (if needed)**
   - Migration to clean up any Adyen-specific data
   - Ensure data integrity during transition

## Detailed Implementation Plan

### 1. Files to Create

#### `packages/cli/src/services/payment/stripe-payment.service.ts`
- **Purpose**: Main Stripe payment service implementation
- **Key Features**:
  - Customer management (create, update, delete)
  - Subscription lifecycle management
  - Payment method handling
  - Invoice creation and management
  - Webhook signature verification
  - Error handling and logging

#### `packages/@n8n/api-types/src/dto/webhook/stripe-webhook-request.dto.ts`
- **Purpose**: Type definitions for Stripe webhooks
- **Contents**: Zod schemas for Stripe webhook events

### 2. Files to Modify

#### `packages/@n8n/config/src/configs/subscription.config.ts`
```typescript
// Remove Adyen configuration
// Add Stripe configuration
@Env('STRIPE_PUBLISHABLE_KEY')
stripePublishableKey: string = '';

@Env('STRIPE_SECRET_KEY')
stripeSecretKey: string = '';

@Env('STRIPE_WEBHOOK_SECRET')
stripeWebhookSecret: string = '';

@Env('STRIPE_ENVIRONMENT')
stripeEnvironment: 'test' | 'live' = 'test';

@Env('DEFAULT_PAYMENT_PROVIDER')
defaultPaymentProvider: 'stripe' = 'stripe';
```

#### `packages/cli/src/services/subscription.service.ts`
```typescript
// Replace AdyenPaymentService with StripePaymentService
// Update metadata handling:
metadata: {
  stripeSubscriptionId: providerSubscription.id,
  stripeCustomerId: customerId,
}
```

#### `packages/cli/src/controllers/webhook.controller.ts`
```typescript
// Remove Adyen webhook handler
// Add Stripe webhook handler
@Post('/stripe', { skipAuth: true })
async handleStripeWebhook(req: WebhookRequest.StripeWebhook, res: Response) {
  // Stripe-specific webhook handling
}
```

### 3. Files to Delete

1. `packages/cli/src/services/payment/adyen-payment.service.ts`
2. `packages/@n8n/api-types/src/dto/webhook/adyen-webhook-request.dto.ts`
3. Any Adyen-specific test files
4. Adyen-related imports from index files

### 4. Environment Variables Migration

#### Remove:
- `ADYEN_API_KEY`
- `ADYEN_MERCHANT_ACCOUNT`
- `ADYEN_WEBHOOK_SECRET`
- `ADYEN_ENVIRONMENT`

#### Add:
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_ENVIRONMENT`

### 5. Database Considerations

#### UserSubscription Entity Updates
The current schema is already well-designed for multi-provider support:
- `stripeSubscriptionId` and `stripeCustomerId` fields already exist
- `metadata` JSON column can store additional Stripe-specific data
- No schema changes required for basic Stripe integration

#### Potential Migration Script
```sql
-- Optional: Clean up any existing Adyen-specific data
UPDATE user_subscription
SET metadata = metadata - 'adyenSubscriptionId' - 'adyenCustomerId'
WHERE metadata ? 'adyenSubscriptionId';
```

## Stripe Integration Architecture

### Key Stripe Concepts Mapping

| Function | Stripe Implementation |
|----------|----------------------|
| Customer Management | Stripe Customer API |
| Subscription Management | Stripe Subscriptions API |
| Payment Methods | Stripe Payment Methods API |
| Invoicing | Stripe Invoices API |
| Webhooks | Stripe Webhook Events |

### Webhook Events to Handle

1. **customer.subscription.created** - New subscription
2. **customer.subscription.updated** - Subscription changes
3. **customer.subscription.deleted** - Subscription cancelled
4. **invoice.payment_succeeded** - Successful payment
5. **invoice.payment_failed** - Failed payment
6. **customer.subscription.trial_will_end** - Trial ending soon

### Error Handling Strategy

1. **Graceful Degradation**: Service continues to function if Stripe is temporarily unavailable
2. **Retry Logic**: Implement exponential backoff for API calls
3. **Comprehensive Logging**: Log all payment operations for debugging
4. **Webhook Reliability**: Implement idempotency keys for webhook processing

## Security Considerations

1. **API Key Management**: Store Stripe keys securely in environment variables
2. **Webhook Signature Verification**: Always verify Stripe webhook signatures
3. **PCI Compliance**: Use Stripe's secure payment forms (no card data storage)
4. **Audit Logging**: Log all payment-related operations

## Testing Strategy

1. **Unit Tests**: Test all StripePaymentService methods
2. **Integration Tests**: Test webhook handling and API interactions
3. **Stripe Test Mode**: Use Stripe's test environment for development
4. **Mock Testing**: Mock Stripe SDK for isolated testing

## Deployment Strategy

1. **Feature Flags**: Use environment variables to control rollout
2. **Gradual Migration**: Support both providers during transition period
3. **Rollback Plan**: Keep Adyen code available for emergency rollback
4. **Monitoring**: Monitor payment success rates and error rates

## Risk Mitigation

1. **Data Backup**: Backup existing subscription data before migration
2. **Staged Rollout**: Test with limited user base first
3. **Monitoring**: Real-time monitoring of payment processing
4. **Support Plan**: Have support team ready for user inquiries

## Success Metrics

1. **Payment Success Rate**: Maintain or improve current success rates
2. **Response Times**: API response times within acceptable limits
3. **Error Rates**: Minimize payment processing errors
4. **User Experience**: Seamless subscription management for users

## Timeline Estimate

- **Phase 1 (Stripe Service)**: 3-5 days
- **Phase 2 (Webhook Migration)**: 2-3 days
- **Phase 3 (Service Integration)**: 2-3 days
- **Phase 4 (Cleanup)**: 1-2 days
- **Testing & Validation**: 3-5 days

**Total Estimated Time**: 11-18 days

## Post-Migration Tasks

1. **Documentation Updates**: Update API documentation
2. **Environment Setup Guides**: Update deployment guides with new env vars
3. **Monitoring Setup**: Configure alerts for payment failures
4. **Performance Optimization**: Optimize based on real usage patterns

## Conclusion

This migration will eliminate Adyen dependencies while establishing a robust, scalable Stripe integration. The abstract payment service architecture ensures future payment providers can be easily integrated. The phased approach minimizes risk and ensures a smooth transition for existing users.
