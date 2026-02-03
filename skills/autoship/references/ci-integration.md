# CI/CD Integration

Run autoship in CI/CD pipelines for fully automated releases.

## GitHub Actions

### Scheduled Releases

Release on a schedule (e.g., weekly):

```yaml
name: Scheduled Release

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am UTC
  workflow_dispatch:
    inputs:
      repo:
        description: 'Repository to release'
        required: true
        type: string
      type:
        description: 'Release type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

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
      
      - name: Install autoship
        run: pnpm add -g autoship
      
      - name: Configure repository
        run: |
          mkdir -p ~/.autoship
          echo '${{ secrets.AUTOSHIP_CONFIG }}' > ~/.autoship/config.json
      
      - name: Run release
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          autoship ${{ inputs.repo || 'myproject' }} \
            -t ${{ inputs.type || 'patch' }} \
            -y
```

### Trigger on Label

Release when a PR is labeled:

```yaml
name: Release on Label

on:
  pull_request:
    types: [labeled]

jobs:
  release:
    if: contains(github.event.label.name, 'release:')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      
      - name: Determine release type
        id: type
        run: |
          LABEL="${{ github.event.label.name }}"
          if [[ "$LABEL" == "release:major" ]]; then
            echo "type=major" >> $GITHUB_OUTPUT
          elif [[ "$LABEL" == "release:minor" ]]; then
            echo "type=minor" >> $GITHUB_OUTPUT
          else
            echo "type=patch" >> $GITHUB_OUTPUT
          fi
      
      - name: Install and run autoship
        env:
          AI_GATEWAY_API_KEY: ${{ secrets.AI_GATEWAY_API_KEY }}
          GH_TOKEN: ${{ secrets.GH_TOKEN }}
        run: |
          pnpm add -g autoship
          mkdir -p ~/.autoship
          echo '${{ secrets.AUTOSHIP_CONFIG }}' > ~/.autoship/config.json
          autoship myproject -t ${{ steps.type.outputs.type }} -y
```

## Environment Variables

Set these secrets in your CI environment:

| Secret | Description |
|--------|-------------|
| `AI_GATEWAY_API_KEY` | API key for AI features |
| `GH_TOKEN` | GitHub token with repo access (or use `GITHUB_TOKEN`) |
| `AUTOSHIP_CONFIG` | Contents of `~/.autoship/config.json` |

### Creating AUTOSHIP_CONFIG Secret

```bash
# Copy your local config to clipboard
cat ~/.autoship/config.json | pbcopy  # macOS
cat ~/.autoship/config.json | xclip   # Linux

# Add as secret in GitHub repo settings
```

## Best Practices

### 1. Use Workflow Dispatch for Manual Triggers

Always include `workflow_dispatch` for manual triggering:

```yaml
on:
  workflow_dispatch:
    inputs:
      type:
        description: 'Release type'
        required: true
        type: choice
        options: [patch, minor, major]
```

### 2. Pin autoship Version

For reproducible builds, pin the version:

```yaml
- run: pnpm add -g autoship@1.0.0
```

### 3. Validate Before Release

Add a validation step:

```yaml
- name: Validate
  run: |
    # Ensure we have changes to release
    if git diff --quiet HEAD $(git describe --tags --abbrev=0); then
      echo "No changes since last release"
      exit 0
    fi
```

### 4. Notify on Completion

```yaml
- name: Notify
  if: success()
  run: |
    curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
      -H "Content-Type: application/json" \
      -d '{"text": "Released ${{ inputs.repo }} (${{ inputs.type }})"}'
```

## Troubleshooting CI

### "gh: command not found"

Install GitHub CLI in your workflow:

```yaml
- name: Install GitHub CLI
  run: |
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update
    sudo apt install gh
```

Or use the official action:

```yaml
- uses: cli/cli-action@v1
```

### "Authentication required"

Ensure `GH_TOKEN` is set and has sufficient permissions:

```yaml
env:
  GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

The token needs `repo` scope for private repositories.
