import chalk from 'chalk';

export class Logger {
  private verbose: boolean;

  constructor(verbose = true) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(chalk.blue('[info]'), message);
  }

  success(message: string): void {
    console.log(chalk.green('[ok]'), message);
  }

  warn(message: string): void {
    console.log(chalk.yellow('[warn]'), message);
  }

  error(message: string): void {
    console.log(chalk.red('[error]'), message);
  }

  step(step: number, total: number, message: string): void {
    console.log(chalk.cyan(`[${step}/${total}]`), message);
  }

  detail(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('  >'), chalk.gray(message));
    }
  }

  blank(): void {
    console.log();
  }

  header(message: string): void {
    console.log();
    console.log(chalk.bold.magenta('='.repeat(50)));
    console.log(chalk.bold.magenta(message));
    console.log(chalk.bold.magenta('='.repeat(50)));
    console.log();
  }

  divider(): void {
    console.log(chalk.gray('-'.repeat(50)));
  }

  waiting(message: string): void {
    console.log(chalk.yellow('[wait]'), message);
  }

  checkStatus(name: string, status: string, conclusion: string | null): void {
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
