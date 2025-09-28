# N8N Subscription Model Implementation Plan

## Overview
This document provides a detailed, step-by-step implementation plan for the subscription model, building on the existing n8n architecture.

## Enterprise Features Analysis

Based on the review of `en.json`, the following enterprise features are currently identified in the n8n codebase:

### Enterprise-Only Features (from en.json analysis):
1. **Workers View** (`workerList.actionBox.title`): "Available on the Enterprise plan"
   - View the current state of workers connected to your instance
   - Located in worker management functionality

2. **Log Streaming** (`settings.log-streaming.actionBox.title`): "Available on the Enterprise plan"
   - Send logs to external endpoints
   - Enterprise-level monitoring and debugging

3. **External Secrets** (`settings.externalSecrets.actionBox.title`): "Available on the Enterprise plan"
   - Connect external secrets tools for centralized credentials management
   - Enhanced security for enterprise environments

4. **Source Control/Environments** (`settings.sourceControl.actionBox.title`): "Available on the Enterprise plan"
   - Use multiple instances for different environments (dev, prod, etc.)
   - Deploy between environments via Git repository

5. **Variables** (`contextual.variables.unavailable.title`): "Available on the Enterprise plan"
   - Set global variables and use them across workflows
   - Cross-workflow data sharing

6. **LDAP Authentication** (`settings.ldap.disabled.title`): "Available on the Enterprise plan"
   - LDAP integration for enterprise authentication
   - Centralized user management

7. **SSO (Single Sign-On)** (`settings.sso.actionBox.title`): "Available on the Enterprise plan"
   - SAML 2.0 and OIDC configuration
   - Unified authentication platform

8. **Advanced Insights** (`insights.upgradeModal.content`): Enterprise plan required
   - Extended insights history (up to one year)
   - Hourly granularity for last 24 hours
   - Advanced workflow trend analysis

### Pro Plan Features:
- **Variables** are also available on Pro plan (`contextual.variables.unavailable.title.cloud`)
- **Advanced collaboration features** for workflow and credential sharing

## Current Architecture Analysis

### Existing Components
1. **Usage Store**: Manages license info and usage tracking
2. **Cloud Plan Store**: Handles trial/plan data for cloud deployments
3. **Settings Usage and Plan View**: UI for viewing current plan and usage
4. **User Management**: Complete authentication and user system
5. **Payment Integration**: Currently uses Stripe nodes but no subscription management
6. **Enterprise Feature Gates**: Existing UI components that show "Available on Enterprise plan" messages

### Integration Points
- The new subscription system will extend the existing `usage.store.ts` and `cloudPlan.store.ts`
- `SettingsUsageAndPlan.vue` will be enhanced with subscription management features
- New subscription-specific components will be added alongside existing ones
- Enterprise feature gates will be integrated with the subscription system

## Phase 1: Database Schema Implementation

### 1.1 Create Database Entities

#### Subscription Plan Entity
```typescript
// packages/@n8n/db/src/entities/subscription-plan.ts
import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { UserSubscription } from './user-subscription';

export interface SubscriptionPlanFeatures {
  advancedNodes: boolean;
  prioritySupport: boolean;
  sso: boolean;
  auditLogs: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  customDomains: boolean;
  advancedSecurity: boolean;
}

@Entity()
export class SubscriptionPlan extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  @Index()
  slug: string; // 'starter', 'pro', 'enterprise'

  @Column({ length: 100 })
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

  @Column('int', { default: 0 })
  storageLimit: number; // in GB

  @JsonColumn({ nullable: true })
  features: SubscriptionPlanFeatures;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPopular: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', default: 14 })
  trialDays: number;

  @OneToMany('UserSubscription', 'plan')
  subscriptions: UserSubscription[];

  // Computed properties
  get yearlyDiscount(): number {
    const monthlyTotal = this.monthlyPrice * 12;
    return Math.round(((monthlyTotal - this.yearlyPrice) / monthlyTotal) * 100);
  }

  get isFreePlan(): boolean {
    return this.monthlyPrice === 0 && this.yearlyPrice === 0;
  }
}
```

#### User Subscription Entity
```typescript
// packages/@n8n/db/src/entities/user-subscription.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';
import type { SubscriptionPlan } from './subscription-plan';
import type { Invoice } from './invoice';

@Entity()
export class UserSubscription extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'planId' })
  plan: SubscriptionPlan;

  @Column()
  planId: string;

  @Column()
  @Index()
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';

  @Column()
  billingCycle: 'monthly' | 'yearly';

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ length: 3 })
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

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  // Payment processor specific data
  @Column({ nullable: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  paypalSubscriptionId: string;

  @Column({ nullable: true })
  squareSubscriptionId: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  paypalCustomerId: string;

  @Column({ nullable: true })
  squareCustomerId: string;

  @JsonColumn({ nullable: true })
  metadata: Record<string, any>;

  @OneToMany('Invoice', 'subscription')
  invoices: Invoice[];

  // Computed properties
  get isActive(): boolean {
    return this.status === 'active' || this.status === 'trialing';
  }

  get isTrialing(): boolean {
    return this.status === 'trialing' && this.trialEnd && new Date() < this.trialEnd;
  }

  get daysUntilRenewal(): number {
    const now = new Date();
    const renewalDate = this.currentPeriodEnd;
    const diffTime = renewalDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
```

#### Payment Method Entity
```typescript
// packages/@n8n/db/src/entities/payment-method.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';

@Entity()
export class PaymentMethod extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column()
  provider: 'stripe' | 'paypal' | 'square';

  @Column()
  type: 'card' | 'bank_account' | 'paypal_account';

  @Column({ nullable: true, length: 4 })
  last4: string;

  @Column({ nullable: true, length: 20 })
  brand: string; // 'visa', 'mastercard', etc.

  @Column({ nullable: true })
  expiryMonth: number;

  @Column({ nullable: true })
  expiryYear: number;

  @Column({ type: 'boolean', default: false })
  @Index()
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

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
```

### 1.2 Create Migration Files

```typescript
// packages/@n8n/db/src/migrations/postgresdb/1740500000000-CreateSubscriptionTables.ts
import type { MigrationContext, ReversibleMigration } from '@n8n/typeorm';

export class CreateSubscriptionTables1740500000000 implements ReversibleMigration {
  async up({ queryRunner, tablePrefix }: MigrationContext) {
    // Create subscription_plan table
    await queryRunner.query(`
      CREATE TABLE ${tablePrefix}subscription_plan (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug varchar(50) UNIQUE NOT NULL,
        name varchar(100) NOT NULL,
        description text,
        monthly_price decimal(10,2) NOT NULL,
        yearly_price decimal(10,2) NOT NULL,
        monthly_executions_limit integer NOT NULL,
        active_workflows_limit integer NOT NULL,
        credentials_limit integer NOT NULL,
        users_limit integer NOT NULL,
        storage_limit integer DEFAULT 0,
        features jsonb,
        is_active boolean DEFAULT true,
        is_popular boolean DEFAULT false,
        sort_order integer DEFAULT 0,
        trial_days integer DEFAULT 14,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create user_subscription table
    await queryRunner.query(`
      CREATE TABLE ${tablePrefix}user_subscription (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
        plan_id uuid NOT NULL REFERENCES ${tablePrefix}subscription_plan(id),
        status varchar(20) NOT NULL,
        billing_cycle varchar(10) NOT NULL,
        amount decimal(10,2) NOT NULL,
        currency varchar(3) NOT NULL,
        current_period_start timestamp NOT NULL,
        current_period_end timestamp NOT NULL,
        trial_start timestamp,
        trial_end timestamp,
        canceled_at timestamp,
        cancel_at_period_end boolean DEFAULT false,
        stripe_subscription_id varchar(255),
        paypal_subscription_id varchar(255),
        square_subscription_id varchar(255),
        stripe_customer_id varchar(255),
        paypal_customer_id varchar(255),
        square_customer_id varchar(255),
        metadata jsonb,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create payment_method table
    await queryRunner.query(`
      CREATE TABLE ${tablePrefix}payment_method (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
        provider varchar(20) NOT NULL,
        type varchar(20) NOT NULL,
        last4 varchar(4),
        brand varchar(20),
        expiry_month integer,
        expiry_year integer,
        is_default boolean DEFAULT false,
        provider_payment_method_id varchar(255) NOT NULL,
        billing_address jsonb,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_subscription_plan_slug ON ${tablePrefix}subscription_plan(slug);`);
    await queryRunner.query(`CREATE INDEX idx_user_subscription_user_id ON ${tablePrefix}user_subscription(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_user_subscription_status ON ${tablePrefix}user_subscription(status);`);
    await queryRunner.query(`CREATE INDEX idx_payment_method_user_id ON ${tablePrefix}payment_method(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_payment_method_is_default ON ${tablePrefix}payment_method(is_default);`);
  }

  async down({ queryRunner, tablePrefix }: MigrationContext) {
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}payment_method;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}user_subscription;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}subscription_plan;`);
  }
}
```

## Phase 2: Service Layer Implementation

### 2.1 Payment Service Interface

```typescript
// packages/cli/src/services/payment/payment-service.interface.ts
export interface IPaymentService {
  // Customer management
  createCustomer(user: { id: string; email: string; firstName?: string; lastName?: string }): Promise<string>;
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

  updateSubscription(subscriptionId: string, params: {
    priceId?: string;
    paymentMethodId?: string;
  }): Promise<void>;

  cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void>;

  // Payment method management
  createPaymentMethod(customerId: string, paymentData: any): Promise<{
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
  createInvoice(customerId: string, items: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>): Promise<{
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    dueDate: Date;
  }>;

  // Webhook handling
  handleWebhook(payload: any, signature: string): Promise<{
    type: string;
    data: any;
  }>;

  // Utility methods
  getSubscription(subscriptionId: string): Promise<any>;
  getCustomer(customerId: string): Promise<any>;
}
```

### 2.2 Stripe Implementation

```typescript
// packages/cli/src/services/payment/stripe-payment.service.ts
import Stripe from 'stripe';
import { Service } from 'typedi';
import { IPaymentService } from './payment-service.interface';

@Service()
export class StripePaymentService implements IPaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async createCustomer(user: { id: string; email: string; firstName?: string; lastName?: string }): Promise<string> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : undefined,
      metadata: { userId: user.id },
    });
    return customer.id;
  }

  async updateCustomer(customerId: string, data: Partial<{ email: string; name: string }>): Promise<void> {
    await this.stripe.customers.update(customerId, data);
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.stripe.customers.del(customerId);
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    paymentMethodId?: string;
    trialDays?: number;
  }) {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      expand: ['latest_invoice.payment_intent'],
    };

    if (params.paymentMethodId) {
      subscriptionData.default_payment_method = params.paymentMethodId;
    }

    if (params.trialDays) {
      subscriptionData.trial_period_days = params.trialDays;
    }

    const subscription = await this.stripe.subscriptions.create(subscriptionData);

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : undefined,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
    };
  }

  async updateSubscription(subscriptionId: string, params: {
    priceId?: string;
    paymentMethodId?: string;
  }): Promise<void> {
    const updateData: Stripe.SubscriptionUpdateParams = {};

    if (params.priceId) {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      updateData.items = [{
        id: subscription.items.data[0].id,
        price: params.priceId,
      }];
    }

    if (params.paymentMethodId) {
      updateData.default_payment_method = params.paymentMethodId;
    }

    await this.stripe.subscriptions.update(subscriptionId, updateData);
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
    if (cancelAtPeriodEnd) {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await this.stripe.subscriptions.cancel(subscriptionId);
    }
  }

  async createPaymentMethod(customerId: string, paymentData: any) {
    const paymentMethod = await this.stripe.paymentMethods.create(paymentData);
    await this.stripe.paymentMethods.attach(paymentMethod.id, { customer: customerId });

    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      expiryMonth: paymentMethod.card?.exp_month,
      expiryYear: paymentMethod.card?.exp_year,
    };
  }

  async listPaymentMethods(customerId: string): Promise<any[]> {
    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return paymentMethods.data;
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  async createInvoice(customerId: string, items: Array<{
    description: string;
    amount: number;
    quantity?: number;
  }>) {
    // Create invoice items
    for (const item of items) {
      await this.stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(item.amount * 100), // Convert to cents
        currency: 'usd',
        description: item.description,
        quantity: item.quantity || 1,
      });
    }

    const invoice = await this.stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
    });

    return {
      id: invoice.id,
      number: invoice.number || '',
      status: invoice.status || 'draft',
      total: (invoice.total || 0) / 100, // Convert from cents
      currency: invoice.currency,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : new Date(),
    };
  }

  async handleWebhook(payload: any, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    return {
      type: event.type,
      data: event.data.object,
    };
  }

  async getSubscription(subscriptionId: string): Promise<any> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async getCustomer(customerId: string): Promise<any> {
    return await this.stripe.customers.retrieve(customerId);
  }
}
```

### 2.3 Subscription Service

```typescript
// packages/cli/src/services/subscription.service.ts
import { Service } from 'typedi';
import { Repository } from '@n8n/typeorm';
import { UserSubscription } from '@n8n/db/entities/user-subscription';
import { SubscriptionPlan } from '@n8n/db/entities/subscription-plan';
import { PaymentMethod } from '@n8n/db/entities/payment-method';
import { User } from '@n8n/db/entities/user';
import { IPaymentService } from './payment/payment-service.interface';
import { StripePaymentService } from './payment/stripe-payment.service';

@Service()
export class SubscriptionService {
  constructor(
    private subscriptionRepository: Repository<UserSubscription>,
    private planRepository: Repository<SubscriptionPlan>,
    private paymentMethodRepository: Repository<PaymentMethod>,
    private userRepository: Repository<User>,
    private stripeService: StripePaymentService,
  ) {}

  async createSubscription(params: {
    userId: string;
    planId: string;
    paymentMethodId?: string;
    billingCycle: 'monthly' | 'yearly';
    provider: 'stripe' | 'paypal' | 'square';
  }): Promise<UserSubscription> {
    const user = await this.userRepository.findOneOrFail({ where: { id: params.userId } });
    const plan = await this.planRepository.findOneOrFail({ where: { id: params.planId } });

    // Get payment service based on provider
    const paymentService = this.getPaymentService(params.provider);

    // Create customer if doesn't exist
    let customerId = await this.getCustomerId(user, params.provider);
    if (!customerId) {
      customerId = await paymentService.createCustomer(user);
      await this.saveCustomerId(user.id, customerId, params.provider);
    }

    // Create subscription with payment provider
    const amount = params.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const providerSubscription = await paymentService.createSubscription({
      customerId,
      priceId: this.getPriceId(plan, params.billingCycle, params.provider),
      paymentMethodId: params.paymentMethodId,
      trialDays: plan.trialDays,
    });

    // Create subscription record
    const subscription = this.subscriptionRepository.create({
      userId: params.userId,
      planId: params.planId,
      status: providerSubscription.status as any,
      billingCycle: params.billingCycle,
      amount,
      currency: 'USD',
      currentPeriodStart: providerSubscription.currentPeriodStart,
      currentPeriodEnd: providerSubscription.currentPeriodEnd,
      trialStart: providerSubscription.trialStart,
      trialEnd: providerSubscription.trialEnd,
      [`${params.provider}SubscriptionId`]: providerSubscription.id,
      [`${params.provider}CustomerId`]: customerId,
    });

    return await this.subscriptionRepository.save(subscription);
  }

  async upgradeSubscription(subscriptionId: string, newPlanId: string): Promise<UserSubscription> {
    const subscription = await this.subscriptionRepository.findOneOrFail({
      where: { id: subscriptionId },
      relations: ['plan', 'user'],
    });

    const newPlan = await this.planRepository.findOneOrFail({ where: { id: newPlanId } });
    const provider = this.getSubscriptionProvider(subscription);
    const paymentService = this.getPaymentService(provider);

    // Update subscription with payment provider
    const providerSubscriptionId = subscription[`${provider}SubscriptionId`];
    await paymentService.updateSubscription(providerSubscriptionId, {
      priceId: this.getPriceId(newPlan, subscription.billingCycle, provider),
    });

    // Update local subscription record
    subscription.planId = newPlanId;
    subscription.amount = subscription.billingCycle === 'yearly' ? newPlan.yearlyPrice : newPlan.monthlyPrice;

    return await this.subscriptionRepository.save(subscription);
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<UserSubscription> {
    const subscription = await this.subscriptionRepository.findOneOrFail({
      where: { id: subscriptionId },
    });

    const provider = this.getSubscriptionProvider(subscription);
    const paymentService = this.getPaymentService(provider);
    const providerSubscriptionId = subscription[`${provider}SubscriptionId`];

    // Cancel with payment provider
    await paymentService.cancelSubscription(providerSubscriptionId, cancelAtPeriodEnd);

    // Update local subscription record
    subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
    if (!cancelAtPeriodEnd) {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
    }

    return await this.subscriptionRepository.save(subscription);
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    return await this.subscriptionRepository.findOne({
      where: { userId, status: 'active' },
      relations: ['plan'],
    });
  }

  async checkUsageLimits(userId: string): Promise<{
    executionsLeft: number;
    workflowsLeft: number;
    credentialsLeft: number;
    usersLeft: number;
  }> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      return {
        executionsLeft: 0,
        workflowsLeft: 0,
        credentialsLeft: 0,
        usersLeft: 0,
      };
    }

    // TODO: Implement actual usage tracking
    return {
      executionsLeft: subscription.plan.monthlyExecutionsLimit,
      workflowsLeft: subscription.plan.activeWorkflowsLimit,
      credentialsLeft: subscription.plan.credentialsLimit,
      usersLeft: subscription.plan.usersLimit,
    };
  }

  private getPaymentService(provider: 'stripe' | 'paypal' | 'square'): IPaymentService {
    switch (provider) {
      case 'stripe':
        return this.stripeService;
      case 'paypal':
        // TODO: Implement PayPal service
        throw new Error('PayPal not implemented yet');
      case 'square':
        // TODO: Implement Square service
        throw new Error('Square not implemented yet');
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  private getSubscriptionProvider(subscription: UserSubscription): 'stripe' | 'paypal' | 'square' {
    if (subscription.stripeSubscriptionId) return 'stripe';
    if (subscription.paypalSubscriptionId) return 'paypal';
    if (subscription.squareSubscriptionId) return 'square';
    throw new Error('No payment provider found for subscription');
  }

  private async getCustomerId(user: User, provider: string): Promise<string | null> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { userId: user.id },
    });
    return subscription?.[`${provider}CustomerId`] || null;
  }

  private async saveCustomerId(userId: string, customerId: string, provider: string): Promise<void> {
    // This would typically be saved in a customer table or user metadata
    // For now, we'll save it when creating the subscription
  }

  private getPriceId(plan: SubscriptionPlan, billingCycle: 'monthly' | 'yearly', provider: string): string {
    // This would map to actual price IDs in the payment provider
    // For now, return a placeholder
    return `${provider}_${plan.slug}_${billingCycle}`;
  }
}
```

## Phase 3: API Layer Implementation

### 3.1 Controllers

```typescript
// packages/cli/src/controllers/subscription.controller.ts
import { Request, Response } from 'express';
import { Get, Post, Put, Delete, RestController, Middleware } from '@/decorators';
import { SubscriptionService } from '@/services/subscription.service';
import { SubscriptionPlan } from '@n8n/db/entities/subscription-plan';
import { Repository } from '@n8n/typeorm';
import { authMiddleware } from '@/middlewares/auth';

@RestController('/subscriptions')
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private planRepository: Repository<SubscriptionPlan>,
  ) {}

  @Get('/plans')
  async getPlans(req: Request, res: Response) {
    const plans = await this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
    return res.json(plans);
  }

  @Post('/subscribe')
  @Middleware(authMiddleware)
  async createSubscription(req: Request, res: Response) {
    const { planId, paymentMethodId, billingCycle, provider } = req.body;
    const userId = req.user.id;

    const subscription = await this.subscriptionService.createSubscription({
      userId,
      planId,
      paymentMethodId,
      billingCycle,
      provider,
    });

    return res.json(subscription);
  }

  @Put('/:id/upgrade')
  @Middleware(authMiddleware)
  async upgradeSubscription(req: Request, res: Response) {
    const { id } = req.params;
    const { planId } = req.body;

    const subscription = await this.subscriptionService.upgradeSubscription(id, planId);
    return res.json(subscription);
  }

  @Delete('/:id')
  @Middleware(authMiddleware)
  async cancelSubscription(req: Request, res: Response) {
    const { id } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;

    const subscription = await this.subscriptionService.cancelSubscription(id, cancelAtPeriodEnd);
    return res.json(subscription);
  }

  @Get('/current')
  @Middleware(authMiddleware)
  async getCurrentSubscription(req: Request, res: Response) {
    const userId = req.user.id;
    const subscription = await this.subscriptionService.getUserSubscription(userId);
    return res.json(subscription);
  }

  @Get('/usage')
  @Middleware(authMiddleware)
  async getUsageLimits(req: Request, res: Response) {
    const userId = req.user.id;
    const usage = await this.subscriptionService.checkUsageLimits(userId);
    return res.json(usage);
  }
}
```

## Phase 4: Frontend Implementation

### 4.1 Enhanced Subscription Store

```typescript
// packages/frontend/editor-ui/src/stores/subscription.store.ts
import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useToast } from '@/composables/useToast';
import * as subscriptionApi from '@/api/subscription';

export interface SubscriptionPlan {
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
  storageLimit: number;
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
  };
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  trialDays: number;
  yearlyDiscount: number;
  isFreePlan: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing' | 'paused';
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  canceledAt?: Date;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
  isTrialing: boolean;
  daysUntilRenewal: number;
}

export interface PaymentMethod {
  id: string;
  provider: 'stripe' | 'paypal' | 'square';
  type: 'card' | 'bank_account' | 'paypal_account';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export interface UsageLimits {
  executionsLeft: number;
  workflowsLeft: number;
  credentialsLeft: number;
  usersLeft: number;
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const rootStore = useRootStore();
  const toast = useToast();

  const currentSubscription = ref<UserSubscription | null>(null);
  const availablePlans = ref<SubscriptionPlan[]>([]);
  const paymentMethods = ref<PaymentMethod[]>([]);
  const usageLimits = ref<UsageLimits | null>(null);
  const loading = ref(false);

  const isSubscribed = computed(() => currentSubscription.value?.isActive || false);
  const isTrialing = computed(() => currentSubscription.value?.isTrialing || false);
  const currentPlan = computed(() => currentSubscription.value?.plan || null);

  const loadPlans = async () => {
    try {
      loading.value = true;
      const plans = await subscriptionApi.getPlans(rootStore.restApiContext);
      availablePlans.value = plans;
    } catch (error) {
      toast.showError(error, 'Failed to load subscription plans');
    } finally {
      loading.value = false;
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const subscription = await subscriptionApi.getCurrentSubscription(rootStore.restApiContext);
      currentSubscription.value = subscription;
    } catch (error) {
      // User might not have a subscription yet
      currentSubscription.value = null;
    }
  };

  const loadUsageLimits = async () => {
    try {
      const usage = await subscriptionApi.getUsageLimits(rootStore.restApiContext);
      usageLimits.value = usage;
    } catch (error) {
      toast.showError(error, 'Failed to load usage limits');
    }
  };

  const subscribe = async (params: {
    planId: string;
    billingCycle: 'monthly' | 'yearly';
    paymentMethodId?: string;
    provider: 'stripe' | 'paypal' | 'square';
  }) => {
    try {
      loading.value = true;
      const subscription = await subscriptionApi.createSubscription(rootStore.restApiContext, params);
      currentSubscription.value = subscription;
      toast.showMessage({
        type: 'success',
        title: 'Subscription Created',
        message: 'Your subscription has been created successfully!',
      });
      return subscription;
    } catch (error) {
      toast.showError(error, 'Failed to create subscription');
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const upgradeSubscription = async (newPlanId: string) => {
    if (!currentSubscription.value) return;

    try {
      loading.value = true;
      const subscription = await subscriptionApi.upgradeSubscription(
        rootStore.restApiContext,
        currentSubscription.value.id,
        { planId: newPlanId }
      );
      currentSubscription.value = subscription;
      toast.showMessage({
        type: 'success',
        title: 'Subscription Updated',
        message: 'Your subscription has been upgraded successfully!',
      });
      return subscription;
    } catch (error) {
      toast.showError(error, 'Failed to upgrade subscription');
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const cancelSubscription = async (cancelAtPeriodEnd: boolean = true) => {
    if (!currentSubscription.value) return;

    try {
      loading.value = true;
      const subscription = await subscriptionApi.cancelSubscription(
        rootStore.restApiContext,
        currentSubscription.value.id,
        { cancelAtPeriodEnd }
      );
      currentSubscription.value = subscription;
      toast.showMessage({
        type: 'success',
        title: 'Subscription Canceled',
        message: cancelAtPeriodEnd
          ? 'Your subscription will be canceled at the end of the current billing period.'
          : 'Your subscription has been canceled immediately.',
      });
      return subscription;
    } catch (error) {
      toast.showError(error, 'Failed to cancel subscription');
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const initialize = async () => {
    await Promise.all([
      loadPlans(),
      loadCurrentSubscription(),
      loadUsageLimits(),
    ]);
  };

  return {
    // State
    currentSubscription,
    availablePlans,
    paymentMethods,
    usageLimits,
    loading,

    // Computed
    isSubscribed,
    isTrialing,
    currentPlan,

    // Actions
    loadPlans,
    loadCurrentSubscription,
    loadUsageLimits,
    subscribe,
    upgradeSubscription,
    cancelSubscription,
    initialize,
  };
});
```

### 4.2 Subscription Plans Component

```vue
<!-- packages/frontend/editor-ui/src/components/SubscriptionPlans.vue -->
<template>
  <div class="subscription-plans">
    <div class="plans-header">
      <h2>Choose Your Plan</h2>
      <div class="billing-toggle">
        <n8n-button-group
          v-model="billingCycle"
          :options="[
            { label: 'Monthly', value: 'monthly' },
            { label: 'Yearly', value: 'yearly' }
          ]"
        />
        <span v-if="billingCycle === 'yearly'" class="savings-badge">
          Save up to 20%
        </span>
      </div>
    </div>

    <div class="plans-grid">
      <div
        v-for="plan in availablePlans"
        :key="plan.id"
        :class="[
          'plan-card',
          { 'popular': plan.isPopular },
          { 'current': currentPlan?.id === plan.id }
        ]"
      >
        <div v-if="plan.isPopular" class="popular-badge">Most Popular</div>

        <div class="plan-header">
          <h3>{{ plan.name }}</h3>
          <div class="price">
            <span class="amount">
              ${{ billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice }}
            </span>
            <span class="period">
              /{{ billingCycle === 'yearly' ? 'year' : 'month' }}
            </span>
          </div>
          <div v-if="billingCycle === 'yearly' && plan.yearlyDiscount > 0" class="discount">
            Save {{ plan.yearlyDiscount }}% annually
          </div>
        </div>

        <div class="plan-features">
          <ul>
            <li>
              <n8n-icon icon="check" size="small" />
              {{ formatNumber(plan.monthlyExecutionsLimit) }} executions/month
            </li>
            <li>
              <n8n-icon icon="check" size="small" />
              {{ plan.activeWorkflowsLimit }} active workflows
            </li>
            <li>
              <n8n-icon icon="check" size="small" />
              {{ plan.credentialsLimit }} credentials
            </li>
            <li>
              <n8n-icon icon="check" size="small" />
              {{ plan.usersLimit }} team members
            </li>
            <li v-if="plan.features.prioritySupport">
              <n8n-icon icon="check" size="small" />
              Priority support
            </li>
            <li v-if="plan.features.sso">
              <n8n-icon icon="check" size="small" />
              Single Sign-On (SSO)
            </li>
            <li v-if="plan.features.auditLogs">
              <n8n-icon icon="check" size="small" />
              Audit logs
            </li>
          </ul>
        </div>

        <div class="plan-actions">
          <n8n-button
            v-if="currentPlan?.id === plan.id"
            type="secondary"
            size="large"
            disabled
            full-width
          >
            Current Plan
          </n8n-button>
          <n8n-button
            v-else-if="plan.isFreePlan"
            type="secondary"
            size="large"
            full-width
            @click="selectPlan(plan)"
          >
            Downgrade
          </n8n-button>
          <n8n-button
            v-else
            type="primary"
            size="large"
            full-width
            :loading="loading"
            @click="selectPlan(plan)"
          >
            {{ currentPlan ? 'Upgrade' : 'Get Started' }}
          </n8n-button>
        </div>

        <div v-if="plan.trialDays > 0 && !currentPlan" class="trial-info">
          {{ plan.trialDays }}-day free trial
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useSubscriptionStore } from '@/stores/subscription.store';
import type { SubscriptionPlan } from '@/stores/subscription.store';

const subscriptionStore = useSubscriptionStore();

const billingCycle = ref<'monthly' | 'yearly'>('monthly');
const loading = computed(() => subscriptionStore.loading);
const availablePlans = computed(() => subscriptionStore.availablePlans);
const currentPlan = computed(() => subscriptionStore.currentPlan);

const emit = defineEmits<{
  selectPlan: [plan: SubscriptionPlan, billingCycle: 'monthly' | 'yearly'];
}>();

const selectPlan = (plan: SubscriptionPlan) => {
  emit('selectPlan', plan, billingCycle.value);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};
</script>

<style lang="scss" scoped>
.subscription-plans {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.plans-header {
  text-align: center;
  margin-bottom: 3rem;

  h2 {
    margin-bottom: 1rem;
    font-size: 2.5rem;
    font-weight: 600;
  }

  .billing-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;

    .savings-badge {
      background: var(--color-success);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
  }
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.plan-card {
  position: relative;
  background: white;
  border: 2px solid var(--color-foreground-light);
  border-radius: 1rem;
  padding: 2rem;
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  &.popular {
    border-color: var(--color-primary);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  &.current {
    border-color: var(--color-success);
    background: var(--color-success-tint-2);
  }
}

.popular-badge {
  position: absolute;
  top: -0.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-primary);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.plan-header {
  text-align: center;
  margin-bottom: 2rem;

  h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .price {
    margin-bottom: 0.5rem;

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

  .discount {
    color: var(--color-success);
    font-weight: 500;
    font-size: 0.875rem;
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
      font-size: 0.95rem;

      .n8n-icon {
        color: var(--color-success);
        flex-shrink: 0;
      }
    }
  }
}

.plan-actions {
  margin-bottom: 1rem;
}

.trial-info {
  text-align: center;
  color: var(--color-text-light);
  font-size: 0.875rem;
  font-style: italic;
}
</style>
```

### 4.3 Enhanced Settings Usage and Plan View

```vue
<!-- Enhanced version of packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.vue -->
<template>
  <div class="settings-usage-and-plan">
    <n8n-heading tag="h2" size="2xlarge">
      {{ locale.baseText('settings.usageAndPlan.title') }}
    </n8n-heading>

    <div v-if="!loading">
      <!-- Current Subscription Section -->
      <div v-if="subscriptionStore.isSubscribed" class="current-subscription">
        <div class="subscription-header">
          <h3>{{ currentSubscription?.plan.name }} Plan</h3>
          <div class="subscription-status">
            <n8n-badge
              :theme="getStatusTheme(currentSubscription?.status)"
              :text="getStatusText(currentSubscription?.status)"
            />
          </div>
        </div>

        <div class="subscription-details">
          <div class="detail-item">
            <span class="label">Billing Cycle:</span>
            <span class="value">{{ currentSubscription?.billingCycle }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Amount:</span>
            <span class="value">${{ currentSubscription?.amount }}/{{ currentSubscription?.billingCycle === 'yearly' ? 'year' : 'month' }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Next Billing:</span>
            <span class="value">{{ formatDate(currentSubscription?.currentPeriodEnd) }}</span>
          </div>
          <div v-if="currentSubscription?.isTrialing" class="detail-item">
            <span class="label">Trial Ends:</span>
            <span class="value">{{ formatDate(currentSubscription?.trialEnd) }}</span>
          </div>
        </div>
      </div>

      <!-- Usage Overview -->
      <div class="usage-overview">
        <h3>Usage This Month</h3>
        <div class="usage-metrics">
          <div class="usage-metric">
            <div class="metric-header">
              <span class="metric-name">Executions</span>
              <span class="metric-count">
                {{ usageStore.activeWorkflowTriggersCount }} /
                {{ currentSubscription?.plan.monthlyExecutionsLimit || 'Unlimited' }}
              </span>
            </div>
            <div class="metric-bar">
              <div
                class="metric-progress"
                :style="{ width: `${executionUsagePercent}%` }"
              ></div>
            </div>
          </div>

          <div class="usage-metric">
            <div class="metric-header">
              <span class="metric-name">Active Workflows</span>
              <span class="metric-count">
                {{ usageStore.activeWorkflowTriggersCount }} /
                {{ currentSubscription?.plan.activeWorkflowsLimit || 'Unlimited' }}
              </span>
            </div>
            <div class="metric-bar">
              <div
                class="metric-progress"
                :style="{ width: `${workflowUsagePercent}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <n8n-button
          v-if="!subscriptionStore.isSubscribed"
          type="primary"
          size="large"
          @click="showPlanSelection = true"
        >
          Choose a Plan
        </n8n-button>

        <template v-else>
          <n8n-button
            type="secondary"
            size="large"
            @click="showPlanSelection = true"
          >
            Change Plan
          </n8n-button>

          <n8n-button
            type="tertiary"
            size="large"
            @click="showCancelDialog = true"
          >
            Cancel Subscription
          </n8n-button>
        </template>
      </div>

      <!-- Plan Selection Modal -->
      <el-dialog
        v-model="showPlanSelection"
        title="Choose Your Plan"
        width="90%"
        :modal-class="$style.planModal"
      >
        <SubscriptionPlans @select-plan="handlePlanSelection" />
      </el-dialog>

      <!-- Cancel Subscription Dialog -->
      <el-dialog
        v-model="showCancelDialog"
        title="Cancel Subscription"
        width="500px"
      >
        <div class="cancel-dialog-content">
          <p>Are you sure you want to cancel your subscription?</p>
          <div class="cancel-options">
            <label>
              <input
                v-model="cancelAtPeriodEnd"
                type="radio"
                :value="true"
              />
              Cancel at the end of current billing period
            </label>
            <label>
              <input
                v-model="cancelAtPeriodEnd"
                type="radio"
                :value="false"
              />
              Cancel immediately
            </label>
          </div>
        </div>
        <template #footer>
          <n8n-button type="secondary" @click="showCancelDialog = false">
            Keep Subscription
          </n8n-button>
          <n8n-button type="danger" @click="handleCancelSubscription">
            Cancel Subscription
          </n8n-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useUsageStore } from '@/stores/usage.store';
import { useToast } from '@/composables/useToast';
import { useDocumentTitle } from '@/composables/useDocumentTitle';
import { i18n as locale } from '@n8n/i18n';
import SubscriptionPlans from '@/components/SubscriptionPlans.vue';
import type { SubscriptionPlan } from '@/stores/subscription.store';

const subscriptionStore = useSubscriptionStore();
const usageStore = useUsageStore();
const toast = useToast();
const documentTitle = useDocumentTitle();

const loading = ref(false);
const showPlanSelection = ref(false);
const showCancelDialog = ref(false);
const cancelAtPeriodEnd = ref(true);

const currentSubscription = computed(() => subscriptionStore.currentSubscription);
const executionUsagePercent = computed(() => {
  if (!currentSubscription.value?.plan.monthlyExecutionsLimit) return 0;
  return Math.min(
    (usageStore.activeWorkflowTriggersCount / currentSubscription.value.plan.monthlyExecutionsLimit) * 100,
    100
  );
});

const workflowUsagePercent = computed(() => {
  if (!currentSubscription.value?.plan.activeWorkflowsLimit) return 0;
  return Math.min(
    (usageStore.activeWorkflowTriggersCount / currentSubscription.value.plan.activeWorkflowsLimit) * 100,
    100
  );
});

const getStatusTheme = (status?: string) => {
  switch (status) {
    case 'active': return 'success';
    case 'trialing': return 'warning';
    case 'canceled': return 'danger';
    case 'past_due': return 'danger';
    default: return 'secondary';
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case 'active': return 'Active';
    case 'trialing': return 'Trial';
    case 'canceled': return 'Canceled';
    case 'past_due': return 'Past Due';
    default: return 'Unknown';
  }
};

const formatDate = (date?: Date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString();
};

const handlePlanSelection = async (plan: SubscriptionPlan, billingCycle: 'monthly' | 'yearly') => {
  try {
    if (subscriptionStore.isSubscribed) {
      await subscriptionStore.upgradeSubscription(plan.id);
    } else {
      // For new subscriptions, we'd need to handle payment method selection
      // This is a simplified version
      await subscriptionStore.subscribe({
        planId: plan.id,
        billingCycle,
        provider: 'stripe', // Default to Stripe
      });
    }
    showPlanSelection.value = false;
  } catch (error) {
    // Error handling is done in the store
  }
};

const handleCancelSubscription = async () => {
  try {
    await subscriptionStore.cancelSubscription(cancelAtPeriodEnd.value);
    showCancelDialog.value = false;
  } catch (error) {
    // Error handling is done in the store
  }
};

onMounted(async () => {
  documentTitle.set(locale.baseText('settings.usageAndPlan.title'));
  loading.value = true;

  try {
    await Promise.all([
      subscriptionStore.initialize(),
      usageStore.getLicenseInfo(),
    ]);
  } catch (error) {
    toast.showError(error, 'Failed to load subscription data');
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.settings-usage-and-plan {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.current-subscription {
  background: var(--color-background-xlight);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 2rem 0;

  .subscription-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;

    h3 {
      margin: 0;
      font-size: 1.25rem;
    }
  }

  .subscription-details {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;

    .detail-item {
      display: flex;
      justify-content: space-between;

      .label {
        font-weight: 500;
        color: var(--color-text-light);
      }

      .value {
        font-weight: 600;
      }
    }
  }
}

.usage-overview {
  margin: 2rem 0;

  h3 {
    margin-bottom: 1rem;
  }

  .usage-metrics {
    display: grid;
    gap: 1rem;
  }

  .usage-metric {
    background: white;
    border: 1px solid var(--color-foreground-light);
    border-radius: 0.5rem;
    padding: 1rem;

    .metric-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;

      .metric-name {
        font-weight: 500;
      }

      .metric-count {
        font-size: 0.875rem;
        color: var(--color-text-light);
      }
    }

    .metric-bar {
      height: 8px;
      background: var(--color-background-base);
      border-radius: 4px;
      overflow: hidden;

      .metric-progress {
        height: 100%;
        background: var(--color-primary);
        transition: width 0.3s ease;
      }
    }
  }
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin: 2rem 0;
}

.cancel-dialog-content {
  .cancel-options {
    margin: 1rem 0;

    label {
      display: block;
      margin: 0.5rem 0;
      cursor: pointer;

      input {
        margin-right: 0.5rem;
      }
    }
  }
}
</style>

<style lang="scss" module>
.planModal {
  .el-dialog {
    max-width: 1200px;
  }
}
</style>
```

## Phase 5: API Integration

### 5.1 Subscription API Client

```typescript
// packages/frontend/@n8n/rest-api-client/src/api/subscription.ts
import type { IRestApiContext } from '../types';
import { makeRestApiRequest } from '../helpers';

export interface CreateSubscriptionRequest {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
  provider: 'stripe' | 'paypal' | 'square';
}

export interface UpgradeSubscriptionRequest {
  planId: string;
}

export interface CancelSubscriptionRequest {
  cancelAtPeriodEnd: boolean;
}

export async function getPlans(context: IRestApiContext) {
  return await makeRestApiRequest(context, 'GET', '/subscriptions/plans');
}

export async function getCurrentSubscription(context: IRestApiContext) {
  return await makeRestApiRequest(context, 'GET', '/subscriptions/current');
}

export async function createSubscription(
  context: IRestApiContext,
  data: CreateSubscriptionRequest
) {
  return await makeRestApiRequest(context, 'POST', '/subscriptions/subscribe', data);
}

export async function upgradeSubscription(
  context: IRestApiContext,
  subscriptionId: string,
  data: UpgradeSubscriptionRequest
) {
  return await makeRestApiRequest(context, 'PUT', `/subscriptions/${subscriptionId}/upgrade`, data);
}

export async function cancelSubscription(
  context: IRestApiContext,
  subscriptionId: string,
  data: CancelSubscriptionRequest
) {
  return await makeRestApiRequest(context, 'DELETE', `/subscriptions/${subscriptionId}`, data);
}

export async function getUsageLimits(context: IRestApiContext) {
  return await makeRestApiRequest(context, 'GET', '/subscriptions/usage');
}
```

## Phase 6: Additional Database Entities

### 6.1 Invoice Entity

```typescript
// packages/@n8n/db/src/entities/invoice.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { JsonColumn, WithTimestamps } from './abstract-entity';
import type { User } from './user';
import type { UserSubscription } from './user-subscription';

@Entity()
export class Invoice extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  @Index()
  invoiceNumber: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => UserSubscription, { nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: UserSubscription;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column()
  @Index()
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column('decimal', { precision: 10, scale: 2 })
  total: number;

  @Column({ length: 3 })
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

  @JsonColumn({ nullable: true })
  metadata: Record<string, any>;

  // Computed properties
  get isPaid(): boolean {
    return this.status === 'paid';
  }

  get isOverdue(): boolean {
    return this.status === 'open' && new Date() > this.dueDate;
  }
}
```

### 6.2 Usage Tracking Entity

```typescript
// packages/@n8n/db/src/entities/usage-tracking.ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from '@n8n/typeorm';
import { WithTimestamps } from './abstract-entity';
import type { User } from './user';

@Entity()
@Index(['userId', 'date'], { unique: true })
export class UsageTracking extends WithTimestamps {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'date' })
  @Index()
  date: Date;

  @Column('int', { default: 0 })
  executionsCount: number;

  @Column('int', { default: 0 })
  activeWorkflowsCount: number;

  @Column('int', { default: 0 })
  credentialsCount: number;

  @Column('int', { default: 0 })
  usersCount: number;

  @Column('bigint', { default: 0 })
  storageUsed: number; // in bytes
}
```

### 6.3 Additional Migration for Invoice and Usage Tracking

```typescript
// packages/@n8n/db/src/migrations/postgresdb/1740500001000-CreateInvoiceAndUsageTrackingTables.ts
import type { MigrationContext, ReversibleMigration } from '@n8n/typeorm';

export class CreateInvoiceAndUsageTrackingTables1740500001000 implements ReversibleMigration {
  async up({ queryRunner, tablePrefix }: MigrationContext) {
    // Create invoice table
    await queryRunner.query(`
      CREATE TABLE ${tablePrefix}invoice (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number varchar(50) UNIQUE NOT NULL,
        user_id uuid NOT NULL REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
        subscription_id uuid REFERENCES ${tablePrefix}user_subscription(id),
        status varchar(20) NOT NULL,
        subtotal decimal(10,2) NOT NULL,
        tax decimal(10,2) DEFAULT 0,
        total decimal(10,2) NOT NULL,
        currency varchar(3) NOT NULL,
        due_date timestamp NOT NULL,
        paid_at timestamp,
        line_items jsonb NOT NULL,
        stripe_invoice_id varchar(255),
        paypal_invoice_id varchar(255),
        square_invoice_id varchar(255),
        metadata jsonb,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create usage_tracking table
    await queryRunner.query(`
      CREATE TABLE ${tablePrefix}usage_tracking (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES ${tablePrefix}user(id) ON DELETE CASCADE,
        date date NOT NULL,
        executions_count integer DEFAULT 0,
        active_workflows_count integer DEFAULT 0,
        credentials_count integer DEFAULT 0,
        users_count integer DEFAULT 0,
        storage_used bigint DEFAULT 0,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX idx_invoice_number ON ${tablePrefix}invoice(invoice_number);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_user_id ON ${tablePrefix}invoice(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_invoice_status ON ${tablePrefix}invoice(status);`);
    await queryRunner.query(`CREATE INDEX idx_usage_tracking_user_id ON ${tablePrefix}usage_tracking(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_usage_tracking_date ON ${tablePrefix}usage_tracking(date);`);
  }

  async down({ queryRunner, tablePrefix }: MigrationContext) {
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}usage_tracking;`);
    await queryRunner.query(`DROP TABLE IF EXISTS ${tablePrefix}invoice;`);
  }
}
```

## Phase 7: Enhanced Service Layer

### 7.1 Usage Monitoring Service

```typescript
// packages/cli/src/services/usage-monitoring.service.ts
import { Service } from 'typedi';
import { Repository } from '@n8n/typeorm';
import { UsageTracking } from '@n8n/db/entities/usage-tracking';
import { UserSubscription } from '@n8n/db/entities/user-subscription';
import { SubscriptionService } from './subscription.service';

@Service()
export class UsageMonitoringService {
  constructor(
    private usageRepository: Repository<UsageTracking>,
    private subscriptionService: SubscriptionService,
  ) {}

  async trackExecution(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get or create usage record for today
    let usage = await this.usageRepository.findOne({
      where: { userId, date: today },
    });

    if (!usage) {
      usage = this.usageRepository.create({
        userId,
        date: today,
        executionsCount: 0,
      });
    }

    usage.executionsCount += 1;
    await this.usageRepository.save(usage);

    // Check if user has exceeded limits
    await this.checkExecutionLimits(userId);
  }

  async trackWorkflowActivation(userId: string, increment: number = 1): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let usage = await this.usageRepository.findOne({
      where: { userId, date: today },
    });

    if (!usage) {
      usage = this.usageRepository.create({
        userId,
        date: today,
        activeWorkflowsCount: 0,
      });
    }

    usage.activeWorkflowsCount += increment;
    await this.usageRepository.save(usage);
  }

  async checkExecutionLimits(userId: string): Promise<boolean> {
    const subscription = await this.subscriptionService.getUserSubscription(userId);
    if (!subscription || subscription.plan.monthlyExecutionsLimit === -1) {
      return true; // Unlimited or no subscription
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usage = await this.usageRepository
      .createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId })
      .andWhere('usage.date >= :startDate', { startDate: currentMonth })
      .select('SUM(usage.executionsCount)', 'totalExecutions')
      .getRawOne();

    const totalExecutions = parseInt(usage.totalExecutions) || 0;
    return totalExecutions < subscription.plan.monthlyExecutionsLimit;
  }

  async getCurrentMonthUsage(userId: string): Promise<{
    executions: number;
    workflows: number;
    credentials: number;
    users: number;
    storage: number;
  }> {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const usage = await this.usageRepository
      .createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId })
      .andWhere('usage.date >= :startDate', { startDate: currentMonth })
      .select([
        'SUM(usage.executionsCount) as executions',
        'MAX(usage.activeWorkflowsCount) as workflows',
        'MAX(usage.credentialsCount) as credentials',
        'MAX(usage.usersCount) as users',
        'MAX(usage.storageUsed) as storage',
      ])
      .getRawOne();

    return {
      executions: parseInt(usage.executions) || 0,
      workflows: parseInt(usage.workflows) || 0,
      credentials: parseInt(usage.credentials) || 0,
      users: parseInt(usage.users) || 0,
      storage: parseInt(usage.storage) || 0,
    };
  }

  async generateUsageReport(userId: string, startDate: Date, endDate: Date): Promise<any> {
    const usage = await this.usageRepository
      .createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId })
      .andWhere('usage.date >= :startDate', { startDate })
      .andWhere('usage.date <= :endDate', { endDate })
      .orderBy('usage.date', 'ASC')
      .getMany();

    return {
      period: { startDate, endDate },
      dailyUsage: usage,
      totals: {
        executions: usage.reduce((sum, day) => sum + day.executionsCount, 0),
        peakWorkflows: Math.max(...usage.map(day => day.activeWorkflowsCount)),
        peakCredentials: Math.max(...usage.map(day => day.credentialsCount)),
        peakUsers: Math.max(...usage.map(day => day.usersCount)),
        peakStorage: Math.max(...usage.map(day => day.storageUsed)),
      },
    };
  }
}
```

### 7.2 Webhook Service

```typescript
// packages/cli/src/services/webhook.service.ts
import { Service } from 'typedi';
import { Repository } from '@n8n/typeorm';
import { UserSubscription } from '@n8n/db/entities/user-subscription';
import { Invoice } from '@n8n/db/entities/invoice';
import { StripePaymentService } from './payment/stripe-payment.service';
import { Logger } from '@n8n/logger';

@Service()
export class WebhookService {
  constructor(
    private subscriptionRepository: Repository<UserSubscription>,
    private invoiceRepository: Repository<Invoice>,
    private stripeService: StripePaymentService,
    private logger: Logger,
  ) {}

  async handleStripeWebhook(payload: any, signature: string): Promise<void> {
    try {
      const event = await this.stripeService.handleWebhook(payload, signature);

      switch (event.type) {
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data);
          break;
        case 'customer.subscription.trial_will_end':
          await this.handleTrialWillEnd(event.data);
          break;
        default:
          this.logger.info(`Unhandled Stripe webhook event: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Error processing Stripe webhook:', error);
      throw error;
    }
  }

  private async handleSubscriptionUpdated(stripeSubscription: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (subscription) {
      subscription.status = stripeSubscription.status;
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      if (stripeSubscription.canceled_at) {
        subscription.canceledAt = new Date(stripeSubscription.canceled_at * 1000);
      }

      await this.subscriptionRepository.save(subscription);
      this.logger.info(`Updated subscription ${subscription.id} from Stripe webhook`);
    }
  }

  private async handleSubscriptionDeleted(stripeSubscription: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
    });

    if (subscription) {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      await this.subscriptionRepository.save(subscription);
      this.logger.info(`Canceled subscription ${subscription.id} from Stripe webhook`);
    }
  }

  private async handleInvoicePaymentSucceeded(stripeInvoice: any): Promise<void> {
    const invoice = await this.invoiceRepository.findOne({
      where: { stripeInvoiceId: stripeInvoice.id },
    });

    if (invoice) {
      invoice.status = 'paid';
      invoice.paidAt = new Date(stripeInvoice.status_transitions.paid_at * 1000);
      await this.invoiceRepository.save(invoice);
      this.logger.info(`Marked invoice ${invoice.id} as paid from Stripe webhook`);
    }
  }

  private async handleInvoicePaymentFailed(stripeInvoice: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeInvoice.subscription },
    });

    if (subscription) {
      subscription.status = 'past_due';
      await this.subscriptionRepository.save(subscription);
      this.logger.warn(`Subscription ${subscription.id} marked as past due due to payment failure`);
    }
  }

  private async handleTrialWillEnd(stripeSubscription: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { stripeSubscriptionId: stripeSubscription.id },
      relations: ['user'],
    });

    if (subscription) {
      // Send trial ending notification email
      this.logger.info(`Trial ending soon for subscription ${subscription.id}`);
      // TODO: Implement email notification
    }
  }
}
```

## Phase 8: Configuration and Environment Setup

### 8.1 Environment Configuration

```typescript
// packages/@n8n/config/src/configs/subscription.config.ts
import { Config, Env } from '../decorators';

@Config
export class SubscriptionConfig {
  /** Stripe Configuration */
  @Env('STRIPE_SECRET_KEY')
  stripeSecretKey: string = '';

  @Env('STRIPE_PUBLISHABLE_KEY')
  stripePublishableKey: string = '';

  @Env('STRIPE_WEBHOOK_SECRET')
  stripeWebhookSecret: string = '';

  /** PayPal Configuration */
  @Env('PAYPAL_CLIENT_ID')
  paypalClientId: string = '';

  @Env('PAYPAL_CLIENT_SECRET')
  paypalClientSecret: string = '';

  @Env('PAYPAL_WEBHOOK_ID')
  paypalWebhookId: string = '';

  @Env('PAYPAL_ENVIRONMENT')
  paypalEnvironment: 'sandbox' | 'live' = 'sandbox';

  /** Square Configuration */
  @Env('SQUARE_ACCESS_TOKEN')
  squareAccessToken: string = '';

  @Env('SQUARE_APPLICATION_ID')
  squareApplicationId: string = '';

  @Env('SQUARE_WEBHOOK_SIGNATURE_KEY')
  squareWebhookSignatureKey: string = '';

  @Env('SQUARE_ENVIRONMENT')
  squareEnvironment: 'sandbox' | 'production' = 'sandbox';

  /** General Subscription Settings */
  @Env('DEFAULT_CURRENCY')
  defaultCurrency: string = 'USD';

  @Env('TRIAL_PERIOD_DAYS')
  trialPeriodDays: number = 14;

  @Env('SUBSCRIPTION_ENABLED')
  subscriptionEnabled: boolean = false;

  @Env('DEFAULT_PAYMENT_PROVIDER')
  defaultPaymentProvider: 'stripe' | 'paypal' | 'square' = 'stripe';

  /** Usage Limits for Free Plan */
  @Env('FREE_PLAN_EXECUTIONS_LIMIT')
  freePlanExecutionsLimit: number = 5000;

  @Env('FREE_PLAN_WORKFLOWS_LIMIT')
  freePlanWorkflowsLimit: number = 5;

  @Env('FREE_PLAN_CREDENTIALS_LIMIT')
  freePlanCredentialsLimit: number = 10;
}
```

### 8.2 Seed Data for Subscription Plans

```typescript
// packages/@n8n/db/src/migrations/postgresdb/1740500002000-SeedSubscriptionPlans.ts
import type { MigrationContext, ReversibleMigration } from '@n8n/typeorm';

export class SeedSubscriptionPlans1740500002000 implements ReversibleMigration {
  async up({ queryRunner, tablePrefix }: MigrationContext) {
    // Insert default subscription plans
    await queryRunner.query(`
      INSERT INTO ${tablePrefix}subscription_plan (
        slug, name, description, monthly_price, yearly_price,
        monthly_executions_limit, active_workflows_limit, credentials_limit, users_limit,
        storage_limit, features, is_active, is_popular, sort_order, trial_days
      ) VALUES
      (
        'free',
        'Free',
        'Perfect for getting started with n8n',
        0.00, 0.00,
        5000, 5, 10, 1, 1,
        '{"advancedNodes": false, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": false, "webhooks": true, "customDomains": false, "advancedSecurity": false}',
        true, false, 1, 0
      ),
      (
        'starter',
        'Starter',
        'Great for small teams and growing businesses',
        20.00, 200.00,
        50000, 25, 50, 3, 10,
        '{"advancedNodes": true, "prioritySupport": false, "sso": false, "auditLogs": false, "customBranding": false, "apiAccess": true, "webhooks": true, "customDomains": false, "advancedSecurity": false}',
        true, false, 2, 14
      ),
      (
        'pro',
        'Pro',
        'Perfect for growing teams with advanced needs',
        50.00, 500.00,
        200000, 100, 200, 10, 50,
        '{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true}',
        true, true, 3, 14
      ),
      (
        'enterprise',
        'Enterprise',
        'For large organizations with custom requirements',
        200.00, 2000.00,
        -1, -1, -1, -1, -1,
        '{"advancedNodes": true, "prioritySupport": true, "sso": true, "auditLogs": true, "customBranding": true, "apiAccess": true, "webhooks": true, "customDomains": true, "advancedSecurity": true}',
        true, false, 4, 14
      );
    `);
  }

  async down({ queryRunner, tablePrefix }: MigrationContext) {
    await queryRunner.query(`DELETE FROM ${tablePrefix}subscription_plan WHERE slug IN ('free', 'starter', 'pro', 'enterprise');`);
  }
}
```

## Phase 9: Testing Strategy

### 9.1 Unit Tests for Subscription Service

```typescript
// packages/cli/test/unit/services/subscription.service.test.ts
import { SubscriptionService } from '@/services/subscription.service';
import { UserSubscription } from '@n8n/db/entities/user-subscription';
import { SubscriptionPlan } from '@n8n/db/entities/subscription-plan';
import { User } from '@n8n/db/entities/user';
import { Repository } from '@n8n/typeorm';
import { mock } from 'jest-mock-extended';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;
  let subscriptionRepository: jest.Mocked<Repository<UserSubscription>>;
  let planRepository: jest.Mocked<Repository<SubscriptionPlan>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let mockStripeService: any;

  beforeEach(() => {
    subscriptionRepository = mock<Repository<UserSubscription>>();
    planRepository = mock<Repository<SubscriptionPlan>>();
    userRepository = mock<Repository<User>>();
    mockStripeService = {
      createCustomer: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
    };

    subscriptionService = new SubscriptionService(
      subscriptionRepository,
      planRepository,
      mock(),
      userRepository,
      mockStripeService,
    );
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', firstName: 'Test', lastName: 'User' };
      const mockPlan = { id: 'plan-1', slug: 'pro', monthlyPrice: 50, yearlyPrice: 500, trialDays: 14 };
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        trialStart: new Date(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      userRepository.findOneOrFail.mockResolvedValue(mockUser as User);
      planRepository.findOneOrFail.mockResolvedValue(mockPlan as SubscriptionPlan);
      mockStripeService.createCustomer.mockResolvedValue('cus_123');
      mockStripeService.createSubscription.mockResolvedValue(mockStripeSubscription);
      subscriptionRepository.create.mockReturnValue({} as UserSubscription);
      subscriptionRepository.save.mockResolvedValue({} as UserSubscription);

      const result = await subscriptionService.createSubscription({
        userId: 'user-1',
        planId: 'plan-1',
        billingCycle: 'monthly',
        provider: 'stripe',
      });

      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(mockUser);
      expect(mockStripeService.createSubscription).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription to new plan', async () => {
      const mockSubscription = {
        id: 'sub-1',
        stripeSubscriptionId: 'sub_123',
        billingCycle: 'monthly',
      };
      const mockNewPlan = { id: 'plan-2', monthlyPrice: 100, yearlyPrice: 1000 };

      subscriptionRepository.findOneOrFail.mockResolvedValue(mockSubscription as UserSubscription);
      planRepository.findOneOrFail.mockResolvedValue(mockNewPlan as SubscriptionPlan);
      mockStripeService.updateSubscription.mockResolvedValue(undefined);
      subscriptionRepository.save.mockResolvedValue({} as UserSubscription);

      await subscriptionService.upgradeSubscription('sub-1', 'plan-2');

      expect(mockStripeService.updateSubscription).toHaveBeenCalledWith('sub_123', expect.any(Object));
      expect(subscriptionRepository.save).toHaveBeenCalled();
    });
  });
});
```

### 9.2 Integration Tests

```typescript
// packages/cli/test/integration/subscription.api.test.ts
import request from 'supertest';
import { Application } from 'express';
import { setupTestApp } from '../utils/test-setup';
import { createTestUser, createTestSubscriptionPlan } from '../utils/test-helpers';

describe('Subscription API', () => {
  let app: Application;
  let authToken: string;
  let testUser: any;
  let testPlan: any;

  beforeAll(async () => {
    app = await setupTestApp();
    testUser = await createTestUser();
    testPlan = await createTestSubscriptionPlan();
    authToken = generateAuthToken(testUser);
  });

  describe('GET /subscriptions/plans', () => {
    it('should return available subscription plans', async () => {
      const response = await request(app)
        .get('/subscriptions/plans')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('monthlyPrice');
    });
  });

  describe('POST /subscriptions/subscribe', () => {
    it('should create a new subscription', async () => {
      const subscriptionData = {
        planId: testPlan.id,
        billingCycle: 'monthly',
        provider: 'stripe',
      };

      const response = await request(app)
        .post('/subscriptions/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(subscriptionData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(response.body.planId).toBe(testPlan.id);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app)
        .post('/subscriptions/subscribe')
        .send({})
        .expect(401);
    });
  });
});
```

## Phase 10: Deployment and Monitoring

### 10.1 Docker Configuration Updates

```dockerfile
# Add to existing Dockerfile
# Install additional dependencies for payment processing
RUN npm install stripe @paypal/checkout-server-sdk squareconnect
```

### 10.2 Monitoring and Alerting

```typescript
// packages/cli/src/services/subscription-monitoring.service.ts
import { Service } from 'typedi';
import { Repository } from '@n8n/typeorm';
import { UserSubscription } from '@n8n/db/entities/user-subscription';
import { Logger } from '@n8n/logger';

@Service()
export class SubscriptionMonitoringService {
  constructor(
    private subscriptionRepository: Repository<UserSubscription>,
    private logger: Logger,
  ) {}

  async checkExpiringTrials(): Promise<void> {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const expiringTrials = await this.subscriptionRepository.find({
      where: {
        status:
