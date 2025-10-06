# Subscription Upgrade Implementation Plan

## Overview

This document outlines the implementation plan for creating a subscription upgrade flow in n8n with Stripe payment integration. The flow allows users to view pricing plans from the settings/usage page, select a plan, and complete payment through Stripe Elements.

## Current Architecture Analysis

### Existing Components ✅
- **Database Entities**: UserSubscription, SubscriptionPlan, PaymentMethod, Invoice entities are implemented
- **Backend Services**: SubscriptionService with full CRUD operations
- **API Controllers**: SubscriptionController with all necessary endpoints
- **Stripe Integration**: StripePaymentService with webhook handling
- **Database Migrations**: Complete schema setup with proper indexing

### Implementation Requirements

Based on the task requirements and existing architecture, we need to implement:

1. Frontend Vue components for plan selection and payment flow
2. Integration with Stripe Elements for secure payment processing
3. User flow from `/settings/usage` to plan selection to payment completion
4. Real-time subscription updates after payment completion

## Implementation Plan

### Phase 1: Frontend Plan Selection UI

#### 1.1 Create Vue Components

##### A. Pricing Plans Component (`PricingPlans.vue`)

```vue
<template>
  <div class="pricing-plans-container">
    <div class="pricing-header">
      <h1>Choose Your Plan</h1>
      <p>Select the perfect plan for your workflow automation needs</p>

      <!-- Billing Toggle -->
      <div class="billing-toggle">
        <label class="toggle-label">
          <input
            type="radio"
            value="monthly"
            v-model="billingCycle"
            @change="updatePricing"
          />
          Monthly
        </label>
        <label class="toggle-label">
          <input
            type="radio"
            value="yearly"
            v-model="billingCycle"
            @change="updatePricing"
          />
          <span>Yearly</span>
          <span class="discount-badge">Save 20%</span>
        </label>
      </div>
    </div>

    <!-- Plans Grid -->
    <div class="plans-grid">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ 'popular': plan.isPopular, 'current': isCurrentPlan(plan) }"
      >
        <div class="plan-header">
          <h3>{{ plan.name }}</h3>
          <div class="plan-price">
            <span class="currency">$</span>
            <span class="amount">{{ getPlanPrice(plan) }}</span>
            <span class="period">/{{ billingCycle === 'yearly' ? 'year' : 'month' }}</span>
          </div>
          <div v-if="billingCycle === 'yearly'" class="savings">
            Save ${{ getYearlySavings(plan) }} per year
          </div>
        </div>

        <!-- Features List -->
        <div class="plan-features">
          <ul>
            <li v-if="plan.monthlyExecutionsLimit === -1">
              <CheckIcon />
              Unlimited executions
            </li>
            <li v-else>
              <CheckIcon />
              {{ formatNumber(plan.monthlyExecutionsLimit) }} executions/month
            </li>

            <li>
              <CheckIcon />
              {{ plan.activeWorkflowsLimit }} active workflows
            </li>

            <li>
              <CheckIcon />
              {{ plan.credentialsLimit }} credentials
            </li>

            <li>
              <CheckIcon />
              {{ plan.usersLimit }} team members
            </li>

            <!-- Premium Features -->
            <li v-if="plan.features?.advancedNodes">
              <CheckIcon />
              Advanced nodes
            </li>

            <li v-if="plan.features?.prioritySupport">
              <CheckIcon />
              Priority support
            </li>

            <li v-if="plan.features?.sso">
              <CheckIcon />
              Single Sign-On (SSO)
            </li>

            <li v-if="plan.features?.auditLogs">
              <CheckIcon />
              Audit logs
            </li>
          </ul>
        </div>

        <!-- Action Button -->
        <div class="plan-action">
          <button
            v-if="isCurrentPlan(plan)"
            class="btn btn-current"
            disabled
          >
            Current Plan
          </button>
          <button
            v-else-if="isDowngrade(plan)"
            class="btn btn-secondary"
            @click="confirmDowngrade(plan)"
          >
            Downgrade
          </button>
          <button
            v-else
            class="btn btn-primary"
            @click="selectPlan(plan)"
            :loading="isProcessing"
          >
            {{ isUpgrade(plan) ? 'Upgrade' : 'Get Started' }}
          </button>
        </div>

        <!-- Trial Info -->
        <div v-if="plan.trialDays > 0" class="trial-info">
          {{ plan.trialDays }}-day free trial
        </div>
      </div>
    </div>

    <!-- Feature Comparison -->
    <div class="feature-comparison">
      <button @click="showComparison = !showComparison" class="comparison-toggle">
        {{ showComparison ? 'Hide' : 'Show' }} detailed comparison
      </button>

      <div v-if="showComparison" class="comparison-table">
        <!-- Detailed feature comparison table -->
        <PlanComparisonTable :plans="plans" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useToast } from '@/components/ui/toast'
import CheckIcon from '@/components/icons/CheckIcon.vue'
import PlanComparisonTable from './PlanComparisonTable.vue'

const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const toast = useToast()

const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const showComparison = ref(false)
const isProcessing = ref(false)

const plans = computed(() => subscriptionStore.availablePlans)
const currentSubscription = computed(() => subscriptionStore.currentSubscription)

onMounted(async () => {
  await subscriptionStore.loadAvailablePlans()
  await subscriptionStore.loadCurrentSubscription()
})

const getPlanPrice = (plan: any) => {
  return billingCycle.value === 'yearly'
    ? Math.floor(plan.yearlyPrice / 12).toString()
    : plan.monthlyPrice.toString()
}

const getYearlySavings = (plan: any) => {
  const monthlyTotal = plan.monthlyPrice * 12
  return (monthlyTotal - plan.yearlyPrice).toFixed(0)
}

const isCurrentPlan = (plan: any) => {
  return currentSubscription.value?.planId === plan.id
}

const isUpgrade = (plan: any) => {
  if (!currentSubscription.value) return true
  // Compare plan pricing to determine if it's an upgrade
  const currentPrice = getCurrentPlanPrice()
  const newPrice = billingCycle.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice * 12
  return newPrice > currentPrice
}

const isDowngrade = (plan: any) => {
  if (!currentSubscription.value) return false
  const currentPrice = getCurrentPlanPrice()
  const newPrice = billingCycle.value === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice * 12
  return newPrice < currentPrice
}

const selectPlan = async (plan: any) => {
  isProcessing.value = true

  try {
    // Navigate to payment page with plan details
    await router.push({
      name: 'subscription-checkout',
      query: {
        planId: plan.id,
        billingCycle: billingCycle.value
      }
    })
  } catch (error) {
    toast.error('Failed to proceed to checkout')
  } finally {
    isProcessing.value = false
  }
}

const confirmDowngrade = (plan: any) => {
  // Show confirmation dialog for downgrade
  // Implementation depends on your modal/dialog system
}

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K'
  }
  return num.toString()
}
</script>
```

##### B. Stripe Checkout Component (`StripeCheckout.vue`)

```vue
<template>
  <div class="checkout-container">
    <div class="checkout-header">
      <button @click="goBack" class="back-button">
        <ArrowLeftIcon />
        Back to Plans
      </button>
      <h1>Complete Your Subscription</h1>
    </div>

    <div class="checkout-content">
      <!-- Order Summary -->
      <div class="order-summary">
        <div class="summary-header">
          <h2>Order Summary</h2>
        </div>

        <div class="plan-details">
          <div class="plan-info">
            <h3>{{ selectedPlan?.name }}</h3>
            <p class="plan-description">{{ selectedPlan?.description }}</p>
          </div>

          <div class="plan-pricing">
            <div class="price-line">
              <span>Subtotal:</span>
              <span>${{ planPrice }}</span>
            </div>
            <div class="price-line" v-if="taxAmount > 0">
              <span>Tax:</span>
              <span>${{ taxAmount }}</span>
            </div>
            <div class="price-line total">
              <span>Total:</span>
              <span>${{ totalAmount }}</span>
            </div>
            <div class="billing-period">
              Billed {{ billingCycle }}
            </div>
          </div>
        </div>

        <!-- Features Summary -->
        <div class="features-summary">
          <h4>What's included:</h4>
          <ul>
            <li>{{ formatNumber(selectedPlan?.monthlyExecutionsLimit) }} executions/month</li>
            <li>{{ selectedPlan?.activeWorkflowsLimit }} active workflows</li>
            <li>{{ selectedPlan?.credentialsLimit }} credentials</li>
            <li>{{ selectedPlan?.usersLimit }} team members</li>
          </ul>
        </div>
      </div>

      <!-- Payment Form -->
      <div class="payment-form">
        <form @submit.prevent="handleSubmit">
          <div class="form-section">
            <h3>Payment Information</h3>

            <!-- Stripe Elements Container -->
            <div class="payment-element-container">
              <div id="payment-element" ref="paymentElement">
                <!-- Stripe Elements will be inserted here -->
              </div>
            </div>

            <div v-if="paymentError" class="error-message">
              {{ paymentError }}
            </div>
          </div>

          <!-- Billing Information -->
          <div class="form-section">
            <h3>Billing Information</h3>

            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                id="email"
                type="email"
                v-model="billingInfo.email"
                :disabled="true"
                class="form-input"
              />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  v-model="billingInfo.firstName"
                  required
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  v-model="billingInfo.lastName"
                  required
                  class="form-input"
                />
              </div>
            </div>
          </div>

          <!-- Terms and Conditions -->
          <div class="form-section">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="agreedToTerms"
                required
              />
              I agree to the <a href="/terms" target="_blank">Terms of Service</a> and
              <a href="/privacy" target="_blank">Privacy Policy</a>
            </label>
          </div>

          <!-- Submit Button -->
          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary btn-large"
              :disabled="!canSubmit"
              :loading="isProcessing"
            >
              <span v-if="selectedPlan?.trialDays > 0">
                Start {{ selectedPlan.trialDays }}-Day Free Trial
              </span>
              <span v-else>
                Subscribe Now - ${{ totalAmount }}/{{ billingCycle.slice(0, -2) }}
              </span>
            </button>

            <p class="security-notice">
              <LockIcon />
              Your payment information is secure and encrypted
            </p>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useUserStore } from '@/stores/user.store'
import { useToast } from '@/components/ui/toast'
import ArrowLeftIcon from '@/components/icons/ArrowLeftIcon.vue'
import LockIcon from '@/components/icons/LockIcon.vue'

const route = useRoute()
const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const userStore = useUserStore()
const toast = useToast()

const stripe = ref<Stripe | null>(null)
const elements = ref<any>(null)
const paymentElement = ref<HTMLElement>()

const selectedPlan = ref<any>(null)
const billingCycle = ref<'monthly' | 'yearly'>('monthly')
const clientSecret = ref<string>('')
const paymentError = ref<string>('')
const isProcessing = ref(false)
const agreedToTerms = ref(false)

const billingInfo = ref({
  email: '',
  firstName: '',
  lastName: ''
})

onMounted(async () => {
  // Initialize user info
  billingInfo.value.email = userStore.currentUser?.email || ''
  billingInfo.value.firstName = userStore.currentUser?.firstName || ''
  billingInfo.value.lastName = userStore.currentUser?.lastName || ''

  // Get plan from query params
  const planId = route.query.planId as string
  billingCycle.value = (route.query.billingCycle as 'monthly' | 'yearly') || 'monthly'

  if (planId) {
    selectedPlan.value = await subscriptionStore.getPlanById(planId)
    if (selectedPlan.value) {
      await initializeStripe()
    }
  }

  if (!selectedPlan.value) {
    toast.error('Invalid plan selected')
    router.push('/settings/usage')
  }
})

const planPrice = computed(() => {
  if (!selectedPlan.value) return 0
  return billingCycle.value === 'yearly'
    ? selectedPlan.value.yearlyPrice
    : selectedPlan.value.monthlyPrice
})

const taxAmount = computed(() => {
  // Calculate tax based on location/plan price
  // This would typically be calculated server-side
  return 0
})

const totalAmount = computed(() => {
  return planPrice.value + taxAmount.value
})

const canSubmit = computed(() => {
  return agreedToTerms.value &&
         !isProcessing.value &&
         billingInfo.value.firstName &&
         billingInfo.value.lastName &&
         elements.value
})

const initializeStripe = async () => {
  try {
    // Load Stripe
    stripe.value = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

    if (!stripe.value) {
      throw new Error('Failed to load Stripe')
    }

    // Create setup intent for subscription
    const response = await subscriptionStore.createSubscriptionSetup({
      planId: selectedPlan.value.id,
      billingCycle: billingCycle.value
    })

    clientSecret.value = response.clientSecret

    // Initialize Stripe Elements for setup intent
    elements.value = stripe.value.elements({
      clientSecret: clientSecret.value,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#0070f3',
          colorBackground: '#ffffff',
          colorText: '#333333',
          borderRadius: '4px'
        }
      }
    })

    const paymentElementOptions = {
      layout: 'tabs',
      paymentMethodOrder: ['card'],
      fields: {
        billingDetails: 'auto'
      }
    }

    const paymentElementInstance = elements.value.create('payment', paymentElementOptions)

    await nextTick()
    if (paymentElement.value) {
      paymentElementInstance.mount(paymentElement.value)
    }

  } catch (error) {
    console.error('Failed to initialize Stripe:', error)
    paymentError.value = 'Failed to initialize payment form'
  }
}

const handleSubmit = async () => {
  if (!stripe.value || !elements.value || isProcessing.value) return

  isProcessing.value = true
  paymentError.value = ''

  try {
    // Confirm setup intent to save payment method
    const { error, setupIntent } = await stripe.value.confirmSetup({
      elements: elements.value,
      confirmParams: {
        return_url: `${window.location.origin}/subscription/success`,
        payment_method_data: {
          billing_details: {
            email: billingInfo.value.email,
            name: `${billingInfo.value.firstName} ${billingInfo.value.lastName}`
          }
        }
      },
      redirect: 'if_required'
    })

    if (error) {
      paymentError.value = error.message || 'Payment setup failed'
      return
    }

    if (setupIntent?.status === 'succeeded' && setupIntent.payment_method) {
      // Setup succeeded - create recurring subscription
      await subscriptionStore.createRecurringSubscription({
        planId: selectedPlan.value.id,
        billingCycle: billingCycle.value,
        paymentMethodId: setupIntent.payment_method as string
      })

      toast.success('Subscription created successfully!')
      router.push('/subscription/success')
    }

  } catch (error) {
    console.error('Subscription creation error:', error)
    paymentError.value = 'An unexpected error occurred'
  } finally {
    isProcessing.value = false
  }
}

const goBack = () => {
  router.push('/settings/usage')
}

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K'
  }
  return num.toString()
}
</script>
```

#### 1.2 Update Settings/Usage Page

Modify the existing settings/usage page to include the "View Plans" button:

```vue
<!-- Add to existing SettingsUsage.vue -->
<template>
  <div class="settings-usage">
    <!-- Existing usage content -->

    <div class="usage-actions">
      <button
        @click="viewPlans"
        class="btn btn-primary"
      >
        View Plans
      </button>
    </div>
  </div>
</template>

<script>
const viewPlans = () => {
  router.push('/subscription/plans')
}
</script>
```

### Phase 2: Subscription Store Implementation

#### 2.1 Create Pinia Store (`subscription.store.ts`)

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  SubscriptionPlan,
  UserSubscription,
  PaymentMethod,
  Invoice
} from '@/types/subscription'

export const useSubscriptionStore = defineStore('subscription', () => {
  // State
  const currentSubscription = ref<UserSubscription | null>(null)
  const availablePlans = ref<SubscriptionPlan[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const invoices = ref<Invoice[]>([])
  const usage = ref<any>(null)
  const isLoading = ref(false)

  // Getters
  const isSubscribed = computed(() => {
    return currentSubscription.value?.isActive ?? false
  })

  const currentPlan = computed(() => {
    return currentSubscription.value?.plan
  })

  const trialDaysRemaining = computed(() => {
    if (!currentSubscription.value?.isTrialing) return 0
    const now = new Date()
    const trialEnd = new Date(currentSubscription.value.trialEnd!)
    const diffTime = trialEnd.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  })

  // Actions
  const loadAvailablePlans = async () => {
    try {
      isLoading.value = true
      const response = await fetch('/api/subscriptions/plans')
      availablePlans.value = await response.json()
    } catch (error) {
      console.error('Failed to load plans:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const loadCurrentSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions/current')
      if (response.ok) {
        currentSubscription.value = await response.json()
      }
    } catch (error) {
      console.error('Failed to load current subscription:', error)
    }
  }

  const getPlanById = async (planId: string) => {
    const plan = availablePlans.value.find(p => p.id === planId)
    if (plan) return plan

    // If not in cache, fetch from API
    try {
      const response = await fetch(`/api/subscriptions/plans/${planId}`)
      return await response.json()
    } catch (error) {
      console.error('Failed to get plan:', error)
      return null
    }
  }

  const createSubscriptionSetup = async (params: {
    planId: string
    billingCycle: 'monthly' | 'yearly'
  }) => {
    try {
      const response = await fetch('/api/subscriptions/create-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        throw new Error('Failed to create subscription setup')
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create subscription setup:', error)
      throw error
    }
  }

  const createRecurringSubscription = async (params: {
    planId: string
    billingCycle: 'monthly' | 'yearly'
    paymentMethodId: string
  }) => {
    try {
      const response = await fetch('/api/subscriptions/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create subscription')
      }

      currentSubscription.value = await response.json()
      return currentSubscription.value
    } catch (error) {
      console.error('Failed to create subscription:', error)
      throw error
    }
  }

  const upgradeSubscription = async (planId: string) => {
    try {
      const response = await fetch('/api/subscriptions/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planId })
      })

      if (!response.ok) {
        throw new Error('Failed to upgrade subscription')
      }

      currentSubscription.value = await response.json()
      return currentSubscription.value
    } catch (error) {
      console.error('Failed to upgrade subscription:', error)
      throw error
    }
  }

  const cancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cancelAtPeriodEnd })
      })

      if (!response.ok) {
        throw new Error('Failed to cancel subscription')
      }

      currentSubscription.value = await response.json()
      return currentSubscription.value
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      throw error
    }
  }

  const loadUsageData = async () => {
    try {
      const response = await fetch('/api/subscriptions/usage')
      usage.value = await response.json()
    } catch (error) {
      console.error('Failed to load usage data:', error)
    }
  }

  const loadPaymentMethods = async () => {
    try {
      const response = await fetch('/api/billing/payment-methods')
      paymentMethods.value = await response.json()
    } catch (error) {
      console.error('Failed to load payment methods:', error)
    }
  }

  const loadInvoices = async () => {
    try {
      const response = await fetch('/api/billing/invoices')
      invoices.value = await response.json()
    } catch (error) {
      console.error('Failed to load invoices:', error)
    }
  }

  return {
    // State
    currentSubscription,
    availablePlans,
    paymentMethods,
    invoices,
    usage,
    isLoading,

    // Getters
    isSubscribed,
    currentPlan,
    trialDaysRemaining,

    // Actions
    loadAvailablePlans,
    loadCurrentSubscription,
    getPlanById,
    createSubscriptionSetup,
    createRecurringSubscription,
    upgradeSubscription,
    cancelSubscription,
    loadUsageData,
    loadPaymentMethods,
    loadInvoices
  }
})
```

### Phase 3: Backend API Extensions

#### 3.1 Add Payment Intent Endpoint

```typescript
// Add to SubscriptionController
@Post('/create-payment-intent')
async createPaymentIntent(req: SubscriptionRequest.CreatePaymentIntent, res: Response) {
  const { planId, billingCycle } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    const paymentIntent = await this.subscriptionService.createPaymentIntent({
      userId,
      planId,
      billingCycle,
      userEmail
    });

    return res.json(paymentIntent);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
```

#### 3.2 Update SubscriptionService

```typescript
// Add to SubscriptionService
async createSubscriptionSetup(params: {
  userId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  userEmail: string;
}) {
  const { userId, planId, billingCycle, userEmail } = params;

  const plan = await this.subscriptionPlanRepository.findById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Get the Stripe price ID based on billing cycle
  const stripePriceId = billingCycle === 'yearly' ? plan.priceIdYearly : plan.priceIdMonthly;

  if (!stripePriceId) {
    throw new Error(`No Stripe price ID configured for plan '${plan.slug}' with ${billingCycle} billing`);
  }

  // Create or get Stripe customer
  let customerId = await this.getOrCreateStripeCustomer(userId, userEmail);

  // Create setup intent for collecting payment method
  const setupIntent = await this.paymentService.createSetupIntent({
    customerId,
    metadata: {
      userId,
      planId,
      billingCycle,
      stripePriceId
    }
  });

  return {
    clientSecret: setupIntent.client_secret,
    customerId,
    stripePriceId,
    planName: plan.name,
    amount: billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
  };
}

async createRecurringSubscription(params: {
  userId: string;
  customerId: string;
  stripePriceId: string;
  paymentMethodId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}) {
  const { userId, customerId, stripePriceId, paymentMethodId, planId, billingCycle } = params;

  const plan = await this.subscriptionPlanRepository.findById(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }

  // Check if user already has an active subscription
  const existingSubscription = await this.userSubscriptionRepository.findActiveByUserId(userId);
  if (existingSubscription) {
    throw new Error('User already has an active subscription');
  }

  try {
    // Attach payment method to customer
    await this.paymentService.attachPaymentMethod(paymentMethodId, customerId);

    // Create recurring subscription in Stripe
    const stripeSubscription = await this.paymentService.createSubscription({
      customerId,
      priceId: stripePriceId,
      paymentMethodId,
      trialDays: plan.trialDays || undefined,
      metadata: {
        userId,
        planId
      }
    });

    // Create subscription record in database
    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    const subscription = this.userSubscriptionRepository.create({
      userId,
      planId: plan.id,
      status: stripeSubscription.status as any,
      billingCycle,
      amount,
      currency: 'USD',
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      metadata: {
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: customerId
      }
    });

    const savedSubscription = await this.userSubscriptionRepository.save(subscription);

    this.logger.info(`Recurring subscription created for user ${userId}`, {
      subscriptionId: savedSubscription.id,
      stripeSubscriptionId: stripeSubscription.id,
      planSlug: plan.slug,
      billingCycle,
      amount
    });

    return savedSubscription;
  } catch (error) {
    this.logger.error('Failed to create recurring subscription:', error);
    throw error;
  }
}

private async getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  // Check if user already has a Stripe customer ID
  const existingSubscription = await this.userSubscriptionRepository.findByUserId(userId);

  if (existingSubscription?.stripeCustomerId) {
    return existingSubscription.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await this.paymentService.createCustomer({
    id: userId,
    email
  });

  return customer.id;
}
```

### Phase 4: Stripe Recurring Subscription Integration

#### 4.1 Environment Configuration

```env
# Add to .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

#### 4.2 Stripe Service Enhancement

```typescript
// Add to StripePaymentService
async createSetupIntent(params: {
  customerId: string;
  metadata: Record<string, string>;
}) {
  return await this.stripe.setupIntents.create({
    customer: params.customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
    metadata: params.metadata
  });
}

async createSubscription(params: {
  customerId: string;
  priceId: string;
  paymentMethodId: string;
  trialDays?: number;
  metadata: Record<string, string>;
}) {
  const subscriptionParams: any = {
    customer: params.customerId,
    items: [{ price: params.priceId }],
    default_payment_method: params.paymentMethodId,
    metadata: params.metadata,
    expand: ['latest_invoice.payment_intent'],
  };

  // Add trial period if specified
  if (params.trialDays && params.trialDays > 0) {
    const trialEnd = Math.floor(Date.now() / 1000) + (params.trialDays * 24 * 60 * 60);
    subscriptionParams.trial_end = trialEnd;
  }

  return await this.stripe.subscriptions.create(subscriptionParams);
}

async attachPaymentMethod(paymentMethodId: string, customerId: string) {
  return await this.stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId
  });
}

async updateSubscription(subscriptionId: string, params: { priceId: string }) {
  // Get current subscription
  const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);

  return await this.stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: params.priceId,
      }
    ],
    proration_behavior: 'always_invoice',
  });
}

async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
  } else {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }
}
```

### Phase 5: Router Configuration

#### 5.1 Add New Routes

```typescript
// Add to router/index.ts
const routes = [
  // ... existing routes

  {
    path: '/subscription',
    name: 'subscription',
    children: [
      {
        path: 'plans',
        name: 'subscription-plans',
        component: () => import('@/views/subscription/PricingPlans.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'checkout',
        name: 'subscription-checkout',
        component: () => import('@/views/subscription/StripeCheckout.vue'),
        meta: { requiresAuth: true }
      },
      {
        path: 'success',
        name: 'subscription-success',
        component: () => import('@/views/subscription/SubscriptionSuccess.vue'),
        meta: { requiresAuth: true }
      }
    ]
  }
]
```

#### 5.2 Success Page Component

```vue
<!-- SubscriptionSuccess.vue -->
<template>
  <div class="subscription-success">
    <div class="success-container">
      <div class="success-icon">
        <CheckCircleIcon />
      </div>

      <h1>Welcome to {{ planName }}!</h1>
      <p class="success-message">
        Your subscription has been successfully activated. You can now enjoy all the features of your plan.
      </p>

      <div class="subscription-details">
        <div class="detail-card">
          <h3>Your Plan</h3>
          <p>{{ planName }}</p>
          <p class="plan-price">${{ planPrice }}/{{ billingCycle }}</p>
        </div>

        <div class="detail-card">
          <h3>Next Billing Date</h3>
          <p>{{ nextBillingDate }}</p>
        </div>

        <div v-if="trialEndDate" class="detail-card">
          <h3>Free Trial</h3>
          <p>Ends {{ trialEndDate }}</p>
        </div>
      </div>

      <div class="action-buttons">
        <router-link to="/workflows" class="btn btn-primary">
          Start Building Workflows
        </router-link>
        <router-link to="/settings/billing" class="btn btn-secondary">
          Manage Subscription
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription.store'
import CheckCircleIcon from '@/components/icons/CheckCircleIcon.vue'

const subscriptionStore = useSubscriptionStore()

const planName = ref('')
const planPrice = ref(0)
const billingCycle = ref('')
const nextBillingDate = ref('')
const trialEndDate = ref('')

onMounted(async () => {
  await subscriptionStore.loadCurrentSubscription()
  const subscription = subscriptionStore.currentSubscription

  if (subscription) {
    planName.value = subscription.plan.name
    planPrice.value = subscription.amount
    billingCycle.value = subscription.billingCycle
    nextBillingDate.value = new Date(subscription.currentPeriodEnd).toLocaleDateString()

    if (subscription.trialEnd) {
      trialEndDate.value = new Date(subscription.trialEnd).toLocaleDateString()
    }
  }
})
</script>
```

### Phase 6: Webhook Processing Enhancement

#### 6.1 Enhanced Webhook Controller

```typescript
// Add to existing webhook endpoint in SubscriptionController
@Post('/webhooks/stripe')
async handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'] as string;
  const payload = req.body;

  try {
    await this.subscriptionService.handleWebhook('stripe', payload, signature);
    return res.json({ received: true });
  } catch (error) {
    this.logger.error('Webhook processing failed:', error);
    return res.status(400).json({ error: 'Webhook processing failed' });
  }
}
```

#### 6.2 Complete Webhook Event Handlers

```typescript
// Add to SubscriptionService
private async handleSubscriptionCreated(subscription: any) {
  const stripeSubscriptionId = subscription.id;
  const customerId = subscription.customer;

  // Find user by Stripe customer ID
  const userSubscription = await this.userSubscriptionRepository.findByStripeCustomerId(customerId);

  if (userSubscription) {
    userSubscription.stripeSubscriptionId = stripeSubscriptionId;
    userSubscription.status = subscription.status;
    userSubscription.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    userSubscription.currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    if (subscription.trial_end) {
      userSubscription.trialEnd = new Date(subscription.trial_end * 1000);
    }

    await this.userSubscriptionRepository.save(userSubscription);
    this.logger.info(`Subscription synchronized: ${stripeSubscriptionId}`);
  }
}

private async handlePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription;
  const userSubscription = await this.userSubscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (userSubscription) {
    // Create invoice record
    await this.createInvoiceRecord({
      userId: userSubscription.userId,
      subscriptionId: userSubscription.id,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_paid / 100, // Convert from cents
      currency: invoice.currency,
      status: invoice.status,
      paidAt: new Date(invoice.status_transitions.paid_at * 1000)
    });

    // Update subscription status if it was past_due
    if (userSubscription.status === 'past_due') {
      userSubscription.status = 'active';
      await this.userSubscriptionRepository.save(userSubscription);
    }
  }
}

private async handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  const userSubscription = await this.userSubscriptionRepository.findByStripeSubscriptionId(subscriptionId);

  if (userSubscription) {
    userSubscription.status = 'past_due';
    await this.userSubscriptionRepository.save(userSubscription);

    // Send notification email to user
    await this.sendPaymentFailedNotification(userSubscription.userId);
  }
}

private async createInvoiceRecord(params: {
  userId: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: Date;
}) {
  const invoice = this.invoiceRepository.create({
    ...params,
    invoiceNumber: this.generateInvoiceNumber(),
    subtotal: params.amount,
    total: params.amount
  });

  await this.invoiceRepository.save(invoice);
}
```

### Phase 7: CSS Styling Framework

#### 7.1 Plan Card Styles

```scss
// subscription-plans.scss
.pricing-plans-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;

  .pricing-header {
    text-align: center;
    margin-bottom: 3rem;

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: var(--color-text-dark);
    }

    p {
      font-size: 1.125rem;
      color: var(--color-text-light);
      margin-bottom: 2rem;
    }
  }

  .billing-toggle {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;

    .toggle-label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border: 2px solid var(--color-border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:has(input:checked) {
        border-color: var(--color-primary);
        background-color: var(--color-primary-light);
      }

      input[type="radio"] {
        display: none;
      }

      .discount-badge {
        background-color: var(--color-success);
        color: white;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        margin-left: 0.5rem;
      }
    }
  }

  .plans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .plan-card {
    border: 2px solid var(--color-border);
    border-radius: 12px;
    padding: 2rem;
    position: relative;
    transition: all 0.3s ease;
    background: white;

    &:hover {
      border-color: var(--color-primary);
      transform: translateY(-4px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    }

    &.popular {
      border-color: var(--color-primary);

      &::before {
        content: "Most Popular";
        position: absolute;
        top: -1px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--color-primary);
        color: white;
        padding: 0.5rem 1.5rem;
        border-radius: 0 0 8px 8px;
        font-size: 0.875rem;
        font-weight: 600;
      }
    }

    &.current {
      border-color: var(--color-success);
      background-color: var(--color-success-light);
    }
  }

  .plan-header {
    text-align: center;
    margin-bottom: 2rem;

    h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .plan-price {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 0.25rem;
      margin-bottom: 0.5rem;

      .currency {
        font-size: 1.25rem;
        color: var(--color-text-light);
      }

      .amount {
        font-size: 3rem;
        font-weight: 700;
        color: var(--color-primary);
      }

      .period {
        font-size: 1rem;
        color: var(--color-text-light);
      }
    }

    .savings {
      color: var(--color-success);
      font-size: 0.875rem;
      font-weight: 500;
    }
  }

  .plan-features {
    margin-bottom: 2rem;

    ul {
      list-style: none;
      padding: 0;

      li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-border-light);

        &:last-child {
          border-bottom: none;
        }

        svg {
          color: var(--color-success);
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
      }
    }
  }

  .plan-action {
    text-align: center;

    .btn {
      width: 100%;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;

      &.btn-primary {
        background: var(--color-primary);
        color: white;

        &:hover {
          background: var(--color-primary-dark);
          transform: translateY(-1px);
        }
      }

      &.btn-secondary {
        background: var(--color-background-light);
        color: var(--color-text);
        border: 1px solid var(--color-border);

        &:hover {
          background: var(--color-background-medium);
        }
      }

      &.btn-current {
        background: var(--color-success);
        color: white;
        cursor: not-allowed;
      }
    }
  }

  .trial-info {
    text-align: center;
    margin-top: 1rem;
    color: var(--color-text-light);
    font-size: 0.875rem;
  }
}
```

#### 7.2 Checkout Form Styles

```scss
// stripe-checkout.scss
.checkout-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;

  .checkout-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;

    .back-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--color-background-light);
      }
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0;
    }
  }

  .checkout-content {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 3rem;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }

  .order-summary {
    background: var(--color-background-light);
    border-radius: 12px;
    padding: 2rem;
    height: fit-content;

    .summary-header {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;

      h2 {
        margin: 0;
        font-size: 1.5rem;
      }
    }

    .plan-details {
      margin-bottom: 2rem;
    }

    .plan-info {
      margin-bottom: 1.5rem;

      h3 {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
      }

      .plan-description {
        color: var(--color-text-light);
        margin: 0;
      }
    }

    .plan-pricing {
      .price-line {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.75rem;

        &.total {
          font-weight: 700;
          font-size: 1.125rem;
          border-top: 1px solid var(--color-border);
          padding-top: 0.75rem;
        }
      }

      .billing-period {
        color: var(--color-text-light);
        font-size: 0.875rem;
        margin-top: 0.5rem;
      }
    }

    .features-summary {
      h4 {
        margin: 0 0 1rem;
        font-size: 1rem;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0;

        li {
          padding: 0.25rem 0;
          color: var(--color-text-light);
          font-size: 0.875rem;
        }
      }
    }
  }

  .payment-form {
    .form-section {
      margin-bottom: 2rem;

      h3 {
        margin: 0 0 1.5rem;
        font-size: 1.25rem;
      }
    }

    .payment-element-container {
      margin-bottom: 1rem;

      #payment-element {
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: white;
      }
    }

    .error-message {
      color: var(--color-danger);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .form-group {
      margin-bottom: 1rem;

      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--color-text-dark);
      }
    }

    .form-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      font-size: 1rem;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
      }

      &:disabled {
        background-color: var(--color-background-light);
        color: var(--color-text-light);
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .checkbox-label {
      display: flex;
      align-items: start;
      gap: 0.75rem;
      margin-bottom: 2rem;

      input[type="checkbox"] {
        margin-top: 0.25rem;
      }

      a {
        color: var(--color-primary);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .form-actions {
      text-align: center;

      .btn-large {
        width: 100%;
        padding: 1rem 2rem;
        font-size: 1.125rem;
        border-radius: 8px;
        margin-bottom: 1rem;
      }

      .security-notice {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: var(--color-text-light);
        font-size: 0.875rem;
        margin: 0;

        svg {
          width: 16px;
          height: 16px;
        }
      }
    }
  }
}
```

### Phase 8: Testing Strategy

#### 8.1 Unit Tests

```typescript
// subscription.service.spec.ts
describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockStripeService: jest.Mocked<StripePaymentService>;
  let mockSubscriptionRepository: jest.Mocked<UserSubscriptionRepository>;

  beforeEach(() => {
    // Setup mocks and service instance
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      // Test subscription creation flow
    });

    it('should handle payment failure gracefully', async () => {
      // Test payment failure handling
    });
  });

  describe('handleWebhook', () => {
    it('should process subscription.created webhook', async () => {
      // Test webhook processing
    });
  });
});
```

#### 8.2 Integration Tests

```typescript
// subscription-flow.e2e.spec.ts
describe('Subscription Flow', () => {
  it('should complete subscription upgrade flow', async () => {
    // Test complete flow from plan selection to payment completion
  });

  it('should handle Stripe payment errors', async () => {
    // Test error handling in payment flow
  });
});
```

### Phase 9: Deployment Checklist

#### 9.1 Environment Setup

- [ ] Configure Stripe API keys in production environment
- [ ] Set up Stripe webhook endpoints
- [ ] Configure DNS for payment success/failure redirects
- [ ] Test webhook signature verification

#### 9.2 Database Migration

- [ ] Run subscription table migrations
- [ ] Seed initial subscription plans
- [ ] Verify indexes are created properly
- [ ] Test data relationships

#### 9.3 Frontend Build

- [ ] Install Stripe.js dependencies
- [ ] Configure environment variables
- [ ] Build and test payment components
- [ ] Verify responsive design on mobile

#### 9.4 Security Verification

- [ ] Validate webhook signature verification
- [ ] Test CSRF protection on payment endpoints
- [ ] Verify PCI compliance for payment forms
- [ ] Test rate limiting on subscription endpoints

### Phase 10: Monitoring & Analytics

#### 10.1 Key Metrics to Track

- Subscription conversion rates
- Payment failure rates
- Trial-to-paid conversion
- Plan upgrade/downgrade rates
- Customer lifetime value

#### 10.2 Error Monitoring

- Webhook processing failures
- Payment intent creation failures
- Subscription sync issues
- Frontend JavaScript errors

### Phase 11: User Documentation

#### 11.1 Help Articles

- How to upgrade your subscription
- Understanding billing cycles
- Managing payment methods
- Canceling your subscription

#### 11.2 Admin Documentation

- Stripe webhook configuration
- Troubleshooting payment issues
- Managing subscription plans
- Understanding subscription metrics

## Conclusion

This comprehensive implementation plan provides a complete subscription upgrade flow that integrates seamlessly with the existing n8n architecture. The solution leverages Stripe Elements for secure payment processing and includes robust error handling, webhook processing, and user experience considerations.

The implementation follows industry best practices for payment processing, includes comprehensive testing strategies, and provides clear deployment guidelines. The modular approach allows for gradual rollout and easy maintenance.

Key benefits of this implementation:
- **Secure**: Uses Stripe Elements for PCI-compliant payment processing
- **User-friendly**: Intuitive pricing page similar to n8n.io/pricing
- **Robust**: Comprehensive error handling and webhook processing
- **Scalable**: Built on existing architecture with proper separation of concerns
- **Maintainable**: Clear code organization and comprehensive documentation
