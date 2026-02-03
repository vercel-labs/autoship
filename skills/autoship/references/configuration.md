# Configuration Reference

autoship stores configuration in `~/.autoship/config.json`.

## Config File Structure

```json
{
  "repos": {
    "<name>": {
      "owner": "<github-owner>",
      "repo": "<github-repo>",
      "baseBranch": "<branch>",
      "cloneUrl": "<clone-url>"
    }
  }
}
```

## Repository Configuration

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string | GitHub organization or username |
| `repo` | string | GitHub repository name |
| `baseBranch` | string | Branch to create releases from (typically `main`) |
| `cloneUrl` | string | HTTPS clone URL (auto-generated) |

### Example

```json
{
  "repos": {
    "ai-sdk": {
      "owner": "vercel",
      "repo": "ai",
      "baseBranch": "main",
      "cloneUrl": "https://github.com/vercel/ai.git"
    },
    "agent-browser": {
      "owner": "vercel-labs",
      "repo": "agent-browser",
      "baseBranch": "main",
      "cloneUrl": "https://github.com/vercel-labs/agent-browser.git"
    }
  }
}
```

## Managing Configuration

### Add Repository (Recommended)

Use the CLI to add repositories:

```bash
autoship add myproject
```

This interactively prompts for all required fields.

### Manual Editing

You can also edit `~/.autoship/config.json` directly:

```bash
# Open config file
$EDITOR ~/.autoship/config.json
```

### Remove Repository

Currently, remove repositories by editing the config file directly:

```bash
# Edit and remove the entry from "repos"
$EDITOR ~/.autoship/config.json
```

## Requirements for Target Repositories

autoship works with repositories that use the [changesets](https://github.com/changesets/changesets) workflow:

1. **Changesets installed** - `@changesets/cli` as dev dependency
2. **Changesets config** - `.changeset/config.json` exists
3. **Changesets GitHub Action** - Configured to create Version Packages PRs
4. **Version tags** - Repository uses version tags (e.g., `v1.2.3`, `package@1.2.3`)

### Typical Target Repository Setup

```bash
# In the target repository
pnpm add -D @changesets/cli
npx changeset init
```

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```
