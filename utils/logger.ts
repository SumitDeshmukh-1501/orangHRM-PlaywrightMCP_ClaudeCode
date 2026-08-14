import fs from 'fs';
import path from 'path';

/**
 * Structured (JSON-lines) logger. One log file per run, appended to by every
 * test via the `log` fixture in `fixtures/logger.fixture.ts`.
 *
 * Note: Playwright runs each worker in its own process, so the run id is
 * taken from PW_RUN_ID when present and falls back to a per-process
 * timestamp. Exporting PW_RUN_ID from a globalSetup would collapse a
 * multi-worker run into a single file; without it, expect one file per worker.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  test: string;
  message: string;
  data?: unknown;
}

const LOG_DIR = path.resolve(process.cwd(), 'test-artifacts', 'logs');

function resolveRunId(): string {
  if (process.env.PW_RUN_ID) return process.env.PW_RUN_ID;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const worker = process.env.TEST_WORKER_INDEX;
  return worker === undefined ? stamp : `${stamp}-w${worker}`;
}

export class RunLogger {
  private readonly records: LogRecord[] = [];
  private readonly filePath: string;

  constructor(runId: string = resolveRunId()) {
    this.filePath = path.join(LOG_DIR, `run-${runId}.log`);
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }

  /** Logs a meaningful action in a test's timeline. */
  step(test: string, message: string, data?: unknown): void {
    this.write({ timestamp: new Date().toISOString(), level: 'info', test, message, data });
  }

  warn(test: string, message: string, data?: unknown): void {
    this.write({ timestamp: new Date().toISOString(), level: 'warn', test, message, data });
  }

  error(test: string, message: string, data?: unknown): void {
    this.write({ timestamp: new Date().toISOString(), level: 'error', test, message, data });
  }

  /** The JSON-lines emitted so far for one test — attached to the HTML report on failure. */
  linesFor(test: string): string {
    return this.records
      .filter((record) => record.test === test)
      .map((record) => JSON.stringify(record))
      .join('\n');
  }

  get logFilePath(): string {
    return this.filePath;
  }

  private write(record: LogRecord): void {
    this.records.push(record);
    fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
  }
}

/** Shared per-process logger instance. */
export const runLogger = new RunLogger();
