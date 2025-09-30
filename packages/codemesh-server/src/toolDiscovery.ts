import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpServerConfig } from './config.js';

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  serverId: string;
  serverName: string;
}

export interface DiscoveryResult {
  serverId: string;
  serverName: string;
  success: boolean;
  tools: DiscoveredTool[];
  error?: string;
}

export class ToolDiscoveryService {
  private static instance: ToolDiscoveryService;

  private constructor() {}

  public static getInstance(): ToolDiscoveryService {
    if (!ToolDiscoveryService.instance) {
      ToolDiscoveryService.instance = new ToolDiscoveryService();
    }
    return ToolDiscoveryService.instance;
  }

  /**
   * Discover tools from HTTP-based MCP servers
   */
  async discoverFromHttpServer(server: McpServerConfig): Promise<DiscoveryResult> {
    if (server.type !== 'http' || !server.url) {
      return {
        serverId: server.id,
        serverName: server.name,
        success: false,
        tools: [],
        error: 'Server is not HTTP type or URL missing',
      };
    }

    console.log(`🔍 Discovering tools from ${server.name} at ${server.url}...`);

    try {
      // Create HTTP transport for the MCP server
      const transport = new StreamableHTTPClientTransport(new URL(server.url));

      // Create MCP client
      const client = new Client(
        {
          name: 'codemesh-discovery-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            elicitation: {},
          },
        },
      );

      // Connect to the server
      await client.connect(transport);
      console.log(`✅ Connected to ${server.name}`);

      // List available tools
      const toolsResponse = await client.listTools();
      console.log(`📋 Found ${toolsResponse.tools.length} tool(s) in ${server.name}`);

      // Transform the tools to our format
      const discoveredTools: DiscoveredTool[] = toolsResponse.tools.map((tool: Tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        serverId: server.id,
        serverName: server.name,
      }));

      // Close the connection
      await transport.close();
      console.log(`🔌 Disconnected from ${server.name}`);

      return {
        serverId: server.id,
        serverName: server.name,
        success: true,
        tools: discoveredTools,
      };
    } catch (error) {
      console.error(`❌ Failed to discover tools from ${server.name}:`, error);
      return {
        serverId: server.id,
        serverName: server.name,
        success: false,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Discover tools from stdio-based MCP servers
   */
  async discoverFromStdioServer(server: McpServerConfig): Promise<DiscoveryResult> {
    if (server.type !== 'stdio' || !server.command || server.command.length === 0) {
      return {
        serverId: server.id,
        serverName: server.name,
        success: false,
        tools: [],
        error: 'Server is not stdio type or command missing',
      };
    }

    console.log(`🔍 Discovering tools from ${server.name} via stdio...`);

    try {
      // Create stdio transport and let SDK handle the process spawning
      const transport = new StdioClientTransport({
        command: server.command[0],
        args: server.command.slice(1),
        cwd: server.cwd || process.cwd(),
        env: {
          ...(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined)) as Record<
            string,
            string
          >),
          ...server.env,
        },
      });

      // Create MCP client
      const client = new Client(
        {
          name: 'codemesh-discovery-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            elicitation: {},
          },
        },
      );

      // Connect to the server
      await client.connect(transport);
      console.log(`✅ Connected to ${server.name}`);

      // List available tools
      const toolsResponse = await client.listTools({});
      const tools: Tool[] = toolsResponse.tools || [];

      console.log(`📋 Found ${tools.length} tool(s) in ${server.name}`);

      // Convert tools to our format
      const discoveredTools: DiscoveredTool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        serverId: server.id,
        serverName: server.name,
      }));

      // Disconnect from the server
      await transport.close();
      console.log(`🔌 Disconnected from ${server.name}`);

      return {
        serverId: server.id,
        serverName: server.name,
        success: true,
        tools: discoveredTools,
      };
    } catch (error) {
      console.error(`❌ Failed to discover tools from ${server.name}:`, error);
      return {
        serverId: server.id,
        serverName: server.name,
        success: false,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Discover tools from all configured MCP servers
   */
  async discoverAllTools(servers: McpServerConfig[]): Promise<DiscoveryResult[]> {
    console.log(`🚀 Starting tool discovery for ${servers.length} server(s)...`);

    const results: DiscoveryResult[] = [];

    // Separate servers by type
    const httpServers = servers.filter((server) => server.type === 'http');
    const stdioServers = servers.filter((server) => server.type === 'stdio');

    console.log(`📊 Found ${httpServers.length} HTTP and ${stdioServers.length} stdio servers`);

    // Discover tools from each server sequentially
    // TODO: Could parallelize this for better performance
    for (const server of httpServers) {
      const result = await this.discoverFromHttpServer(server);
      results.push(result);
    }

    for (const server of stdioServers) {
      const result = await this.discoverFromStdioServer(server);
      results.push(result);
    }

    const totalTools = results.reduce((sum, result) => sum + result.tools.length, 0);
    const successfulServers = results.filter((result) => result.success).length;

    console.log(`🎯 Discovery complete: ${totalTools} total tools from ${successfulServers}/${results.length} servers`);

    return results;
  }

  /**
   * Generate a summary of discovered tools for display
   */
  generateDiscoverySummary(results: DiscoveryResult[]): string {
    const lines: string[] = [];

    let totalTools = 0;
    let successfulConnections = 0;

    for (const result of results) {
      if (result.success) {
        successfulConnections++;
        totalTools += result.tools.length;

        lines.push(`✅ ${result.serverName} (${result.serverId})`);
        lines.push(`   📊 ${result.tools.length} tools available`);
        lines.push('');

        // List ALL tools with their descriptions
        for (const tool of result.tools) {
          const description = tool.description || 'No description available';
          lines.push(`   🔧 ${tool.name}`);
          lines.push(`      ${description}`);
        }
      } else {
        lines.push(`❌ ${result.serverName} (${result.serverId})`);
        lines.push(`   Error: ${result.error}`);
      }
      lines.push('');
    }

    const summary = [
      `🔍 Tool Discovery Summary`,
      `📊 Total: ${totalTools} tools from ${successfulConnections}/${results.length} servers`,
      '',
      ...lines,
    ];

    return summary.join('\n');
  }
}
