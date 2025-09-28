import { VM } from 'vm2';
import * as ts from 'typescript';
import type { ToolResult } from './runtimeWrapper.js';

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
   * Execute TypeScript code with injected tools
   */
  async executeCode(
    code: string,
    tools: Record<string, (input: unknown) => Promise<ToolResult>>
  ): Promise<ExecutionResult> {
    const logs: string[] = [];

    try {
      console.log(`🚀 Executing TypeScript code...`);

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
              const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              logs.push(message);
              console.log(`📝 Code output:`, message);
            },
            error: (...args: any[]) => {
              const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
              ).join(' ');
              logs.push(`ERROR: ${message}`);
              console.error(`❌ Code error:`, message);
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

      console.log(`🔧 Available tools in sandbox:`, Object.keys(tools));

      // Execute the compiled code
      const result = await vm.run(`
        (async () => {
          ${compiledCode}
        })()
      `);

      console.log(`✅ Code execution completed successfully`);

      return {
        success: true,
        result,
        logs,
      };

    } catch (error) {
      console.error(`❌ Code execution failed:`, error);

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
      console.log(`🔧 Compiling TypeScript code...`);

      const result = ts.transpile(code, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        lib: ['ES2020'],
        strict: false,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
      });

      console.log(`✅ TypeScript compilation successful`);
      return result;

    } catch (error) {
      console.error(`❌ TypeScript compilation failed:`, error);
      throw new Error(`TypeScript compilation failed: ${error}`);
    }
  }

  /**
   * Format execution result for MCP response
   */
  formatResult(executionResult: ExecutionResult): string {
    const sections = [
      `🚀 CodeMode Execution Complete`,
      ``,
      `Status: ${executionResult.success ? '✅ Success' : '❌ Failed'}`,
    ];

    if (executionResult.logs && executionResult.logs.length > 0) {
      sections.push(
        ``,
        `📝 Console Output:`,
        ...executionResult.logs.map(log => `  ${log}`)
      );
    }

    if (executionResult.success && executionResult.result !== undefined) {
      sections.push(
        ``,
        `📤 Execution Result:`,
        `\`\`\`json`,
        JSON.stringify(executionResult.result, null, 2),
        `\`\`\``
      );
    }

    if (!executionResult.success && executionResult.error) {
      sections.push(
        ``,
        `❌ Error:`,
        `\`\`\``,
        executionResult.error,
        `\`\`\``
      );
    }

    return sections.join('\n');
  }
}