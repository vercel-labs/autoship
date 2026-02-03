import { execSync, spawn } from 'child_process';
import { RepoConfig, PullRequest, CheckRun } from './types.js';
import { logger } from './logger.js';

export class GitHubOperations {
  private config: RepoConfig;

  constructor(config: RepoConfig) {
    this.config = config;
  }

  private exec(command: string): string {
    logger.detail(`Running: ${command}`);
    return execSync(command, { encoding: 'utf-8' }).trim();
  }

  private execJson<T>(command: string): T {
    const output = this.exec(command);
    return JSON.parse(output) as T;
  }

  async createPullRequest(
    branchName: string,
    title: string,
    body: string
  ): Promise<PullRequest> {
    logger.detail(`Creating PR: ${title}`);
    logger.detail(`  Head: ${branchName}`);
    logger.detail(`  Base: ${this.config.baseBranch}`);

    // Create the PR (returns the URL)
    const prUrl = this.exec(`gh pr create \
      --repo "${this.config.owner}/${this.config.repo}" \
      --head "${branchName}" \
      --base "${this.config.baseBranch}" \
      --title "${title.replace(/"/g, '\\"')}" \
      --body "${body.replace(/"/g, '\\"')}"`);

    // Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    if (!prNumberMatch) {
      throw new Error(`Could not parse PR number from URL: ${prUrl}`);
    }
    const prNumber = parseInt(prNumberMatch[1], 10);

    // Get full PR details
    const result = this.execJson<{
      number: number;
      url: string;
      headRefName: string;
      headRefOid: string;
      state: string;
    }>(`gh pr view ${prNumber} \
      --repo "${this.config.owner}/${this.config.repo}" \
      --json number,url,headRefName,headRefOid,state`);

    return {
      number: result.number,
      html_url: result.url,
      head: {
        ref: result.headRefName,
        sha: result.headRefOid,
      },
      state: result.state,
    };
  }

  async getPullRequest(prNumber: number): Promise<PullRequest> {
    const result = this.execJson<{
      number: number;
      url: string;
      headRefName: string;
      headRefOid: string;
      state: string;
      mergeable: string;
      mergedAt: string | null;
    }>(`gh pr view ${prNumber} \
      --repo "${this.config.owner}/${this.config.repo}" \
      --json number,url,headRefName,headRefOid,state,mergeable,mergedAt`);

    return {
      number: result.number,
      html_url: result.url,
      head: {
        ref: result.headRefName,
        sha: result.headRefOid,
      },
      state: result.state,
      mergeable: result.mergeable === 'MERGEABLE',
      merged: result.mergedAt !== null,
    };
  }

  async getCheckRuns(prNumber: number): Promise<CheckRun[]> {
    try {
      const result = this.execJson<{
        statusCheckRollup: Array<{
          __typename: string;
          name: string;
          status: string;
          conclusion: string;
          workflowName?: string;
        }>;
      }>(`gh pr checks ${prNumber} \
        --repo "${this.config.owner}/${this.config.repo}" \
        --json name,status,conclusion,workflowName 2>/dev/null || echo '{"statusCheckRollup":[]}'`);

      if (!result.statusCheckRollup) {
        return [];
      }

      return result.statusCheckRollup.map((check) => ({
        id: 0,
        name: check.workflowName || check.name,
        status: this.mapStatus(check.status),
        conclusion: this.mapConclusion(check.conclusion),
      }));
    } catch {
      return [];
    }
  }

  private mapStatus(status: string): 'queued' | 'in_progress' | 'completed' {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'completed';
      case 'IN_PROGRESS':
      case 'PENDING':
        return 'in_progress';
      default:
        return 'queued';
    }
  }

  private mapConclusion(conclusion: string): CheckRun['conclusion'] {
    switch (conclusion?.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'FAILURE':
        return 'failure';
      case 'NEUTRAL':
        return 'neutral';
      case 'CANCELLED':
        return 'cancelled';
      case 'SKIPPED':
        return 'skipped';
      case 'TIMED_OUT':
        return 'timed_out';
      default:
        return null;
    }
  }

  async waitForChecks(
    prNumber: number,
    timeoutMs = 30 * 60 * 1000,
    pollIntervalMs = 15000
  ): Promise<{ success: boolean; checks: CheckRun[] }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Use gh pr checks which shows the status nicely
      let checks: CheckRun[];
      
      try {
        const output = this.exec(
          `gh pr checks ${prNumber} --repo "${this.config.owner}/${this.config.repo}" 2>&1 || true`
        );
        
        // Parse the tabular output from gh pr checks
        const lines = output.split('\n').filter(line => line.trim());
        checks = [];
        
        for (const line of lines) {
          // Skip header or empty lines
          if (line.includes('Some checks are still pending') || 
              line.includes('All checks were successful') ||
              line.includes('Some checks were not successful')) {
            continue;
          }
          
          // Parse line format: "NAME\tSTATUS\tTIME\tURL"
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const name = parts[0].trim();
            const statusStr = parts[1].trim().toLowerCase();
            
            let status: 'queued' | 'in_progress' | 'completed' = 'queued';
            let conclusion: CheckRun['conclusion'] = null;
            
            if (statusStr === 'pass' || statusStr === 'success') {
              status = 'completed';
              conclusion = 'success';
            } else if (statusStr === 'fail' || statusStr === 'failure') {
              status = 'completed';
              conclusion = 'failure';
            } else if (statusStr === 'pending' || statusStr === 'in_progress') {
              status = 'in_progress';
            } else if (statusStr === 'skipping' || statusStr === 'skipped') {
              status = 'completed';
              conclusion = 'skipped';
            }
            
            if (name) {
              checks.push({ id: 0, name, status, conclusion });
            }
          }
        }
      } catch {
        checks = [];
      }
      
      if (checks.length === 0) {
        logger.detail('No checks found yet, waiting...');
        await this.sleep(pollIntervalMs);
        continue;
      }

      const allCompleted = checks.every(check => check.status === 'completed');
      
      logger.blank();
      logger.info(`Check status (${checks.length} checks):`);
      for (const check of checks) {
        logger.checkStatus(check.name, check.status, check.conclusion);
      }

      if (allCompleted) {
        const allSuccess = checks.every(
          check => check.conclusion === 'success' || check.conclusion === 'skipped'
        );
        return { success: allSuccess, checks };
      }

      const completed = checks.filter(c => c.status === 'completed').length;
      const inProgress = checks.filter(c => c.status === 'in_progress').length;
      const queued = checks.filter(c => c.status === 'queued').length;
      
      logger.detail(`Progress: ${completed}/${checks.length} complete, ${inProgress} in progress, ${queued} queued`);
      
      await this.sleep(pollIntervalMs);
    }

    throw new Error('Timeout waiting for checks to complete');
  }

  async mergePullRequest(prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash'): Promise<void> {
    logger.detail(`Merging PR #${prNumber} using ${mergeMethod} (admin)...`);
    
    this.exec(`gh pr merge ${prNumber} \
      --repo "${this.config.owner}/${this.config.repo}" \
      --${mergeMethod} \
      --admin \
      --delete-branch`);
    
    logger.detail('PR merged successfully');
  }

  async deleteBranch(branchName: string): Promise<void> {
    // Branch deletion is handled by --delete-branch in merge
    logger.detail(`Branch ${branchName} will be deleted with PR merge`);
  }

  async findVersionPackagesPR(): Promise<PullRequest | null> {
    logger.detail('Looking for Version Packages PR...');
    
    try {
      const result = this.execJson<Array<{
        number: number;
        url: string;
        headRefName: string;
        headRefOid: string;
        state: string;
        title: string;
      }>>(`gh pr list \
        --repo "${this.config.owner}/${this.config.repo}" \
        --state open \
        --head "changeset-release/${this.config.baseBranch}" \
        --json number,url,headRefName,headRefOid,state,title`);

      if (result.length > 0) {
        const pr = result[0];
        return {
          number: pr.number,
          html_url: pr.url,
          head: {
            ref: pr.headRefName,
            sha: pr.headRefOid,
          },
          state: pr.state,
        };
      }
    } catch {
      // No PR found
    }

    return null;
  }

  async waitForVersionPackagesPR(
    timeoutMs = 10 * 60 * 1000,
    pollIntervalMs = 10000
  ): Promise<PullRequest> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const pr = await this.findVersionPackagesPR();
      
      if (pr) {
        return pr;
      }
      
      logger.detail('Version Packages PR not found yet, waiting...');
      await this.sleep(pollIntervalMs);
    }

    throw new Error('Timeout waiting for Version Packages PR');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
