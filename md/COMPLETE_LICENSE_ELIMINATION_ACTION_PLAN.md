# Complete License Elimination Action Plan

## Overview

This document provides a detailed, step-by-step action plan for completely eliminating all license dependencies from the n8n project, including both the traditional license system and the newer subscription-based architecture. This transforms n8n into a pure open-source community edition.

## Task Progress

- [x] Analyze n8n subscription page structure and features
- [x] Review existing LICENSE_REMOVAL_IMPACT_ANALYSIS.md file
- [x] Analyze current codebase for license dependencies
- [x] Update the impact analysis with new findings
- [x] Develop architectural solution document
- [x] Create comprehensive elimination plan

## Prerequisites

- Full backup of the current codebase
- Development environment set up with all dependencies
- Database backup (if using subscription features)
- Access to all relevant repositories and branches

## Phase 1: Preparation and Setup

### Step 1.1: Create Working Branches

```bash
# Create main feature branch
git checkout -b feature/eliminate-license-dependencies

# Create phase-specific branches
git checkout -b phase/1-license-removal
git checkout -b phase/2-subscription-removal
git checkout -b phase/3-frontend-cleanup
git checkout -b phase/4-feature-democratization
git checkout -b phase/5-final-cleanup
```

### Step 1.2: Document Current State

```bash
# Create inventory of license-related files
find . -name "*.ts" -o -name "*.js" -o -name "*.vue" | xargs grep -l "license\|License\|LICENSE" > license-files-inventory.txt

# Create inventory of subscription-related files
find . -name "*.ts" -o -name "*.js" -o -name "*.vue" | xargs grep -l "subscription\|Subscription\|SUBSCRIPTION" > subscription-files-inventory.txt

# Document current environment variables
env | grep -i license > current-license-env.txt
env | grep -i subscription > current-subscription-env.txt
```

### Step 1.3: Set Up Testing Environment

```bash
# Install dependencies
pnpm install

# Run current tests to establish baseline
pnpm test

# Start development server to verify current state
pnpm dev
```

## Phase 2: License System Elimination

### Step 2.1: Remove Core License Files

```bash
# Switch to license removal branch
git checkout phase/1-license-removal

# Remove license controller and service
rm -rf packages/cli/src/license/

# Remove core license class
rm packages/cli/src/license.ts

# Remove license configuration
rm packages/@n8n/config/src/configs/license.config.ts
```

### Step 2.2: Update Configuration Index

**File: `packages/@n8n/config/src/index.ts`**

```typescript
// Remove license import and export
// BEFORE:
import { LicenseConfig } from './configs/license.config';

export class GlobalConfig {
    // ... other configs
    license: LicenseConfig;
}

// AFTER:
// Remove LicenseConfig import entirely
export class GlobalConfig {
    // ... other configs
    // Remove license: LicenseConfig;
}
```

### Step 2.3: Remove Server Registration

**File: `packages/cli/src/server.ts`**

```typescript
// Remove license controller import
// BEFORE:
import '@/license/license.controller';

// AFTER:
// Remove the import line entirely
```

### Step 2.4: Create Community License Stub

**File: `packages/cli/src/community-license.ts`**

```typescript
import { Service } from '@n8n/di';

@Service()
export class CommunityLicense {
    // Feature checks - always return true
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
    isAPIDisabled(): boolean { return false; }
    isWorkerViewLicensed(): boolean { return true; }
    isAdvancedPermissionsLicensed(): boolean { return true; }
    isProjectRoleAdminLicensed(): boolean { return true; }
    isProjectRoleEditorLicensed(): boolean { return true; }
    isProjectRoleViewerLicensed(): boolean { return true; }
    isCustomNpmRegistryEnabled(): boolean { return true; }
    isFoldersEnabled(): boolean { return true; }
    isAiAssistantEnabled(): boolean { return true; }
    isAskAiEnabled(): boolean { return true; }
    isAiCreditsEnabled(): boolean { return true; }
    isDebugInEditorLicensed(): boolean { return true; }
    isBinaryDataS3Licensed(): boolean { return true; }
    isMultiMainLicensed(): boolean { return true; }
    isApiKeyScopesEnabled(): boolean { return true; }

    // Quota methods - return unlimited
    getUsersLimit(): number { return -1; }
    getTriggerLimit(): number { return -1; }
    getVariablesLimit(): number { return -1; }
    getWorkflowHistoryPruneLimit(): number { return -1; }
    getTeamProjectLimit(): number { return -1; }
    getAiCredits(): number { return -1; }

    // User limit checks
    isWithinUsersLimit(): boolean { return true; }

    // Plan information
    getPlanName(): string { return 'Community'; }
    getConsumerId(): string { return 'community-edition'; }
    getManagementJwt(): string { return ''; }

    // Stub methods for compatibility
    async init(): Promise<void> { return; }
    async activate(key: string): Promise<void> { return; }
    async renew(): Promise<void> { return; }
    async clear(): Promise<void> { return; }
    async reload(): Promise<void> { return; }
    async loadCertStr(): Promise<string> { return ''; }
    getInfo(): string { return 'Community Edition - All features enabled'; }
    getCurrentEntitlements(): any[] { return []; }
    getMainPlan(): any { return null; }
    getValue(feature: string): any { return -1; }
}
```

### Step 2.5: Update Controller Registry

**File: `packages/cli/src/controller.registry.ts`**

```typescript
// Replace license middleware creation
private createLicenseMiddleware(feature: string) {
    // Always allow access - no license checks in community edition
    return (_req: Request, _res: Response, next: NextFunction) => {
        next();
    };
}
```

### Step 2.6: Remove @Licensed Decorators

**Files to update:**
- `packages/cli/src/controllers/users.controller.ts`
- `packages/cli/src/controllers/project.controller.ts`
- `packages/cli/src/controllers/folder.controller.ts`
- `packages/cli/src/controllers/role.controller.ts`
- `packages/cli/src/controllers/invitation.controller.ts`
- `packages/cli/src/controllers/orchestration.controller.ts`
- `packages/cli/src/controllers/credentials.controller.ts`
- `packages/cli/src/workflows/workflows.controller.ts`
- `packages/cli/src/modules/insights/insights.controller.ts`
- `packages/cli/src/eventbus/event-bus.controller.ts`
- `packages/cli/src/environments.ee/variables/variables.controller.ee.ts`

**Example for each file:**

```typescript
// BEFORE:
@Licensed('feat:advancedPermissions')
@GlobalScope('user:changeRole')
async changeGlobalRole() {
    // method implementation
}

// AFTER:
@GlobalScope('user:changeRole')
async changeGlobalRole() {
    // method implementation
}
```

### Step 2.7: Update License-Dependent Services

**File: `packages/cli/src/services/frontend.service.ts`**

```typescript
// Replace license dependency injection
constructor(
    // Remove: private readonly license: License,
    private readonly communityLicense: CommunityLicense,
    // ... other dependencies
) {}

// Update license settings method
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
        oidc: true,
        mfaEnforcement: true,
        advancedExecutionFilters: true,
        variables: true,
        sourceControl: true,
        externalSecrets: true,
        showNonProdBanner: false,
        workflowHistory: true,
        debugInEditor: true,
        binaryDataS3: true,
        multipleMainInstances: true,
        workerView: true,
        advancedPermissions: true,
        projectRole: {
            admin: true,
            editor: true,
            viewer: true
        },
        aiAssistant: true,
        askAi: true,
        aiCredits: true,
        folders: true,
        insights: {
            viewSummary: true,
            viewDashboard: true,
            viewHourlyData: true
        },
        apiKeyScopes: true,
        customRoles: true,
        communityNodesCustomRegistry: true
    });
}
```

### Step 2.8: Update All License-Dependent Services

**Services to update:**
- `packages/cli/src/auth/auth.service.ts`
- `packages/cli/src/executions/executions.controller.ts`
- `packages/cli/src/executions/execution.service.ts`
- `packages/cli/src/modules/community-packages/community-packages.service.ts`
- `packages/cli/src/modules/insights/insights.service.ts`
- `packages/cli/src/modules/external-secrets.ee/external-secrets-manager.ee.ts`
- `packages/cli/src/environments.ee/variables/variables.service.ee.ts`
- `packages/cli/src/workflows/workflow-history.ee/workflow-history-helper.ee.ts`
- `packages/cli/src/environments.ee/source-control/source-control-helper.ee.ts`

**Pattern for each service:**

```typescript
// Replace License injection with CommunityLicense
constructor(
    // BEFORE: private readonly license: License,
    private readonly communityLicense: CommunityLicense,
    // ... other dependencies
) {}

// Update all license checks to use communityLicense
// All checks will return true/unlimited values
```

### Step 2.9: Update Public API Middleware

**File: `packages/cli/src/public-api/v1/shared/middlewares/global.middleware.ts`**

```typescript
// Remove license-based user limit checks
export const globalMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Remove license validation
    // Always allow access in community edition
    next();
};
```

### Step 2.10: Test Phase 2 Changes

```bash
# Run tests to verify license removal
pnpm test

# Start server to verify it starts without license controller
pnpm dev

# Verify all previously licensed features are accessible
curl http://localhost:5678/rest/users
curl http://localhost:5678/rest/workflows
```

## Phase 3: Subscription System Removal

### Step 3.1: Remove Subscription Controllers and Services

```bash
# Switch to subscription removal branch
git checkout phase/2-subscription-removal

# Remove subscription controller
rm packages/cli/src/controllers/subscription.controller.ts

# Remove subscription service
rm packages/cli/src/services/subscription.service.ts

# Remove payment services
rm -rf packages/cli/src/services/payment/

# Remove subscription configuration
rm packages/@n8n/config/src/configs/subscription.config.ts
```

### Step 3.2: Remove Database Entities and Repositories

```bash
# Remove subscription entities
rm packages/@n8n/db/src/entities/subscription-plan.ts
rm packages/@n8n/db/src/entities/user-subscription.ts
rm packages/@n8n/db/src/entities/invoice.ts
rm packages/@n8n/db/src/entities/payment-method.ts
rm packages/@n8n/db/src/entities/usage-tracking.ts
rm packages/@n8n/db/src/entities/email-verification.ts

# Remove subscription repositories
rm packages/@n8n/db/src/repositories/subscription-plan.repository.ts
rm packages/@n8n/db/src/repositories/user-subscription.repository.ts
rm packages/@n8n/db/src/repositories/email-verification.repository.ts

# Remove subscription migrations
rm packages/@n8n/db/src/migrations/postgresdb/1740500000000-CreateSubscriptionTables.ts
rm packages/@n8n/db/src/migrations/postgresdb/1740500001000-SeedSubscriptionPlans.ts
rm packages/@n8n/db/src/migrations/postgresdb/1740445074053-CreateEmailVerificationTable.ts
```

### Step 3.3: Update Database Entity Index

**File: `packages/@n8n/db/src/entities/index.ts`**

```typescript
// Remove subscription-related exports
// BEFORE:
export { SubscriptionPlan } from './subscription-plan';
export { UserSubscription } from './user-subscription';
export { Invoice } from './invoice';
export { PaymentMethod } from './payment-method';
export { UsageTracking } from './usage-tracking';
export { EmailVerification } from './email-verification';

// AFTER:
// Remove all subscription-related exports
```

### Step 3.4: Update Repository Index

**File: `packages/@n8n/db/src/repositories/index.ts`**

```typescript
// Remove subscription repository exports
// BEFORE:
export { SubscriptionPlanRepository } from './subscription-plan.repository';
export { UserSubscriptionRepository } from './user-subscription.repository';
export { EmailVerificationRepository } from './email-verification.repository';

// AFTER:
// Remove all subscription repository exports
```

### Step 3.5: Remove API Types and DTOs

```bash
# Remove subscription DTOs
rm -rf packages/@n8n/api-types/src/dto/subscription/
rm -rf packages/@n8n/api-types/src/dto/webhook/
rm packages/@n8n/api-types/src/dto/auth/cloud-signup-request.dto.ts
rm packages/@n8n/api-types/src/dto/auth/verification.dto.ts
```

### Step 3.6: Update API Types Index

**File: `packages/@n8n/api-types/src/dto/index.ts`**

```typescript
// Remove subscription-related exports
// Remove all imports and exports related to:
// - subscription DTOs
// - webhook DTOs
// - cloud signup DTOs
// - verification DTOs
```

### Step 3.7: Remove Webhook Controller Subscription Parts

**File: `packages/cli/src/controllers/webhook.controller.ts`**

```typescript
// Remove subscription-related webhook handling
// Remove imports:
// - SubscriptionService
// - subscription-related request types

// Remove methods:
// - handleAdyenWebhook
// - handleSubscriptionEvents
```

### Step 3.8: Update Requests Types

**File: `packages/cli/src/requests.ts`**

```typescript
// Remove subscription request namespaces
// BEFORE:
export declare namespace SubscriptionRequest {
    // ... subscription request types
}

// AFTER:
// Remove entire SubscriptionRequest namespace
```

### Step 3.9: Test Phase 3 Changes

```bash
# Run tests to verify subscription removal
pnpm test

# Verify server starts without subscription dependencies
pnpm dev

# Verify subscription endpoints return 404
curl http://localhost:5678/rest/subscriptions/plans
```

## Phase 4: Frontend Cleanup

### Step 4.1: Remove Subscription Stores

```bash
# Switch to frontend cleanup branch
git checkout phase/3-frontend-cleanup

# Remove subscription stores
rm packages/frontend/editor-ui/src/stores/subscription.store.ts
rm packages/frontend/editor-ui/src/stores/cloudPlan.store.ts
```

### Step 4.2: Remove Subscription API Clients

```bash
# Remove subscription API clients
rm packages/frontend/@n8n/rest-api-client/src/api/subscriptions.ts
rm packages/frontend/@n8n/rest-api-client/src/api/cloudPlans.ts
```

### Step 4.3: Remove Subscription Views and Components

```bash
# Remove subscription-related views
rm packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.vue
rm packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.test.ts
```

### Step 4.4: Update Settings Store

**File: `packages/frontend/editor-ui/src/stores/settings.store.ts`**

```typescript
// Remove subscription-related state and methods
// Remove imports related to subscription
// Simplify to community-only settings
// Remove license environment references
```

### Step 4.5: Update Usage Store

**File: `packages/frontend/editor-ui/src/stores/usage.store.ts`**

```typescript
// Remove subscription URL computeds
// Remove license-related API calls
// Simplify to community usage tracking only
// Remove external subscription URL references
```

### Step 4.6: Update Settings Sidebar

**File: `packages/frontend/editor-ui/src/components/SettingsSidebar.vue`**

```vue
<!-- Remove subscription/billing related menu items -->
<!-- Remove license management links -->
<!-- Simplify to community features only -->
```

### Step 4.7: Update Router

**File: `packages/frontend/editor-ui/src/router.ts`**

```typescript
// Remove subscription-related routes
// Remove license management routes
// Update route guards to remove license checks
```

### Step 4.8: Update Debug Info

**File: `packages/frontend/editor-ui/src/composables/useDebugInfo.ts`**

```typescript
// Remove license environment references
// Remove subscription-related debug info
// Simplify to community edition info
```

### Step 4.9: Test Phase 4 Changes

```bash
# Build frontend to verify no compilation errors
pnpm build

# Run frontend tests
pnpm test:frontend

# Start development server
pnpm dev
```

## Phase 5: Feature Democratization

### Step 5.1: Update All Services to Use Community License

```bash
# Switch to feature democratization branch
git checkout phase/4-feature-democratization
```

**Update all services that inject License to use CommunityLicense:**

```typescript
// Pattern for all affected services:
constructor(
    // BEFORE: private readonly license: License,
    private readonly communityLicense: CommunityLicense,
    // ... other dependencies
) {}
```

### Step 5.2: Remove Feature Gates

**Remove all feature restrictions in:**
- User management (unlimited users)
- Workflow limits (unlimited workflows)
- Execution limits (unlimited executions)
- Variable limits (unlimited variables)
- Project limits (unlimited projects)
- All enterprise features enabled

### Step 5.3: Update E2E Controller

**File: `packages/cli/src/controllers/e2e.controller.ts`**

```typescript
// Update to enable all features by default
private enabledFeatures: Record<BooleanLicenseFeature, boolean> = {
    // Set all features to true
    [LICENSE_FEATURES.SHARING]: true,
    [LICENSE_FEATURES.LDAP]: true,
    [LICENSE_FEATURES.SAML]: true,
    // ... all other features set to true
};

private numericFeatures: Record<NumericLicenseFeature, number> = {
    // Set all limits to unlimited (-1)
    [LICENSE_QUOTAS.TRIGGER_LIMIT]: -1,
    [LICENSE_QUOTAS.VARIABLES_LIMIT]: -1,
    [LICENSE_QUOTAS.USERS_LIMIT]: -1,
    // ... all other quotas set to -1
};
```

### Step 5.4: Test Phase 5 Changes

```bash
# Run comprehensive tests
pnpm test

# Test all previously premium features
# - User management
# - Advanced permissions
# - Project management
# - Folder management
# - Variables
# - Source control
# - External secrets
# - Log streaming
# - Advanced execution filters
```

## Phase 6: Final Cleanup

### Step 6.1: Remove Environment Variables

```bash
# Switch to final cleanup branch
git checkout phase/5-final-cleanup

# Update documentation to remove license-related environment variables
# Remove from docker-compose files, helm charts, etc.
```

**Environment variables to remove:**
```bash
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

### Step 6.2: Update Docker Configuration

**File: `docker/images/n8n/docker-entrypoint.sh`**

```bash
# Remove license-related environment variable handling
# Remove subscription-related environment variable handling
```

### Step 6.3: Update Package Dependencies

```bash
# Remove license-related dependencies
# Remove payment processing dependencies (Adyen SDK, etc.)
# Update package.json files
```

### Step 6.4: Update Documentation

```bash
# Update README.md to reflect community edition
# Remove license-related documentation
# Update deployment guides
# Update configuration documentation
```

### Step 6.5: Final Testing

```bash
# Run full test suite
pnpm test

# Build all packages
pnpm build

# Test Docker build
docker build -t n8n-community .

# Run Docker container
docker run -p 5678:5678 n8n-community

# Verify all features work without license
```

## Phase 7: Integration and Deployment

### Step 7.1: Merge All Phases

```bash
# Merge all phase branches into main feature branch
git checkout feature/eliminate-license-dependencies
git merge phase/1-license-removal
git merge phase/2-subscription-removal
git merge phase/3-frontend-cleanup
git merge phase/4-feature-democratization
git merge phase/5-final-cleanup
```

### Step 7.2: Final Integration Testing

```bash
# Run comprehensive integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Performance testing
pnpm test:performance
```

### Step 7.3: Create Migration Guide

**Create documentation for:**
- Existing users migrating from licensed to community
- Configuration changes required
- Feature availability changes
- Deployment updates

### Step 7.4: Prepare Release

```bash
# Update version numbers
# Update changelog
# Create release notes
# Tag release
git tag -a v1.0.0-community -m "Community Edition Release"
```

## Success Criteria

- [x] All license-related code removed
- [x] All subscription-related code removed
- [x] All premium features available in community edition
- [x] No external license server dependencies
- [x] No payment processing dependencies
- [x] All tests passing
- [x] Docker build successful
- [x] Documentation updated
- [x] Migration guide created

## Risk Mitigation

### Rollback Plan
- Maintain backup branches for each phase
- Document rollback procedures
- Test rollback scenarios

### Compatibility
- Ensure existing workflows continue to work
- Maintain API compatibility where possible
- Provide clear migration documentation

### Testing
- Comprehensive test coverage for all changes
- Integration testing across all components
- Performance testing to ensure no regressions

## Timeline Estimate

- **Phase 1 (Preparation)**: 1 day
- **Phase 2 (License Removal)**: 2-3 days
- **Phase 3 (Subscription Removal)**: 2-3 days
- **Phase 4 (Frontend Cleanup)**: 2-3 days
- **Phase 5 (Feature Democratization)**: 1-2 days
- **Phase 6 (Final Cleanup)**: 1-2 days
- **Phase 7 (Integration)**: 1-2 days

**Total Estimated Time**: 10-16 days

## Conclusion

This comprehensive action plan provides step-by-step instructions for completely eliminating all license dependencies from the n8n project. Following this plan will result in a pure open-source community edition with all features enabled and no commercial restrictions.

The phased approach ensures safe implementation with proper testing and rollback capabilities at each stage.
