#!/bin/bash
# Template: Automated Release
# Purpose: Fully automated release with no prompts
# Usage: ./automated-release.sh <repo-name> <release-type> [message]
#
# Examples:
#   ./automated-release.sh myproject patch
#   ./automated-release.sh myproject minor
#   ./automated-release.sh myproject major "Breaking API changes"

set -euo pipefail

REPO="${1:?Usage: $0 <repo-name> <release-type> [message]}"
TYPE="${2:?Usage: $0 <repo-name> <release-type> [message]}"
MESSAGE="${3:-}"

# Validate release type
if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Error: release type must be patch, minor, or major"
  exit 1
fi

# Check requirements
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is required"
  echo "Install: https://cli.github.com"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "Error: GitHub CLI not authenticated"
  echo "Run: gh auth login"
  exit 1
fi

if [[ -z "${AI_GATEWAY_API_KEY:-}" ]]; then
  echo "Error: AI_GATEWAY_API_KEY environment variable not set"
  exit 1
fi

# Run autoship
echo "Starting $TYPE release for $REPO..."

if [[ -n "$MESSAGE" ]]; then
  autoship "$REPO" -t "$TYPE" -m "$MESSAGE" -y
else
  autoship "$REPO" -t "$TYPE" -y
fi

echo "Release complete!"
