import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { GitOperations } from './git.js';
import type { RepoConfig } from './types.js';

vi.mock('fs');
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));
vi.mock('./config.js', () => ({
  getTempDir: vi.fn(() => '/mock/tmp/autoship'),
}));
vi.mock('./logger.js', () => ({
  logger: {
    detail: vi.fn(),
  },
}));
vi.mock('crypto', () => ({
  randomBytes: vi.fn(() => ({
    toString: () => 'abcd1234',
  })),
}));

const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  checkoutLocalBranch: vi.fn().mockResolvedValue(undefined),
  add: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  push: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' }, all: [] }),
  fetch: vi.fn().mockResolvedValue(undefined),
  tags: vi.fn().mockResolvedValue({ all: ['v1.0.0', 'v0.9.0'] }),
  diff: vi.fn().mockResolvedValue('diff content'),
  diffSummary: vi.fn().mockResolvedValue({
    files: [{ file: 'src/index.ts' }],
    insertions: 10,
    deletions: 5,
  }),
};

import { simpleGit } from 'simple-git';

describe('GitOperations', () => {
  const mockConfig: RepoConfig = {
    owner: 'test-org',
    repo: 'test-repo',
    baseBranch: 'main',
    cloneUrl: 'https://github.com/test-org/test-repo.git',
  };

  let gitOps: GitOperations;

  beforeEach(() => {
    vi.clearAllMocks();
    gitOps = new GitOperations(mockConfig);
  });

  describe('getWorkDir', () => {
    it('should return work directory path', () => {
      const workDir = gitOps.getWorkDir();
      
      expect(workDir).toBe('/mock/tmp/autoship/test-repo-abcd1234');
    });
  });

  describe('clone', () => {
    it('should clone repository to work directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      await gitOps.clone();

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test-org/test-repo.git',
        '/mock/tmp/autoship/test-repo-abcd1234',
        ['--depth', '1']
      );
    });

    it('should remove existing directory before cloning', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.rmSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);

      await gitOps.clone();

      expect(fs.rmSync).toHaveBeenCalledWith(
        '/mock/tmp/autoship/test-repo-abcd1234',
        { recursive: true }
      );
    });
  });

  describe('createBranch', () => {
    it('should create and checkout new branch', async () => {
      await gitOps.createBranch('feature/test');

      expect(mockGit.checkoutLocalBranch).toHaveBeenCalledWith('feature/test');
    });
  });

  describe('generateChangeset', () => {
    it('should write changeset file', async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const changesetId = await gitOps.generateChangeset(
        { type: 'minor', message: 'Test message' },
        'my-package'
      );

      expect(changesetId).toBe('release-abcd1234');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/mock/tmp/autoship/test-repo-abcd1234/.changeset/release-abcd1234.md',
        expect.stringContaining('"my-package": minor')
      );
    });

    it('should include message in changeset', async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      await gitOps.generateChangeset(
        { type: 'patch', message: 'Fixed critical bug' },
        'my-package'
      );

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Fixed critical bug')
      );
    });
  });

  describe('stageAndCommit', () => {
    it('should stage changeset files and commit', async () => {
      await gitOps.stageAndCommit('test commit message');

      expect(mockGit.add).toHaveBeenCalledWith('.changeset/*');
      expect(mockGit.commit).toHaveBeenCalledWith('test commit message');
    });
  });

  describe('push', () => {
    it('should push branch to origin', async () => {
      await gitOps.push('feature/test');

      expect(mockGit.push).toHaveBeenCalledWith('origin', 'feature/test');
    });
  });

  describe('getCurrentCommitSha', () => {
    it('should return latest commit hash', async () => {
      const sha = await gitOps.getCurrentCommitSha();

      expect(sha).toBe('abc123');
    });

    it('should return empty string if no commits', async () => {
      mockGit.log.mockResolvedValueOnce({ latest: null, all: [] });

      const sha = await gitOps.getCurrentCommitSha();

      expect(sha).toBe('');
    });
  });

  describe('cleanup', () => {
    it('should remove work directory', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.rmSync).mockImplementation(() => {});

      await gitOps.cleanup();

      expect(fs.rmSync).toHaveBeenCalledWith(
        '/mock/tmp/autoship/test-repo-abcd1234',
        { recursive: true }
      );
    });

    it('should not throw if directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(gitOps.cleanup()).resolves.not.toThrow();
    });
  });

  describe('getPackageName', () => {
    it('should read package name from package.json', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@org/package', version: '1.0.0' })
      );

      const name = await gitOps.getPackageName();

      expect(name).toBe('@org/package');
    });
  });

  describe('getPackageVersion', () => {
    it('should read package version from package.json', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ name: '@org/package', version: '2.5.0' })
      );

      const version = await gitOps.getPackageVersion();

      expect(version).toBe('2.5.0');
    });
  });

  describe('getRecentCommits', () => {
    it('should return recent commit messages', async () => {
      mockGit.log.mockResolvedValueOnce({
        all: [
          { message: 'feat: new feature' },
          { message: 'fix: bug fix' },
        ],
      });

      const commits = await gitOps.getRecentCommits(10);

      expect(commits).toEqual(['feat: new feature', 'fix: bug fix']);
    });
  });

  describe('getLatestVersionTag', () => {
    it('should return latest version tag', async () => {
      const tag = await gitOps.getLatestVersionTag();

      expect(tag).toBe('v1.0.0');
      expect(mockGit.fetch).toHaveBeenCalledWith(['--tags']);
    });

    it('should return null if no tags found', async () => {
      mockGit.tags.mockResolvedValueOnce({ all: [] });

      const tag = await gitOps.getLatestVersionTag();

      expect(tag).toBeNull();
    });
  });

  describe('getDiffSinceTag', () => {
    it('should return diff since tag', async () => {
      const diff = await gitOps.getDiffSinceTag('v1.0.0');

      expect(diff).toBe('diff content');
      expect(mockGit.diff).toHaveBeenCalledWith(['v1.0.0', 'HEAD', '--stat']);
    });
  });

  describe('getDiffSummary', () => {
    it('should return diff summary since tag', async () => {
      const summary = await gitOps.getDiffSummary('v1.0.0');

      expect(summary).toEqual({
        files: ['src/index.ts'],
        insertions: 10,
        deletions: 5,
      });
    });
  });

  describe('getCommitsSinceTag', () => {
    it('should return commits since tag', async () => {
      mockGit.log.mockResolvedValueOnce({
        all: [
          { message: 'feat: feature 1' },
          { message: 'feat: feature 2' },
        ],
      });

      const commits = await gitOps.getCommitsSinceTag('v1.0.0');

      expect(commits).toEqual(['feat: feature 1', 'feat: feature 2']);
      expect(mockGit.log).toHaveBeenCalledWith(['v1.0.0..HEAD', '--oneline']);
    });
  });

  describe('getFullDiffSinceTag', () => {
    it('should return full diff since tag', async () => {
      mockGit.diff.mockResolvedValueOnce('full diff content');

      const diff = await gitOps.getFullDiffSinceTag('v1.0.0');

      expect(diff).toBe('full diff content');
    });

    it('should truncate long diffs', async () => {
      const longDiff = 'x'.repeat(15000);
      mockGit.diff.mockResolvedValueOnce(longDiff);

      const diff = await gitOps.getFullDiffSinceTag('v1.0.0', 10000);

      expect(diff.length).toBeLessThan(longDiff.length);
      expect(diff).toContain('... (diff truncated)');
    });
  });
});
