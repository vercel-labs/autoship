---
name: autoship
description: Automated release CLI for changesets-based repositories. Use when the user needs to create releases, manage repository configurations, check release status, or analyze changes. Triggers include requests to "release a package", "create a patch/minor/major release", "check CI status", "merge a PR", "analyze changes", or any task involving npm package releases with changesets.
allowed-tools: Bash(autoship:*)
---

# Release Automation with autoship

## Core Workflow

For AI agents, use `--json` for machine-readable output and `-y` to skip confirmations:

```bash
# Full automated release
autoship <repo> -t patch -m "Fix bug in login" -y --json

# Or read message from stdin
echo "Fix critical security issue" | autoship <repo> -t patch --stdin -y --json
```

## Essential Commands

```bash
# Repository management
autoship repo add <name> -o <owner> -r <repo>   # Add repo (non-interactive)
autoship repo list --json                        # List repos as JSON
autoship repo show <name> --json                 # Get repo config
autoship repo remove <name>                      # Remove repo

# Analysis (before releasing)
autoship analyze <repo> --json                   # Get commits, files changed since last release

# Release
autoship <repo> -t <type> -m "<message>" -y      # Create release (patch/minor/major)
autoship <repo> --stdin -t patch -y              # Read message from stdin

# Status & monitoring
autoship status <repo> --json                    # Check for Version Packages PR
autoship status <repo> -p <number> --json        # Check specific PR status

# Merging
autoship merge <repo> <pr> --wait                # Wait for CI then merge
autoship merge <repo> <pr> --method squash       # Merge with specific method
```

## JSON Output Format

All commands support `--json` for structured output:

```bash
# Success response
autoship repo list --json
# {"success":true,"repositories":[{"name":"myapp","owner":"org","repo":"myapp","baseBranch":"main","cloneUrl":"..."}]}

# Error response
autoship status unknown-repo --json
# {"success":false,"error":"Repository \"unknown-repo\" not found"}
```

## Common Patterns

### Setup a new repository

```bash
autoship repo add myapp -o vercel-labs -r myapp -b main
```

### Analyze before releasing

```bash
# Check what changed since last release
autoship analyze myapp --json
# Returns: commits, filesChanged, insertions, deletions, currentVersion, latestTag
```

### Automated patch release

```bash
autoship myapp -t patch -m "Fix authentication bug" -y --json
```

### Release with heredoc message

```bash
cat <<'EOF' | autoship myapp -t minor --stdin -y
Add new authentication providers

- Support for GitHub OAuth
- Support for Google OAuth
- Improved session handling
EOF
```

### Check release status

```bash
# Check if Version Packages PR exists
autoship status myapp --json

# Check specific PR
autoship status myapp -p 123 --json
```

### Merge with CI check

```bash
# Wait for CI to pass, then merge
autoship merge myapp 123 --wait --json
```

## Release Types

| Type | When to Use |
|------|-------------|
| `patch` | Bug fixes, documentation updates, minor changes |
| `minor` | New features, backwards-compatible changes |
| `major` | Breaking changes, API changes |

## Flags Reference

| Flag | Description |
|------|-------------|
| `--json` | Output results as JSON (required for agents) |
| `-y, --yes` | Skip all confirmations (required for automation) |
| `-t, --type` | Release type: patch, minor, major |
| `-m, --message` | Release description |
| `--stdin` | Read message from stdin |
| `-o, --owner` | GitHub owner (repo add) |
| `-r, --repo` | Repository name (repo add) |
| `-b, --branch` | Base branch (repo add, default: main) |
| `-p, --pr` | PR number (status command) |
| `--wait` | Wait for CI before merging |
| `--method` | Merge method: merge, squash, rebase |

## Error Handling

All errors include structured output in JSON mode:

```json
{"success":false,"error":"Repository not found","available":["myapp","otherapp"]}
```

Exit codes:
- `0`: Success
- `1`: Error (check error message in JSON output)
