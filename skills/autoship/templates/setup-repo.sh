#!/bin/bash
# Template: Non-interactive Repository Setup
# Purpose: Add a repository without interactive prompts
# Usage: ./setup-repo.sh <name> <owner> <repo> [base-branch]
#
# Examples:
#   ./setup-repo.sh myproject vercel-labs myproject
#   ./setup-repo.sh myproject vercel-labs myproject main
#   ./setup-repo.sh ai-sdk vercel ai main

set -euo pipefail

NAME="${1:?Usage: $0 <name> <owner> <repo> [base-branch]}"
OWNER="${2:?Usage: $0 <name> <owner> <repo> [base-branch]}"
REPO="${3:?Usage: $0 <name> <owner> <repo> [base-branch]}"
BASE_BRANCH="${4:-main}"

CONFIG_DIR="$HOME/.autoship"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Create config directory if needed
mkdir -p "$CONFIG_DIR"

# Initialize config file if needed
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo '{"repos":{}}' > "$CONFIG_FILE"
fi

# Check if jq is available for JSON manipulation
if command -v jq &> /dev/null; then
  # Use jq for proper JSON handling
  CLONE_URL="https://github.com/$OWNER/$REPO.git"
  
  jq --arg name "$NAME" \
     --arg owner "$OWNER" \
     --arg repo "$REPO" \
     --arg branch "$BASE_BRANCH" \
     --arg url "$CLONE_URL" \
     '.repos[$name] = {owner: $owner, repo: $repo, baseBranch: $branch, cloneUrl: $url}' \
     "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
  
  echo "Repository '$NAME' added!"
  echo "  Owner: $OWNER"
  echo "  Repo: $REPO"
  echo "  Branch: $BASE_BRANCH"
  echo "  Clone URL: $CLONE_URL"
else
  # Fallback: use autoship add with expect-like input
  echo "Warning: jq not found, using interactive fallback"
  echo "Install jq for non-interactive setup: brew install jq"
  echo ""
  echo "Running: autoship add $NAME"
  echo "Please enter:"
  echo "  Owner: $OWNER"
  echo "  Repo: $REPO"
  echo "  Branch: $BASE_BRANCH"
  autoship add "$NAME"
fi
