#!/bin/bash

# =============================================================================
# Manual Release to Google Artifact Registry Script
# =============================================================================
# This script manually creates a release branch from pre-prod and provides
# instructions for triggering the Google Artifact Registry upload process.
# Use this if the automated workflow has issues.
#
# Prerequisites:
# - Git repository with pre-prod branch
# - GitHub CLI (gh) installed and authenticated
# - Proper permissions to create branches and trigger workflows
# - Google Artifact Registry secrets configured in GitHub repository
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RELEASE_BRANCH="pre-prod"
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

This script manually creates a release branch from pre-prod and provides instructions
for triggering the Google Artifact Registry upload process.

OPTIONS:
    -t, --release-type TYPE     Release type: patch|minor|major|experimental (default: minor)
    -h, --help                  Show this help message

EXAMPLES:
    $0                          # Create minor release from pre-prod
    $0 -t patch                 # Create patch release from pre-prod
    $0 -t major                 # Create major release from pre-prod

EOF
}

get_next_version() {
    local release_type="$1"
    local current_version

    # Get current version from package.json
    if [[ -f "package.json" ]]; then
        current_version=$(node -p "require('./package.json').version")
    else
        log_error "package.json not found"
        exit 1
    fi

    log_info "Current version: $current_version"

    # Parse version components
    local major minor patch
    IFS='.' read -r major minor patch <<< "$current_version"

    # Remove any pre-release suffixes from patch
    patch=$(echo "$patch" | sed 's/-.*//')

    # Calculate next version
    case "$release_type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        experimental)
            patch=$((patch + 1))
            echo "${major}.${minor}.${patch}-experimental.$(date +%s)"
            return
            ;;
    esac

    echo "${major}.${minor}.${patch}"
}

create_release_branch_manually() {
    local release_type="$1"
    local next_version

    log_info "Creating release branch manually..."

    # Get next version
    next_version=$(get_next_version "$release_type")
    log_info "Next version will be: $next_version"

    # Ensure we're on pre-prod and it's up to date
    log_info "Switching to pre-prod branch..."
    git checkout "$RELEASE_BRANCH"
    git pull origin "$RELEASE_BRANCH"

    # Create release branch
    local release_branch_name="release/$next_version"
    log_info "Creating release branch: $release_branch_name"

    if git show-ref --verify --quiet "refs/heads/$release_branch_name"; then
        log_warning "Release branch $release_branch_name already exists locally"
        git checkout "$release_branch_name"
    else
        git checkout -b "$release_branch_name"
    fi

    # Update package.json version (basic approach)
    if command -v node &> /dev/null; then
        log_info "Updating package.json version to $next_version..."
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.version = '$next_version';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
        "

        # Commit the version change
        git add package.json
        git commit -m ":rocket: Release $next_version"

        log_success "Version updated and committed"
    else
        log_warning "Node.js not found. Please manually update package.json version to $next_version"
    fi

    # Push the release branch
    log_info "Pushing release branch to remote..."
    git push origin "$release_branch_name"

    log_success "Release branch created successfully: $release_branch_name"

    # Create PR
    log_info "Creating pull request..."
    gh pr create \
        --title ":rocket: Release $next_version" \
        --body "Release $next_version

This PR contains the release preparation for version $next_version.

**Changes:**
- Version bump to $next_version
- Ready for release to Google Artifact Registry

**Next Steps:**
1. Review this PR
2. Merge this PR to trigger the release-publish workflow
3. The workflow will automatically upload to Google Artifact Registry

**Google Artifact Registry Images:**
- N8N Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:$next_version
- Runners Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/runners:$next_version" \
        --base "$release_branch_name" \
        --head "$release_branch_name" \
        --label "release,release:$release_type"

    log_success "Pull request created successfully"

    echo "$next_version"
}

show_next_steps() {
    local release_type="$1"
    local version="$2"

    cat << EOF

${GREEN}=============================================================================
MANUAL RELEASE PROCESS COMPLETED SUCCESSFULLY
=============================================================================${NC}

${BLUE}WHAT HAPPENED:${NC}
✅ Release branch 'release/$version' created from '$RELEASE_BRANCH'
✅ Version bumped to '$version' in package.json
✅ Changes committed and pushed to remote
✅ Pull Request created for the release

${YELLOW}NEXT STEPS:${NC}

1. ${BLUE}REVIEW THE RELEASE PR:${NC}
   - Check the version bump is correct
   - Review any other changes
   - View the PR: gh pr view

2. ${BLUE}MERGE THE RELEASE PR:${NC}
   - Once satisfied, merge the PR
   - This will automatically trigger the release-publish.yml workflow
   - Command: gh pr merge --merge

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
- N8N Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:$version
- N8N Latest: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/n8n:latest
- Runners Image: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/runners:$version
- Runners Latest: \${GAR_LOCATION}-docker.pkg.dev/\${GCP_PROJECT_ID}/\${GAR_REPOSITORY}/runners:latest

${BLUE}USEFUL COMMANDS:${NC}
- View the PR: gh pr view
- Merge the PR: gh pr merge --merge
- List workflow runs: gh run list
- Watch a workflow: gh run watch <run-id>
- Check releases: gh release list

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

    log_info "Starting manual release process..."
    log_info "Base branch: $RELEASE_BRANCH"
    log_info "Release type: $release_type"
    echo

    # Validate release type
    case "$release_type" in
        patch|minor|major|experimental)
            ;;
        *)
            log_error "Invalid release type '$release_type'. Must be one of: patch, minor, major, experimental"
            exit 1
            ;;
    esac

    # Check prerequisites
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi

    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) is not installed"
        exit 1
    fi

    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI is not authenticated. Please run 'gh auth login'"
        exit 1
    fi

    # Execute the manual release process
    local version
    version=$(create_release_branch_manually "$release_type")

    show_next_steps "$release_type" "$version"
}

# Run main function with all arguments
main "$@"
