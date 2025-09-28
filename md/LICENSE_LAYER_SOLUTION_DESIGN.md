# License Layer Solution Design Document

## Executive Summary

This document outlines the design for a standalone license layer with comprehensive entity tables, approval mechanisms, and owner-exclusive management capabilities for the n8n platform. The solution addresses the current architectural gaps and provides a robust foundation for license management, subscription handling, and feature control.

## Current Architecture Analysis

### Existing Components Review

#### 1. License Controller (`license.controller.ts`)
**Strengths:**
- RESTful API endpoints for license operations
- Global scope protection for sensitive operations
- Integration with local license API service
- Owner-only enterprise license generation

**Gaps:**
- Limited approval workflow mechanisms
- No comprehensive audit trail
- Missing license lifecycle management
- Insufficient validation and verification layers

#### 2. License Service (`license.service.ts`)
**Strengths:**
- Integration with LicenseState and License SDK
- Usage metrics collection
- Community and enterprise trial handling
- Error mapping and validation

**Gaps:**
- No approval workflow integration
- Limited license status tracking
- Missing comprehensive license history
- No owner-specific management features

#### 3. Local License API Service (`local-license-api.service.ts`)
**Strengths:**
- Local license generation capabilities
- Multiple license types support (trial, community, enterprise)
- Integration with subscription plans
- License validation mechanisms

**Gaps:**
- No approval workflow
- Limited audit capabilities
- Missing license lifecycle tracking
- No comprehensive owner management

#### 4. Core License Class (`license.ts`)
**Strengths:**
- Comprehensive feature checking
- SDK integration
- Metrics collection
- Auto-renewal capabilities

**Gaps:**
- No approval mechanisms
- Limited owner-specific features
- Missing comprehensive audit trail

#### 5. Subscription Model
**Strengths:**
- Comprehensive subscription plan entity
- User subscription tracking
- Payment method integration
- Usage tracking capabilities

**Gaps:**
- No direct license integration
- Missing approval workflows
- Limited owner management features

## Proposed Solution Architecture

### 1. Standalone License Layer Design

#### Core Principles
- **Separation of Concerns**: Clear separation between license management, subscription handling, and feature control
- **Owner-Centric Control**: Exclusive owner access to critical license operations
- **Comprehensive Auditing**: Full audit trail for all license operations
- **Approval Workflows**: Multi-stage approval processes for license changes
- **Scalable Architecture**: Support for future license types and features

### 2. New Entity Tables Design

#### 2.1 License Entity
```typescript
interface License {
  id: string;
  licenseKey: string;
  licenseType: 'community' | 'trial' | 'enterprise' | 'custom';
  status: 'pending' | 'active' | 'suspended' | 'expired' | 'revoked';
  issuedTo: string; // User ID or organization
  issuedBy: string; // User ID (must be owner)
  validFrom: Date;
  validUntil: Date;
  features: LicenseFeatures;
  limits: LicenseLimits;
  metadata: Record<string, any>;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string; // Owner user ID
  approvedAt?: Date;
  rejectionReason?: string;
  subscriptionId?: string; // Link to subscription
  parentLicenseId?: string; // For sub-licenses
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.2 License Approval Entity
```typescript
interface LicenseApproval {
  id: string;
  licenseId: string;
  requestedBy: string; // User ID
  approvalType: 'creation' | 'modification' | 'renewal' | 'revocation';
  requestData: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approvedBy?: string; // Owner user ID
  approvedAt?: Date;
  rejectedBy?: string; // Owner user ID
  rejectedAt?: Date;
  rejectionReason?: string;
  expiresAt: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.3 License Audit Log Entity
```typescript
interface LicenseAuditLog {
  id: string;
  licenseId: string;
  action: 'created' | 'activated' | 'suspended' | 'renewed' | 'revoked' | 'modified';
  performedBy: string; // User ID
  previousState?: Record<string, any>;
  newState: Record<string, any>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}
```

#### 2.4 License Template Entity
```typescript
interface LicenseTemplate {
  id: string;
  name: string;
  description: string;
  licenseType: 'community' | 'trial' | 'enterprise' | 'custom';
  defaultFeatures: LicenseFeatures;
  defaultLimits: LicenseLimits;
  defaultValidityDays: number;
  requiresApproval: boolean;
  isActive: boolean;
  createdBy: string; // Owner user ID
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2.5 Owner Management Entity
```typescript
interface OwnerManagement {
  id: string;
  ownerId: string; // User ID with global:owner role
  permissions: OwnerPermissions;
  delegatedUsers: string[]; // User IDs with delegated permissions
  settings: OwnerSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface OwnerPermissions {
  canCreateLicenses: boolean;
  canApproveLicenses: boolean;
  canRevokeLicenses: boolean;
  canManageTemplates: boolean;
  canDelegatePermissions: boolean;
  canViewAuditLogs: boolean;
  canManageSubscriptions: boolean;
}

interface OwnerSettings {
  autoApprovalEnabled: boolean;
  autoApprovalCriteria: Record<string, any>;
  notificationPreferences: Record<string, boolean>;
  approvalTimeoutDays: number;
}
```

### 3. License-Subscription Integration

#### 3.1 Enhanced Subscription Plan Integration
```typescript
interface EnhancedSubscriptionPlan extends SubscriptionPlan {
  licenseTemplateId?: string; // Link to license template
  autoLicenseGeneration: boolean;
  licenseApprovalRequired: boolean;
  maxLicensesPerSubscription: number;
}
```

#### 3.2 Subscription-License Mapping
```typescript
interface SubscriptionLicense {
  id: string;
  subscriptionId: string;
  licenseId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4. Owner-Exclusive Management Model

#### 4.1 Access Control Layer
```typescript
interface OwnerAccessControl {
  // Only global:owner can perform these operations
  createLicense(template: LicenseTemplate, targetUser: string): Promise<License>;
  approveLicense(approvalId: string, decision: 'approve' | 'reject', reason?: string): Promise<void>;
  revokeLicense(licenseId: string, reason: string): Promise<void>;
  createLicenseTemplate(template: Partial<LicenseTemplate>): Promise<LicenseTemplate>;
  delegatePermissions(userId: string, permissions: Partial<OwnerPermissions>): Promise<void>;
  viewAuditLogs(filters: AuditLogFilters): Promise<LicenseAuditLog[]>;
  manageOwnerSettings(settings: Partial<OwnerSettings>): Promise<void>;
}
```

#### 4.2 Approval Workflow Engine
```typescript
interface ApprovalWorkflow {
  submitApproval(request: LicenseApprovalRequest): Promise<LicenseApproval>;
  processApproval(approvalId: string, decision: ApprovalDecision): Promise<void>;
  getApprovalQueue(filters: ApprovalFilters): Promise<LicenseApproval[]>;
  autoProcessApprovals(): Promise<void>; // Based on owner settings
  notifyOwners(approval: LicenseApproval): Promise<void>;
  expireApprovals(): Promise<void>; // Cleanup expired approvals
}
```

### 5. Service Layer Architecture

#### 5.1 Enhanced License Management Service
```typescript
@Service()
export class EnhancedLicenseManagementService {
  constructor(
    private readonly licenseRepository: LicenseRepository,
    private readonly approvalRepository: LicenseApprovalRepository,
    private readonly auditRepository: LicenseAuditLogRepository,
    private readonly templateRepository: LicenseTemplateRepository,
    private readonly ownerRepository: OwnerManagementRepository,
    private readonly approvalWorkflow: ApprovalWorkflow,
    private readonly accessControl: OwnerAccessControl,
  ) {}

  // Core license operations
  async createLicense(request: CreateLicenseRequest): Promise<License>;
  async activateLicense(licenseKey: string, userId: string): Promise<void>;
  async renewLicense(licenseId: string): Promise<License>;
  async suspendLicense(licenseId: string, reason: string): Promise<void>;
  async revokeLicense(licenseId: string, reason: string): Promise<void>;

  // Approval operations
  async submitLicenseRequest(request: LicenseRequest): Promise<LicenseApproval>;
  async processApproval(approvalId: string, decision: ApprovalDecision): Promise<void>;
  async getApprovalQueue(ownerId: string): Promise<LicenseApproval[]>;

  // Owner operations
  async initializeOwnerManagement(ownerId: string): Promise<OwnerManagement>;
  async updateOwnerSettings(ownerId: string, settings: Partial<OwnerSettings>): Promise<void>;
  async delegatePermissions(ownerId: string, targetUserId: string, permissions: Partial<OwnerPermissions>): Promise<void>;

  // Audit and reporting
  async getAuditLogs(filters: AuditLogFilters): Promise<LicenseAuditLog[]>;
  async generateLicenseReport(filters: ReportFilters): Promise<LicenseReport>;
}
```

#### 5.2 License Validation Service
```typescript
@Service()
export class LicenseValidationService {
  async validateLicenseKey(licenseKey: string): Promise<ValidationResult>;
  async validateLicenseFeatures(licenseId: string, features: string[]): Promise<boolean>;
  async validateLicenseLimits(licenseId: string, usage: UsageData): Promise<ValidationResult>;
  async validateLicenseStatus(licenseId: string): Promise<boolean>;
  async validateOwnerPermissions(userId: string, operation: string): Promise<boolean>;
}
```

### 6. API Layer Enhancements

#### 6.1 Enhanced License Controller
```typescript
@RestController('/license')
export class EnhancedLicenseController {
  // Owner-only endpoints
  @Post('/create')
  @GlobalScope('license:owner')
  async createLicense(req: AuthenticatedRequest, @Body body: CreateLicenseRequest);

  @Post('/approve/:approvalId')
  @GlobalScope('license:owner')
  async approveLicense(req: AuthenticatedRequest, @Param('approvalId') approvalId: string, @Body body: ApprovalDecision);

  @Post('/revoke/:licenseId')
  @GlobalScope('license:owner')
  async revokeLicense(req: AuthenticatedRequest, @Param('licenseId') licenseId: string, @Body body: RevocationRequest);

  @Get('/approvals/queue')
  @GlobalScope('license:owner')
  async getApprovalQueue(req: AuthenticatedRequest);

  @Get('/audit-logs')
  @GlobalScope('license:owner')
  async getAuditLogs(req: AuthenticatedRequest, @Query() filters: AuditLogFilters);

  // User endpoints
  @Post('/request')
  @GlobalScope('license:request')
  async requestLicense(req: AuthenticatedRequest, @Body body: LicenseRequest);

  @Get('/my-licenses')
  async getMyLicenses(req: AuthenticatedRequest);

  @Post('/activate')
  async activateLicense(req: AuthenticatedRequest, @Body body: { licenseKey: string });
}
```

### 7. Database Migration Strategy

#### 7.1 Migration Sequence
1. **Create License Tables**: Core license entities
2. **Create Approval Tables**: Approval workflow entities
3. **Create Audit Tables**: Audit logging entities
4. **Create Owner Management Tables**: Owner-specific entities
5. **Update Subscription Tables**: Add license integration fields
6. **Seed Default Data**: Create default templates and owner settings

#### 7.2 Data Migration
- Migrate existing license data to new structure
- Create default license templates
- Initialize owner management for existing global:owner users
- Establish audit trail for existing licenses

### 8. Security Considerations

#### 8.1 Access Control
- **Role-Based Access**: Strict role checking for owner operations
- **Permission Delegation**: Controlled delegation of owner permissions
- **Audit Trail**: Comprehensive logging of all operations
- **Rate Limiting**: Prevent abuse of license operations

#### 8.2 Data Protection
- **Encryption**: Sensitive license data encryption
- **Secure Storage**: Protected storage of license keys
- **Access Logging**: Log all access to license data
- **Data Retention**: Configurable retention policies

### 9. Integration Points

#### 9.1 Existing System Integration
- **License SDK**: Enhanced integration with existing license SDK
- **Subscription System**: Seamless integration with subscription plans
- **User Management**: Integration with user roles and permissions
- **Notification System**: Integration with existing notification mechanisms

#### 9.2 External System Integration
- **Payment Processors**: Integration with Stripe, PayPal, Square
- **Analytics**: License usage analytics and reporting
- **Monitoring**: System health and license status monitoring

### 10. Implementation Phases

#### Phase 1: Core Infrastructure (Weeks 1-2)
- Create new entity tables
- Implement basic repositories
- Set up database migrations

#### Phase 2: License Management (Weeks 3-4)
- Implement enhanced license management service
- Create license validation service
- Set up basic API endpoints

#### Phase 3: Approval Workflow (Weeks 5-6)
- Implement approval workflow engine
- Create approval management interfaces
- Set up notification system

#### Phase 4: Owner Management (Weeks 7-8)
- Implement owner-exclusive features
- Create owner management interfaces
- Set up permission delegation

#### Phase 5: Integration & Testing (Weeks 9-10)
- Integrate with existing systems
- Comprehensive testing
- Performance optimization

#### Phase 6: Deployment & Monitoring (Weeks 11-12)
- Production deployment
- Monitoring setup
- Documentation completion

### 11. Success Metrics

#### 11.1 Functional Metrics
- **License Creation Time**: < 5 seconds for standard licenses
- **Approval Processing Time**: < 24 hours for standard approvals
- **System Availability**: 99.9% uptime
- **Data Integrity**: 100% audit trail coverage

#### 11.2 Business Metrics
- **Owner Satisfaction**: Improved license management efficiency
- **User Experience**: Streamlined license activation process
- **Compliance**: Full audit trail for regulatory requirements
- **Scalability**: Support for 10x current license volume

### 12. Risk Mitigation

#### 12.1 Technical Risks
- **Data Migration**: Comprehensive testing and rollback procedures
- **Performance Impact**: Gradual rollout and monitoring
- **Integration Issues**: Extensive integration testing

#### 12.2 Business Risks
- **User Disruption**: Minimal downtime deployment strategy
- **Feature Regression**: Comprehensive regression testing
- **Security Vulnerabilities**: Security review and penetration testing

## Conclusion

This solution design provides a comprehensive, scalable, and secure license management layer that addresses all current architectural gaps while providing robust owner-exclusive management capabilities. The phased implementation approach ensures minimal disruption to existing operations while delivering significant improvements in license management, approval workflows, and audit capabilities.

The proposed architecture establishes a solid foundation for future license management requirements and provides the flexibility to adapt to changing business needs while maintaining security and compliance standards.
