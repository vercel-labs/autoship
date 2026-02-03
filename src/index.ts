#!/usr/bin/env node

import { Command } from 'commander';
import { text, select, isCancel, cancel } from '@clack/prompts';
import * as fs from 'fs';
import { getRepoConfig, addRepoConfig, listRepos, removeRepoConfig } from './config.js';
import { runRelease } from './release.js';
import { logger, setJsonMode, outputJson } from './logger.js';
import { RepoConfig, ReleaseOptions } from './types.js';
import { GitHubOperations } from './github.js';
import { GitOperations } from './git.js';

const program = new Command();

// Global options
let jsonMode = false;

program
  .name('autoship')
  .description('CLI tool to automate changeset-based releases')
  .version('0.2.0')
  .option('--json', 'Output results as JSON')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) {
      jsonMode = true;
      setJsonMode(true);
    }
  });

// Main release command
program
  .argument('[repo]', 'Repository name to release')
  .option('-t, --type <type>', 'Release type (patch, minor, major)')
  .option('-m, --message <message>', 'Release message')
  .option('--stdin', 'Read release message from stdin')
  .option('-y, --yes', 'Skip confirmations')
  .action(async (repo: string | undefined, opts: { type?: string; message?: string; stdin?: boolean; yes?: boolean }) => {
    try {
      // Handle stdin for message
      if (opts.stdin && !opts.message) {
        opts.message = await readStdin();
      }

      // If no repo specified, show list and prompt
      if (!repo) {
        const repos = listRepos();

        if (repos.length === 0) {
          if (jsonMode) {
            outputJson({ success: false, error: 'No repositories configured', hint: 'Run: autoship repo add <name>' });
          } else {
            logger.error('No repositories configured.');
            logger.info('Add a repository with: autoship repo add <name>');
          }
          process.exit(1);
        }

        if (jsonMode) {
          outputJson({ success: false, error: 'Repository name required in JSON mode', available: repos });
          process.exit(1);
        }

        const selected = await select({
          message: 'Select a repository to release:',
          options: repos.map(r => ({ label: r, value: r })),
        });

        if (isCancel(selected)) {
          cancel('Operation cancelled');
          process.exit(0);
        }
        repo = selected;
      }

      const config = getRepoConfig(repo);

      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${repo}" not found`, available: listRepos() });
        } else {
          logger.error(`Repository "${repo}" not found.`);
          logger.info('Available repositories: ' + listRepos().join(', '));
          logger.info('Add a new repository with: autoship repo add <name>');
        }
        process.exit(1);
      }

      const options: Partial<ReleaseOptions> = {
        skipConfirmations: opts.yes,
      };

      if (opts.type && ['patch', 'minor', 'major'].includes(opts.type)) {
        options.type = opts.type as 'patch' | 'minor' | 'major';
      }

      if (opts.message) {
        options.message = opts.message;
      }

      await runRelease(config, options);
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Repository management commands
const repoCmd = program.command('repo').description('Manage repository configurations');

repoCmd
  .command('add <name>')
  .description('Add a new repository configuration')
  .option('-o, --owner <owner>', 'GitHub owner (org or user)')
  .option('-r, --repo <repo>', 'Repository name')
  .option('-b, --branch <branch>', 'Base branch', 'main')
  .action(async (name: string, opts: { owner?: string; repo?: string; branch?: string }) => {
    try {
      let owner = opts.owner;
      let repo = opts.repo || name;
      let baseBranch = opts.branch || 'main';

      // If owner not provided, prompt (unless in json mode)
      if (!owner) {
        if (jsonMode) {
          outputJson({ success: false, error: 'Owner is required in JSON mode. Use --owner flag.' });
          process.exit(1);
        }

        logger.info(`Adding repository: ${name}`);

        const ownerResult = await text({
          message: 'GitHub owner (org or user):',
          validate: (v) => {
            if (!v || v.length === 0) return 'Owner is required';
          },
        });

        if (isCancel(ownerResult)) {
          cancel('Operation cancelled');
          process.exit(0);
        }
        owner = ownerResult;

        const repoResult = await text({
          message: 'Repository name:',
          defaultValue: name,
          validate: (v) => {
            if (!v || v.length === 0) return 'Repo is required';
          },
        });

        if (isCancel(repoResult)) {
          cancel('Operation cancelled');
          process.exit(0);
        }
        repo = repoResult;

        const baseBranchResult = await text({
          message: 'Base branch:',
          defaultValue: 'main',
        });

        if (isCancel(baseBranchResult)) {
          cancel('Operation cancelled');
          process.exit(0);
        }
        baseBranch = baseBranchResult;
      }

      const cloneUrl = `https://github.com/${owner}/${repo}.git`;

      const config: RepoConfig = {
        owner,
        repo,
        baseBranch,
        cloneUrl,
      };

      addRepoConfig(name, config);

      if (jsonMode) {
        outputJson({ success: true, name, config });
      } else {
        logger.success(`Repository "${name}" added!`);
        logger.detail(`Clone URL: ${cloneUrl}`);
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

repoCmd
  .command('remove <name>')
  .alias('rm')
  .description('Remove a repository configuration')
  .action((name: string) => {
    try {
      const config = getRepoConfig(name);
      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${name}" not found` });
        } else {
          logger.error(`Repository "${name}" not found.`);
        }
        process.exit(1);
      }

      removeRepoConfig(name);

      if (jsonMode) {
        outputJson({ success: true, removed: name });
      } else {
        logger.success(`Repository "${name}" removed.`);
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

repoCmd
  .command('list')
  .alias('ls')
  .description('List configured repositories')
  .action(() => {
    try {
      const repos = listRepos();

      if (jsonMode) {
        const repoConfigs = repos.map(name => ({
          name,
          ...getRepoConfig(name),
        }));
        outputJson({ success: true, repositories: repoConfigs });
        return;
      }

      if (repos.length === 0) {
        logger.info('No repositories configured.');
        logger.info('Add a repository with: autoship repo add <name>');
        return;
      }

      logger.info('Configured repositories:');
      for (const repo of repos) {
        const config = getRepoConfig(repo);
        if (config) {
          console.log(`  - ${repo} (${config.owner}/${config.repo})`);
        }
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

repoCmd
  .command('show <name>')
  .description('Show repository configuration details')
  .action((name: string) => {
    try {
      const config = getRepoConfig(name);

      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${name}" not found` });
        } else {
          logger.error(`Repository "${name}" not found.`);
        }
        process.exit(1);
      }

      if (jsonMode) {
        outputJson({ success: true, name, config });
      } else {
        logger.info(`Repository: ${name}`);
        console.log(`  Owner: ${config.owner}`);
        console.log(`  Repo: ${config.repo}`);
        console.log(`  Branch: ${config.baseBranch}`);
        console.log(`  URL: ${config.cloneUrl}`);
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Status command - check PR and CI status
program
  .command('status <repo>')
  .description('Check release status (PRs, CI checks)')
  .option('-p, --pr <number>', 'Check specific PR number')
  .action(async (repoName: string, opts: { pr?: string }) => {
    try {
      const config = getRepoConfig(repoName);

      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${repoName}" not found` });
        } else {
          logger.error(`Repository "${repoName}" not found.`);
        }
        process.exit(1);
      }

      const github = new GitHubOperations(config);

      if (opts.pr) {
        const prNumber = parseInt(opts.pr, 10);
        const pr = await github.getPullRequest(prNumber);
        const checks = await github.getCheckRuns(prNumber);

        if (jsonMode) {
          outputJson({ success: true, pr, checks });
        } else {
          logger.info(`PR #${pr.number}: ${pr.state}`);
          logger.info(`URL: ${pr.html_url}`);
          if (checks.length > 0) {
            logger.info('Checks:');
            for (const check of checks) {
              logger.checkStatus(check.name, check.status, check.conclusion);
            }
          }
        }
      } else {
        // Check for Version Packages PR
        const versionPr = await github.findVersionPackagesPR();

        if (jsonMode) {
          outputJson({
            success: true,
            versionPackagesPR: versionPr ? { number: versionPr.number, url: versionPr.html_url, state: versionPr.state } : null
          });
        } else {
          if (versionPr) {
            logger.info(`Version Packages PR: #${versionPr.number}`);
            logger.info(`URL: ${versionPr.html_url}`);
            logger.info(`State: ${versionPr.state}`);
          } else {
            logger.info('No Version Packages PR found.');
          }
        }
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Analyze command - analyze changes without releasing
program
  .command('analyze <repo>')
  .description('Analyze changes since last release without creating a release')
  .action(async (repoName: string) => {
    try {
      const config = getRepoConfig(repoName);

      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${repoName}" not found` });
        } else {
          logger.error(`Repository "${repoName}" not found.`);
        }
        process.exit(1);
      }

      const git = new GitOperations(config);

      if (!jsonMode) {
        logger.info(`Analyzing ${config.owner}/${config.repo}...`);
      }

      await git.clone();

      const packageName = await git.getPackageName();
      const currentVersion = await git.getPackageVersion();
      const latestTag = await git.getLatestVersionTag();

      let analysis: {
        package: string;
        currentVersion: string;
        latestTag: string | null;
        commits: string[];
        filesChanged: string[];
        insertions: number;
        deletions: number;
      };

      if (latestTag) {
        const [commits, diffSummary] = await Promise.all([
          git.getCommitsSinceTag(latestTag),
          git.getDiffSummary(latestTag),
        ]);

        analysis = {
          package: packageName,
          currentVersion,
          latestTag,
          commits,
          filesChanged: diffSummary.files,
          insertions: diffSummary.insertions,
          deletions: diffSummary.deletions,
        };
      } else {
        const commits = await git.getRecentCommits(10);
        analysis = {
          package: packageName,
          currentVersion,
          latestTag: null,
          commits,
          filesChanged: [],
          insertions: 0,
          deletions: 0,
        };
      }

      await git.cleanup();

      if (jsonMode) {
        outputJson({ success: true, ...analysis });
      } else {
        logger.info(`Package: ${analysis.package} @ ${analysis.currentVersion}`);
        logger.info(`Latest tag: ${analysis.latestTag || 'none'}`);
        logger.info(`Commits since last release: ${analysis.commits.length}`);
        if (analysis.commits.length > 0) {
          logger.info('Recent commits:');
          for (const commit of analysis.commits.slice(0, 10)) {
            console.log(`  - ${commit}`);
          }
        }
        if (analysis.filesChanged.length > 0) {
          logger.info(`Files changed: ${analysis.filesChanged.length}`);
          logger.info(`Lines: +${analysis.insertions}/-${analysis.deletions}`);
        }
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Merge command - merge a PR
program
  .command('merge <repo> <pr>')
  .description('Merge a pull request')
  .option('--method <method>', 'Merge method: merge, squash, rebase', 'squash')
  .option('--wait', 'Wait for CI checks before merging')
  .action(async (repoName: string, prNumber: string, opts: { method?: string; wait?: boolean }) => {
    try {
      const config = getRepoConfig(repoName);

      if (!config) {
        if (jsonMode) {
          outputJson({ success: false, error: `Repository "${repoName}" not found` });
        } else {
          logger.error(`Repository "${repoName}" not found.`);
        }
        process.exit(1);
      }

      const github = new GitHubOperations(config);
      const prNum = parseInt(prNumber, 10);

      if (opts.wait) {
        if (!jsonMode) {
          logger.info('Waiting for CI checks...');
        }
        const { success, checks } = await github.waitForChecks(prNum);
        if (!success) {
          if (jsonMode) {
            outputJson({ success: false, error: 'CI checks failed', checks });
          } else {
            logger.error('CI checks failed!');
          }
          process.exit(1);
        }
      }

      const method = (opts.method || 'squash') as 'merge' | 'squash' | 'rebase';
      await github.mergePullRequest(prNum, method);

      if (jsonMode) {
        outputJson({ success: true, merged: prNum, method });
      } else {
        logger.success(`PR #${prNum} merged!`);
      }
    } catch (error) {
      if (jsonMode) {
        outputJson({ success: false, error: error instanceof Error ? error.message : String(error) });
      } else {
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Backward compatibility: keep 'add' and 'list' as aliases
program
  .command('add <name>')
  .description('Add a new repository (alias for repo add)')
  .option('-o, --owner <owner>', 'GitHub owner (org or user)')
  .option('-r, --repo <repo>', 'Repository name')
  .option('-b, --branch <branch>', 'Base branch', 'main')
  .action(async (name: string, opts: { owner?: string; repo?: string; branch?: string }) => {
    // Delegate to repo add
    await repoCmd.commands.find(c => c.name() === 'add')?.parseAsync([name, ...process.argv.slice(4)], { from: 'user' });
  });

program
  .command('list')
  .description('List configured repositories (alias for repo list)')
  .action(() => {
    repoCmd.commands.find(c => c.name() === 'list')?.parseAsync([], { from: 'user' });
  });

// Helper function to read from stdin
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
  });
}

program.parse();
