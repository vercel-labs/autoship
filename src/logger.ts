import chalk from 'chalk';

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

export class Logger {
  private verbose: boolean;

  constructor(verbose = true) {
    this.verbose = verbose;
  }

  info(message: string): void {
    if (jsonMode) return;
    console.log(chalk.blue('[info]'), message);
  }

  success(message: string): void {
    if (jsonMode) return;
    console.log(chalk.green('[ok]'), message);
  }

  warn(message: string): void {
    if (jsonMode) return;
    console.log(chalk.yellow('[warn]'), message);
  }

  error(message: string): void {
    if (jsonMode) return;
    console.log(chalk.red('[error]'), message);
  }

  step(step: number, total: number, message: string): void {
    if (jsonMode) return;
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  }

  detail(message: string): void {
    if (jsonMode) return;
    if (this.verbose) {
      console.log(chalk.gray('  >'), chalk.gray(message));
    }
  }

  blank(): void {
    if (jsonMode) return;
    console.log();
  }

  header(message: string): void {
    if (jsonMode) return;
    console.log();
    console.log(chalk.bold.magenta('='.repeat(50)));
    console.log(chalk.bold.magenta(message));
    console.log(chalk.bold.magenta('='.repeat(50)));
    console.log();
  }

  divider(): void {
    if (jsonMode) return;
    console.log(chalk.gray('-'.repeat(50)));
  }

  waiting(message: string): void {
    if (jsonMode) return;
    console.log(chalk.yellow('[wait]'), message);
  }

  checkStatus(name: string, status: string, conclusion: string | null): void {
    if (jsonMode) return;
    const icon = conclusion === 'success'
      ? chalk.green('[ok]')
      : conclusion === 'failure'
        ? chalk.red('[x]')
        : chalk.yellow('[.]');
    const statusText = conclusion || status;
    console.log(`  ${icon} ${name}: ${statusText}`);
  }
}

export const logger = new Logger();
