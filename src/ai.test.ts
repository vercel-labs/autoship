import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChangesetMessage, suggestReleaseType, DiffContext } from './ai.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: {
    detail: vi.fn(),
    warn: vi.fn(),
  },
}));

import { generateText } from 'ai';

function mockGenerateText(text: string): void {
  vi.mocked(generateText).mockResolvedValue({
    text,
    finishReason: 'stop',
    usage: { promptTokens: 100, completionTokens: 20 },
    response: { id: 'test', timestamp: new Date(), modelId: 'test', headers: {} },
    request: {},
    warnings: [],
    steps: [],
    toolCalls: [],
    toolResults: [],
    reasoning: undefined,
    reasoningDetails: [],
    sources: [],
    experimental_providerMetadata: undefined,
    providerMetadata: undefined,
    files: [],
  } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never);
}

describe('ai', () => {
  const mockDiffContext: DiffContext = {
    commits: ['feat: add new feature', 'fix: resolve bug'],
    diff: 'diff --git a/src/index.ts b/src/index.ts\n+new code',
    filesChanged: ['src/index.ts', 'src/utils.ts'],
    insertions: 50,
    deletions: 10,
    previousVersion: 'v1.0.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateChangesetMessage', () => {
    it('should generate changeset message from AI', async () => {
      mockGenerateText('Added new feature and fixed critical bug.');

      const result = await generateChangesetMessage('my-package', 'minor', mockDiffContext);
      
      expect(result).toBe('Added new feature and fixed critical bug.');
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'anthropic/claude-opus-4.5',
        })
      );
    });

    it('should include multiple packages in the prompt label', async () => {
      mockGenerateText('Updated multiple packages.');

      await generateChangesetMessage(['pkg-a', 'pkg-b'], 'minor', mockDiffContext);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Packages: pkg-a, pkg-b'),
        })
      );
    });

    it('should throw error when AI generation fails', async () => {
      vi.mocked(generateText).mockRejectedValue(new Error('API error'));

      await expect(
        generateChangesetMessage('my-package', 'patch', mockDiffContext)
      ).rejects.toThrow('API error');
    });

    it('should trim whitespace from AI response', async () => {
      mockGenerateText('  Message with whitespace  \n');

      const result = await generateChangesetMessage('my-package', 'patch', mockDiffContext);
      
      expect(result).toBe('Message with whitespace');
    });
  });

  describe('suggestReleaseType', () => {
    it('should return patch for empty commits', async () => {
      const emptyContext: DiffContext = {
        ...mockDiffContext,
        commits: [],
      };

      const result = await suggestReleaseType(emptyContext);
      
      expect(result).toBe('patch');
      expect(generateText).not.toHaveBeenCalled();
    });

    it('should return AI suggested release type', async () => {
      mockGenerateText('minor');

      const result = await suggestReleaseType(mockDiffContext);
      
      expect(result).toBe('minor');
    });

    it('should return major when AI suggests major', async () => {
      mockGenerateText('MAJOR');

      const result = await suggestReleaseType(mockDiffContext);
      
      expect(result).toBe('major');
    });

    it('should default to patch for invalid AI response', async () => {
      mockGenerateText('invalid response');

      const result = await suggestReleaseType(mockDiffContext);
      
      expect(result).toBe('patch');
    });

    it('should default to patch when AI fails', async () => {
      vi.mocked(generateText).mockRejectedValue(new Error('API error'));

      const result = await suggestReleaseType(mockDiffContext);
      
      expect(result).toBe('patch');
    });
  });
});
