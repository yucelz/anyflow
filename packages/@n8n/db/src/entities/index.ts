import { AnnotationTagEntity } from './annotation-tag-entity.ee';
import { AnnotationTagMapping } from './annotation-tag-mapping.ee';
import { ApiKey } from './api-key';
import { AuthIdentity } from './auth-identity';
import { AuthProviderSyncHistory } from './auth-provider-sync-history';
import { CredentialsEntity } from './credentials-entity';
import { EmailVerification } from './email-verification';
import { EventDestinations } from './event-destinations';
import { ExecutionAnnotation } from './execution-annotation.ee';
import { ExecutionData } from './execution-data';
import { ExecutionEntity } from './execution-entity';
import { ExecutionMetadata } from './execution-metadata';
import { Folder } from './folder';
import { FolderTagMapping } from './folder-tag-mapping';
import { InvalidAuthToken } from './invalid-auth-token';
import { Invoice } from './invoice';
import {
	LicenseEntity,
	LicenseType,
	LicenseStatus,
	ApprovalStatus,
	LicenseFeatures,
	LicenseLimits,
} from './license.entity';
import { LicenseApprovalEntity, ApprovalType, ApprovalPriority } from './license-approval.entity';
import { LicenseAuditLogEntity, LicenseAuditAction } from './license-audit-log.entity';
import { LicenseTemplateEntity } from './license-template.entity';
import { OwnerManagementEntity } from './owner-management.entity';
import { PaymentMethod } from './payment-method';
import { ProcessedData } from './processed-data';
import { Project } from './project';
import { ProjectRelation } from './project-relation';
import { Role } from './role';
import { Scope } from './scope';
import { Settings } from './settings';
import { SharedCredentials } from './shared-credentials';
import { SharedWorkflow } from './shared-workflow';
import { SubscriptionPlan } from './subscription-plan';
import { TagEntity } from './tag-entity';
import { TestCaseExecution } from './test-case-execution.ee';
import { TestRun } from './test-run.ee';
import { UsageTracking } from './usage-tracking';
import { User } from './user';
import { UserSubscription } from './user-subscription';
import { Variables } from './variables';
import { WebhookEntity } from './webhook-entity';
import { WorkflowEntity } from './workflow-entity';
import { WorkflowHistory } from './workflow-history';
import { WorkflowStatistics } from './workflow-statistics';
import { WorkflowTagMapping } from './workflow-tag-mapping';

export {
	EventDestinations,
	InvalidAuthToken,
	ProcessedData,
	Settings,
	Variables,
	ApiKey,
	WebhookEntity,
	AuthIdentity,
	CredentialsEntity,
	EmailVerification,
	Folder,
	Project,
	ProjectRelation,
	Role,
	Scope,
	SharedCredentials,
	SharedWorkflow,
	TagEntity,
	User,
	WorkflowEntity,
	WorkflowStatistics,
	WorkflowTagMapping,
	FolderTagMapping,
	AuthProviderSyncHistory,
	WorkflowHistory,
	ExecutionData,
	ExecutionMetadata,
	AnnotationTagEntity,
	ExecutionAnnotation,
	AnnotationTagMapping,
	TestRun,
	TestCaseExecution,
	ExecutionEntity,
	Invoice,
	PaymentMethod,
	SubscriptionPlan,
	UsageTracking,
	UserSubscription,
	LicenseEntity,
	LicenseApprovalEntity,
	LicenseAuditLogEntity,
	LicenseTemplateEntity,
	OwnerManagementEntity,
	ApprovalType,
	ApprovalPriority,
	ApprovalStatus,
	LicenseType,
	LicenseStatus,
	LicenseFeatures,
	LicenseLimits,
	LicenseAuditAction,
};

export const entities = {
	EventDestinations,
	InvalidAuthToken,
	ProcessedData,
	Settings,
	Variables,
	ApiKey,
	WebhookEntity,
	AuthIdentity,
	CredentialsEntity,
	EmailVerification,
	Folder,
	Project,
	ProjectRelation,
	Scope,
	SharedCredentials,
	SharedWorkflow,
	TagEntity,
	User,
	WorkflowEntity,
	WorkflowStatistics,
	WorkflowTagMapping,
	FolderTagMapping,
	AuthProviderSyncHistory,
	WorkflowHistory,
	ExecutionData,
	ExecutionMetadata,
	AnnotationTagEntity,
	ExecutionAnnotation,
	AnnotationTagMapping,
	TestRun,
	TestCaseExecution,
	ExecutionEntity,
	Role,
	Invoice,
	PaymentMethod,
	SubscriptionPlan,
	UsageTracking,
	UserSubscription,
	LicenseEntity,
	LicenseApprovalEntity,
	LicenseAuditLogEntity,
	LicenseTemplateEntity,
	OwnerManagementEntity,
};
