import { confirm, select, text, isCancel, cancel } from '@clack/prompts';
import ora from 'ora';
import { RepoConfig, ReleaseOptions } from './types.js';
import { GitOperations } from './git.js';
import { GitHubOperations } from './github.js';
import { logger } from './logger.js';
import { generateChangesetMessage, suggestReleaseType, DiffContext } from './ai.js';

const TOTAL_STEPS = 10;

export async function runRelease(
  config: RepoConfig,
  options: Partial<ReleaseOptions> = {}
): Promise<void> {
  logger.header(`Release: ${config.repo}`);

  const git = new GitOperations(config);
  const github = new GitHubOperations(config);

  let spinner: ReturnType<typeof ora> | null = null;

  try {
    // Step 1: Clone repository (need this first to analyze changes)
    logger.step(1, TOTAL_STEPS, 'Cloning repository from main...');
    spinner = ora('Cloning...').start();
    await git.clone();
    spinner.succeed('Repository cloned');

    const packageName = await git.getPackageName();
    const currentVersion = await git.getPackageVersion();
    logger.detail(`Package: ${packageName} @ ${currentVersion}`);

    // Find the latest version tag and get diff
    spinner = ora('Finding latest version tag...').start();
    const latestTag = await git.getLatestVersionTag();
    
    if (!latestTag) {
      spinner.fail('No version tags found');
      logger.warn('Cannot find previous version tag. Using recent commits instead.');
    } else {
      spinner.succeed(`Latest version: ${latestTag}`);
    }

    // Build diff context
    let diffContext: DiffContext;
    
    if (latestTag) {
      spinner = ora('Analyzing changes since last release...').start();
      const [commits, diffSummary, diff] = await Promise.all([
        git.getCommitsSinceTag(latestTag),
        git.getDiffSummary(latestTag),
        git.getFullDiffSinceTag(latestTag),
      ]);
      spinner.succeed(`Found ${commits.length} commits, ${diffSummary.files.length} files changed`);
      
      diffContext = {
        commits,
        diff,
        filesChanged: diffSummary.files,
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
        previousVersion: latestTag,
      };
      
      logger.detail(`Changes: +${diffContext.insertions}/-${diffContext.deletions} lines`);
    } else {
      // Fallback to recent commits if no tag found
      const recentCommits = await git.getRecentCommits(15);
      diffContext = {
        commits: recentCommits,
        diff: '',
        filesChanged: [],
        insertions: 0,
        deletions: 0,
        previousVersion: 'unknown',
      };
    }

    // Determine release type
    let releaseType: 'patch' | 'minor' | 'major';
    
    if (options.type) {
      releaseType = options.type;
    } else {
      // Use AI to suggest release type based on diff
      spinner = ora('Analyzing changes...').start();
      const suggestedType = await suggestReleaseType(diffContext);
      spinner.succeed(`AI suggests: ${suggestedType} release`);

      const selectedType = await select({
        message: 'What type of release is this?',
        options: [
          { label: 'patch - Bug fixes, small changes', value: 'patch' as const },
          { label: 'minor - New features, backwards compatible', value: 'minor' as const },
          { label: 'major - Breaking changes', value: 'major' as const },
        ],
        initialValue: suggestedType,
      });

      if (isCancel(selectedType)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }
      releaseType = selectedType;
    }

    // Generate release message with AI
    let releaseMessage: string;
    
    if (options.message) {
      releaseMessage = options.message;
    } else {
      spinner = ora('Generating changeset description with AI...').start();
      
      try {
        const aiMessage = await generateChangesetMessage(packageName, releaseType, diffContext);
        spinner.succeed('AI generated description');
        
        logger.blank();
        logger.info('AI-generated changeset description:');
        logger.divider();
        console.log(aiMessage);
        logger.divider();
        logger.blank();

        const useAiMessage = await confirm({
          message: 'Use this description?',
          initialValue: true,
        });

        if (isCancel(useAiMessage)) {
          cancel('Release cancelled');
          await git.cleanup();
          process.exit(0);
        }

        if (useAiMessage) {
          releaseMessage = aiMessage;
        } else {
          const customMessage = await text({
            message: 'Enter your own description:',
            validate: (value) => {
              if (!value || value.length === 0) return 'Message is required';
            },
          });

          if (isCancel(customMessage)) {
            cancel('Release cancelled');
            await git.cleanup();
            process.exit(0);
          }
          releaseMessage = customMessage;
        }
      } catch (error) {
        spinner.fail('AI generation failed');
        logger.warn('Falling back to manual input');
        
        const fallbackMessage = await text({
          message: 'Describe the changes for this release:',
          validate: (value) => {
            if (!value || value.length === 0) return 'Message is required';
          },
        });

        if (isCancel(fallbackMessage)) {
          cancel('Release cancelled');
          await git.cleanup();
          process.exit(0);
        }
        releaseMessage = fallbackMessage;
      }
    }

    const fullOptions: ReleaseOptions = {
      type: releaseType,
      message: releaseMessage,
      skipConfirmations: options.skipConfirmations,
    };

    const branchName = `release/${fullOptions.type}-${Date.now()}`;

    // Step 2: Create branch
    logger.step(2, TOTAL_STEPS, 'Creating release branch...');
    spinner = ora(`Creating branch ${branchName}...`).start();
    await git.createBranch(branchName);
    spinner.succeed(`Branch created: ${branchName}`);

    // Step 3: Generate changeset
    logger.step(3, TOTAL_STEPS, 'Generating changeset...');
    spinner = ora('Generating changeset...').start();
    const changesetId = await git.generateChangeset(fullOptions, packageName);
    spinner.succeed(`Changeset created: ${changesetId}.md`);

    logger.blank();
    logger.info('Changeset content:');
    logger.divider();
    console.log(`"${packageName}": ${fullOptions.type}`);
    console.log();
    console.log(fullOptions.message);
    logger.divider();
    logger.blank();

    // Confirm before pushing
    if (!fullOptions.skipConfirmations) {
      const shouldContinue = await confirm({
        message: 'Push changes and create PR?',
        initialValue: true,
      });

      if (isCancel(shouldContinue)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }

      if (!shouldContinue) {
        logger.warn('Release cancelled by user');
        await git.cleanup();
        return;
      }
    }

    // Step 4: Commit changes
    logger.step(4, TOTAL_STEPS, 'Committing changes...');
    spinner = ora('Committing...').start();
    await git.stageAndCommit(`chore: add ${fullOptions.type} changeset for release`);
    spinner.succeed('Changes committed');

    // Step 5: Push branch
    logger.step(5, TOTAL_STEPS, 'Pushing branch to origin...');
    spinner = ora('Pushing...').start();
    await git.push(branchName);
    spinner.succeed('Branch pushed');

    // Step 6: Create PR
    logger.step(6, TOTAL_STEPS, 'Creating pull request...');
    spinner = ora('Creating PR...').start();
    const pr = await github.createPullRequest(
      branchName,
      `chore: ${fullOptions.type} release - ${fullOptions.message.slice(0, 50)}`,
      `## Release Changeset

**Type:** ${fullOptions.type}

**Changes:**
${fullOptions.message}

---
*This PR was created automatically by autoship*`
    );
    spinner.succeed(`PR created: #${pr.number}`);
    logger.info(`PR URL: ${pr.html_url}`);

    // Confirm before waiting for checks
    if (!fullOptions.skipConfirmations) {
      const shouldWait = await confirm({
        message: 'Wait for CI checks to pass?',
        initialValue: true,
      });

      if (isCancel(shouldWait)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }

      if (!shouldWait) {
        logger.info('You can manually merge the PR when ready');
        await git.cleanup();
        return;
      }
    }

    // Step 7: Wait for checks
    logger.step(7, TOTAL_STEPS, 'Waiting for CI checks...');
    logger.waiting('This may take several minutes...');
    
    const { success: checksPass, checks } = await github.waitForChecks(pr.number);
    
    if (!checksPass) {
      logger.error('CI checks failed!');
      logger.info(`Please check the PR: ${pr.html_url}`);
      
      const failedChecks = checks.filter(c => c.conclusion === 'failure');
      for (const check of failedChecks) {
        logger.error(`  Failed: ${check.name}`);
      }
      
      await git.cleanup();
      process.exit(1);
    }
    
    logger.success('All CI checks passed!');

    // Confirm before merging
    if (!fullOptions.skipConfirmations) {
      const shouldMerge = await confirm({
        message: 'Merge the changeset PR?',
        initialValue: true,
      });

      if (isCancel(shouldMerge)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }

      if (!shouldMerge) {
        logger.info('You can manually merge the PR when ready');
        await git.cleanup();
        return;
      }
    }

    // Step 8: Merge PR
    logger.step(8, TOTAL_STEPS, 'Merging changeset PR...');
    spinner = ora('Merging...').start();
    await github.mergePullRequest(pr.number);
    await github.deleteBranch(branchName);
    spinner.succeed('Changeset PR merged!');

    // Step 9: Wait for Version Packages PR
    logger.step(9, TOTAL_STEPS, 'Waiting for Version Packages PR...');
    logger.waiting('Changesets action will create a Version Packages PR...');
    
    const versionPr = await github.waitForVersionPackagesPR();
    logger.success(`Version Packages PR found: #${versionPr.number}`);
    logger.info(`PR URL: ${versionPr.html_url}`);

    // Confirm before continuing
    if (!fullOptions.skipConfirmations) {
      const shouldContinueVersion = await confirm({
        message: 'Wait for checks and merge the Version Packages PR?',
        initialValue: true,
      });

      if (isCancel(shouldContinueVersion)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }

      if (!shouldContinueVersion) {
        logger.info('You can manually merge the Version Packages PR when ready');
        await git.cleanup();
        return;
      }
    }

    // Wait for checks on Version Packages PR
    logger.waiting('Waiting for Version Packages PR checks...');
    const { success: versionChecksPass } = await github.waitForChecks(versionPr.number);
    
    if (!versionChecksPass) {
      logger.error('Version Packages PR checks failed!');
      logger.info(`Please check the PR: ${versionPr.html_url}`);
      await git.cleanup();
      process.exit(1);
    }
    
    logger.success('Version Packages PR checks passed!');

    // Final confirmation
    if (!fullOptions.skipConfirmations) {
      const shouldMergeVersion = await confirm({
        message: 'Merge the Version Packages PR to publish the release?',
        initialValue: true,
      });

      if (isCancel(shouldMergeVersion)) {
        cancel('Release cancelled');
        await git.cleanup();
        process.exit(0);
      }

      if (!shouldMergeVersion) {
        logger.info('You can manually merge the Version Packages PR when ready');
        await git.cleanup();
        return;
      }
    }

    // Step 10: Merge Version Packages PR
    logger.step(10, TOTAL_STEPS, 'Merging Version Packages PR...');
    spinner = ora('Merging and publishing...').start();
    await github.mergePullRequest(versionPr.number);
    spinner.succeed('Version Packages PR merged!');

    logger.blank();
    logger.header('Release Complete!');
    logger.success(`The ${fullOptions.type} release has been published.`);
    logger.info('The release workflow will now:');
    logger.detail('- Build binaries for all platforms');
    logger.detail('- Publish the package to npm');
    logger.detail('- Create a GitHub release');
    
    await git.cleanup();

  } catch (error) {
    spinner?.fail();
    logger.error(`Release failed: ${error instanceof Error ? error.message : String(error)}`);
    
    try {
      await git.cleanup();
    } catch {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}
