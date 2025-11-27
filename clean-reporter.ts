/*
    Steam Library Scraper
    Copyright (C) 2025 Allard van der Willik - YourPlantDad

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

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