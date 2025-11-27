import { Reporter } from '@playwright/test/reporter';

/**
 * A custom reporter that silences the default "Running 1 test" and "1 passed" messages.
 * It only lets through the console.log output from your script.
 */
class CleanReporter implements Reporter {
  // This hook catches all console.log() output from the test and prints it to the terminal
  onStdOut(chunk: string | Buffer) {
    process.stdout.write(chunk);
  }

  // We intentionally leave out onBegin, onTestEnd, and onEnd to suppress status messages
}

export default CleanReporter;