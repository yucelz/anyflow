# N8N Subscription Model Architecture

## Overview
This document outlines the comprehensive architecture for implementing a subscription-based billing system for n8n, compatible with Square, Stripe, and PayPal payment processors.

## Current Architecture Analysis

### Existing Components
1. **Cloud Plan Store** (`cloudPlan.store.ts`): Manages trial/plan data and usage tracking
2. **User Management**: Complete user system with roles, authentication, and verification
3. **Database Entities**: Well-structured TypeORM entities for users, projects, and settings
4. **Frontend**: Vue.js with Pinia stores and component-based architecture

### Current Limitations
- No subscription management beyond trials
- No payment processing integration
- No billing history or invoice management
- Limited plan flexibility

## Proposed Subscription Architecture

### 1. Database Schema Design

#### New Entities

##### Subscription Plans Entity
```typescript
@Entity()
export class SubscriptionPlan extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // 'starter', 'pro', 'enterprise'

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  monthlyPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  yearlyPrice: number;

  @Column('int')
  monthlyExecutionsLimit: number;

  @Column('int')
  activeWorkflowsLimit: number;

  @Column('int')
  credentialsLimit: number;

  @Column('int')
  usersLimit: number;

  @JsonColumn({ nullable: true })
  features: {
    advancedNodes: boolean;
    prioritySupport: boolean;
    sso: boolean;
    auditLogs: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
```

##### User Subscriptions Entity
```typescript
@Entity()
export class UserSubscription extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column()
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';

  @Column()
  billingCycle: 'monthly' | 'yearly';

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  currency: string; // 'USD', 'EUR', etc.

  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelAtPeriodEnd: boolean;

  // Payment processor specific data
  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  paypalSubscriptionId: string;

  @Column({ nullable: true })
  squareSubscriptionId: string;

  @JsonColumn({ nullable: true })
  metadata: Record<string, any>;
}
```

##### Payment Methods Entity
```typescript
@Entity()
export class PaymentMethod extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  provider: 'stripe' | 'paypal' | 'square';

  @Column()
  type: 'card' | 'bank_account' | 'paypal_account';

  @Column({ nullable: true })
  last4: string;

  @Column({ nullable: true })
  brand: string; // 'visa', 'mastercard', etc.

  @Column({ nullable: true })
  expiryMonth: number;

  @Column({ nullable: true })
  expiryYear: number;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  @Column()
  providerPaymentMethodId: string;

  @JsonColumn({ nullable: true })
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}
```

##### Invoices Entity
```typescript
@Entity()
export class Invoice extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  invoiceNumber: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => UserSubscription, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: UserSubscription;

  @Column()
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column()
  currency: string;

  @Column({ type: 'timestamp' })
  dueDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @JsonColumn()
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;

  @Column({ nullable: true })
  stripeInvoiceId: string;

  @Column({ nullable: true })
  paypalInvoiceId: string;

  @Column({ nullable: true })
  squareInvoiceId: string;
}
```

##### Usage Tracking Entity
```typescript
@Entity()
export class UsageTracking extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  date: Date;

  @Column('int', { default: 0 })
  executionsCount: number;

  @Column('int', { default: 0 })
  activeWorkflowsCount: number;

  @Column('int', { default: 0 })
  credentialsCount: number;

  @Index(['userId', 'date'], { unique: true })
  userDateIndex: any;
}
```

### 2. Service Layer Architecture

#### Payment Service Interface
```typescript
export interface IPaymentService {
  createCustomer(user: User): Promise<string>;
  createSubscription(customerId: string, planId: string, paymentMethodId: string): Promise<any>;
  updateSubscription(subscriptionId: string, planId: string): Promise<any>;
  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<any>;
  createPaymentMethod(customerId: string, paymentData: any): Promise<any>;
  processPayment(amount: number, currency: string, paymentMethodId: string): Promise<any>;
  createInvoice(customerId: string, items: any[]): Promise<any>;
  getSubscription(subscriptionId: string): Promise<any>;
  handleWebhook(payload: any, signature: string): Promise<any>;
}
```

#### Concrete Payment Service Implementations
```typescript
// Stripe Service
export class StripePaymentService implements IPaymentService {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey);
  }

  async createCustomer(user: User): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user.id }
    });
    return customer.id;
  }

  // ... other methods
}

// PayPal Service
export class PayPalPaymentService implements IPaymentService {
  // PayPal implementation
}

// Square Service
export class SquarePaymentService implements IPaymentService {
  // Square implementation
}
```

#### Subscription Service
```typescript
export class SubscriptionService {
  constructor(
    private subscriptionRepository: Repository<UserSubscription>,
    private planRepository: Repository<SubscriptionPlan>,
    private paymentService: IPaymentService,
    private usageService: UsageService
  ) {}

  async createSubscription(userId: string, planId: string, paymentMethodId: string): Promise<UserSubscription> {
    // Implementation
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<UserSubscription> {
    // Implementation
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<UserSubscription> {
    // Implementation
  }

  async checkUsageLimits(userId: string): Promise<{
    executionsLeft: number;
    workflowsLeft: number;
    credentialsLeft: number;
  }> {
    // Implementation
  }
}
```

### 3. API Layer Design

#### Controllers
```typescript
@Controller('subscriptions')
export class SubscriptionController {
  @Get('plans')
  async getPlans(): Promise<SubscriptionPlan[]> {
    // Return available subscription plans
  }

  @Post('subscribe')
  async createSubscription(@Body() data: CreateSubscriptionDto): Promise<UserSubscription> {
    // Create new subscription
  }

  @Put(':id/upgrade')
  async upgradeSubscription(@Param('id') id: string, @Body() data: UpgradeSubscriptionDto): Promise<UserSubscription> {
    // Upgrade subscription
  }

  @Delete(':id')
  async cancelSubscription(@Param('id') id: string, @Body() data: CancelSubscriptionDto): Promise<UserSubscription> {
    // Cancel subscription
  }

  @Get('usage')
  async getCurrentUsage(): Promise<UsageData> {
    // Get current usage statistics
  }
}

@Controller('billing')
export class BillingController {
  @Get('invoices')
  async getInvoices(): Promise<Invoice[]> {
    // Get user invoices
  }

  @Get('payment-methods')
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    // Get user payment methods
  }

  @Post('payment-methods')
  async addPaymentMethod(@Body() data: AddPaymentMethodDto): Promise<PaymentMethod> {
    // Add new payment method
  }

  @Post('webhooks/:provider')
  async handleWebhook(@Param('provider') provider: string, @Body() payload: any, @Headers() headers: any): Promise<void> {
    // Handle payment provider webhooks
  }
}
```

### 4. Frontend Architecture

#### New Stores
```typescript
// subscription.store.ts
export const useSubscriptionStore = defineStore('subscription', () => {
  const currentSubscription = ref<UserSubscription | null>(null);
  const availablePlans = ref<SubscriptionPlan[]>([]);
  const usage = ref<UsageData | null>(null);
  const invoices = ref<Invoice[]>([]);
  const paymentMethods = ref<PaymentMethod[]>([]);

  const subscribe = async (planId: string, paymentMethodId: string) => {
    // Implementation
  };

  const upgradeSubscription = async (newPlanId: string) => {
    // Implementation
  };

  const cancelSubscription = async (cancelAtPeriodEnd: boolean) => {
    // Implementation
  };

  const addPaymentMethod = async (paymentData: any) => {
    // Implementation
  };

  return {
    currentSubscription,
    availablePlans,
    usage,
    invoices,
    paymentMethods,
    subscribe,
    upgradeSubscription,
    cancelSubscription,
    addPaymentMethod
  };
});
```

#### New UI Components

##### Subscription Plans View
```vue
<template>
  <div class="subscription-plans">
    <h1>Choose Your Plan</h1>
    <div class="plans-grid">
      <div v-for="plan in plans" :key="plan.id" class="plan-card">
        <h3>{{ plan.name }}</h3>
        <p class="price">${{ plan.monthlyPrice }}/month</p>
        <ul class="features">
          <li>{{ plan.monthlyExecutionsLimit }} executions/month</li>
          <li>{{ plan.activeWorkflowsLimit }} active workflows</li>
          <li>{{ plan.credentialsLimit }} credentials</li>
        </ul>
        <button @click="selectPlan(plan)" class="select-plan-btn">
          Select Plan
        </button>
      </div>
    </div>
  </div>
</template>
```

##### Payment Method Management
```vue
<template>
  <div class="payment-methods">
    <h2>Payment Methods</h2>
    <div v-for="method in paymentMethods" :key="method.id" class="payment-method">
      <div class="method-info">
        <span class="brand">{{ method.brand }}</span>
        <span class="last4">**** {{ method.last4 }}</span>
        <span v-if="method.isDefault" class="default-badge">Default</span>
      </div>
      <button @click="removePaymentMethod(method.id)">Remove</button>
    </div>
    <button @click="showAddPaymentMethod = true">Add Payment Method</button>
  </div>
</template>
```

##### Billing Dashboard
```vue
<template>
  <div class="billing-dashboard">
    <div class="current-plan">
      <h2>Current Plan: {{ currentSubscription?.plan.name }}</h2>
      <p>Next billing date: {{ formatDate(currentSubscription?.currentPeriodEnd) }}</p>
      <p>Amount: ${{ currentSubscription?.amount }}</p>
    </div>

    <div class="usage-overview">
      <h3>Usage This Month</h3>
      <div class="usage-bars">
        <div class="usage-item">
          <span>Executions</span>
          <div class="progress-bar">
            <div class="progress" :style="{ width: executionUsagePercent + '%' }"></div>
          </div>
          <span>{{ usage?.executions }} / {{ currentSubscription?.plan.monthlyExecutionsLimit }}</span>
        </div>
      </div>
    </div>

    <div class="recent-invoices">
      <h3>Recent Invoices</h3>
      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invoice in invoices" :key="invoice.id">
            <td>{{ invoice.invoiceNumber }}</td>
            <td>{{ formatDate(invoice.createdAt) }}</td>
            <td>${{ invoice.total }}</td>
            <td>{{ invoice.status }}</td>
            <td>
              <button @click="downloadInvoice(invoice.id)">Download</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
```

### 5. Integration Points

#### Webhook Handlers
```typescript
export class WebhookService {
  async handleStripeWebhook(payload: any, signature: string): Promise<void> {
    // Handle Stripe events: subscription updates, payment failures, etc.
  }

  async handlePayPalWebhook(payload: any): Promise<void> {
    // Handle PayPal events
  }

  async handleSquareWebhook(payload: any, signature: string): Promise<void> {
    // Handle Square events
  }
}
```

#### Usage Monitoring
```typescript
export class UsageMonitoringService {
  async trackExecution(userId: string): Promise<void> {
    // Increment execution count and check limits
  }

  async checkLimits(userId: string): Promise<boolean> {
    // Check if user has exceeded limits
  }

  async generateUsageReport(userId: string, period: 'month' | 'year'): Promise<UsageReport> {
    // Generate usage reports
  }
}
```

### 6. Configuration

#### Environment Variables
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Square
SQUARE_ACCESS_TOKEN=...
SQUARE_APPLICATION_ID=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...

# General
DEFAULT_CURRENCY=USD
TRIAL_PERIOD_DAYS=14
```

### 7. Migration Strategy

#### Phase 1: Database Setup
1. Create new entities and migrations
2. Seed initial subscription plans
3. Migrate existing trial users to new system

#### Phase 2: Backend Implementation
1. Implement payment services
2. Create subscription management APIs
3. Set up webhook handlers

#### Phase 3: Frontend Implementation
1. Create subscription management UI
2. Update existing cloud plan components
3. Add billing dashboard

#### Phase 4: Testing & Deployment
1. Comprehensive testing with all payment providers
2. Gradual rollout to existing users
3. Monitor and optimize

### 8. Security Considerations

- All payment data encrypted at rest
- PCI DSS compliance for card data handling
- Webhook signature verification
- Rate limiting on payment endpoints
- Audit logging for all billing operations

### 9. Monitoring & Analytics

- Subscription metrics dashboard
- Payment failure alerts
- Usage trend analysis
- Revenue reporting
- Customer lifecycle tracking

This architecture provides a robust, scalable foundation for subscription management while maintaining compatibility with the existing n8n infrastructure.
