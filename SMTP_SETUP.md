# N8N SMTP Configuration Guide

This guide explains how to configure SMTP settings for N8N using environment variables.

## Overview

N8N uses SMTP for sending emails in various scenarios:
- User invitations
- Password reset requests
- Workflow sharing notifications
- Credential sharing notifications
- Project sharing notifications
- Email verification codes

## Required Environment Variables

### Basic SMTP Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `N8N_EMAIL_MODE` | Email sending mode | `smtp` | Yes |
| `N8N_SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` | Yes |
| `N8N_SMTP_PORT` | SMTP server port | `587` | Yes |
| `N8N_SMTP_USER` | SMTP username/email | `your-email@gmail.com` | Yes |
| `N8N_SMTP_PASS` | SMTP password/app password | `your-app-password` | Yes |
| `N8N_SMTP_SENDER` | Sender name and email | `N8N <your-email@gmail.com>` | Yes |

### Security Settings

| Variable | Description | Default | Options |
|----------|-------------|---------|---------|
| `N8N_SMTP_SSL` | Use SSL/TLS encryption | `true` | `true`, `false` |
| `N8N_SMTP_STARTTLS` | Use STARTTLS when SSL is disabled | `true` | `true`, `false` |

### OAuth Configuration (Optional)

| Variable | Description | Required for OAuth |
|----------|-------------|-------------------|
| `N8N_SMTP_OAUTH_SERVICE_CLIENT` | OAuth service client ID | Yes |
| `N8N_SMTP_OAUTH_PRIVATE_KEY` | OAuth private key | Yes |

## Common SMTP Provider Settings

### Gmail
```bash
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp.gmail.com
N8N_SMTP_PORT=587
N8N_SMTP_SSL=false
N8N_SMTP_STARTTLS=true
N8N_SMTP_USER=your-email@gmail.com
N8N_SMTP_PASS=your-app-password
N8N_SMTP_SENDER=N8N <your-email@gmail.com>
```

**Note**: For Gmail, you need to use an App Password instead of your regular password. Enable 2FA and generate an App Password in your Google Account settings.

### Outlook/Hotmail
```bash
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp-mail.outlook.com
N8N_SMTP_PORT=587
N8N_SMTP_SSL=false
N8N_SMTP_STARTTLS=true
N8N_SMTP_USER=your-email@outlook.com
N8N_SMTP_PASS=your-password
N8N_SMTP_SENDER=N8N <your-email@outlook.com>
```

### Yahoo Mail
```bash
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp.mail.yahoo.com
N8N_SMTP_PORT=587
N8N_SMTP_SSL=false
N8N_SMTP_STARTTLS=true
N8N_SMTP_USER=your-email@yahoo.com
N8N_SMTP_PASS=your-app-password
N8N_SMTP_SENDER=N8N <your-email@yahoo.com>
```

### Custom SMTP Server (SSL)
```bash
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=mail.yourdomain.com
N8N_SMTP_PORT=465
N8N_SMTP_SSL=true
N8N_SMTP_STARTTLS=false
N8N_SMTP_USER=your-email@yourdomain.com
N8N_SMTP_PASS=your-password
N8N_SMTP_SENDER=N8N <your-email@yourdomain.com>
```

## Email Template Customization (Optional)

You can override default email templates by specifying full paths to custom HTML templates:

| Variable | Purpose |
|----------|---------|
| `N8N_UM_EMAIL_TEMPLATES_INVITE` | User invitation emails |
| `N8N_UM_EMAIL_TEMPLATES_PWRESET` | Password reset emails |
| `N8N_UM_EMAIL_TEMPLATES_WORKFLOW_SHARED` | Workflow sharing notifications |
| `N8N_UM_EMAIL_TEMPLATES_CREDENTIALS_SHARED` | Credential sharing notifications |
| `N8N_UM_EMAIL_TEMPLATES_PROJECT_SHARED` | Project sharing notifications |
| `N8N_UM_EMAIL_TEMPLATES_VERIFICATION_CODE` | Email verification codes |

## JWT Configuration (Optional)

Configure JWT settings for user management:

| Variable | Description | Default |
|----------|-------------|---------|
| `N8N_USER_MANAGEMENT_JWT_SECRET` | JWT secret key | Auto-generated |
| `N8N_USER_MANAGEMENT_JWT_DURATION_HOURS` | JWT expiration time in hours | `168` (7 days) |
| `N8N_USER_MANAGEMENT_JWT_REFRESH_TIMEOUT_HOURS` | Auto-refresh timeout | `0` (25% of duration) |

## Setup Instructions

1. **Copy the `.env` file**: Use the provided `.env` file as a template
2. **Configure your SMTP provider**: Update the SMTP settings based on your email provider
3. **Set authentication**: Add your email credentials (use app passwords for Gmail/Yahoo)
4. **Test the configuration**: Start N8N and test email functionality
5. **Verify emails are sent**: Check that invitation and notification emails are working

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Ensure you're using the correct username and password
   - For Gmail/Yahoo, use App Passwords instead of regular passwords
   - Enable "Less secure app access" if required by your provider

2. **Connection Timeout**
   - Verify the SMTP host and port are correct
   - Check if your firewall allows outbound connections on the SMTP port
   - Try different ports (25, 465, 587)

3. **SSL/TLS Issues**
   - Try toggling `N8N_SMTP_SSL` and `N8N_SMTP_STARTTLS` settings
   - For port 465, use `N8N_SMTP_SSL=true` and `N8N_SMTP_STARTTLS=false`
   - For port 587, use `N8N_SMTP_SSL=false` and `N8N_SMTP_STARTTLS=true`

4. **Emails Not Sending**
   - Check N8N logs for error messages
   - Verify `N8N_EMAIL_MODE=smtp` is set
   - Ensure all required variables are configured

### Testing SMTP Configuration

You can test your SMTP configuration by:
1. Starting N8N with your SMTP settings
2. Inviting a new user to test email delivery
3. Checking the N8N logs for any SMTP-related errors

## Security Best Practices

1. **Use App Passwords**: For Gmail and Yahoo, always use App Passwords
2. **Enable 2FA**: Enable two-factor authentication on your email account
3. **Secure Storage**: Store your `.env` file securely and don't commit it to version control
4. **Regular Rotation**: Regularly rotate your SMTP passwords
5. **Dedicated Email**: Consider using a dedicated email account for N8N notifications

## Environment File Location

Place your `.env` file in the root directory of your N8N installation. N8N will automatically load these environment variables on startup.

## Docker Integration

### Building Docker Image with Environment Variables

You can now build N8N Docker images with optional environment variable support:

#### Standard Docker Build (without .env)
```bash
npm run build:docker
```

#### Docker Build with .env Integration
```bash
npm run build:docker:env
```

When using `build:docker:env`, the build script will:
1. Check for a `.env` file in the root directory
2. Load N8N-related environment variables from the file
3. Pass them as build arguments to the Docker build process
4. Display information about loaded variables during the build

### Using Docker Compose

A `docker-compose.yml` file is provided for easy deployment with environment variables:

```bash
# Build the image first
npm run build:docker

# Start with Docker Compose (automatically loads .env file)
docker-compose up -d

# View logs
docker-compose logs -f n8n

# Stop the service
docker-compose down
```

The Docker Compose configuration:
- Automatically loads variables from your `.env` file
- Maps port 5678 for N8N web interface
- Creates a persistent volume for N8N data
- Supports custom email template mounting

### Manual Docker Run with Environment Variables

If you prefer using `docker run` directly:

```bash
# Build the image
npm run build:docker

# Run with environment variables from .env file
docker run -d \
  --name n8n \
  -p 5678:5678 \
  --env-file .env \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n:local
```

### Environment Variable Precedence

When using Docker, environment variables are loaded in this order (highest to lowest priority):
1. Docker run `-e` flags or Docker Compose `environment` section
2. `--env-file` or Docker Compose `env_file` directive
3. Variables set in the Dockerfile (if any)
4. N8N default values

## Development Workflow

### Recommended Development Setup

1. **Configure Environment**: Update your `.env` file with SMTP settings
2. **Build with Environment**: Use `npm run build:docker:env` to build with your settings
3. **Deploy with Compose**: Use `docker-compose up -d` for easy management
4. **Test Email Functionality**: Verify SMTP settings work by testing user invitations

### Example Development Commands

```bash
# Complete development workflow
npm run build:docker:env
docker-compose up -d
docker-compose logs -f n8n

# Rebuild after .env changes
docker-compose down
npm run build:docker:env
docker-compose up -d

# Quick restart without rebuild
docker-compose restart n8n
```
