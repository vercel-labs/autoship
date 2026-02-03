# Command Reference

Complete reference for all autoship commands. For quick start and common patterns, see SKILL.md.

## Main Command

```bash
autoship [repo] [options]
```

If `repo` is omitted, displays an interactive selector with all configured repositories.

### Options

| Option | Description |
|--------|-------------|
| `-t, --type <type>` | Release type: `patch`, `minor`, or `major` |
| `-m, --message <message>` | Custom changeset description (skips AI generation) |
| `-y, --yes` | Skip all confirmation prompts |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

### Examples

```bash
# Interactive mode - prompts for everything
autoship myproject

# Specify release type, AI generates message
autoship myproject -t minor

# Fully automated with custom message
autoship myproject -t patch -m "Fixed login validation" -y

# Fully automated with AI message
autoship myproject -t patch -y
```

## add Command

Add a new repository configuration.

```bash
autoship add <name>
```

### Arguments

| Argument | Description |
|----------|-------------|
| `name` | Friendly name for the repository (used in other commands) |

### Interactive Prompts

1. **GitHub owner** - Organization or username (required)
2. **Repository name** - GitHub repository name (defaults to `name`)
3. **Base branch** - Branch to release from (defaults to `main`)

### Example

```bash
autoship add myproject
# > GitHub owner (org or user): vercel-labs
# > Repository name: myproject
# > Base branch: main
# Repository "myproject" added!
# Clone URL: https://github.com/vercel-labs/myproject.git
```

## list Command

List all configured repositories.

```bash
autoship list
```

### Output

```
Configured repositories:
  - myproject (vercel-labs/myproject)
  - another-lib (vercel-labs/another-lib)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `AI_GATEWAY_API_KEY` | API key for AI-powered suggestions and descriptions | Yes |
| `GITHUB_TOKEN` | GitHub token (uses `gh` CLI auth by default) | No |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (see output for details) |

Common error scenarios:
- Repository not configured
- GitHub CLI not authenticated
- CI checks failed
- AI API unavailable (falls back to manual input)
