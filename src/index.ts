#!/usr/bin/env node

import { Command } from 'commander';
import { text, select, isCancel, cancel } from '@clack/prompts';
import { getRepoConfig, addRepoConfig, listRepos } from './config.js';
import { runRelease } from './release.js';
import { logger } from './logger.js';
import { RepoConfig, ReleaseOptions } from './types.js';

const program = new Command();

program
  .name('autoship')
  .description('CLI tool to automate changeset-based releases')
  .version('0.1.0');

program
  .argument('[repo]', 'Repository name to release')
  .option('-t, --type <type>', 'Release type (patch, minor, major)')
  .option('-m, --message <message>', 'Release message')
  .option('-y, --yes', 'Skip confirmations')
  .action(async (repo: string | undefined, opts: { type?: string; message?: string; yes?: boolean }) => {
    // If no repo specified, show list and prompt
    if (!repo) {
      const repos = listRepos();
      
      if (repos.length === 0) {
        logger.error('No repositories configured.');
        logger.info('Add a repository with: npx autoship add <name>');
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
      logger.error(`Repository "${repo}" not found.`);
      logger.info('Available repositories: ' + listRepos().join(', '));
      logger.info('Add a new repository with: npx autoship add <name>');
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
  });

program
  .command('add <name>')
  .description('Add a new repository configuration')
  .action(async (name: string) => {
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
    const owner = ownerResult;

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
    const repo = repoResult;

    const baseBranchResult = await text({
      message: 'Base branch:',
      defaultValue: 'main',
    });

    if (isCancel(baseBranchResult)) {
      cancel('Operation cancelled');
      process.exit(0);
    }
    const baseBranch = baseBranchResult;

    const cloneUrl = `https://github.com/${owner}/${repo}.git`;

    const config: RepoConfig = {
      owner,
      repo,
      baseBranch,
      cloneUrl,
    };

    addRepoConfig(name, config);
    logger.success(`Repository "${name}" added!`);
    logger.detail(`Clone URL: ${cloneUrl}`);
  });

program
  .command('list')
  .description('List configured repositories')
  .action(() => {
    const repos = listRepos();
    
    if (repos.length === 0) {
      logger.info('No repositories configured.');
      logger.info('Add a repository with: npx autoship add <name>');
      return;
    }

    logger.info('Configured repositories:');
    for (const repo of repos) {
      const config = getRepoConfig(repo);
      if (config) {
        console.log(`  - ${repo} (${config.owner}/${config.repo})`);
      }
    }
  });

program.parse();
