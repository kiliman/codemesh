import { VM } from 'vm2';
import * as ts from 'typescript';
import type { ToolResult } from './runtimeWrapper.js';
import { logger } from './logger.js';

export interface ExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  logs?: string[];
}

export class CodeExecutor {
  private static instance: CodeExecutor;

  private constructor() {}

  public static getInstance(): CodeExecutor {
    if (!CodeExecutor.instance) {
      CodeExecutor.instance = new CodeExecutor();
    }
    return CodeExecutor.instance;
  }

  /**
   * Check if code contains exploration patterns
   */
  private isExploringOutput(code: string): boolean {
    // Look for explicit EXPLORING comments
    if (code.includes('// EXPLORING') || code.includes('//EXPLORING')) {
      return true;
    }

    // Look for common exploration comment patterns
    const explorationComments = [
      /\/\/\s*Test/i,
      /\/\/\s*Check/i,
      /\/\/\s*Parse/i,
      /\/\/\s*Display/i,
      /\/\/\s*Raw result/i,
      /\/\/\s*Get the/i,
      /\/\/\s*Inspect/i,
    ];

    if (explorationComments.some(pattern => pattern.test(code))) {
      return true;
    }

    // Look for simple console.log of tool results (variable then log pattern)
    // Pattern: await ...Server.method(...); followed by console.log
    const hasToolCall = /await\s+\w+Server\.\w+\(/i.test(code);
    const hasConsoleLog = /console\.log\(/i.test(code);

    return hasToolCall && hasConsoleLog;
  }

  /**
   * Execute TypeScript code with injected tools
   */
  async executeCode(
    code: string,
    tools: Record<string, (input: unknown) => Promise<ToolResult>>,
  ): Promise<ExecutionResult> {
    const logs: string[] = [];

    try {
      logger.log(`🚀 Executing TypeScript code...`);

      // Compile TypeScript to JavaScript
      const compiledCode = this.compileTypeScript(code);

      // Create VM with limited scope
      const vm = new VM({
        timeout: 30000, // 30 second timeout
        sandbox: {
          // Inject tools
          ...tools,
          // Add console.log capture
          console: {
            log: (...args: any[]) => {
              const message = args
                .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
                .join(' ');
              logs.push(message);
              logger.log(`📝 Code output:`, message);
            },
            error: (...args: any[]) => {
              const message = args
                .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
                .join(' ');
              logs.push(`ERROR: ${message}`);
              logger.error(`❌ Code error:`, message);
            },
          },
          // Add Promise support
          Promise,
          // Add setTimeout for delays
          setTimeout,
        },
        eval: false,
        wasm: false,
      });

      logger.log(`🔧 Available tools in sandbox:`, Object.keys(tools));

      // Execute the compiled code
      const result = await vm.run(`
        (async () => {
          ${compiledCode}
        })()
      `);

      logger.log(`✅ Code execution completed successfully`);

      return {
        success: true,
        result,
        logs,
      };
    } catch (error) {
      logger.error(`❌ Code execution failed:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        logs,
      };
    }
  }

  /**
   * Compile TypeScript code to JavaScript
   */
  private compileTypeScript(code: string): string {
    try {
      logger.log(`🔧 Compiling TypeScript code...`);

      const result = ts.transpile(code, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        lib: ['ES2020'],
        strict: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      });

      logger.log(`✅ TypeScript compilation successful`);
      return result;
    } catch (error) {
      logger.error(`❌ TypeScript compilation failed:`, error);
      throw new Error(`TypeScript compilation failed: ${error}`);
    }
  }

  /**
   * Format execution result for MCP response
   */
  formatResult(executionResult: ExecutionResult, code?: string): string {
    const isExploring = code && this.isExploringOutput(code);

    const sections = [
      `🚀 CodeMode Execution Complete`,
      ``,
      `Status: ${executionResult.success ? '✅ Success' : '❌ Failed'}`,
    ];

    // If this looks like exploration code, add augmentation reminder FIRST
    if (isExploring && executionResult.success) {
      sections.push(
        ``,
        `<augmentation_reminder>`,
        `⚠️ WAIT! You're using // EXPLORING - read this BEFORE looking at output:`,
        ``,
        `If the output below is unclear or hard to parse, DO NOT trial-and-error!`,
        ``,
        `REQUIRED NEXT STEPS:`,
        `1. Look at the raw output below and analyze its structure`,
        `2. Create augmentation markdown: Output Format, Fields, Example, Parsing Code`,
        `3. Call add-augmentation to save it`,
        `4. Call get-tool-apis again to see enhanced JSDoc`,
        `5. THEN write your parsing code with full understanding`,
        ``,
        `You MUST document unclear output before trying to parse it!`,
        `</augmentation_reminder>`,
        ``,
      );
    }

    if (executionResult.logs && executionResult.logs.length > 0) {
      sections.push(``, `📝 Console Output:`, ...executionResult.logs.map((log) => `  ${log}`));
    }

    if (executionResult.success && executionResult.result !== undefined) {
      sections.push(
        ``,
        `📤 Execution Result:`,
        `\`\`\`json`,
        JSON.stringify(executionResult.result, null, 2),
        `\`\`\``,
      );
    }

    if (!executionResult.success && executionResult.error) {
      sections.push(``, `❌ Error:`, `\`\`\``, executionResult.error, `\`\`\``);
    }

    return sections.join('\n');
  }
}
