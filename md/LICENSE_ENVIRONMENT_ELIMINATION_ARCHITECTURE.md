# License Environment Elimination Architecture

## Executive Summary

This document outlines a comprehensive architectural solution to eliminate all license dependencies from the n8n project, transforming it into a pure open-source community edition. The solution addresses both the traditional license system and the newer subscription-based architecture, providing a clean, maintainable codebase free from commercial licensing constraints.

## Current State Analysis

### Dual Licensing Architecture
The n8n codebase currently implements two parallel systems:

1. **Traditional License System**: External license server validation with feature gates
2. **Subscription System**: Self-hosted payment processing with Adyen/Stripe integration

### Key Findings from n8n Subscription Page Analysis
Based on analysis of https://subscription.n8n.io, n8n offers:
- **Starter Plan**: £20/month (2.5K executions)
- **Pro Plan**: £50/month (10K executions)
- **Business Plan**: £667/month (40K executions)
- **Enterprise Plan**: Custom pricing

Each tier includes different feature sets like SSO, SAML, advanced permissions, project management, and various execution limits.

## Architectural Solution Overview

### Phase 1: License System Elimination
Remove all external license validation and convert to community-only features.

### Phase 2: Subscription System Removal
Eliminate payment processing, subscription management, and related infrastructure.

### Phase 3: Feature Democratization
Make all premium features available in the community edition.

### Phase 4: Cleanup and Optimization
Remove dead code, simplify configurations, and optimize the codebase.

## Detailed Implementation Plan

### Phase 1: License System Elimination

#### 1.1 Core License Infrastructure Removal

**Files to Delete:**
```
packages/cli/src/license/
├── license.controller.ts
├── license.service.ts
└── __tests__/license.service.test.ts

packages/cli/src/license.ts
packages/@n8n/config/src/configs/license.config.ts
```

**Configuration Changes:**
```typescript
// Remove from packages/@n8n/config/src/index.ts
- import { LicenseConfig } from './configs/license.config';
- license: LicenseConfig;
```

#### 1.2 License Decorator and Middleware Removal

**Controller Registry Updates:**
```typescript
// packages/cli/src/controller.registry.ts
// Replace license middleware with pass-through
private createLicenseMiddleware(feature: string) {
    return (_req: Request, _res: Response, next: NextFunction) => {
        // Always allow access - no license checks
        next();
    };
}
```

**Remove @Licensed Decorators:**
- Replace all `@Licensed('feature')` decorators with no-op or remove entirely
- Update affected controllers:
  - `packages/cli/src/controllers/users.controller.ts`
  - `packages/cli/src/controllers/project.controller.ts`
  - `packages/cli/src/controllers/folder.controller.ts`
  - `packages/cli/src/controllers/role.controller.ts`
  - `packages/cli/src/controllers/invitation.controller.ts`
  - `packages/cli/src/controllers/orchestration.controller.ts`

#### 1.3 License-Dependent Service Updates

**Frontend Service Modifications:**
```typescript
// packages/cli/src/services/frontend.service.ts
// Replace license checks with community defaults
private updateLicenseSettings() {
    this.settings.license = {
        planName: 'Community',
        consumerId: 'community-edition'
    };

    // Enable all enterprise features for community
    Object.assign(this.settings.enterprise, {
        sharing: true,
        logStreaming: true,
        ldap: true,
        saml: true,
        advancedExecutionFilters: true,
        variables: true,
        sourceControl: true,
        externalSecrets: true,
        // ... enable all features
    });
}
```

### Phase 2: Subscription System Removal

#### 2.1 Backend Infrastructure Removal

**Controllers and Services:**
```
packages/cli/src/controllers/subscription.controller.ts
packages/cli/src/services/subscription.service.ts
packages/cli/src/controllers/webhook.controller.ts (subscription webhooks)
packages/cli/src/services/payment/
├── adyen-payment.service.ts
├── stripe-payment.service.ts
└── payment-service.interface.ts
```

**Configuration Removal:**
```
packages/@n8n/config/src/configs/subscription.config.ts
```

#### 2.2 Database Schema Cleanup

**Entities to Remove:**
```
packages/@n8n/db/src/entities/
├── subscription-plan.ts
├── user-subscription.ts
├── invoice.ts
├── payment-method.ts
├── usage-tracking.ts
└── email-verification.ts

packages/@n8n/db/src/repositories/
├── subscription-plan.repository.ts
└── user-subscription.repository.ts
```

**Migration Strategy:**
```sql
-- Create rollback migrations to remove subscription tables
-- packages/@n8n/db/src/migrations/postgresdb/1740600000000-RemoveSubscriptionTables.ts

DROP TABLE IF EXISTS user_subscription;
DROP TABLE IF EXISTS subscription_plan;
DROP TABLE IF EXISTS invoice;
DROP TABLE IF EXISTS payment_method;
DROP TABLE IF EXISTS usage_tracking;
DROP TABLE IF EXISTS email_verification;
```

#### 2.3 API Types and DTOs Cleanup

**Remove Subscription DTOs:**
```
packages/@n8n/api-types/src/dto/subscription/
├── create-subscription-request.dto.ts
├── upgrade-subscription-request.dto.ts
└── cancel-subscription-request.dto.ts

packages/@n8n/api-types/src/dto/webhook/
├── adyen-webhook-request.dto.ts
└── subscription-event-request.dto.ts

packages/@n8n/api-types/src/dto/auth/
├── cloud-signup-request.dto.ts
└── verification.dto.ts
```

### Phase 3: Frontend Transformation

#### 3.1 Store Elimination

**Remove Subscription Stores:**
```
packages/frontend/editor-ui/src/stores/
├── subscription.store.ts
└── cloudPlan.store.ts
```

**Update Settings Store:**
```typescript
// packages/frontend/editor-ui/src/stores/settings.store.ts
// Remove subscription-related state and methods
// Simplify to community-only settings
```

#### 3.2 UI Component Updates

**Remove Subscription Views:**
```
packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.vue
packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.test.ts
```

**Update Settings Sidebar:**
```vue
<!-- packages/frontend/editor-ui/src/components/SettingsSidebar.vue -->
<!-- Remove subscription/billing related menu items -->
<!-- Simplify to community features only -->
```

#### 3.3 API Client Cleanup

**Remove Subscription APIs:**
```
packages/frontend/@n8n/rest-api-client/src/api/
├── subscriptions.ts
└── cloudPlans.ts
```

**Update Usage API:**
```typescript
// packages/frontend/@n8n/rest-api-client/src/api/usage.ts
// Remove license-related functions
// Keep only community usage tracking
```

### Phase 4: Feature Democratization

#### 4.1 Enable All Premium Features

**Feature Gate Removal Strategy:**
```typescript
// Create a CommunityLicense stub class
export class CommunityLicense {
    // Always return true for all feature checks
    isLicensed(feature: string): boolean { return true; }
    isSharingEnabled(): boolean { return true; }
    isLogStreamingEnabled(): boolean { return true; }
    isLdapEnabled(): boolean { return true; }
    isSamlEnabled(): boolean { return true; }
    isAdvancedExecutionFiltersEnabled(): boolean { return true; }
    isVariablesEnabled(): boolean { return true; }
    isSourceControlLicensed(): boolean { return true; }
    isExternalSecretsEnabled(): boolean { return true; }
    isWorkflowHistoryLicensed(): boolean { return true; }
    isWorkerViewLicensed(): boolean { return true; }
    isAdvancedPermissionsLicensed(): boolean { return true; }
    isFoldersEnabled(): boolean { return true; }

    // Return unlimited quotas
    getUsersLimit(): number { return -1; }
    getTriggerLimit(): number { return -1; }
    getVariablesLimit(): number { return -1; }
    getWorkflowHistoryPruneLimit(): number { return -1; }

    // Community plan identification
    getPlanName(): string { return 'Community'; }
    getConsumerId(): string { return 'community-edition'; }
}
```

#### 4.2 Service Integration Updates

**Update All License-Dependent Services:**
```typescript
// Replace license injections with CommunityLicense
// Update all services that check license features
// Remove usage limits and restrictions
```

### Phase 5: Configuration Simplification

#### 5.1 Environment Variables Cleanup

**Remove License/Subscription Variables:**
```bash
# Remove these environment variables from documentation and configs
N8N_LICENSE_SERVER_URL
N8N_LICENSE_AUTO_RENEW_ENABLED
N8N_LICENSE_ACTIVATION_KEY
N8N_LICENSE_DETACH_FLOATING_ON_SHUTDOWN
N8N_LICENSE_TENANT_ID
N8N_LICENSE_CERT

ADYEN_API_KEY
ADYEN_MERCHANT_ACCOUNT
ADYEN_WEBHOOK_SECRET
ADYEN_ENVIRONMENT
SUBSCRIPTION_ENABLED
DEFAULT_PAYMENT_PROVIDER
FREE_PLAN_EXECUTIONS_LIMIT
FREE_PLAN_WORKFLOWS_LIMIT
FREE_PLAN_CREDENTIALS_LIMIT
```

#### 5.2 Docker and Deployment Updates

**Update Docker Configuration:**
```dockerfile
# Remove license-related environment variables from docker-compose files
# Update documentation to reflect community-only deployment
```

**Update Helm Charts and Kubernetes Manifests:**
```yaml
# Remove license and subscription related configurations
# Simplify deployment to community edition only
```

## Implementation Strategy

### Phase-by-Phase Rollout

#### Phase 1: Preparation (Week 1)
- Create feature branches for each phase
- Set up comprehensive testing environment
- Document current license usage patterns
- Create rollback procedures

#### Phase 2: Backend License Removal (Week 2)
- Remove license controller and service
- Update license-dependent services
- Replace @Licensed decorators
- Implement CommunityLicense stub

#### Phase 3: Subscription System Removal (Week 3)
- Remove subscription controllers and services
- Clean up database entities and migrations
- Remove payment processing infrastructure
- Update API documentation

#### Phase 4: Frontend Cleanup (Week 4)
- Remove subscription stores and components
- Update UI to reflect community features
- Remove license-related API calls
- Update user documentation

#### Phase 5: Feature Democratization (Week 5)
- Enable all premium features
- Remove usage limits and restrictions
- Update feature documentation
- Comprehensive testing

#### Phase 6: Final Cleanup (Week 6)
- Remove dead code and unused dependencies
- Update configuration files
- Final testing and validation
- Documentation updates

### Testing Strategy

#### Unit Testing
- Update all existing tests to reflect community license
- Remove subscription-related test suites
- Add tests for CommunityLicense implementation

#### Integration Testing
- Test all previously licensed features work without restrictions
- Verify API endpoints return appropriate responses
- Test frontend components render correctly

#### End-to-End Testing
- Full workflow testing with all features enabled
- User management and permissions testing
- Advanced feature testing (SSO, SAML, etc.)

### Risk Mitigation

#### Rollback Strategy
- Maintain separate branches for each phase
- Create database migration rollbacks
- Document configuration restoration procedures
- Maintain feature flag system during transition

#### Compatibility Considerations
- Ensure existing workflows continue to function
- Maintain API compatibility where possible
- Provide migration guides for users

## Post-Implementation Benefits

### Simplified Architecture
- Reduced codebase complexity
- Fewer external dependencies
- Simplified deployment and configuration
- Easier maintenance and development

### Enhanced User Experience
- All features available to all users
- No license-related restrictions or errors
- Simplified onboarding process
- Consistent feature availability

### Development Benefits
- Faster development cycles
- Reduced testing complexity
- Simplified CI/CD pipelines
- Focus on core functionality

### Community Benefits
- True open-source experience
- No commercial restrictions
- Enhanced community adoption
- Simplified contribution process

## Conclusion

This architectural solution provides a comprehensive approach to eliminating all license dependencies from the n8n project. By following this phased implementation plan, the project can be transformed into a truly open-source community edition while maintaining all existing functionality and improving the overall user and developer experience.

The elimination of licensing constraints will simplify the codebase, reduce maintenance overhead, and provide a better foundation for future development and community contributions.
