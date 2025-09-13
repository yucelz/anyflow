#!/bin/bash

# =============================================================================
# Release to Google Artifact Registry Script
# =============================================================================
# This script creates a release branch from pre-prod and triggers the
# Google Artifact Registry upload process
#
# Prerequisites:
# - Git repository with pre-prod branch
# - GitHub CLI (gh) installed and authenticated
# - Proper permissions to create branches and trigger workflows
# - Google Artifact Registry secrets configured in GitHub repository
#
# Required GitHub Secrets:
# - GCP_PROJECT_ID: Google Cloud Project ID
# - GCP_SA_KEY: Google Cloud Service Account Key (JSON)
# - GAR_LOCATION: Google Artifact Registry location (e.g., us-central1)
# - GAR_REPOSITORY: Google Artifact Registry repository name
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RELEASE_BRANCH="pre-prod"  # Always create releases from pre-prod
DEFAULT_RELEASE_TYPE="minor"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

This script creates a release branch from pre-prod and triggers the Google Artifact Registry upload process.

OPTIONS:
    -t, --release-type TYPE     Release type: patch|minor|major|experimental (default: minor)
    -h, --help                  Show this help message

EXAMPLES:
    $0                          # Create minor release from pre-prod
    $0 -t patch                 # Create patch release from pre-prod
    $0 -t major                 # Create major release from pre-prod

PROCESS OVERVIEW:
    1. Validate prerequisites and inputs
    2. Fetch latest changes from remote
    3. Create release PR using GitHub workflow (always from pre-prod)
    4. Monitor release PR creation
    5. Provide instructions for manual merge and GAR upload

EOF
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check if GitHub CLI is installed
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/"
        exit 1
    fi

    # Check if GitHub CLI is authenticated
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated. Please run 'gh auth login'"
        exit 1
    fi

    # Check if required secrets are configured (we can't directly check secrets, but we can check if the workflow exists)
    if [[ ! -f ".github/workflows/google-artifact-registry.yml" ]]; then
        log_error "Google Artifact Registry workflow not found at .github/workflows/google-artifact-registry.yml"
        exit 1
    fi

    if [[ ! -f ".github/workflows/release-create-pr.yml" ]]; then
        log_error "Release create PR workflow not found at .github/workflows/release-create-pr.yml"
        exit 1
    fi

    if [[ ! -f ".github/workflows/release-publish.yml" ]]; then
        log_error "Release publish workflow not found at .github/workflows/release-publish.yml"
        exit 1
    fi

    log_success "All prerequisites met"
}

validate_inputs() {
    local release_type="$1"

    log_info "Validating inputs..."

    # Validate release type
    case "$release_type" in
        patch|minor|major|experimental)
            log_success "Release type '$release_type' is valid"
            ;;
        *)
            log_error "Invalid release type '$release_type'. Must be one of: patch, minor, major, experimental"
            exit 1
            ;;
    esac

    # Check if pre-prod branch exists
    if ! git show-ref --verify --quiet "refs/remotes/origin/$RELEASE_BRANCH"; then
        log_error "Pre-prod branch '$RELEASE_BRANCH' does not exist on remote"
        exit 1
    fi

    log_success "Input validation completed"
}

fetch_latest_changes() {
    log_info "Fetching latest changes from remote..."
    git fetch origin
    log_success "Latest changes fetched"
}

create_release_pr() {
    local release_type="$1"

    log_info "Creating release PR from '$RELEASE_BRANCH' with release type '$release_type'..."

    # Trigger the release-create-pr workflow
    gh workflow run release-create-pr.yml \
        --field base-branch="$RELEASE_BRANCH" \
        --field release-type="$release_type"

    log_success "Release PR workflow triggered"
    log_info "Waiting for workflow to start..."
    sleep 5

    # Get the latest workflow run
    local run_id
    run_id=$(gh run list --workflow=release-create-pr.yml --limit=1 --json databaseId --jq '.[0].databaseId')

    if [[ -n "$run_id" ]]; then
        log_info "Monitoring workflow run: $run_id"
        log_info "You can view the workflow at: $(gh run view "$run_id" --json url --jq '.url')"

        # Wait for workflow to complete
        gh run watch "$run_id"

        # Check if workflow succeeded
        local status
        status=$(gh run view "$run_id" --json conclusion --jq '.conclusion')

        if [[ "$status" == "success" ]]; then
            log_success "Release PR workflow completed successfully"
            return 0
        else
            log_error "Release PR workflow failed with status: $status"
            log_error "This is likely due to a git push issue in the workflow."
            log_error "Please check the workflow logs for details:"
            log_error "  gh run view $run_id --log"
            log_error ""
            log_error "Common causes:"
            log_error "  - Branch protection rules preventing force push"
            log_error "  - Insufficient permissions for the GitHub token"
            log_error "  - Git refspec syntax issues in the workflow"
            log_error ""
            log_error "You may need to manually create the release branch or"
            log_error "contact your repository administrator to check permissions."
            return 1
        fi
    else
        log_error "Could not find workflow run"
        return 1
    fi
}

show_next_steps() {
    local release_type="$1"

    cat << EOF

${GREEN}=============================================================================
RELEASE PROCESS INITIATED SUCCESSFULLY
=============================================================================${NC}

${BLUE}WHAT HAPPENED:${NC}
✅ Release PR workflow has been triggered
✅ A new release branch will be created from '$RELEASE_BRANCH'
✅ Version will be bumped according to '$release_type' release type
✅ A Pull Request will be created for the release

${YELLOW}NEXT STEPS:${NC}

1. ${BLUE}REVIEW THE RELEASE PR:${NC}
   - Check the generated changelog
   - Verify version bumps are correct
   - Review any other changes

2. ${BLUE}MERGE THE RELEASE PR:${NC}
   - Once you're satisfied with the release PR, merge it
   - This will automatically trigger the release-publish.yml workflow

3. ${BLUE}AUTOMATIC GOOGLE ARTIFACT REGISTRY UPLOAD:${NC}
   - The release-publish.yml workflow will automatically:
     ✅ Publish to NPM
     ✅ Build and push Docker images to DockerHub
     ✅ Build and push Docker images to Google Artifact Registry
     ✅ Create GitHub release
     ✅ Create Sentry release

4. ${BLUE}MONITOR THE RELEASE:${NC}
   - Watch the release-publish workflow: gh run list --workflow=release-publish.yml
   - Check Google Artifact Registry for the new images
   - Verify the GitHub release was created

${GREEN}GOOGLE ARTIFACT REGISTRY IMAGES WILL BE AVAILABLE AT:${NC}
- N8N Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:\${VERSION}
- N8N Latest: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:latest
- Runners Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/runners:\${VERSION}
- Runners Latest: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/runners:latest

${BLUE}USEFUL COMMANDS:${NC}
- List recent workflow runs: gh run list
- Watch a specific run: gh run watch <run-id>
- View release PRs: gh pr list --label release
- Check current releases: gh release list

EOF
}

main() {
    local release_type="$DEFAULT_RELEASE_TYPE"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--release-type)
                release_type="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    log_info "Starting release process..."
    log_info "Base branch: $RELEASE_BRANCH (fixed)"
    log_info "Release type: $release_type"
    echo

    # Execute the release process
    check_prerequisites
    validate_inputs "$release_type"
    fetch_latest_changes

    if create_release_pr "$release_type"; then
        show_next_steps "$release_type"
    else
        log_error "Release process failed. Please check the workflow logs."
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
