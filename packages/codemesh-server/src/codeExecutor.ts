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
    // ONLY look for explicit EXPLORING comments
    // This is consistent and doesn't have false positives
    return code.includes('// EXPLORING') || code.includes('//EXPLORING');
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

    // NUCLEAR OPTION: If exploring, return as ERROR to force augmentation creation
    if (isExploring && executionResult.success) {
      const sections = [
        `❌ EXPLORATION MODE - AUGMENTATION REQUIRED`,
        ``,
        `You used // EXPLORING or similar exploration patterns in your code.`,
        `This triggers MANDATORY augmentation workflow.`,
        ``,
        `<exploration_output>`,
      ];

      // Show the output they wanted to see
      if (executionResult.logs && executionResult.logs.length > 0) {
        sections.push(`📝 Console Output:`, ...executionResult.logs.map((log) => `  ${log}`));
      }

      if (executionResult.result !== undefined) {
        sections.push(
          ``,
          `📤 Execution Result:`,
          `\`\`\`json`,
          JSON.stringify(executionResult.result, null, 2),
          `\`\`\``,
        );
      }

      sections.push(`</exploration_output>`);

      // Now the mandatory instructions
      sections.push(
        ``,
        ``,
        `<mandatory_next_steps>`,
        `🚫 STOP! DO NOT WRITE PARSING CODE YET!`,
        ``,
        `❌ ERROR: You are in EXPLORATION mode. You MUST create an augmentation FIRST.`,
        ``,
        `🚨 DO NOT:`,
        `   ❌ Try to fix the parsing code`,
        `   ❌ Adjust regex patterns`,
        `   ❌ Trial-and-error different approaches`,
        `   ❌ Call execute-code again without // EXPLORING`,
        ``,
        `✅ DO THIS INSTEAD (MANDATORY):`,
        ``,
        `1. Analyze the output above - what's the structure?`,
        `   (JSON? Key-value text? Nested objects? Arrays?)`,
        ``,
        `2. Create augmentation markdown with these sections:`,
        `   # serverName.methodName`,
        `   ## Output Format`,
        `   [Describe structure]`,
        `   ### Fields`,
        `   - field: type (description)`,
        `   ### Example Output`,
        `   [Paste actual output from above]`,
        `   ### Parsing Example`,
        `   \`\`\`typescript`,
        `   [Working TypeScript parsing code]`,
        `   \`\`\``,
        ``,
        `3. Call add-augmentation tool with:`,
        `   - toolName: "serverName.methodName"`,
        `   - markdown: [your documentation]`,
        ``,
        `4. Call get-tool-apis again to verify enhanced JSDoc`,
        ``,
        `5. THEN call execute-code again WITHOUT // EXPLORING comment`,
        ``,
        `This is NOT optional. Document first, parse second!`,
        `</mandatory_next_steps>`,
      );

      return sections.join('\n');
    }

    // Normal execution (no exploration)
    const sections = [
      `🚀 CodeMode Execution Complete`,
      ``,
      `Status: ${executionResult.success ? '✅ Success' : '❌ Failed'}`,
    ];

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
