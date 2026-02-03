# autoship

CLI tool to automate changeset-based releases with AI-generated descriptions.

## Features

- **AI-Powered Release Analysis** - Automatically suggests release type (patch/minor/major) based on commit history and code changes
- **Smart Changeset Generation** - Generates clear, concise changeset descriptions using AI
- **End-to-End Automation** - Handles the full release workflow from clone to publish
- **CI Integration** - Waits for checks to pass before merging
- **Interactive & Headless Modes** - Use interactively or fully automated with `-y` flag
- **JSON Output** - Machine-readable output with `--json` for AI agent integration
- **Multi-Repository Support** - Configure and manage multiple repositories
- **Changesets Compatible** - Works with any repository using the changesets workflow

## Requirements

- **Node.js** 18+
- **Git**
- **GitHub CLI** (`gh`) - authenticated with repo access
- **AI_GATEWAY_API_KEY** environment variable (optional, for AI features)

The target repository must use [changesets](https://github.com/changesets/changesets) for versioning.

## Installation

```bash
npm install -g autoship
# or
npx autoship
```

## Quick Start

```bash
# Add a repository
autoship repo add myproject -o myorg -r myproject

# Create a release
autoship myproject -t patch -m "Fix login bug" -y
```

## Commands

### Repository Management

```bash
autoship repo add <name> -o <owner> -r <repo>   # Add repository (non-interactive)
autoship repo add <name>                         # Add repository (interactive)
autoship repo list                               # List all repositories
autoship repo show <name>                        # Show repository details
autoship repo remove <name>                      # Remove repository
```

### Release

```bash
autoship <repo>                     # Interactive release
autoship <repo> -t patch            # Patch release
autoship <repo> -t minor -y         # Minor release, skip confirmations
autoship <repo> -t major -m "..."   # Major release with message
```

### Analysis & Status

```bash
autoship analyze <repo>             # Analyze changes since last release
autoship status <repo>              # Check for Version Packages PR
autoship status <repo> -p 123       # Check specific PR status
```

### Merge

```bash
autoship merge <repo> <pr>          # Merge a PR
autoship merge <repo> <pr> --wait   # Wait for CI, then merge
```

## Options

```
-t, --type <type>     Release type: patch, minor, or major
-m, --message <msg>   Release description (skips AI generation)
--stdin               Read release message from stdin
-y, --yes             Skip all confirmations
--json                Output results as JSON
```

## AI Agent Integration

For automated workflows and AI agents, use `--json` and `-y`:

```bash
# Non-interactive release with JSON output
autoship myproject -t patch -m "Fix bug" -y --json

# Read message from stdin (for heredocs)
cat <<'EOF' | autoship myproject -t minor --stdin -y --json
Add new feature

- Feature A
- Feature B
EOF

# Check status
autoship status myproject --json

# Analyze changes
autoship analyze myproject --json
```

All JSON responses follow this format:

```json
// Success
{"success": true, "data": {...}}

// Error
{"success": false, "error": "Error message"}
```

## Examples

### Full automated release

```bash
autoship myproject -t patch -m "Fixed authentication bug" -y
```

### Interactive release with AI

```bash
autoship myproject
# Tool will:
# 1. Analyze changes
# 2. Suggest release type
# 3. Generate description with AI
# 4. Create PR and wait for CI
# 5. Merge and publish
```

### Analyze before releasing

```bash
autoship analyze myproject
# Shows: commits, files changed, lines added/removed
```

## Configuration

Config is stored at `~/.autoship/config.json`.

## Contributing

```bash
git clone https://github.com/vercel-labs/autoship.git
cd autoship
pnpm install
pnpm build
pnpm test
```

## License

Apache-2.0
