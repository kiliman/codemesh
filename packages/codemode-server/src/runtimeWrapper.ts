import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerConfig } from "./config.js";
import type { DiscoveredTool } from "./toolDiscovery.js";

export interface ToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    url?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: {
    progressToken?: string;
  };
}

export interface RuntimeTool {
  name: string;
  originalName: string;
  serverId: string;
  serverConfig: McpServerConfig;
  tool: DiscoveredTool;
}

export class RuntimeWrapper {
  private connections: Map<string, Client> = new Map();
  private transports: Map<string, StreamableHTTPClientTransport> = new Map();
  private tools: Map<string, RuntimeTool> = new Map();
  private serverConfigs: Map<string, McpServerConfig> = new Map();

  constructor() {}

  /**
   * Register tools for runtime execution
   */
  async registerTools(tools: DiscoveredTool[], serverConfigs: McpServerConfig[]): Promise<void> {
    console.log(`🔧 Registering ${tools.length} tools for runtime execution...`);

    // Store server configurations
    for (const config of serverConfigs) {
      this.serverConfigs.set(config.id, config);
    }

    // Register each tool
    for (const tool of tools) {
      const serverConfig = this.serverConfigs.get(tool.serverId);
      if (!serverConfig) {
        console.warn(`⚠️ Server config not found for tool ${tool.name} (server: ${tool.serverId})`);
        continue;
      }

      const functionName = this.createSafeFunctionName(tool.name, tool.serverId);

      this.tools.set(functionName, {
        name: functionName,
        originalName: tool.name,
        serverId: tool.serverId,
        serverConfig,
        tool,
      });

      console.log(`✅ Registered ${tool.name} → ${functionName}()`);
    }

    console.log(`🎯 Runtime wrapper ready with ${this.tools.size} tools`);
  }

  /**
   * Create a safe function name from tool name and server ID
   */
  private createSafeFunctionName(toolName: string, serverId: string): string {
    const safeName = toolName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeServerId = serverId.replace(/[^a-zA-Z0-9]/g, '_');
    return `${safeName}_${safeServerId}`;
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

    if (serverConfig.type !== "http" || !serverConfig.url) {
      throw new Error(`Only HTTP servers are currently supported (server: ${serverId})`);
    }

    console.log(`🔌 Connecting to ${serverConfig.name} at ${serverConfig.url}...`);

    // Create transport
    const transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));

    // Create client
    const client = new Client(
      {
        name: "codemode-runtime-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          elicitation: {},
        },
      }
    );

    // Connect
    await client.connect(transport);

    // Store connections
    this.connections.set(serverId, client);
    this.transports.set(serverId, transport);

    console.log(`✅ Connected to ${serverConfig.name}`);

    return client;
  }

  /**
   * Execute a tool function
   */
  async callTool(functionName: string, input: unknown): Promise<ToolResult> {
    const runtimeTool = this.tools.get(functionName);
    if (!runtimeTool) {
      throw new Error(`Tool function '${functionName}' not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    console.log(`🔧 Executing ${functionName} (${runtimeTool.originalName} on ${runtimeTool.tool.serverName})`);

    try {
      // Get connection to the appropriate server
      const client = await this.getConnection(runtimeTool.serverId);

      // Call the tool on the MCP server
      const result: CallToolResult = await client.callTool({
        name: runtimeTool.originalName,
        arguments: input || {},
      });

      console.log(`✅ ${functionName} executed successfully`);

      // Convert MCP result to our ToolResult format
      return {
        content: result.content || [],
        isError: result.isError,
        _meta: result._meta,
      };

    } catch (error) {
      console.error(`❌ Error executing ${functionName}:`, error);

      return {
        content: [
          {
            type: "text",
            text: `Error executing ${functionName}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Create a tools object with callable functions
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
    console.log(`🧹 Cleaning up runtime wrapper...`);

    // Close all transports
    for (const [serverId, transport] of this.transports) {
      try {
        await transport.close();
        console.log(`🔌 Disconnected from ${serverId}`);
      } catch (error) {
        console.error(`❌ Error disconnecting from ${serverId}:`, error);
      }
    }

    // Clear all maps
    this.connections.clear();
    this.transports.clear();
    this.tools.clear();
    this.serverConfigs.clear();

    console.log(`✅ Runtime wrapper cleanup complete`);
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
      "",
      "Registered Tools:",
    ];

    for (const [functionName, runtimeTool] of this.tools) {
      lines.push(`  🔧 ${functionName}() → ${runtimeTool.originalName} on ${runtimeTool.tool.serverName}`);
    }

    return lines.join('\n');
  }
}