import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpServerConfig } from './config.js';
import type { DiscoveredTool } from './toolDiscovery.js';
import { createServerObjectName, convertToolName, createSafeFunctionName } from './utils.js';
import { logger } from './logger.js';

// Re-export CallToolResult from MCP SDK as our ToolResult
export type ToolResult = CallToolResult;

export interface RuntimeTool {
  name: string;
  originalName: string;
  serverId: string;
  serverConfig: McpServerConfig;
  tool: DiscoveredTool;
}

export class RuntimeWrapper {
  private connections: Map<string, Client> = new Map();
  private transports: Map<string, StreamableHTTPClientTransport | StdioClientTransport> = new Map();
  private tools: Map<string, RuntimeTool> = new Map();
  private serverConfigs: Map<string, McpServerConfig> = new Map();

  constructor() {}

  /**
   * Register tools for runtime execution
   */
  async registerTools(tools: DiscoveredTool[], serverConfigs: McpServerConfig[]): Promise<void> {
    logger.log(`🔧 Registering ${tools.length} tools for runtime execution...`);

    // Store server configurations
    for (const config of serverConfigs) {
      this.serverConfigs.set(config.id, config);
    }

    // Register each tool
    for (const tool of tools) {
      const serverConfig = this.serverConfigs.get(tool.serverId);
      if (!serverConfig) {
        logger.warn(`⚠️ Server config not found for tool ${tool.name} (server: ${tool.serverId})`);
        continue;
      }

      const functionName = createSafeFunctionName(tool.name, tool.serverId);

      this.tools.set(functionName, {
        name: functionName,
        originalName: tool.name,
        serverId: tool.serverId,
        serverConfig,
        tool,
      });

      logger.log(`✅ Registered ${tool.name} → ${functionName}()`);
    }

    logger.log(`🎯 Runtime wrapper ready with ${this.tools.size} tools`);
  }

  /**
   * Get or create a connection to an MCP server
   */
  private async getConnection(serverId: string): Promise<Client> {
    if (this.connections.has(serverId)) {
      return this.connections.get(serverId)!;
    }

    const serverConfig = this.serverConfigs.get(serverId);
    if (!serverConfig) {
      throw new Error(`Server configuration not found for ${serverId}`);
    }

    logger.log(`🔌 Connecting to ${serverConfig.name} (${serverConfig.type})...`);

    let transport: StreamableHTTPClientTransport | StdioClientTransport;

    if (serverConfig.type === 'http') {
      if (!serverConfig.url) {
        throw new Error(`HTTP server ${serverId} missing URL`);
      }
      logger.log(`📡 HTTP connection to ${serverConfig.url}`);
      transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));
    } else if (serverConfig.type === 'stdio') {
      if (!serverConfig.command || serverConfig.command.length === 0) {
        throw new Error(`Stdio server ${serverId} missing command`);
      }

      logger.log(`🖥️ Spawning process: ${serverConfig.command.join(' ')}`);
      transport = new StdioClientTransport({
        command: serverConfig.command[0],
        args: serverConfig.command.slice(1),
        cwd: serverConfig.cwd || process.cwd(),
        env: {
          ...(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)) as Record<
            string,
            string
          >),
          ...serverConfig.env,
        },
      });
    } else {
      throw new Error(`Unsupported server type: ${serverConfig.type} (server: ${serverId})`);
    }

    // Create client
    const client = new Client(
      {
        name: 'codemode-runtime-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          elicitation: {},
        },
      },
    );

    // Connect
    await client.connect(transport);

    // Store connections
    this.connections.set(serverId, client);
    this.transports.set(serverId, transport);

    logger.log(`✅ Connected to ${serverConfig.name}`);

    return client;
  }

  /**
   * Execute a tool function
   */
  async callTool(functionName: string, input: unknown): Promise<ToolResult> {
    const runtimeTool = this.tools.get(functionName);
    if (!runtimeTool) {
      throw new Error(
        `Tool function '${functionName}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
      );
    }

    logger.log(`🔧 Executing ${functionName} (${runtimeTool.originalName} on ${runtimeTool.tool.serverName})`);

    try {
      // Get connection to the appropriate server
      const client = await this.getConnection(runtimeTool.serverId);

      // Call the tool on the MCP server
      const result = await client.callTool({
        name: runtimeTool.originalName,
        arguments: (input || {}) as { [key: string]: unknown },
      });

      logger.log(`✅ ${functionName} executed successfully`);

      // Return the CallToolResult directly (it is now our ToolResult type)
      return result as CallToolResult;
    } catch (error) {
      logger.error(`❌ Error executing ${functionName}:`, error);

      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${functionName}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      } as CallToolResult;
    }
  }

  /**
   * Create a tools object with callable functions (legacy flat API)
   */
  createToolsObject(): Record<string, (input: unknown) => Promise<ToolResult>> {
    const toolsObject: Record<string, (input: unknown) => Promise<ToolResult>> = {};

    for (const [functionName] of this.tools) {
      toolsObject[functionName] = async (input: unknown) => {
        return this.callTool(functionName, input);
      };
    }

    return toolsObject;
  }

  /**
   * Create server objects with namespaced methods (new API)
   */
  createServerObjects(): Record<string, Record<string, (input: unknown) => Promise<ToolResult>>> {
    const serverObjects: Record<string, Record<string, (input: unknown) => Promise<ToolResult>>> = {};

    // Group tools by server
    const serverGroups = new Map<string, RuntimeTool[]>();
    for (const [functionName, runtimeTool] of this.tools) {
      const serverObjectName = createServerObjectName(runtimeTool.serverId);
      if (!serverGroups.has(serverObjectName)) {
        serverGroups.set(serverObjectName, []);
      }
      serverGroups.get(serverObjectName)!.push(runtimeTool);
    }

    // Create server objects with methods
    for (const [serverObjectName, serverTools] of serverGroups) {
      const serverObject: Record<string, (input: unknown) => Promise<ToolResult>> = {};

      for (const runtimeTool of serverTools) {
        const methodName = convertToolName(runtimeTool.originalName);
        const functionName = runtimeTool.name; // This is the flat function name

        serverObject[methodName] = async (input: unknown) => {
          return this.callTool(functionName, input);
        };
      }

      serverObjects[serverObjectName] = serverObject;
    }

    return serverObjects;
  }

  /**
   * Create runtime API with namespaced server objects
   */
  createRuntimeApi(): Record<string, any> {
    return this.createServerObjects();
  }


  /**
   * Get registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool metadata for a specific function
   */
  getToolMetadata(functionName: string): RuntimeTool | undefined {
    return this.tools.get(functionName);
  }

  /**
   * Close all connections
   */
  async cleanup(): Promise<void> {
    logger.log(`🧹 Cleaning up runtime wrapper...`);

    // Close all transports
    for (const [serverId, transport] of this.transports) {
      try {
        await transport.close();
        logger.log(`🔌 Disconnected from ${serverId}`);
      } catch (error) {
        logger.error(`❌ Error disconnecting from ${serverId}:`, error);
      }
    }

    // Clear all maps
    this.connections.clear();
    this.transports.clear();
    this.tools.clear();
    this.serverConfigs.clear();

    logger.log(`✅ Runtime wrapper cleanup complete`);
  }

  /**
   * Get summary of registered tools
   */
  getSummary(): string {
    const lines = [
      `🔧 Runtime Wrapper Summary`,
      `📊 ${this.tools.size} tools registered`,
      `🌐 ${this.serverConfigs.size} server configurations`,
      `🔌 ${this.connections.size} active connections`,
      '',
      'Registered Tools:',
    ];

    for (const [functionName, runtimeTool] of this.tools) {
      lines.push(`  🔧 ${functionName}() → ${runtimeTool.originalName} on ${runtimeTool.tool.serverName}`);
    }

    return lines.join('\n');
  }
}
