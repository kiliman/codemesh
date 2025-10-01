import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { LoggingConfig } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ToolCallLog {
  tool: string;
  args?: any;
  code?: string;
  duration: number;
  status: 'success' | 'error';
  response?: any;
  error?: string;
  consoleOutput?: string;
  isExploring?: boolean;
}

export class FileLogger {
  private static instance: FileLogger | null = null;
  private config: LoggingConfig | null = null;
  private currentLogFile: string | null = null;
  private sessionStartTime: Date | null = null;

  private constructor() {}

  public static getInstance(): FileLogger {
    if (!FileLogger.instance) {
      FileLogger.instance = new FileLogger();
    }
    return FileLogger.instance;
  }

  public configure(config: LoggingConfig | undefined) {
    this.config = config || null;
    if (this.config?.enabled) {
      this.initSession();
    }
  }

  public isEnabled(): boolean {
    return this.config?.enabled === true;
  }

  private initSession() {
    if (!this.config?.enabled) return;

    const now = new Date();
    this.sessionStartTime = now;
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const logDir = this.config.logDir || '.codemesh/logs';

    // Create log directory if it doesn't exist
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    this.currentLogFile = join(logDir, `${dateStr}.md`);

    // Write session header if this is a new file
    if (!existsSync(this.currentLogFile)) {
      this.writeToFile(`# CodeMesh Session Log\n`);
      this.writeToFile(`**Date:** ${dateStr}\n\n`);
      this.writeToFile(`---\n\n`);
    } else {
      // Add separator for new session in existing file
      this.writeToFile(`\n---\n\n`);
      this.writeToFile(`## New Session - ${now.toTimeString().split(' ')[0]}\n\n`);
    }
  }

  private writeToFile(content: string) {
    if (!this.currentLogFile) return;
    try {
      appendFileSync(this.currentLogFile, content, 'utf-8');
    } catch (error) {
      // Silently fail to avoid disrupting tool execution
      console.error('Failed to write to log file:', error);
    }
  }

  private formatTimestamp(): string {
    return new Date().toTimeString().split(' ')[0]; // HH:MM:SS
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private getStatusEmoji(status: 'success' | 'error'): string {
    return status === 'success' ? '✅' : '❌';
  }

  public logToolCall(log: ToolCallLog) {
    if (!this.config?.enabled) return;

    const timestamp = this.formatTimestamp();
    const duration = this.formatDuration(log.duration);
    const statusEmoji = this.getStatusEmoji(log.status);
    const exploringTag = log.isExploring ? ' (EXPLORING)' : '';

    let content = `## ${timestamp} - ${log.tool}${exploringTag}\n`;
    content += `**Duration:** ${duration}  \n`;
    content += `**Status:** ${statusEmoji} ${log.status === 'success' ? 'Success' : 'Error'}\n\n`;

    // Log arguments if present
    if (log.args && Object.keys(log.args).length > 0) {
      content += `### Request\n`;
      if (log.tool === 'execute-code' && log.code) {
        content += `\`\`\`typescript\n${log.code}\n\`\`\`\n\n`;
      } else {
        content += `\`\`\`json\n${JSON.stringify(log.args, null, 2)}\n\`\`\`\n\n`;
      }
    } else {
      content += `### Request\nNo arguments\n\n`;
    }

    // Log console output if present
    if (log.consoleOutput) {
      content += `### Console Output\n`;
      content += `\`\`\`\n${log.consoleOutput}\n\`\`\`\n\n`;
    }

    // Log response
    content += `### Response\n`;
    if (log.status === 'error' && log.error) {
      content += `\`\`\`\n${log.error}\n\`\`\`\n\n`;
    } else if (log.response) {
      // Try to format response nicely
      if (typeof log.response === 'string') {
        // Check if it looks like code or JSON
        if (log.response.trim().startsWith('{') || log.response.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(log.response);
            content += `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n\n`;
          } catch {
            content += `\`\`\`\n${log.response}\n\`\`\`\n\n`;
          }
        } else {
          content += `\`\`\`\n${log.response}\n\`\`\`\n\n`;
        }
      } else {
        content += `\`\`\`json\n${JSON.stringify(log.response, null, 2)}\n\`\`\`\n\n`;
      }
    }

    content += `---\n\n`;

    this.writeToFile(content);
  }

  public logMessage(level: LogLevel, message: string) {
    if (!this.config?.enabled) return;

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const configLevel = this.config.level || 'info';

    // Check if message should be logged based on level
    if (levels.indexOf(level) < levels.indexOf(configLevel)) {
      return;
    }

    const timestamp = this.formatTimestamp();
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[level];

    const content = `${timestamp} ${emoji} **${level.toUpperCase()}**: ${message}\n\n`;
    this.writeToFile(content);
  }
}
