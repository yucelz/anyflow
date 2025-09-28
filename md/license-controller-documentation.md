# License Controller Documentation

## Overview

The `LicenseController` is a REST API controller that manages license operations for the n8n workflow automation platform. It handles enterprise trial requests, community edition registration, license activation, renewal, and various license management operations.

## Controller Details

- **Base Route**: `/license`
- **File Location**: `packages/cli/src/license/license.controller.ts`
- **Authentication**: Uses JWT-based authentication with cookies
- **Authorization**: Several endpoints require `license:manage` global scope

## Dependencies

The controller injects the following services:

- `LicenseService`: Core license management operations
- `InstanceSettings`: Instance configuration and ID management
- `UrlService`: URL generation for instance and webhook endpoints
- `LocalLicenseApiService`: Local license API operations

## Authentication & Authorization

### Authentication Method
- **Type**: JWT-based authentication using HTTP cookies
- **Cookie Name**: Defined in `AUTH_COOKIE_NAME` constant
- **Token Structure**: Contains user ID, hash, browser ID, and MFA usage flag
- **Middleware**: `AuthenticatedRequest` type ensures user authentication

### Authorization Scopes
- `license:manage`: Required for most license management operations
- `global:owner`: Required for enterprise license generation

### Request Types
- `AuthenticatedRequest`: Standard authenticated request with user context
- `LicenseRequest.Activate`: Specific request type for license activation

## API Endpoints

### 1. Get License Data
```http
GET /license/
```

**Description**: Retrieves current license information and status.

**Authentication**: Required
**Authorization**: None (accessible to all authenticated users)
**Request Body**: None
**Response**: License data object containing current license status and details

---

### 2. Request Enterprise Trial
```http
POST /license/enterprise/request_trial
```

**Description**: Requests an enterprise trial license for the authenticated user.

**Authentication**: Required
**Authorization**: `license:manage` global scope
**Request Body**: None (uses authenticated user data)
**Response**: Success confirmation or error details

**Error Handling**:
- Catches `AxiosError` and extracts error messages
- Throws `BadRequestError` with specific error message or generic failure message

---

### 3. Register Community Edition
```http
POST /license/enterprise/community-registered
```

**Description**: Registers the community edition with user and instance details.

**Authentication**: Required
**Authorization**: None
**Request Body**:
```json
{
  "email": "user@example.com"
}
```
**Response**: Registration confirmation with license details

**Parameters Used**:
- `userId`: From authenticated user
- `email`: From request payload
- `instanceId`: From instance settings
- `instanceUrl`: Generated base URL
- `licenseType`: Set to 'community-registered'

---

### 4. Activate License
```http
POST /license/activate
```

**Description**: Activates a license using the provided activation key.

**Authentication**: Required
**Authorization**: `license:manage` global scope
**Request Body**:
```json
{
  "activationKey": "your-activation-key-here"
}
```
**Response**: License data with management token

---

### 5. Renew License
```http
POST /license/renew
```

**Description**: Renews the current active license.

**Authentication**: Required
**Authorization**: `license:manage` global scope
**Request Body**: None
**Response**: Updated license data with management token

---

### 6. Get Available Plans
```http
GET /license/plans
```

**Description**: Retrieves available license plans with endpoints.

**Authentication**: Required
**Authorization**: None
**Request Body**: None
**Response**: Array of available plans with pricing and feature details

---

### 7. Request Enterprise Trial (Local)
```http
POST /license/enterprise-trial
```

**Description**: Requests an enterprise trial through the local license API service.

**Authentication**: Required
**Authorization**: `license:manage` global scope
**Request Body**: None (uses authenticated user data)
**Response**:
```json
{
  "success": true,
  "message": "Enterprise trial request processed successfully"
}
```

**Parameters Used**:
- `licenseType`: Set to 'enterprise'
- `firstName`: From authenticated user
- `lastName`: From authenticated user
- `email`: From authenticated user
- `instanceUrl`: Generated webhook base URL

---

### 8. Register Community Edition (Local)
```http
POST /license/community-registered
```

**Description**: Registers community edition through local license API service.

**Authentication**: Required
**Authorization**: None
**Request Body**:
```json
{
  "email": "user@example.com"
}
```
**Response**: Registration confirmation

**Parameters Used**:
- `email`: From request payload
- `instanceId`: From instance settings
- `instanceUrl`: Generated base URL
- `licenseType`: Set to 'community-registered'

---

### 9. Generate Enterprise Owner License
```http
POST /license/generate-enterprise-owner
```

**Description**: Generates an enterprise license for the global owner.

**Authentication**: Required
**Authorization**: User must have `global:owner` role
**Request Body**: None
**Response**:
```json
{
  "success": true,
  "message": "Enterprise license generated successfully for global:owner",
  "licenseKey": "generated-license-key",
  "owner": "global:owner"
}
```

**Security**: Only users with `global:owner` role can access this endpoint

---

### 10. Get License Info
```http
GET /license/info/:licenseKey
```

**Description**: Retrieves information about a specific license key.

**Authentication**: Required
**Authorization**: None
**Path Parameters**:
- `licenseKey`: The license key to query
**Response**: License information object

---

### 11. Validate License Key
```http
POST /license/validate
```

**Description**: Validates a license key and returns validation status.

**Authentication**: Required
**Authorization**: None
**Request Body**:
```json
{
  "licenseKey": "license-key-to-validate"
}
```
**Response**: Validation result object

## Private Methods

### getTokenAndData()
**Description**: Private helper method that combines license data with management JWT token.

**Returns**: Object containing license data and management token
**Usage**: Used by activate and renew endpoints to provide complete license information

## Error Handling

The controller implements comprehensive error handling:

1. **AxiosError Handling**: Extracts specific error messages from HTTP responses
2. **Generic Error Handling**: Provides fallback error messages
3. **BadRequestError**: Throws structured error responses
4. **Authorization Checks**: Validates user roles for restricted operations

## Security Considerations

1. **Authentication**: All endpoints require valid JWT authentication
2. **Authorization**: Sensitive operations require specific scopes or roles
3. **Role-based Access**: Enterprise owner operations restricted to global owners
4. **Input Validation**: Request bodies are validated using DTOs
5. **Error Message Sanitization**: Prevents information leakage through error responses

## Integration Points

### External Services
- **License Service**: Core license management operations
- **Local License API Service**: Local license operations and validation
- **URL Service**: Instance and webhook URL generation
- **Instance Settings**: Configuration and instance identification

### Database Entities
- User entities for authentication context
- License entities for license storage and management
- Instance configuration for license binding

## Usage Examples

### Activating a License
```javascript
// Request
POST /license/activate
Content-Type: application/json
Cookie: n8n-auth=jwt-token-here

{
  "activationKey": "ENTERPRISE-LICENSE-KEY-123"
}

// Response
{
  "licenseData": { /* license details */ },
  "managementToken": "jwt-management-token"
}
```

### Requesting Enterprise Trial
```javascript
// Request
POST /license/enterprise-trial
Cookie: n8n-auth=jwt-token-here

// Response
{
  "success": true,
  "message": "Enterprise trial request processed successfully"
}
```

## Related Files

- `packages/cli/src/license/license.service.ts`: Core license service
- `packages/cli/src/license/local-license-api.service.ts`: Local license API operations
- `packages/cli/src/requests.ts`: Request type definitions
- `packages/cli/src/auth/auth.service.ts`: Authentication service
- `packages/@n8n/api-types`: API type definitions
