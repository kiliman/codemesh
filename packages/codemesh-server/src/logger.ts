import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Simple file logger for stdio MCP servers
 * Writes to a log file instead of stdout to avoid interfering with JSON-RPC
 */
class FileLogger {
  private logPath: string;
  private enabled: boolean;

  constructor(logPath?: string) {
    // Only enable logging if logPath is explicitly provided
    this.logPath = logPath || '';
    this.enabled = !!logPath;

    // Ensure log directory exists only if logging is enabled
    if (this.enabled) {
      try {
        const logDir = path.dirname(this.logPath);
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
      } catch (error) {
        // Silently fail if we can't create log directory
        this.enabled = false;
      }
    }
  }

  private write(level: string, ...args: unknown[]): void {
    if (!this.enabled) return;

    try {
      const timestamp = new Date().toISOString();
      const message = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
        .join(' ');
      const logLine = `[${timestamp}] [${level}] ${message}\n`;

      fs.appendFileSync(this.logPath, logLine, { encoding: 'utf-8' });
    } catch (error) {
      // Silently fail - we can't log if logging fails!
    }
  }

  log(...args: unknown[]): void {
    this.write('INFO', ...args);
  }

  error(...args: unknown[]): void {
    this.write('ERROR', ...args);
  }

  warn(...args: unknown[]): void {
    this.write('WARN', ...args);
  }

  info(...args: unknown[]): void {
    this.write('INFO', ...args);
  }

  debug(...args: unknown[]): void {
    this.write('DEBUG', ...args);
  }
}

// Singleton logger instance
export const logger = new FileLogger();