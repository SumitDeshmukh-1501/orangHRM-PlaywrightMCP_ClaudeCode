import { test as base, expect } from '@playwright/test';
import { RunLogger, runLogger } from '../utils/logger';

/**
 * Custom test fixture: structured logging plus automatic attachment of this
 * test's log lines to the HTML report when the test fails.
 *
 * Every spec must import `test`/`expect` from this module, never from
 * `@playwright/test` directly.
 */
export const test = base.extend<{ log: RunLogger }>({
  log: async ({}, use, testInfo) => {
    runLogger.step(testInfo.title, 'test started', {
      file: testInfo.file,
      project: testInfo.project.name,
      retry: testInfo.retry,
    });

    await use(runLogger);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) {
      runLogger.error(testInfo.title, `test finished with status "${testInfo.status}"`, {
        errors: testInfo.errors.map((error) => error.message),
      });
      await testInfo.attach('run-log', {
        body: runLogger.linesFor(testInfo.title),
        contentType: 'application/x-ndjson',
      });
    } else {
      runLogger.step(testInfo.title, `test finished with status "${testInfo.status}"`, {
        durationMs: testInfo.duration,
      });
    }
  },
});

export { expect };
