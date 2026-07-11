import { TestFailure } from './assert.js';

export interface ManualCheck {
  flow: string;
  text: string;
}

export interface StepResult {
  name: string;
  status: 'passed' | 'failed';
  error?: Error;
}

export class TestRunner {
  readonly results: StepResult[] = [];
  readonly manualChecks: ManualCheck[] = [];

  async step(name: string, callback: () => Promise<void>): Promise<void> {
    process.stdout.write(`\n[RUN] ${name}\n`);
    try {
      await callback();
      this.results.push({ name, status: 'passed' });
      process.stdout.write(`[PASS] ${name}\n`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.results.push({ name, status: 'failed', error });
      process.stdout.write(`[FAIL] ${name}\n${error.stack ?? error.message}\n`);
      throw error;
    }
  }

  addManualCheck(flow: string, text: string): void {
    this.manualChecks.push({ flow, text });
  }

  printSummary(): void {
    const failed = this.results.filter((result) => result.status === 'failed');
    const passed = this.results.filter((result) => result.status === 'passed');

    process.stdout.write('\n================ Test Summary ================\n');
    process.stdout.write(`Passed: ${passed.length}\n`);
    process.stdout.write(`Failed: ${failed.length}\n`);

    if (failed.length > 0) {
      process.stdout.write('\nFailures:\n');
      for (const result of failed) {
        const kind = result.error instanceof TestFailure ? 'assertion' : 'error';
        process.stdout.write(`- ${result.name} (${kind}): ${result.error?.message ?? 'unknown error'}\n`);
      }
    }

    if (this.manualChecks.length > 0) {
      process.stdout.write('\n================ Manual Email Checks ================\n');
      for (const check of this.manualChecks) {
        process.stdout.write(`- [${check.flow}] ${check.text}\n`);
      }
    }
  }
}
