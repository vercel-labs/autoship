# autoship

CLI tool to automate changeset-based releases with AI-generated descriptions.

## Features

- **AI-Powered Release Analysis** - Automatically suggests release type (patch/minor/major) based on commit history and code changes
- **Smart Changeset Generation** - Generates clear, concise changeset descriptions using AI
- **End-to-End Automation** - Handles the full release workflow from clone to publish
- **CI Integration** - Waits for checks to pass before merging
- **Interactive & Headless Modes** - Use interactively or fully automated with `-y` flag
- **Multi-Repository Support** - Configure and manage multiple repositories
- **Changesets Compatible** - Works with any repository using the changesets workflow

## Requirements

- **Node.js** 18+
- **Git**
- **GitHub CLI** (`gh`) - authenticated with repo access
- **AI_GATEWAY_API_KEY** environment variable

The target repository must use [changesets](https://github.com/changesets/changesets) for versioning.

## Setup

### 1. Authenticate GitHub CLI

```bash
gh auth login
```

### 2. Set your API key

```bash
export AI_GATEWAY_API_KEY=your-key
```

### 3. Add a repository

```bash
npx autoship add myproject
```

You'll be prompted for:
- GitHub owner (org or username)
- Repository name
- Base branch (default: `main`)

## Usage

### Start a release

```bash
npx autoship [repo]
```

If no repo is specified, you'll be prompted to select one.

The tool will:
1. Clone the repository
2. Analyze changes since the last version tag
3. Suggest a release type (patch/minor/major) using AI
4. Generate a changeset description using AI
5. Create a PR with the changeset
6. Wait for CI checks to pass
7. Merge the changeset PR
8. Wait for the Version Packages PR (created by changesets action)
9. Merge the Version Packages PR to publish

### Options

```
-t, --type <type>     Release type: patch, minor, or major
-m, --message <msg>   Release description (skips AI generation)
-y, --yes             Skip all confirmations
```

### Examples

```bash
# Interactive release
npx autoship myproject

# Patch release with custom message
npx autoship myproject -t patch -m "Fixed login bug"

# Fully automated minor release
npx autoship myproject -t minor -y
```

### List configured repositories

```bash
npx autoship list
```

## Configuration

Config is stored at `~/.autoship/config.json`.

## Usage with AI Agents

### Just ask the agent

The simplest approach - just tell your agent to use it:

```
Use autoship to release my package. Run autoship --help to see available commands.
```

### AI Coding Assistants

Add the skill to your AI coding assistant for richer context:

```bash
npx skills add vercel-labs/autoship
```

This works with Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Goose, OpenCode, and Windsurf.

### AGENTS.md / CLAUDE.md

For more consistent results, add to your project or global instructions file:

```markdown
## Package Releases

Use `autoship` for releases. Run `autoship --help` for all commands.

Core workflow:
1. `autoship add <name>` - Configure repository (one-time)
2. `autoship <name> -t patch -y` - Automated release
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

```bash
# Clone the repo
git clone https://github.com/vercel-labs/autoship.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## License

Apache-2.0
