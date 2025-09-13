# Release Process Documentation

## Overview

This document outlines the complete release process for uploading code to Google Artifact Registry (GAR) using the existing GitHub Actions workflows. The process creates a new release branch from `pre-prod` and automatically handles the entire release pipeline.

## Current Release Architecture

### Branch Strategy
- **`master`**: Main production branch
- **`pre-prod`**: Pre-production branch containing tested features ready for release
- **`dev`**: Development branch for ongoing work
- **`release/*`**: Temporary release branches created during the release process

### Workflow Files Analysis

#### 1. `google-artifact-registry.yml`
- **Purpose**: Builds and pushes Docker images to Google Artifact Registry
- **Trigger**: Called by other workflows (workflow_call)
- **Key Features**:
  - Multi-architecture builds (AMD64 and ARM64)
  - Only pushes stable releases to GAR
  - Creates both n8n and runners images
  - Generates multi-arch manifests

#### 2. `release-create-pr.yml`
- **Purpose**: Creates a release PR from a specified base branch
- **Trigger**: Manual workflow dispatch
- **Process**:
  - Bumps package versions based on release type
  - Updates changelog
  - Creates release branch (`release/{version}`)
  - Creates PR from release branch

#### 3. `release-publish.yml`
- **Purpose**: Main release workflow that publishes to all registries
- **Trigger**: When PR to `release/*` branch is merged
- **Process**:
  - Publishes to NPM
  - Calls `docker-build-push.yml` for DockerHub
  - Calls `google-artifact-registry.yml` for GAR
  - Creates GitHub release
  - Creates Sentry release

#### 4. `docker-build-push.yml`
- **Purpose**: Builds and pushes Docker images to DockerHub and GHCR
- **Features**: Multi-platform builds, security scanning, manifest creation

#### 5. `release-push-to-channel.yml`
- **Purpose**: Promotes existing releases to different channels (beta/stable)
- **Use Case**: Post-release channel management

## Step-by-Step Release Process

### Prerequisites

1. **GitHub CLI Installation**
   ```bash
   # Install GitHub CLI
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update
   sudo apt install gh

   # Authenticate
   gh auth login

 	# Set default repository
	 gh repo set-default github.com/yucelz/anyflow
   ```

2. **Required GitHub Secrets**
   Ensure these secrets are configured in your GitHub repository:
   - `GCP_PROJECT_ID`: Google Cloud Project ID
   - `GCP_SA_KEY`: Google Cloud Service Account Key (JSON format)
   - `GAR_LOCATION`: Google Artifact Registry location (e.g., `us-central1`)
   - `GAR_REPOSITORY`: Google Artifact Registry repository name

3. **Permissions**
   - Write access to the repository
   - Ability to create branches and PRs
   - Workflow execution permissions

### Using the Release Scripts

#### Primary Script: `release-to-gar.sh`

The `release-to-gar.sh` script automates the entire process using GitHub workflows:

```bash
# Basic usage (creates minor release from pre-prod)
./release-to-gar.sh

# Create patch release from pre-prod
./release-to-gar.sh -t patch

# Create major release from pre-prod
./release-to-gar.sh -t major

# Show help
./release-to-gar.sh --help
```

#### Alternative Script: `manual-release-to-gar.sh`

If the automated workflow has issues (such as git push failures), use the manual script:

```bash
# Basic usage (creates minor release from pre-prod)
./manual-release-to-gar.sh

# Create patch release from pre-prod
./manual-release-to-gar.sh -t patch

# Create major release from pre-prod
./manual-release-to-gar.sh -t major

# Show help
./manual-release-to-gar.sh --help
```

**When to use the manual script:**
- The automated workflow fails with git push errors
- You need more control over the release process
- Branch protection rules prevent the workflow from pushing
- GitHub token permissions are insufficient

### Manual Process (Alternative)

If you prefer to run the process manually:

1. **Trigger Release PR Creation**
   ```bash
   gh workflow run release-create-pr.yml \
     --field base-branch="pre-prod" \
     --field release-type="minor"
   ```

   **Note**: The script always uses `pre-prod` as the base branch for consistency and safety.

2. **Monitor Workflow**
   ```bash
   gh run list --workflow=release-create-pr.yml
   gh run watch <run-id>
   ```

3. **Review and Merge PR**
   - Check the created PR in GitHub
   - Review changelog and version bumps
   - Merge the PR when ready

4. **Monitor Release Publication**
   ```bash
   gh run list --workflow=release-publish.yml
   gh run watch <run-id>
   ```

## What Happens During Release

### Phase 1: Release PR Creation
1. **Version Bumping**: Package versions are updated according to semver
2. **Changelog Update**: Changelog is automatically generated/updated
3. **Branch Creation**: New `release/{version}` branch is created
4. **PR Creation**: Pull request is created for review

### Phase 2: Release Publication (After PR Merge)
1. **NPM Publication**: Packages are published to NPM registry
2. **Docker Build & Push**:
   - Images built for multiple architectures
   - Pushed to DockerHub with version tags
3. **Google Artifact Registry Upload**:
   - N8N image: `{GAR_LOCATION}-docker.pkg.dev/{PROJECT_ID}/{REPOSITORY}/n8n:{VERSION}`
   - Runners image: `{GAR_LOCATION}-docker.pkg.dev/{PROJECT_ID}/{REPOSITORY}/runners:{VERSION}`
   - Latest tags are also created
4. **GitHub Release**: Release notes are created on GitHub
5. **Sentry Release**: Release tracking is set up in Sentry

## Google Artifact Registry Configuration

### Image Naming Convention
```
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/n8n:{VERSION}
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/n8n:latest
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/runners:{VERSION}
{GAR_LOCATION}-docker.pkg.dev/{GCP_PROJECT_ID}/{GAR_REPOSITORY}/runners:latest
```

### Multi-Architecture Support
- **AMD64**: `linux/amd64`
- **ARM64**: `linux/arm64`
- **Manifest**: Combined multi-arch manifest for both platforms

### Security Features
- **Provenance**: Build provenance information included
- **SBOM**: Software Bill of Materials generated
- **Scanning**: Security vulnerability scanning (for stable/nightly releases)

## Monitoring and Troubleshooting

### Useful Commands
```bash
# List recent workflow runs
gh run list

# Watch specific workflow
gh run watch <run-id>

# View release PRs
gh pr list --label release

# Check current releases
gh release list

# View workflow logs
gh run view <run-id> --log
```

### Common Issues

1. **Release Workflow Git Push Failures**
   - **Symptoms**: `release-create-pr.yml` workflow fails at "Push the base branch" step with exit code 128
   - **Causes**:
     - Branch protection rules preventing force push
     - Insufficient GitHub token permissions
     - Git refspec syntax issues in the workflow
   - **Solutions**:
     - Use the manual script: `./manual-release-to-gar.sh`
     - Check branch protection settings in GitHub
     - Verify workflow permissions in repository settings
     - Contact repository administrator for permission review

2. **Workflow Permission Errors**
   - Ensure GitHub token has necessary permissions
   - Check repository settings for workflow permissions
   - Verify the token has write access to contents and pull requests

3. **Google Cloud Authentication Failures**
   - Verify `GCP_SA_KEY` secret is valid JSON
   - Ensure service account has GAR push permissions
   - Check `GAR_LOCATION` and `GAR_REPOSITORY` values

4. **Version Conflicts**
   - Ensure the version being released doesn't already exist
   - Check NPM registry for existing versions

5. **Build Failures**
   - Review build logs for compilation errors
   - Check Docker build context and dependencies

6. **Manual Script Issues**
   - Ensure Node.js is installed for version bumping
   - Verify GitHub CLI is authenticated
   - Check that you have push permissions to the repository

### Rollback Procedures

If a release needs to be rolled back:

1. **NPM Rollback**
   ```bash
   npm unpublish n8n@{VERSION}  # Use with caution
   ```

2. **Docker Image Removal**
   - Remove tags from GAR using gcloud CLI
   - Update latest tags to previous version

3. **GitHub Release**
   - Mark release as pre-release or delete
   - Update release notes

## Best Practices

1. **Pre-Release Testing**
   - Thoroughly test the `pre-prod` branch before release
   - Run integration tests and manual verification

2. **Release Timing**
   - Schedule releases during low-traffic periods
   - Coordinate with team members

3. **Version Management**
   - Follow semantic versioning strictly
   - Document breaking changes clearly

4. **Monitoring**
   - Monitor workflow execution closely
   - Set up alerts for failed releases

5. **Documentation**
   - Keep release notes comprehensive
   - Document any manual steps required post-release

## Security Considerations

1. **Secret Management**
   - Regularly rotate service account keys
   - Use least-privilege access for GAR service account
   - Monitor secret usage and access logs

2. **Image Security**
   - Review security scan results before release
   - Keep base images updated
   - Monitor for vulnerabilities post-release

3. **Access Control**
   - Limit who can trigger releases
   - Use branch protection rules
   - Require PR reviews for release branches

## Conclusion

This release process provides a robust, automated pipeline for deploying to Google Artifact Registry while maintaining security, traceability, and reliability. The `release-to-gar.sh` script simplifies the process while the underlying GitHub Actions workflows handle the complex build and deployment logic.

For questions or issues, refer to the workflow logs and this documentation, or consult with the development team.
