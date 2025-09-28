import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { McpServerConfig } from "./config.js";

export interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema: unknown;
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
    if (server.type !== "http" || !server.url) {
      return {
        serverId: server.id,
        serverName: server.name,
        success: false,
        tools: [],
        error: "Server is not HTTP type or URL missing"
      };
    }

    console.log(`🔍 Discovering tools from ${server.name} at ${server.url}...`);

    try {
      // Create HTTP transport for the MCP server
      const transport = new StreamableHTTPClientTransport(new URL(server.url));

      // Create MCP client
      const client = new Client(
        {
          name: "codemode-discovery-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            elicitation: {},
          },
        }
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
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Discover tools from all configured MCP servers
   */
  async discoverAllTools(servers: McpServerConfig[]): Promise<DiscoveryResult[]> {
    console.log(`🚀 Starting tool discovery for ${servers.length} server(s)...`);

    const results: DiscoveryResult[] = [];

    // For now, only support HTTP servers (stdio would require process management)
    const httpServers = servers.filter(server => server.type === "http");

    if (httpServers.length === 0) {
      console.log("⚠️ No HTTP servers found for discovery");
      return results;
    }

    // Discover tools from each HTTP server sequentially
    // TODO: Could parallelize this for better performance
    for (const server of httpServers) {
      const result = await this.discoverFromHttpServer(server);
      results.push(result);
    }

    const totalTools = results.reduce((sum, result) => sum + result.tools.length, 0);
    const successfulServers = results.filter(result => result.success).length;

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
        lines.push(`   📊 ${result.tools.length} tools discovered`);

        // List the first few tools
        const toolsToShow = result.tools.slice(0, 3);
        for (const tool of toolsToShow) {
          lines.push(`   🔧 ${tool.name}${tool.description ? ` - ${tool.description}` : ''}`);
        }

        if (result.tools.length > 3) {
          lines.push(`   ... and ${result.tools.length - 3} more tools`);
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
      ...lines
    ];

    return summary.join('\n');
  }
}