# Agent Instructions

## Using autoship

For instructions on using the autoship CLI tool, see `skills/autoship/SKILL.md`.

## Code Style

- Do not use emojis in code, output, or documentation. Unicode symbols are acceptable.
- Use TypeScript for all source files.
- Use ES modules (`import`/`export`), not CommonJS.
- Prefer `async`/`await` over raw promises.

## Package Management

**Always check the latest version before installing a package.**

Before adding or updating any dependency, verify the current latest version on npm:

```bash
npm view <package-name> version
```

Or check multiple packages at once:

```bash
npm view ai version
npm view @ai-sdk/provider-utils version
npm view zod version
```

This ensures we don't install outdated versions that may have incompatible types or missing features.

## No Emojis

**Do not use emojis anywhere in this codebase.**

This includes:
- Log messages and console output
- Comments and documentation
- Commit messages
- Variable names or string literals
