import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { ConfigLoader } from "./src/config.js";

// CodeMode MCP Server - executes TypeScript code against discovered MCP tools
const getCodeModeServer = () => {
  const server = new McpServer(
    {
      name: "codemode-server",
      version: "1.0.0",
      description: "Execute TypeScript code against MCP tools",
    },
    { capabilities: { logging: {} } }
  );

  // Register the main execute-code tool
  server.registerTool(
    "execute-code",
    {
      title: "Execute TypeScript Code",
      description: "Execute TypeScript code that can call discovered MCP tools",
      inputSchema: {
        code: z.string().describe("TypeScript code to execute"),
        discoveryEndpoint: z.string().optional().describe("MCP server endpoint to discover tools from"),
      },
    },
    async ({ code, discoveryEndpoint }): Promise<CallToolResult> => {
      try {
        // TODO: Phase 1 - Basic implementation
        // For now, just return the code that would be executed
        return {
          content: [
            {
              type: "text",
              text: `CodeMode Server received code:\n\n${code}\n\nDiscovery endpoint: ${discoveryEndpoint || 'none specified'}\n\n[Implementation pending - Phase 1 complete]`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing code: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Register a tool to discover available MCP tools from configured servers
  server.registerTool(
    "discover-tools",
    {
      title: "Discover MCP Tools",
      description: "Discover available tools from configured MCP servers and generate TypeScript definitions",
      inputSchema: {
        configPath: z.string().optional().describe("Path to MCP configuration file (defaults to ./mcp-config.json)"),
        serverId: z.string().optional().describe("Specific server ID to discover (discovers all if not specified)"),
      },
    },
    async ({ configPath = "./mcp-config.json", serverId }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance();
        const config = configLoader.loadConfig(configPath);

        const serversToDiscover = serverId
          ? config.servers.filter(s => s.id === serverId)
          : config.servers;

        if (serversToDiscover.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : "❌ No servers configured for discovery",
              },
            ],
          };
        }

        const results = [];
        for (const server of serversToDiscover) {
          results.push(`📡 Server: ${server.name} (${server.id})`);
          results.push(`   Type: ${server.type}`);
          if (server.type === "http" && server.url) {
            results.push(`   URL: ${server.url}`);
          } else if (server.type === "stdio" && server.command) {
            results.push(`   Command: ${server.command.join(" ")}`);
          }
          results.push("");
        }

        return {
          content: [
            {
              type: "text",
              text: `🔍 Discovered ${serversToDiscover.length} MCP server(s):\n\n${results.join("\n")}\n[Tool enumeration implementation pending - Phase 2]`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error discovering tools: ${error}`,
            },
          ],
        };
      }
    }
  );

  return server;
};

const CODEMODE_PORT = process.env.CODEMODE_PORT
  ? parseInt(process.env.CODEMODE_PORT, 10)
  : 3002;

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP endpoint handlers (same pattern as the example server)
const mcpHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && req.body?.method === "initialize") {
      // New session
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          console.log(`CodeMode session initialized: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(`CodeMode session closed: ${sid}`);
          delete transports[sid];
        }
      };

      const server = getCodeModeServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid session" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("CodeMode server error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
};

// Set up routes
app.post("/mcp", mcpHandler);
app.get("/mcp", mcpHandler);
app.delete("/mcp", mcpHandler);

app.listen(CODEMODE_PORT, () => {
  console.log(`🚀 CodeMode MCP Server listening on port ${CODEMODE_PORT}`);
  console.log(`📡 Connect with: http://localhost:${CODEMODE_PORT}/mcp`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down CodeMode server...");
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing session ${sessionId}:`, error);
    }
  }
  process.exit(0);
});