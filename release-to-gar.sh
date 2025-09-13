#!/bin/bash

# =============================================================================
# Upload to Google Artifact Registry Script
# =============================================================================
# This script triggers the Google Artifact Registry workflow to build and
# upload Docker images to Google Cloud
#
# Prerequisites:
# - Git repository
# - GitHub CLI (gh) installed and authenticated
# - Proper permissions to trigger workflows
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
DEFAULT_N8N_VERSION="latest"

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

This script triggers the Google Artifact Registry workflow to build and upload Docker images.

OPTIONS:
    -v, --version VERSION       N8N version to build (default: latest)
    -h, --help                  Show this help message

EXAMPLES:
    $0                          # Build and upload latest version
    $0 -v 1.0.0                 # Build and upload specific version
    $0 -v latest                # Build and upload latest version

PROCESS OVERVIEW:
    1. Validate prerequisites and inputs
    2. Trigger Google Artifact Registry workflow
    3. Monitor workflow execution
    4. Provide status and next steps

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

    # Check if Google Artifact Registry workflow exists
    if [[ ! -f ".github/workflows/google-artifact-registry.yml" ]]; then
        log_error "Google Artifact Registry workflow not found at .github/workflows/google-artifact-registry.yml"
        exit 1
    fi

    log_success "All prerequisites met"
}

validate_inputs() {
    local n8n_version="$1"

    log_info "Validating inputs..."

    # Basic validation for version string (allow any non-empty string)
    if [[ -z "$n8n_version" ]]; then
        log_error "N8N version cannot be empty"
        exit 1
    fi

    log_success "N8N version '$n8n_version' is valid"
    log_success "Input validation completed"
}

trigger_gar_workflow() {
    local n8n_version="$1"

    log_info "Triggering Google Artifact Registry workflow with version '$n8n_version'..."

    # Trigger the google-artifact-registry workflow
    gh workflow run google-artifact-registry.yml \
        --field n8n_version="$n8n_version"

    log_success "Google Artifact Registry workflow triggered"
    log_info "Waiting for workflow to start..."
    sleep 5

    # Get the latest workflow run
    local run_id
    run_id=$(gh run list --workflow=google-artifact-registry.yml --limit=1 --json databaseId --jq '.[0].databaseId')

    if [[ -n "$run_id" ]]; then
        log_info "Monitoring workflow run: $run_id"
        log_info "You can view the workflow at: $(gh run view "$run_id" --json url --jq '.url')"

        # Wait for workflow to complete
        gh run watch "$run_id"

        # Check if workflow succeeded
        local status
        status=$(gh run view "$run_id" --json conclusion --jq '.conclusion')

        if [[ "$status" == "success" ]]; then
            log_success "Google Artifact Registry workflow completed successfully"
            return 0
        else
            log_error "Google Artifact Registry workflow failed with status: $status"
            log_error "Please check the workflow logs for details:"
            log_error "  gh run view $run_id --log"
            log_error ""
            log_error "Common causes:"
            log_error "  - Missing or invalid Google Cloud credentials"
            log_error "  - Docker build failures"
            log_error "  - Network connectivity issues"
            log_error "  - Insufficient permissions for Google Artifact Registry"
            return 1
        fi
    else
        log_error "Could not find workflow run"
        return 1
    fi
}

show_completion_summary() {
    local n8n_version="$1"

    cat << EOF

${GREEN}=============================================================================
GOOGLE ARTIFACT REGISTRY UPLOAD COMPLETED
=============================================================================${NC}

${BLUE}WHAT HAPPENED:${NC}
✅ Google Artifact Registry workflow was triggered
✅ Docker image was built using: node scripts/build-n8n.mjs && node scripts/dockerize-n8n.mjs
✅ Docker image was tagged and uploaded to Google Artifact Registry

${GREEN}DOCKER IMAGES AVAILABLE AT:${NC}
- N8N Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:${n8n_version}
- N8N Latest: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:latest

${BLUE}USEFUL COMMANDS:${NC}
- List recent workflow runs: gh run list --workflow=google-artifact-registry.yml
- Check workflow status: gh run list
- View workflow logs: gh run view <run-id> --log

${BLUE}NEXT STEPS:${NC}
- Verify the images are available in your Google Artifact Registry
- Deploy the images to your Kubernetes cluster or container environment
- Update your deployment configurations to use the new image tags

EOF
}

main() {
    local n8n_version="$DEFAULT_N8N_VERSION"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                n8n_version="$2"
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

    log_info "Starting Google Artifact Registry upload process..."
    log_info "N8N version: $n8n_version"
    echo

    # Execute the upload process
    check_prerequisites
    validate_inputs "$n8n_version"

    if trigger_gar_workflow "$n8n_version"; then
        show_completion_summary "$n8n_version"
    else
        log_error "Google Artifact Registry upload failed. Please check the workflow logs."
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
