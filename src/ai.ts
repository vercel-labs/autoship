import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger.js';

export interface DiffContext {
  commits: string[];
  diff: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
  previousVersion: string;
}

const client = new Anthropic();

export async function generateChangesetMessage(
  packageName: string,
  releaseType: 'patch' | 'minor' | 'major',
  context: DiffContext
): Promise<string> {
  logger.detail('Generating changeset description with AI...');

  const prompt = `You are writing a changeset description for an npm package release.

Package: ${packageName}
Release type: ${releaseType}
Previous version: ${context.previousVersion}

Commits since last release:
${context.commits.map(c => `- ${c}`).join('\n')}

Files changed (${context.filesChanged.length} files, +${context.insertions}/-${context.deletions}):
${context.filesChanged.slice(0, 20).join('\n')}${context.filesChanged.length > 20 ? `\n... and ${context.filesChanged.length - 20} more files` : ''}

Code diff:
\`\`\`
${context.diff}
\`\`\`

Write a concise, clear changeset description (1-3 sentences) that describes what changed in this release.
Focus on user-facing changes and benefits. Be specific about what was added, fixed, or changed.
Do not include markdown formatting, bullet points, or headers. Just write the plain text description.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI');
    }

    return textBlock.text.trim();
  } catch (error) {
    logger.warn(`AI generation failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export async function suggestReleaseType(
  context: DiffContext
): Promise<'patch' | 'minor' | 'major'> {
  logger.detail('Analyzing changes to suggest release type...');

  if (context.commits.length === 0) {
    return 'patch';
  }

  const prompt = `Analyze these changes and determine the appropriate semantic version bump.

Commits since ${context.previousVersion}:
${context.commits.map(c => `- ${c}`).join('\n')}

Files changed (${context.filesChanged.length} files, +${context.insertions}/-${context.deletions}):
${context.filesChanged.slice(0, 15).join('\n')}

Code diff:
\`\`\`
${context.diff.slice(0, 5000)}
\`\`\`

Rules:
- "patch" for bug fixes, small changes, documentation, dependency updates
- "minor" for new features that are backwards compatible
- "major" for breaking changes (API changes, removed features, major refactors)

Respond with ONLY one word: patch, minor, or major`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return 'patch';
    }

    const suggestion = textBlock.text.trim().toLowerCase();
    if (suggestion === 'major' || suggestion === 'minor' || suggestion === 'patch') {
      return suggestion;
    }
    return 'patch';
  } catch {
    return 'patch';
  }
}
