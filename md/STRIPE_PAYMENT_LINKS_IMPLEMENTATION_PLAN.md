# Stripe Payment Links Integration Implementation Plan

## Overview
This document outlines the implementation plan for integrating Stripe Payment Links into the existing n8n subscription system. The integration will provide a simplified checkout experience while maintaining compatibility with the existing payment infrastructure.

## Current State Analysis

### Existing Implementation
- **Frontend**: Custom Stripe Elements integration via `StripeCheckout.vue`
- **Backend**: Comprehensive Stripe service with setup intents, subscriptions, and webhook handling
- **Database**:
  - `UserSubscription` entity for tracking subscription details
  - `PaymentMethod` entity for storing payment method information
- **Flow**: Plan Selection → Custom Checkout → Setup Intent → Payment Confirmation → Subscription Creation

### Key Findings from Stripe API Documentation Review

### Stripe Payment Links API Features
- **Line Items**: Support up to 20 line items for flat rate pricing, 1 for "Customer chooses" pricing
- **After Completion**: Supports redirect URLs and custom messages after payment
- **Promotion Codes**: Built-in support for coupons and promotion codes
- **Address Collection**: Can collect both billing and shipping addresses
- **Custom Text**: Allows custom messaging on the payment page
- **Invoice Creation**: Can automatically create invoices post-payment
- **Subscription Support**: Full support for recurring payments and trial periods
- **Webhook Events**: Triggers `checkout.session.completed` events (same as Checkout Sessions)

### Stripe Checkout Sessions API Integration
- Payment Links create Checkout Sessions behind the scenes
- Sessions support metadata for tracking user and plan information
- Sessions have standard lifecycle: open → complete/expired
- Sessions support automatic tax calculation
- Sessions can be updated with limited fields after creation

## Key Files Analyzed
1. `packages/frontend/editor-ui/src/views/subscription/StripeCheckout.vue` - Current checkout implementation
2. `packages/@n8n/db/src/entities/user-subscription.ts` - Subscription entity
3. `packages/@n8n/db/src/entities/payment-method.ts` - Payment method entity
4. `packages/cli/src/services/payment/stripe-payment.service.ts` - Stripe service
5. `packages/cli/src/controllers/subscription.controller.ts` - Subscription controller

## Implementation Plan

### Phase 1: Backend Payment Links Integration

#### 1.1 Extend Stripe Payment Service
**File**: `packages/cli/src/services/payment/stripe-payment.service.ts`

Add Payment Links functionality:

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
      line_items: [{
        price: params.priceId,
        quantity: params.quantity || 1,
      }],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: params.successUrl
        }
      },
      metadata: params.metadata || {},
    };

    // Add optional features based on Stripe Payment Links API
    if (params.allowPromotionCodes !== undefined) {
      paymentLinkData.allow_promotion_codes = params.allowPromotionCodes;
    }

    if (params.collectBillingAddress !== undefined) {
      paymentLinkData.billing_address_collection = params.collectBillingAddress ? 'required' : 'auto';
    }

    if (params.collectShippingAddress !== undefined) {
      paymentLinkData.shipping_address_collection = {
        allowed_countries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI']
      };
    }

    if (params.customText) {
      paymentLinkData.custom_text = params.customText;
    }

    if (params.invoiceCreation) {
      paymentLinkData.invoice_creation = {
        enabled: true
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
}

async updatePaymentLink(linkId: string, params: {
  active?: boolean;
  metadata?: Record<string, string>;
}): Promise<void> {
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
```

#### 1.2 Update Payment Service Interface
**File**: `packages/cli/src/services/payment/payment-service.interface.ts`

```typescript
// Add to IPaymentService interface
createPaymentLink(params: {
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
}): Promise<{ id: string; url: string }>;

updatePaymentLink(linkId: string, params: {
  active?: boolean;
  metadata?: Record<string, string>;
}): Promise<void>;

retrievePaymentLink(linkId: string): Promise<any>;

listPaymentLinks(params?: {
  limit?: number;
  starting_after?: string;
  ending_before?: string;
  active?: boolean;
}): Promise<any>;
```

#### 1.3 Extend Subscription Service
**File**: `packages/cli/src/services/subscription.service.ts`

Add Payment Links support:

```typescript
async createPaymentLinkForPlan(params: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  userId: string;
  metadata?: Record<string, string>;
}): Promise<{ paymentLinkId: string; url: string }> {
  const plan = await this.subscriptionPlanRepository.findOne({
    where: { id: params.planId }
  });

  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get appropriate price ID based on billing cycle
  const priceId = params.billingCycle === 'yearly'
    ? plan.yearlyStripePrice
    : plan.monthlyStripePrice;

  if (!priceId) {
    throw new Error(`Price ID not configured for ${params.billingCycle} billing`);
  }

  // Create payment link with metadata for tracking
  const metadata = {
    userId: params.userId,
    planId: params.planId,
    billingCycle: params.billingCycle,
    ...params.metadata
  };

  const successUrl = `${process.env.FRONTEND_URL}/subscription/payment-link-success?session_id={CHECKOUT_SESSION_ID}`;

  return await this.paymentService.createPaymentLink({
    priceId,
    metadata,
    successUrl,
    trialDays: plan.trialDays,
    allowPromotionCodes: true, // Enable promotion codes for subscriptions
    collectBillingAddress: true, // Collect billing address for tax calculations
    invoiceCreation: true, // Create invoices for record keeping
  });
}
```

#### 1.4 Update Subscription Controller
**File**: `packages/cli/src/controllers/subscription.controller.ts`

Add new endpoint:

```typescript
@Post('/payment-link')
async createPaymentLink(req: SubscriptionRequest.CreatePaymentLink, res: Response) {
  const { planId, billingCycle } = req.body;
  const userId = req.user.id;

  // Input validation
  if (!planId) {
    const errorDetails = this.handleError(
      new ValidationError('Plan ID is required', 'planId'),
      'createPaymentLink',
    );
    return res.status(errorDetails.status).json({
      error: errorDetails.message,
      code: errorDetails.code,
    });
  }

  if (!billingCycle || !['monthly', 'yearly'].includes(billingCycle)) {
    const errorDetails = this.handleError(
      new ValidationError('Invalid billing cycle. Must be monthly or yearly', 'billingCycle'),
      'createPaymentLink',
    );
    return res.status(errorDetails.status).json({
      error: errorDetails.message,
      code: errorDetails.code,
    });
  }

  try {
    const paymentLink = await this.subscriptionService.createPaymentLinkForPlan({
      planId,
      billingCycle,
      userId,
    });

    this.logger.info(`Payment link created successfully for user ${userId}`, {
      planId,
      billingCycle,
      paymentLinkId: paymentLink.paymentLinkId,
    });

    return res.json(paymentLink);
  } catch (error) {
    const errorDetails = this.handleError(error, 'createPaymentLink');
    return res.status(errorDetails.status).json({
      error: errorDetails.message,
      code: errorDetails.code,
    });
  }
}
```

#### 1.5 Enhanced Webhook Processing
Update webhook handler to process Payment Link events:

```typescript
// In subscription.service.ts
async handleWebhook(provider: string, payload: any, signature: string): Promise<void> {
  const event = await this.paymentService.handleWebhook(payload, signature);

  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'customer.subscription.created':
      await this.handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdated(event.data.object);
      break;
    case 'invoice.payment_succeeded':
      await this.handleInvoicePaymentSucceeded(event.data.object);
      break;
    // Add more webhook handlers as needed
  }
}

private async handleCheckoutSessionCompleted(session: any): Promise<void> {
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const billingCycle = session.metadata?.billingCycle;

  if (!userId || !planId || !billingCycle) {
    this.logger.warn('Missing metadata in checkout session', { sessionId: session.id });
    return;
  }

  // Create or update user subscription
  const subscription = await this.createSubscriptionFromSession({
    userId,
    planId,
    billingCycle,
    stripeSessionId: session.id,
    stripeSubscriptionId: session.subscription,
    stripeCustomerId: session.customer,
  });

  // Update payment method if present
  if (session.payment_method) {
    await this.savePaymentMethodFromSession(userId, session);
  }

  this.logger.info('Subscription created from payment link checkout', {
    userId,
    subscriptionId: subscription.id,
    stripeSessionId: session.id,
  });
}

private async savePaymentMethodFromSession(userId: string, session: any): Promise<void> {
  // Retrieve payment method details from Stripe
  const paymentMethod = await this.paymentService.getPaymentMethod(session.payment_method);

  // Save to payment_method table
  const existingPaymentMethod = await this.paymentMethodRepository.findOne({
    where: {
      userId,
      providerPaymentMethodId: paymentMethod.id
    }
  });

  if (!existingPaymentMethod) {
    const newPaymentMethod = this.paymentMethodRepository.create({
      userId,
      provider: 'stripe',
      type: paymentMethod.type,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      expiryMonth: paymentMethod.card?.exp_month,
      expiryYear: paymentMethod.card?.exp_year,
      providerPaymentMethodId: paymentMethod.id,
      isDefault: true, // Set as default for new subscriptions
      isActive: true,
    });

    await this.paymentMethodRepository.save(newPaymentMethod);
  }
}
```

### Phase 2: Frontend Integration

#### 2.1 Create Payment Links Component
**File**: `packages/frontend/editor-ui/src/views/subscription/PaymentLinks.vue`

```vue
<template>
  <div class="payment-links-container">
    <div class="payment-header">
      <h1>Complete Your Subscription</h1>
      <p v-if="selectedPlan">{{ selectedPlan.name }} - {{ billingCycleDisplay }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-container">
      <n8n-spinner size="large" />
      <p>Preparing your checkout...</p>
    </div>

    <!-- Payment Link Ready -->
    <div v-else-if="paymentLinkUrl" class="payment-link-ready">
      <div class="checkout-options">
        <h3>Choose Your Checkout Method</h3>

        <!-- Payment Link Option -->
        <div class="checkout-option">
          <h4>Quick Checkout (Recommended)</h4>
          <p>Complete your purchase using Stripe's secure checkout page.</p>
          <n8n-button
            @click="redirectToPaymentLink"
            type="primary"
            size="large"
            class="checkout-button"
          >
            <i class="fas fa-external-link-alt"></i>
            Continue to Checkout
          </n8n-button>
        </div>

        <!-- Traditional Checkout Option -->
        <div class="checkout-option">
          <h4>Traditional Checkout</h4>
          <p>Complete your purchase directly on our site.</p>
          <n8n-button
            @click="useTraditionalCheckout"
            type="secondary"
            size="large"
            class="checkout-button"
          >
            Use Traditional Checkout
          </n8n-button>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <div class="error-message">
        <h2>Setup Error</h2>
        <p>{{ error }}</p>
        <n8n-button @click="$router.push('/subscription/plans')" type="secondary">
          Back to Plans
        </n8n-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useToast } from '@/composables/useToast';
import type { SubscriptionPlan } from '@/types/subscription';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();
const toast = useToast();

// State
const isLoading = ref(true);
const error = ref<string>('');
const paymentLinkUrl = ref<string>('');
const selectedPlan = ref<SubscriptionPlan | null>(null);

// Query params
const planId = computed(() => route.query.planId as string);
const billingCycle = computed(
  () => (route.query.billingCycle as 'monthly' | 'yearly') || 'monthly',
);

// Computed
const billingCycleDisplay = computed(() => {
  return billingCycle.value === 'yearly' ? 'Yearly' : 'Monthly';
});

onMounted(async () => {
  await initializePaymentLink();
});

const initializePaymentLink = async () => {
  try {
    isLoading.value = true;

    // Validate required parameters
    if (!planId.value) {
      error.value = 'Plan ID is required';
      return;
    }

    // Load plan details
    selectedPlan.value = await subscriptionStore.getPlanById(planId.value);
    if (!selectedPlan.value) {
      error.value = 'Selected plan not found';
      return;
    }

    // Create payment link
    const response = await subscriptionStore.createPaymentLink({
      planId: planId.value,
      billingCycle: billingCycle.value,
    });

    paymentLinkUrl.value = response.url;
  } catch (err) {
    console.error('Failed to initialize payment link:', err);
    error.value = err instanceof Error ? err.message : 'Failed to initialize payment link';
  } finally {
    isLoading.value = false;
  }
};

const redirectToPaymentLink = () => {
  if (paymentLinkUrl.value) {
    window.location.href = paymentLinkUrl.value;
  }
};

const useTraditionalCheckout = () => {
  router.push({
    path: '/subscription/checkout',
    query: {
      planId: planId.value,
      billingCycle: billingCycle.value,
    },
  });
};
</script>

<style lang="scss" scoped>
.payment-links-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;

  .payment-header {
    text-align: center;
    margin-bottom: 3rem;

    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--color-text-dark);
    }

    p {
      font-size: 1.125rem;
      color: var(--color-text-light);
    }
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 0;

    p {
      color: var(--color-text-light);
    }
  }

  .payment-link-ready {
    .checkout-options {
      h3 {
        text-align: center;
        margin-bottom: 2rem;
        color: var(--color-text-dark);
      }
    }

    .checkout-option {
      border: 1px solid var(--color-foreground-base);
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 1.5rem;
      text-align: center;

      h4 {
        margin-bottom: 0.5rem;
        color: var(--color-text-dark);
      }

      p {
        color: var(--color-text-light);
        margin-bottom: 1.5rem;
      }

      .checkout-button {
        width: 100%;

        i {
          margin-right: 0.5rem;
        }
      }
    }
  }

  .error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;

    .error-message {
      text-align: center;
      max-width: 400px;

      h2 {
        font-size: 1.5rem;
        color: var(--color-danger);
        margin-bottom: 1rem;
      }

      p {
        color: var(--color-text-light);
        margin-bottom: 2rem;
      }
    }
  }
}
</style>
```

#### 2.2 Create Success Page Component
**File**: `packages/frontend/editor-ui/src/views/subscription/PaymentLinkSuccess.vue`

```vue
<template>
  <div class="payment-success-container">
    <div v-if="isLoading" class="loading-container">
      <n8n-spinner size="large" />
      <p>Processing your subscription...</p>
    </div>

    <div v-else-if="subscription" class="success-container">
      <div class="success-message">
        <i class="fas fa-check-circle success-icon"></i>
        <h1>Welcome to {{ subscription.plan.name }}!</h1>
        <p>Your subscription has been successfully activated.</p>

        <div class="subscription-details">
          <h3>Subscription Details</h3>
          <div class="detail-item">
            <span>Plan:</span>
            <span>{{ subscription.plan.name }}</span>
          </div>
          <div class="detail-item">
            <span>Billing Cycle:</span>
            <span>{{ subscription.billingCycle }}</span>
          </div>
          <div class="detail-item">
            <span>Next Billing Date:</span>
            <span>{{ formatDate(subscription.currentPeriodEnd) }}</span>
          </div>
          <div v-if="subscription.trialEnd" class="detail-item">
            <span>Trial Ends:</span>
            <span>{{ formatDate(subscription.trialEnd) }}</span>
          </div>
        </div>

        <div class="action-buttons">
          <n8n-button
            @click="redirectToApplication"
            type="primary"
            size="large"
            class="continue-button"
          >
            Continue to Application
          </n8n-button>

          <n8n-button
            @click="goToSettings"
            type="secondary"
            size="large"
            class="settings-button"
          >
            View Subscription Settings
          </n8n-button>
        </div>
      </div>
    </div>

    <div v-else class="error-container">
      <div class="error-message">
        <h2>Processing Error</h2>
        <p>We're having trouble processing your subscription. Please contact support.</p>
        <n8n-button @click="$router.push('/subscription/plans')" type="secondary">
          Back to Plans
        </n8n-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSubscriptionStore } from '@/stores/subscription.store';
import type { UserSubscription } from '@/types/subscription';

const route = useRoute();
const router = useRouter();
const subscriptionStore = useSubscriptionStore();

// State
const isLoading = ref(true);
const subscription = ref<UserSubscription | null>(null);

onMounted(async () => {
  await processSuccess();
});

const processSuccess = async () => {
  try {
    const sessionId = route.query.session_id as string;

    if (sessionId) {
      // Wait a bit for webhooks to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Fetch current subscription
    subscription.value = await subscriptionStore.getCurrentSubscription();
  } catch (error) {
    console.error('Failed to process success:', error);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString();
};

const redirectToApplication = () => {
  router.push('/workflows');
};

const goToSettings = () => {
  router.push('/settings/usage-and-plan');
};
</script>

<style lang="scss" scoped>
.payment-success-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 0;

    p {
      color: var(--color-text-light);
    }
  }

  .success-container {
    text-align: center;

    .success-message {
      .success-icon {
        font-size: 4rem;
        color: var(--color-success);
        margin-bottom: 1rem;
      }

      h1 {
        font-size: 2.5rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--color-text-dark);
      }

      p {
        font-size: 1.25rem;
        color: var(--color-text-light);
        margin-bottom: 2rem;
      }
    }

    .subscription-details {
      background: var(--color-background-light);
      border: 1px solid var(--color-foreground-base);
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
      text-align: left;

      h3 {
        margin-bottom: 1rem;
        color: var(--color-text-dark);
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--color-foreground-light);

        &:last-child {
          border-bottom: none;
        }

        span:first-child {
          font-weight: 500;
          color: var(--color-text-base);
        }

        span:last-child {
          color: var(--color-text-dark);
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;

      .continue-button,
      .settings-button {
        min-width: 200px;
      }

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: center;

        .continue-button,
        .settings-button {
          width: 100%;
        }
      }
    }
  }

  .error-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;

    .error-message {
      text-align: center;
      max-width: 400px;

      h2 {
        font-size: 1.5rem;
        color: var(--color-danger);
        margin-bottom: 1rem;
      }

      p {
        color: var(--color-text-light);
        margin-bottom: 2rem;
      }
    }
  }
}
</style>
```

#### 2.3 Update Subscription Store
**File**: `packages/frontend/editor-ui/src/stores/subscription.store.ts`

Add Payment Links methods:

```typescript
// Add to subscription store
async createPaymentLink(params: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}): Promise<{ paymentLinkId: string; url: string }> {
  const response = await this.restApi.makeRestApiRequest(
    'POST',
    '/subscriptions/payment-link',
    params
  );
  return response;
}
```

#### 2.4 Update Router Configuration
**File**: `packages/frontend/editor-ui/src/router.ts`

Add new routes:

```typescript
// Add to routes array
{
  path: '/subscription/payment-links',
  name: 'PaymentLinks',
  component: async () => await import('@/views/subscription/PaymentLinks.vue'),
  meta: {
    requiresAuth: true,
  },
},
{
  path: '/subscription/payment-link-success',
  name: 'PaymentLinkSuccess',
  component: async () => await import('@/views/subscription/PaymentLinkSuccess.vue'),
  meta: {
    requiresAuth: true,
  },
},
```

### Phase 3: Request Types & API Integration

#### 3.1 Update Request Types
**File**: `packages/cli/src/requests.ts`

```typescript
// Add to SubscriptionRequest namespace
export namespace SubscriptionRequest {
  // ... existing types

  export type CreatePaymentLink = AuthenticatedRequest<
    {},
    {},
    {
      planId: string;
      billingCycle: 'monthly' | 'yearly';
    }
  >;
}
```

#### 3.2 Update API Types
**File**: `packages/@n8n/api-types/src/dto/index.ts`

Add Payment Link DTOs if needed.

### Phase 4: Database Schema Updates

#### 4.1 Add Payment Link Tracking (Optional)
If needed, create a migration to add payment link tracking:

```sql
-- Migration: Add payment link tracking
ALTER TABLE user_subscription
ADD COLUMN stripe_payment_link_id VARCHAR(255),
ADD COLUMN payment_link_session_id VARCHAR(255);

CREATE INDEX idx_user_subscription_payment_link
ON user_subscription(stripe_payment_link_id);
```

### Phase 5: Configuration & Environment

#### 5.1 Environment Variables
Add to `.env`:

```env
# Payment Links Configuration
FRONTEND_URL=http://localhost:3000
STRIPE_PAYMENT_LINK_SUCCESS_URL=/subscription/payment-link-success
STRIPE_PAYMENT_LINK_CANCEL_URL=/subscription/plans
```

### Phase 6: Testing Strategy

#### 6.1 Unit Tests
- Test Payment Links service methods (create, update, retrieve, list)
- Test webhook processing for `checkout.session.completed`
- Test payment method saving from session
- Test promotion code validation
- Test address collection functionality

#### 6.2 Integration Tests
- Test full Payment Links flow with different pricing models
- Test redirect handling and success page functionality
- Test webhook processing end-to-end
- Test subscription creation with trial periods
- Test invoice creation and delivery
- Test payment link deactivation/reactivation

#### 6.3 Manual Testing
1. **Basic Payment Links**:
   - Create payment link for different plans (monthly/yearly)
   - Complete checkout via payment link
   - Verify subscription creation and activation
   - Test payment method saving and storage

2. **Advanced Features**:
   - Test promotion code application
   - Verify billing address collection
   - Test custom text display on payment page
   - Verify invoice generation post-payment

3. **Error Scenarios**:
   - Test expired payment links
   - Test deactivated payment links
   - Test failed payments and retry flows
   - Test webhook failure scenarios

#### 6.4 Performance Testing
- Test payment link creation performance under load
- Test webhook processing performance
- Monitor payment completion times
- Test concurrent payment processing

## Migration Strategy

### Option 1: Gradual Migration
1. Deploy Payment Links as additional option alongside existing checkout
2. A/B test with percentage of users
3. Gradually increase Payment Links usage
4. Eventually deprecate old checkout

### Option 2: Feature Flag
1. Implement behind feature flag
2. Enable for beta users first
3. Collect feedback and iterate
4. Enable for all users

### Option 3: Plan-Specific
1. Use Payment Links for specific plans
2. Keep existing checkout for complex plans
3. Gradually migrate all plans

## Implementation Timeline

### Week 1-2: Backend Implementation
- Extend Stripe service with Payment Links
- Update subscription service and controller
- Enhance webhook processing
- Add request types

### Week 3: Frontend Implementation
- Create Payment Links components
- Update routing and store
- Implement success flow

### Week 4: Integration & Testing
- End-to-end testing
- Webhook testing
- Performance testing
- Security review

### Week 5: Deployment & Monitoring
- Deploy to staging
- User acceptance testing
- Production deployment
- Monitor success metrics

## Success Metrics

1. **Conversion Rate**: Compare checkout completion rates between Payment Links and traditional checkout
2. **Time to Subscribe**: Measure average time from plan selection to subscription activation
3. **User Experience**:
   - Collect user feedback on Payment Links vs traditional checkout
   - Monitor mobile vs desktop completion rates
   - Track user preference between checkout options
4. **Error Rate**:
   - Monitor payment failures and technical issues
   - Track webhook processing success rates
   - Monitor payment link expiration rates
5. **Support Tickets**: Track reduction in payment-related support requests
6. **Feature Adoption**:
   - Monitor promotion code usage rates
   - Track invoice delivery success rates
   - Measure payment method save rates

## Additional Benefits from API Review

### Enhanced Features Available
- **Automatic Tax Calculation**: Stripe handles tax calculation based on billing address
- **Multiple Payment Methods**: Supports cards, digital wallets, bank transfers, and more
- **Localization**: Payment pages support multiple languages and currencies
- **Mobile Optimization**: Payment Links are optimized for mobile devices
- **Security**: PCI DSS compliant with built-in fraud detection
- **Analytics**: Built-in analytics for payment link performance

### API Limitations Identified
- Payment Links cannot be deleted, only deactivated
- Limited customization compared to full Checkout Sessions
- Subscription modifications require separate API calls
- Customer portal integration requires additional setup

## Risk Mitigation

1. **Fallback Strategy**: Keep existing checkout as backup
2. **Monitoring**: Comprehensive logging and monitoring
3. **Testing**: Extensive testing in staging environment
4. **Rollback Plan**: Quick rollback capabilities
5. **User Communication**: Clear communication about new checkout option

## Conclusion

This implementation plan provides a comprehensive approach to integrating Stripe Payment Links while maintaining the existing functionality. The phased approach allows for careful testing and gradual rollout, minimizing risk while improving the user experience.

The Payment Links integration will provide:
- Simplified checkout experience
- Reduced maintenance overhead
- Better mobile experience
- Enhanced security through Stripe's hosted pages
- Improved conversion rates

Upon successful completion, users will have a choice between Payment Links and traditional checkout, with Payment Links being the recommended option for better user experience.
