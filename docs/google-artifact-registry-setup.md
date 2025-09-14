# Google Artifact Registry Setup for n8n Kubernetes Deployment

This document describes the Google Artifact Registry integration that automatically builds and pushes Docker images for n8n when releases are published.

## Overview

The Google Artifact Registry workflow (`google-artifact-registry.yml`) is automatically triggered during the release process and builds multi-architecture Docker images for both n8n and task runners, pushing them to Google Artifact Registry for Kubernetes deployment.

## Features

- **Multi-architecture support**: Builds for both AMD64 and ARM64 platforms
- **Automatic triggering**: Runs automatically when stable releases are published
- **Dual image support**: Builds both n8n main application and task runners
- **Version tagging**: Creates both version-specific and latest tags
- **Kubernetes ready**: Images are optimized for Kubernetes deployment

## Required Secrets

The following GitHub repository secrets must be configured:

### `GCP_PROJECT_ID`
- **Description**: Your Google Cloud Project ID
- **Example**: `my-project-123456`

### `GCP_SA_KEY`
- **Description**: Google Cloud Service Account Key in JSON format
- **Requirements**: The service account must have the following IAM roles:
  - `Artifact Registry Writer` (`roles/artifactregistry.writer`)
  - `Storage Object Viewer` (`roles/storage.objectViewer`) - if using Google Cloud Storage for build cache

### `GAR_LOCATION`
- **Description**: Google Artifact Registry location/region
- **Example**: `us-central1`, `europe-west1`, `asia-southeast1`

### `GAR_REPOSITORY`
- **Description**: Name of the Artifact Registry repository
- **Example**: `n8n-images`

## Google Cloud Setup

### 1. Create Artifact Registry Repository

```bash
# Set your project ID
export PROJECT_ID="anyflow-helm"
export LOCATION="us-central1"
export REPOSITORY="n8n-images"

# Create the repository
gcloud artifacts repositories create $REPOSITORY \
    --repository-format=docker \
    --location=$LOCATION \
    --project=$PROJECT_ID
```

### 2. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions-key \
    --description="Service account for GitHub Actions n8n builds" \
    --display-name="GitHub Actions n8n" \
    --project=$PROJECT_ID

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-actions-key@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Create and download key
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account="github-actions-key@$PROJECT_ID.iam.gserviceaccount.com" \
    --project=$PROJECT_ID
```

### 3. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add the following repository secrets:
   - `GCP_PROJECT_ID`: Your Google Cloud project ID
   - `GCP_SA_KEY`: Contents of the `github-actions-key.json` file
   - `GAR_LOCATION`: Your chosen region (e.g., `us-central1`)
   - `GAR_REPOSITORY`: Your repository name (e.g., `n8n-images`)

## Image References

After a successful release, the following images will be available:

### n8n Main Application
```
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/n8n:{VERSION}
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/n8n:latest
```

### Task Runners
```
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/runners:{VERSION}
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/runners:latest
```

## Kubernetes Deployment

Use these images in your Kubernetes manifests or Helm charts:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: n8n
spec:
  template:
    spec:
      containers:
      - name: n8n
        image: us-central1-docker.pkg.dev/my-project/n8n-images/n8n:latest
        # ... other configuration
```

## Workflow Behavior

- **Trigger**: Only runs for stable releases (when `release_type: stable`)
- **Platforms**: Builds for both `linux/amd64` and `linux/arm64`
- **Parallel builds**: Each platform builds in parallel for faster execution
- **Multi-arch manifests**: Creates unified manifests that work on both architectures
- **Failure handling**: If Google Artifact Registry push fails, it won't affect other release processes

## Troubleshooting

### Authentication Issues
- Verify the service account key is valid and properly formatted JSON
- Ensure the service account has the required IAM permissions
- Check that the project ID matches your Google Cloud project

### Repository Not Found
- Verify the Artifact Registry repository exists in the specified location
- Ensure the repository name and location match your secrets

### Build Failures
- Check the GitHub Actions logs for detailed error messages
- Verify that the base Docker images are accessible
- Ensure sufficient build resources are available

## Security Considerations

- The service account key should be stored securely as a GitHub secret
- Use the principle of least privilege - only grant necessary IAM roles
- Regularly rotate service account keys
- Monitor Artifact Registry access logs for unusual activity

## Cost Optimization

- Artifact Registry charges for storage and data transfer
- Consider setting up lifecycle policies to automatically delete old images
- Monitor usage through Google Cloud Console billing reports
