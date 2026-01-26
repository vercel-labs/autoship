#!/usr/bin/env node

import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import { getRepoConfig, addRepoConfig, listRepos } from './config.js';
import { runRelease } from './release.js';
import { logger } from './logger.js';
import { RepoConfig, ReleaseOptions } from './types.js';

const program = new Command();

program
  .name('mkrelease')
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
        logger.info('Add a repository with: mkrelease add <name>');
        process.exit(1);
      }

      repo = await select({
        message: 'Select a repository to release:',
        choices: repos.map(r => ({ name: r, value: r })),
      });
    }

    const config = getRepoConfig(repo);
    
    if (!config) {
      logger.error(`Repository "${repo}" not found.`);
      logger.info('Available repositories: ' + listRepos().join(', '));
      logger.info('Add a new repository with: mkrelease add <name>');
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

    const owner = await input({
      message: 'GitHub owner (org or user):',
      validate: (v) => v.length > 0 || 'Owner is required',
    });

    const repo = await input({
      message: 'Repository name:',
      default: name,
      validate: (v) => v.length > 0 || 'Repo is required',
    });

    const baseBranch = await input({
      message: 'Base branch:',
      default: 'main',
    });

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
      logger.info('Add a repository with: mkrelease add <name>');
      return;
    }

    logger.info('Configured repositories:');
    for (const repo of repos) {
      const config = getRepoConfig(repo);
      if (config) {
        console.log(`  • ${repo} (${config.owner}/${config.repo})`);
      }
    }
  });

program.parse();
