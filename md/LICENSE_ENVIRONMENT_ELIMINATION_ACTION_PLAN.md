# License Environment URL Elimination Action Plan

## Executive Summary

This document outlines a comprehensive action plan to eliminate the `settingsStore.settings.license.environment` URLs (`https://subscription.n8n.io` and `https://staging-subscription.n8n.io`) and fully transition to the new subscription model architecture.

## Current State Analysis

### 1. License Environment URL Usage

**Current Implementation in `usage.store.ts`:**
```typescript
const subscriptionAppUrl = computed(() =>
  settingsStore.settings.license.environment === 'production'
    ? 'https://subscription.n8n.io'
    : 'https://staging-subscription.n8n.io',
);
```

**Files Currently Using These URLs:**
- `packages/frontend/editor-ui/src/stores/usage.store.ts` - Main usage for subscription URLs
- `packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.test.ts` - Test file references
- `packages/frontend/editor-ui/src/composables/useDebugInfo.ts` - Debug information display
- `packages/frontend/editor-ui/dist/assets/index-Dhahl8WD.js` - Compiled bundle (will be regenerated)

### 2. New Subscription Architecture

**Backend Components:**
- ✅ `SubscriptionService` - Complete subscription management
- ✅ `SubscriptionController` - REST API endpoints
- ✅ Database entities and repositories
- ✅ Payment service integration (Adyen)
- ✅ Webhook handling

**Frontend Components:**
- ✅ `subscriptionStore` - New Pinia store for subscription management
- ✅ `subscriptionsApi` - REST API client
- ✅ Subscription management components
- ✅ Database migrations and seeding

### 3. Integration Points

**Current Dependencies:**
1. **Usage Store** - Uses license environment for external subscription URLs
2. **Settings Store** - Provides license environment configuration
3. **Debug Info** - Uses license environment for environment detection
4. **Plan Management** - Currently relies on external subscription URLs

## Action Plan

### Phase 1: Backend API Integration (Priority: High)

#### 1.1 Update Usage Store to Use Internal APIs
**File:** `packages/frontend/editor-ui/src/stores/usage.store.ts`

**Changes Required:**
- Remove `subscriptionAppUrl` computed property
- Remove `viewPlansUrl` and `managePlanUrl` computed properties
- Replace external URL dependencies with internal subscription store integration
- Update telemetry payload to work with new subscription model

**Implementation:**
```typescript
// Remove these computed properties:
// - subscriptionAppUrl
// - viewPlansUrl
// - managePlanUrl

// Add integration with subscription store:
const subscriptionStore = useSubscriptionStore();

// Replace external URLs with internal navigation/API calls
const viewPlans = () => {
  // Navigate to internal subscription management page
  router.push('/settings/subscription');
};

const managePlan = () => {
  // Use internal subscription management
  subscriptionStore.fetchCurrentSubscription();
};
```

#### 1.2 Update Settings Store Configuration
**File:** `packages/frontend/editor-ui/src/stores/settings.store.ts`

**Changes Required:**
- Add `subscriptionEnabled` flag to settings interface
- Remove dependency on `license.environment` for subscription functionality
- Add subscription-related computed properties

#### 1.3 Update Debug Info Component
**File:** `packages/frontend/editor-ui/src/composables/useDebugInfo.ts`

**Changes Required:**
- Replace `license.environment` check with subscription store data
- Use internal subscription status for environment detection

### Phase 2: Frontend Component Updates (Priority: High)

#### 2.1 Update Settings Usage and Plan View
**File:** `packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.vue`

**Changes Required:**
- Replace usage store URL methods with subscription store
- Integrate with internal subscription management
- Remove external URL redirections

#### 2.2 Update Subscription Management Component
**File:** `packages/frontend/editor-ui/src/components/SubscriptionManagement.vue`

**Changes Required:**
- Ensure full integration with subscription store
- Remove any remaining external URL dependencies
- Implement complete subscription lifecycle management

### Phase 3: Configuration and Settings (Priority: Medium)

#### 3.1 Backend Configuration Updates
**Files:**
- `packages/@n8n/config/src/configs/subscription.config.ts`
- Backend settings API endpoints

**Changes Required:**
- Add `subscriptionEnabled` configuration flag
- Remove `license.environment` from frontend settings
- Add subscription-related configuration options

#### 3.2 Frontend Settings Integration
**Changes Required:**
- Update settings API to include subscription configuration
- Remove license environment from frontend settings payload
- Add subscription status to settings

### Phase 4: Testing and Validation (Priority: High)

#### 4.1 Update Test Files
**File:** `packages/frontend/editor-ui/src/views/SettingsUsageAndPlan.test.ts`

**Changes Required:**
- Remove hardcoded subscription URL tests
- Add tests for internal subscription store integration
- Update mocks to use new subscription architecture

#### 4.2 End-to-End Testing
**File:** `cypress/e2e/27-cloud.cy.ts`

**Changes Required:**
- Update cloud/subscription related tests
- Remove external URL navigation tests
- Add internal subscription flow tests

### Phase 5: Cleanup and Migration (Priority: Low)

#### 5.1 Remove Legacy Code
**Files to Clean:**
- Remove `license.environment` references
- Remove external subscription URL constants
- Clean up unused imports and dependencies

#### 5.2 Database Migration
**Considerations:**
- Ensure existing license data is properly migrated
- Maintain backward compatibility during transition
- Plan for gradual rollout

## Implementation Strategy

### Step-by-Step Execution

1. **Preparation Phase**
   - Enable subscription system in configuration
   - Ensure all database migrations are applied
   - Verify subscription store functionality

2. **Backend Integration**
   - Update usage store to remove external URLs
   - Integrate with subscription store
   - Update settings configuration

3. **Frontend Updates**
   - Update all components to use internal subscription management
   - Remove external URL dependencies
   - Update routing and navigation

4. **Testing Phase**
   - Update all test files
   - Run comprehensive testing
   - Validate subscription workflows

5. **Deployment and Monitoring**
   - Deploy with feature flags if possible
   - Monitor for issues
   - Gradual rollout to users

## Risk Assessment

### High Risk
- **User Experience Disruption**: Users accustomed to external subscription management
- **Data Migration**: Ensuring existing license data is properly handled
- **Payment Integration**: Ensuring payment flows work correctly

### Medium Risk
- **Testing Coverage**: Ensuring all subscription flows are properly tested
- **Configuration Management**: Managing different environments properly

### Low Risk
- **Code Cleanup**: Removing legacy code
- **Documentation Updates**: Updating relevant documentation

## Success Criteria

1. ✅ All external subscription URLs removed from codebase
2. ✅ Internal subscription management fully functional
3. ✅ All tests passing with new architecture
4. ✅ User workflows uninterrupted
5. ✅ Payment processing working correctly
6. ✅ Subscription lifecycle management complete

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 2-3 days
- **Phase 3**: 1-2 days
- **Phase 4**: 2-3 days
- **Phase 5**: 1 day

**Total Estimated Time**: 8-12 days

## Dependencies

1. **Subscription System Activation**: Ensure subscription system is enabled in configuration
2. **Database Setup**: All subscription-related tables and data must be ready
3. **Payment Integration**: Adyen payment service must be properly configured
4. **Feature Flags**: Consider using feature flags for gradual rollout

## Next Steps

1. Review and approve this action plan
2. Set up development environment with subscription system enabled
3. Begin Phase 1 implementation
4. Coordinate with QA team for testing strategy
5. Plan deployment and rollout strategy

---

*This action plan provides a comprehensive roadmap for eliminating license environment URLs and fully transitioning to the new subscription model. Each phase builds upon the previous one, ensuring a smooth and safe migration.*
