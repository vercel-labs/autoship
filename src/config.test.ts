import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock os module before importing config
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn(() => '/mock/home'),
    tmpdir: vi.fn(() => '/mock/tmp'),
  };
});

vi.mock('fs');

// Import after mocks are set up
const { getRepoConfig, addRepoConfig, listRepos, getTempDir } = await import('./config.js');

describe('config', () => {
  const mockHomedir = '/mock/home';
  const mockConfigDir = '/mock/home/.autoship';
  const mockConfigFile = '/mock/home/.autoship/config.json';

  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue(mockHomedir);
    vi.mocked(os.tmpdir).mockReturnValue('/mock/tmp');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getRepoConfig', () => {
    it('should return stored config', () => {
      const storedConfig = {
        repos: {
          'my-repo': {
            owner: 'my-org',
            repo: 'my-repo',
            baseBranch: 'main',
            cloneUrl: 'https://github.com/my-org/my-repo.git',
          },
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storedConfig));

      const config = getRepoConfig('my-repo');
      
      expect(config).toEqual(storedConfig.repos['my-repo']);
    });

    it('should return null for unknown repos', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config = getRepoConfig('unknown-repo');
      
      expect(config).toBeNull();
    });

    it('should handle corrupted config file gracefully', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const config = getRepoConfig('unknown-repo');
      
      expect(config).toBeNull();
    });
  });

  describe('addRepoConfig', () => {
    it('should add new repo config to stored configs', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ repos: {} }));
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      const newConfig = {
        owner: 'new-org',
        repo: 'new-repo',
        baseBranch: 'develop',
        cloneUrl: 'https://github.com/new-org/new-repo.git',
      };

      addRepoConfig('new-repo', newConfig);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigFile,
        JSON.stringify({ repos: { 'new-repo': newConfig } }, null, 2)
      );
    });

    it('should create config directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === mockConfigFile) return false;
        if (p === mockConfigDir) return false;
        return false;
      });
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});

      addRepoConfig('test-repo', {
        owner: 'test',
        repo: 'test-repo',
        baseBranch: 'main',
        cloneUrl: 'https://github.com/test/test-repo.git',
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
    });
  });

  describe('listRepos', () => {
    it('should return empty array when no stored config', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const repos = listRepos();
      
      expect(repos).toEqual([]);
    });

    it('should return stored repos', () => {
      const storedConfig = {
        repos: {
          'custom-repo': {
            owner: 'custom',
            repo: 'custom-repo',
            baseBranch: 'main',
            cloneUrl: 'https://github.com/custom/custom-repo.git',
          },
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(storedConfig));

      const repos = listRepos();
      
      expect(repos).toContain('custom-repo');
    });
  });

  describe('getTempDir', () => {
    it('should return temp directory path', () => {
      const tempDir = getTempDir();
      
      expect(tempDir).toBe('/mock/tmp/autoship');
    });
  });
});
