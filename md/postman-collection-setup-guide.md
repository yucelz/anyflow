# n8n License Controller API - Postman Collection Setup Guide

## Overview

This guide explains how to set up and use the Postman collection for testing the n8n License Controller API. The collection includes comprehensive authentication handling and covers all license management endpoints.

## Files Included

1. **`license-controller-documentation.md`** - Complete API documentation
2. **`license-api-postman-collection.json`** - Postman collection file
3. **`postman-collection-setup-guide.md`** - This setup guide

## Prerequisites

- Postman installed (Desktop app or web version)
- Running n8n instance (local or remote)
- Valid user credentials for authentication
- Basic understanding of REST APIs and authentication

## Installation Steps

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select **Upload Files** tab
4. Choose the `license-api-postman-collection.json` file
5. Click **Import**

### 2. Configure Environment Variables

After importing, you'll need to configure the collection variables:

1. Click on the collection name "n8n License Controller API"
2. Go to the **Variables** tab
3. Update the following variables:

| Variable | Default Value | Description | Required |
|----------|---------------|-------------|----------|
| `base_url` | `http://localhost:5678` | Your n8n instance URL | Yes |
| `user_email` | `admin@example.com` | Your login email | Yes |
| `user_password` | `password123` | Your login password | Yes |
| `test_license_key` | `TEST-LICENSE-KEY-123` | Sample license key for testing | Optional |
| `activation_key` | `ACTIVATION-KEY-123` | Real activation key for testing | Optional |

**Important**: Replace the default values with your actual n8n instance details.

### 3. Common Configuration Examples

#### Local Development
```
base_url: http://localhost:5678
user_email: owner@n8n.local
user_password: your-password
```

#### Remote Instance
```
base_url: https://your-n8n-instance.com
user_email: admin@yourcompany.com
user_password: your-secure-password
```

#### Docker Setup
```
base_url: http://localhost:5678
user_email: admin@example.com
user_password: admin
```

## Usage Instructions

### Step 1: Authentication

Before testing any license endpoints, you must authenticate:

1. Navigate to **Authentication** folder
2. Run the **Login** request
3. Verify successful authentication with **Get Current User**

The login request will automatically:
- Extract the JWT token from cookies
- Store it in the `auth_token` variable
- Store user information for subsequent requests

### Step 2: Test Basic Endpoints

Start with endpoints that don't require special permissions:

1. **Get License Data** - View current license status
2. **Get Available Plans** - See available license plans
3. **Validate License Key** - Test license key validation

### Step 3: Test License Operations

For endpoints requiring `license:manage` scope:

1. **Activate License** - Activate a license with activation key
2. **Renew License** - Renew current license
3. **Request Enterprise Trial** - Request trial license

### Step 4: Test Community Edition

1. **Register Community Edition** - Register community version
2. **Register Community Edition (Local)** - Local registration

### Step 5: Test Enterprise Owner Operations

**Note**: These require `global:owner` role:

1. **Generate Enterprise Owner License** - Generate enterprise license

## Collection Structure

```
n8n License Controller API/
├── Authentication/
│   ├── Login
│   ├── Get Current User
│   └── Logout
├── License Management/
│   ├── Get License Data
│   ├── Get Available Plans
│   ├── Validate License Key
│   └── Get License Info
├── License Operations (Requires license:manage scope)/
│   ├── Activate License
│   ├── Renew License
│   ├── Request Enterprise Trial
│   └── Request Enterprise Trial (Local)
├── Community Edition/
│   ├── Register Community Edition
│   └── Register Community Edition (Local)
└── Enterprise Owner Operations (Requires global:owner role)/
    └── Generate Enterprise Owner License
```

## Authentication Details

### JWT Cookie Authentication

The n8n API uses JWT tokens stored in HTTP cookies for authentication:

- **Cookie Name**: `n8n-auth`
- **Token Type**: JWT (JSON Web Token)
- **Storage**: HTTP-only cookie
- **Automatic Handling**: The collection automatically manages token extraction and usage

### Authorization Scopes

Different endpoints require different authorization levels:

- **No special scope**: Basic authenticated endpoints
- **`license:manage`**: License management operations
- **`global:owner`**: Enterprise owner operations

## Testing Scenarios

### Scenario 1: New User Setup

1. Login with credentials
2. Get current license data
3. Register community edition
4. View available plans

### Scenario 2: License Activation

1. Login as user with `license:manage` scope
2. Get current license data
3. Activate license with activation key
4. Verify activation success

### Scenario 3: Enterprise Trial

1. Login as authorized user
2. Request enterprise trial
3. Check license status
4. Test enterprise features

### Scenario 4: Owner Operations

1. Login as global owner
2. Generate enterprise owner license
3. Validate generated license
4. Test owner-specific features

## Troubleshooting

### Common Issues

#### 1. Authentication Failures (401)
- **Cause**: Invalid credentials or expired token
- **Solution**:
  - Verify credentials in collection variables
  - Re-run the Login request
  - Check n8n instance is running

#### 2. Authorization Failures (403)
- **Cause**: Insufficient permissions for endpoint
- **Solution**:
  - Verify user has required scope/role
  - Check endpoint documentation for requirements
  - Login with appropriate user account

#### 3. Connection Errors
- **Cause**: Incorrect base URL or n8n instance not running
- **Solution**:
  - Verify `base_url` variable
  - Check n8n instance status
  - Test basic connectivity

#### 4. Invalid License Keys
- **Cause**: Using test/invalid license keys
- **Solution**:
  - Use real license keys for activation
  - Update test variables with valid keys
  - Check license key format

### Debug Tips

1. **Check Console Logs**: Postman console shows detailed request/response information
2. **Verify Variables**: Ensure all required variables are set correctly
3. **Test Authentication**: Always start with login request
4. **Check Response Headers**: Look for authentication cookies and error details
5. **Review Test Results**: Each request includes automated tests for validation

## Advanced Usage

### Custom Test Scripts

Each request includes test scripts that:
- Validate response status codes
- Check response structure
- Store important values in variables
- Provide helpful error messages

### Environment Management

For multiple environments (dev, staging, prod):

1. Create separate environments in Postman
2. Duplicate the collection variables
3. Set environment-specific values
4. Switch environments as needed

### Automated Testing

The collection can be used with Newman (Postman CLI) for automated testing:

```bash
# Install Newman
npm install -g newman

# Run collection
newman run license-api-postman-collection.json \
  --environment your-environment.json \
  --reporters cli,json
```

## Security Considerations

1. **Credential Storage**: Never commit real credentials to version control
2. **Token Management**: Tokens are automatically managed but expire
3. **HTTPS Usage**: Use HTTPS for production instances
4. **Permission Testing**: Test with different user roles
5. **Rate Limiting**: Be aware of API rate limits

## Support and Documentation

- **API Documentation**: See `license-controller-documentation.md`
- **Source Code**: `packages/cli/src/license/license.controller.ts`
- **n8n Documentation**: [Official n8n docs](https://docs.n8n.io)
- **Postman Documentation**: [Postman Learning Center](https://learning.postman.com)

## Collection Maintenance

### Updating the Collection

When the API changes:

1. Update endpoint URLs and parameters
2. Modify test scripts as needed
3. Update documentation
4. Test all scenarios
5. Export updated collection

### Version Control

- Keep collection files in version control
- Document changes in commit messages
- Tag releases for stable versions
- Maintain backward compatibility when possible

## Conclusion

This Postman collection provides comprehensive testing capabilities for the n8n License Controller API. It handles authentication automatically and includes all necessary endpoints with proper authorization checks. Use this guide to set up and effectively test the license management functionality in your n8n instance.
