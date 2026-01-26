import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { GitHubOperations } from './github.js';
import type { RepoConfig } from './types.js';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('./logger.js', () => ({
  logger: {
    detail: vi.fn(),
    info: vi.fn(),
    blank: vi.fn(),
    checkStatus: vi.fn(),
  },
}));

describe('GitHubOperations', () => {
  const mockConfig: RepoConfig = {
    owner: 'test-org',
    repo: 'test-repo',
    baseBranch: 'main',
    cloneUrl: 'https://github.com/test-org/test-repo.git',
  };

  let githubOps: GitHubOperations;

  beforeEach(() => {
    vi.clearAllMocks();
    githubOps = new GitHubOperations(mockConfig);
  });

  describe('createPullRequest', () => {
    it('should create pull request and return PR details', async () => {
      vi.mocked(execSync)
        .mockReturnValueOnce('https://github.com/test-org/test-repo/pull/42')
        .mockReturnValueOnce(
          JSON.stringify({
            number: 42,
            url: 'https://github.com/test-org/test-repo/pull/42',
            headRefName: 'feature/test',
            headRefOid: 'abc123',
            state: 'OPEN',
          })
        );

      const pr = await githubOps.createPullRequest(
        'feature/test',
        'Test PR',
        'PR body'
      );

      expect(pr.number).toBe(42);
      expect(pr.html_url).toBe('https://github.com/test-org/test-repo/pull/42');
      expect(pr.head.ref).toBe('feature/test');
      expect(pr.head.sha).toBe('abc123');
    });

    it('should throw error if PR URL cannot be parsed', async () => {
      vi.mocked(execSync).mockReturnValueOnce('invalid url');

      await expect(
        githubOps.createPullRequest('feature/test', 'Test PR', 'PR body')
      ).rejects.toThrow('Could not parse PR number');
    });
  });

  describe('getPullRequest', () => {
    it('should return pull request details', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          number: 42,
          url: 'https://github.com/test-org/test-repo/pull/42',
          headRefName: 'feature/test',
          headRefOid: 'abc123',
          state: 'OPEN',
          mergeable: 'MERGEABLE',
          merged: false,
        })
      );

      const pr = await githubOps.getPullRequest(42);

      expect(pr.number).toBe(42);
      expect(pr.mergeable).toBe(true);
      expect(pr.merged).toBe(false);
    });

    it('should handle non-mergeable PR', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          number: 42,
          url: 'https://github.com/test-org/test-repo/pull/42',
          headRefName: 'feature/test',
          headRefOid: 'abc123',
          state: 'OPEN',
          mergeable: 'CONFLICTING',
          merged: false,
        })
      );

      const pr = await githubOps.getPullRequest(42);

      expect(pr.mergeable).toBe(false);
    });
  });

  describe('getCheckRuns', () => {
    it('should return check runs', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            {
              __typename: 'CheckRun',
              name: 'build',
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
              workflowName: 'CI',
            },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks).toHaveLength(1);
      expect(checks[0].name).toBe('CI');
      expect(checks[0].status).toBe('completed');
      expect(checks[0].conclusion).toBe('success');
    });

    it('should return empty array on error', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Command failed');
      });

      const checks = await githubOps.getCheckRuns(42);

      expect(checks).toEqual([]);
    });

    it('should handle empty status check rollup', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({ statusCheckRollup: null })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks).toEqual([]);
    });
  });

  describe('mergePullRequest', () => {
    it('should merge pull request with squash by default', async () => {
      vi.mocked(execSync).mockReturnValueOnce('');

      await githubOps.mergePullRequest(42);

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('--squash'),
        expect.any(Object)
      );
    });

    it('should use specified merge method', async () => {
      vi.mocked(execSync).mockReturnValueOnce('');

      await githubOps.mergePullRequest(42, 'rebase');

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('--rebase'),
        expect.any(Object)
      );
    });
  });

  describe('findVersionPackagesPR', () => {
    it('should find version packages PR', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify([
          {
            number: 100,
            url: 'https://github.com/test-org/test-repo/pull/100',
            headRefName: 'changeset-release/main',
            headRefOid: 'def456',
            state: 'OPEN',
            title: 'Version Packages',
          },
        ])
      );

      const pr = await githubOps.findVersionPackagesPR();

      expect(pr).not.toBeNull();
      expect(pr!.number).toBe(100);
      expect(pr!.head.ref).toBe('changeset-release/main');
    });

    it('should return null if no PR found', async () => {
      vi.mocked(execSync).mockReturnValueOnce(JSON.stringify([]));

      const pr = await githubOps.findVersionPackagesPR();

      expect(pr).toBeNull();
    });

    it('should return null on error', async () => {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Command failed');
      });

      const pr = await githubOps.findVersionPackagesPR();

      expect(pr).toBeNull();
    });
  });

  describe('status mapping', () => {
    it('should map COMPLETED status correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            {
              name: 'test',
              status: 'COMPLETED',
              conclusion: 'SUCCESS',
            },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].status).toBe('completed');
    });

    it('should map IN_PROGRESS status correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            {
              name: 'test',
              status: 'IN_PROGRESS',
              conclusion: null,
            },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].status).toBe('in_progress');
    });

    it('should map PENDING status to in_progress', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            {
              name: 'test',
              status: 'PENDING',
              conclusion: null,
            },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].status).toBe('in_progress');
    });
  });

  describe('conclusion mapping', () => {
    it('should map SUCCESS conclusion correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            { name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].conclusion).toBe('success');
    });

    it('should map FAILURE conclusion correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            { name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].conclusion).toBe('failure');
    });

    it('should map SKIPPED conclusion correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            { name: 'test', status: 'COMPLETED', conclusion: 'SKIPPED' },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].conclusion).toBe('skipped');
    });

    it('should map CANCELLED conclusion correctly', async () => {
      vi.mocked(execSync).mockReturnValueOnce(
        JSON.stringify({
          statusCheckRollup: [
            { name: 'test', status: 'COMPLETED', conclusion: 'CANCELLED' },
          ],
        })
      );

      const checks = await githubOps.getCheckRuns(42);

      expect(checks[0].conclusion).toBe('cancelled');
    });
  });
});
