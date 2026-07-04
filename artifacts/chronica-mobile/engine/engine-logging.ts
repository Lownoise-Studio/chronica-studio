/** Structured engine logging — optional sink, no console spam by default. */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warning: 40,
  error: 50,
  fatal: 60,
};

export interface EngineLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface EngineLogSink {
  write(entry: EngineLogEntry): void;
}

let activeSink: EngineLogSink | null = null;
let minLevel: LogLevel = 'warning';

export function configureEngineLogging(options: {
  sink?: EngineLogSink | null;
  minLevel?: LogLevel;
} = {}): void {
  if ('sink' in options) {
    activeSink = options.sink ?? null;
  }
  if (options.minLevel) {
    minLevel = options.minLevel;
  }
}

export function getEngineLogMinLevel(): LogLevel {
  return minLevel;
}

export function engineLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  if (!activeSink) return;

  activeSink.write({
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

/** In-memory sink for tests and local debugging. */
export function createMemoryLogSink(): EngineLogSink & { entries: EngineLogEntry[]; clear(): void } {
  const entries: EngineLogEntry[] = [];
  return {
    entries,
    clear() {
      entries.length = 0;
    },
    write(entry) {
      entries.push(entry);
    },
  };
}
