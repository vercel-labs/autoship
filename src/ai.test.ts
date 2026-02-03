import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mockCreate is available when vi.mock runs
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  function MockAnthropic() {
    return {
      messages: {
        create: mockCreate,
      },
    };
  }
  return { default: MockAnthropic };
});

vi.mock('./logger.js', () => ({
  logger: {
    detail: vi.fn(),
    warn: vi.fn(),
  },
}));

import { generateChangesetMessage, suggestReleaseType, DiffContext } from './ai.js';

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
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Added new feature and fixed critical bug.' }],
      });

      const result = await generateChangesetMessage('my-package', 'minor', mockDiffContext);

      expect(result).toBe('Added new feature and fixed critical bug.');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
        })
      );
    });

    it('should throw error when AI generation fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      await expect(
        generateChangesetMessage('my-package', 'patch', mockDiffContext)
      ).rejects.toThrow('API error');
    });

    it('should trim whitespace from AI response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '  Message with whitespace  \n' }],
      });

      const result = await generateChangesetMessage('my-package', 'patch', mockDiffContext);

      expect(result).toBe('Message with whitespace');
    });

    it('should throw error when no text response from AI', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      await expect(
        generateChangesetMessage('my-package', 'patch', mockDiffContext)
      ).rejects.toThrow('No text response from AI');
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
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should return AI suggested release type', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'minor' }],
      });

      const result = await suggestReleaseType(mockDiffContext);

      expect(result).toBe('minor');
    });

    it('should return major when AI suggests major', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'MAJOR' }],
      });

      const result = await suggestReleaseType(mockDiffContext);

      expect(result).toBe('major');
    });

    it('should default to patch for invalid AI response', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'invalid response' }],
      });

      const result = await suggestReleaseType(mockDiffContext);

      expect(result).toBe('patch');
    });

    it('should default to patch when AI fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const result = await suggestReleaseType(mockDiffContext);

      expect(result).toBe('patch');
    });

    it('should default to patch when no text block in response', async () => {
      mockCreate.mockResolvedValue({
        content: [],
      });

      const result = await suggestReleaseType(mockDiffContext);

      expect(result).toBe('patch');
    });
  });
});
