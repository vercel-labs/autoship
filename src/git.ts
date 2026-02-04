import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { RepoConfig, ReleaseOptions } from './types.js';
import { logger } from './logger.js';
import { getTempDir } from './config.js';
import { randomBytes } from 'crypto';

export class GitOperations {
  private git: SimpleGit;
  private workDir: string;
  private config: RepoConfig;

  constructor(config: RepoConfig) {
    this.config = config;
    this.workDir = path.join(getTempDir(), `${config.repo}-${randomBytes(4).toString('hex')}`);
    this.git = simpleGit();
  }

  getWorkDir(): string {
    return this.workDir;
  }

  async clone(): Promise<void> {
    logger.detail(`Cloning ${this.config.cloneUrl} to ${this.workDir}`);
    
    // Ensure temp directory exists
    const tempDir = getTempDir();
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Remove existing directory if it exists
    if (fs.existsSync(this.workDir)) {
      fs.rmSync(this.workDir, { recursive: true });
    }

    await this.git.clone(this.config.cloneUrl, this.workDir, ['--depth', '1']);
    this.git = simpleGit(this.workDir);
    
    logger.detail(`Cloned to ${this.workDir}`);
  }

  async createBranch(branchName: string): Promise<void> {
    logger.detail(`Creating branch: ${branchName}`);
    await this.git.checkoutLocalBranch(branchName);
    logger.detail(`Switched to branch: ${branchName}`);
  }

  async generateChangeset(options: ReleaseOptions, packageNames: string | string[]): Promise<string> {
    const changesetDir = path.join(this.workDir, '.changeset');

    // Generate a unique changeset name
    const changesetId = `release-${randomBytes(4).toString('hex')}`;
    const changesetPath = path.join(changesetDir, `${changesetId}.md`);

    const normalizedPackageNames = Array.isArray(packageNames) ? packageNames : [packageNames];
    const packageEntries = normalizedPackageNames
      .map(name => `"${name}": ${options.type}`)
      .join('\n');

    const content = `---
${packageEntries}
---

${options.message}
`;

    logger.detail(`Writing changeset to ${changesetPath}`);
    fs.writeFileSync(changesetPath, content);

    return changesetId;
  }

  async stageAndCommit(message: string): Promise<void> {
    logger.detail('Staging changes...');
    await this.git.add('.changeset/*');
    
    logger.detail(`Committing: ${message}`);
    await this.git.commit(message);
  }

  async push(branchName: string): Promise<void> {
    logger.detail(`Pushing branch ${branchName} to origin...`);
    await this.git.push('origin', branchName);
    logger.detail('Push complete');
  }

  async getCurrentCommitSha(): Promise<string> {
    const log = await this.git.log(['-1']);
    return log.latest?.hash || '';
  }

  async cleanup(): Promise<void> {
    if (fs.existsSync(this.workDir)) {
      logger.detail(`Cleaning up ${this.workDir}`);
      fs.rmSync(this.workDir, { recursive: true });
    }
  }

  async getPackageName(): Promise<string> {
    const packageJsonPath = path.join(this.workDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name;
  }

  async getPackageVersion(): Promise<string> {
    const packageJsonPath = path.join(this.workDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  }

  async getRecentCommits(count = 10): Promise<string[]> {
    logger.detail(`Fetching last ${count} commits...`);
    
    // Need to fetch full history for commits
    await this.git.fetch(['--unshallow']).catch(() => {
      // Already unshallowed or full clone
    });
    
    const log = await this.git.log([`-${count}`, '--oneline']);
    return log.all.map(commit => commit.message);
  }

  async getLatestVersionTag(): Promise<string | null> {
    logger.detail('Finding latest version tag...');
    
    // Fetch tags
    await this.git.fetch(['--tags']);
    
    // Get all tags that start with 'v' and sort by version
    const tags = await this.git.tags(['--sort=-v:refname', 'v*']);
    
    if (tags.all.length === 0) {
      logger.detail('No version tags found');
      return null;
    }
    
    const latestTag = tags.all[0];
    logger.detail(`Latest version tag: ${latestTag}`);
    return latestTag;
  }

  async getDiffSinceTag(tag: string): Promise<string> {
    logger.detail(`Getting diff since ${tag}...`);
    
    // Get the diff between the tag and HEAD
    const diff = await this.git.diff([tag, 'HEAD', '--stat']);
    return diff;
  }

  async getDiffSummary(tag: string): Promise<{ files: string[]; insertions: number; deletions: number }> {
    logger.detail(`Getting diff summary since ${tag}...`);
    
    const diffSummary = await this.git.diffSummary([tag, 'HEAD']);
    return {
      files: diffSummary.files.map(f => f.file),
      insertions: diffSummary.insertions,
      deletions: diffSummary.deletions,
    };
  }

  async getCommitsSinceTag(tag: string): Promise<string[]> {
    logger.detail(`Getting commits since ${tag}...`);
    
    const log = await this.git.log([`${tag}..HEAD`, '--oneline']);
    return log.all.map(commit => commit.message);
  }

  async getFullDiffSinceTag(tag: string, maxLength = 10000): Promise<string> {
    logger.detail(`Getting full diff since ${tag}...`);
    
    // Get the actual code diff (limited to avoid huge outputs)
    const diff = await this.git.diff([tag, 'HEAD']);
    
    if (diff.length > maxLength) {
      return diff.slice(0, maxLength) + '\n\n... (diff truncated)';
    }
    return diff;
  }
}
