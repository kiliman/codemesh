import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { ConfigLoader } from "./config.js";
import { ToolDiscoveryService } from "./toolDiscovery.js";
import { TypeGeneratorService } from "./typeGenerator.js";

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
        discoveryEndpoint: z
          .string()
          .optional()
          .describe("MCP server endpoint to discover tools from"),
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
              text: `CodeMode Server received code:\n\n${code}\n\nDiscovery endpoint: ${
                discoveryEndpoint || "none specified"
              }\n\n[Implementation pending - Phase 1 complete]`,
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
      description:
        "Discover available tools from configured MCP servers and generate TypeScript definitions",
      inputSchema: {
        configPath: z
          .string()
          .optional()
          .describe(
            "Path to MCP configuration file (defaults to ./mcp-config.json)"
          ),
        serverId: z
          .string()
          .optional()
          .describe(
            "Specific server ID to discover (discovers all if not specified)"
          ),
      },
    },
    async ({
      configPath = "./mcp-config.json",
      serverId,
    }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance();
        const config = configLoader.loadConfig(configPath);

        const serversToDiscover = serverId
          ? config.servers.filter((s) => s.id === serverId)
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

        // Use the ToolDiscoveryService to actually discover tools
        const discoveryService = ToolDiscoveryService.getInstance();
        const discoveryResults = await discoveryService.discoverAllTools(serversToDiscover);
        const summary = discoveryService.generateDiscoverySummary(discoveryResults);

        return {
          content: [
            {
              type: "text",
              text: summary,
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

  // Register a tool to generate TypeScript types from discovered tools
  server.registerTool(
    "generate-types",
    {
      title: "Generate TypeScript Types",
      description: "Generate TypeScript type definitions from discovered MCP tools",
      inputSchema: {
        configPath: z
          .string()
          .optional()
          .describe(
            "Path to MCP configuration file (defaults to ./mcp-config.json)"
          ),
        outputDir: z
          .string()
          .optional()
          .describe(
            "Directory to save generated types (defaults to ./generated)"
          ),
        serverId: z
          .string()
          .optional()
          .describe(
            "Specific server ID to generate types for (generates for all if not specified)"
          ),
      },
    },
    async ({
      configPath = "./mcp-config.json",
      outputDir = "./generated",
      serverId,
    }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance();
        const config = configLoader.loadConfig(configPath);

        const serversToProcess = serverId
          ? config.servers.filter((s) => s.id === serverId)
          : config.servers;

        if (serversToProcess.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : "❌ No servers configured for type generation",
              },
            ],
          };
        }

        // First discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance();
        const discoveryResults = await discoveryService.discoverAllTools(serversToProcess);

        // Generate TypeScript types from discovered tools
        const typeGenerator = TypeGeneratorService.getInstance();
        const generatedTypes = await typeGenerator.generateTypes(discoveryResults);

        // Save the generated types to files
        await typeGenerator.saveGeneratedTypes(generatedTypes, outputDir);

        // Create a summary of what was generated
        const summary = [
          "🎯 TypeScript Type Generation Complete",
          `📊 Generated types for ${generatedTypes.tools.length} tools`,
          `📁 Output directory: ${outputDir}`,
          "",
          "Generated files:",
          "📄 types.ts - TypeScript interfaces for tool inputs",
          "📄 tools.ts - Tool function signatures and metadata",
          "📄 metadata.json - Runtime tool metadata",
          "",
          "Generated tool functions:",
          ...generatedTypes.tools.map(tool =>
            `🔧 ${tool.toolName} → ${tool.inputTypeName}`
          ),
        ];

        return {
          content: [
            {
              type: "text",
              text: summary.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error generating types: ${error}`,
            },
          ],
        };
      }
    }
  );

  // Register a tool to get TypeScript APIs for specific tools (context-efficient)
  server.registerTool(
    "get-tool-apis",
    {
      title: "Get Tool APIs",
      description: "Get TypeScript type definitions for specific tools (context-efficient)",
      inputSchema: {
        toolNames: z
          .array(z.string())
          .describe("Array of tool names to get TypeScript APIs for"),
        configPath: z
          .string()
          .optional()
          .describe(
            "Path to MCP configuration file (defaults to ./mcp-config.json)"
          ),
        serverId: z
          .string()
          .optional()
          .describe(
            "Specific server ID to get tools from (searches all if not specified)"
          ),
      },
    },
    async ({
      toolNames,
      configPath = "./mcp-config.json",
      serverId,
    }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance();
        const config = configLoader.loadConfig(configPath);

        const serversToSearch = serverId
          ? config.servers.filter((s) => s.id === serverId)
          : config.servers;

        if (serversToSearch.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : "❌ No servers configured",
              },
            ],
          };
        }

        // Discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance();
        const discoveryResults = await discoveryService.discoverAllTools(serversToSearch);

        // Filter discovered tools to only the requested ones
        const requestedTools: any[] = [];
        for (const result of discoveryResults) {
          if (result.success) {
            for (const tool of result.tools) {
              if (toolNames.includes(tool.name)) {
                requestedTools.push(tool);
              }
            }
          }
        }

        if (requestedTools.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `❌ None of the requested tools [${toolNames.join(', ')}] were found in the configured servers`,
              },
            ],
          };
        }

        // Generate TypeScript types for only the requested tools
        const typeGenerator = TypeGeneratorService.getInstance();

        // Create a mock discovery result with only the requested tools
        const filteredResults = [{
          serverId: "filtered",
          serverName: "Filtered Tools",
          success: true,
          tools: requestedTools,
        }];

        const generatedTypes = await typeGenerator.generateTypes(filteredResults);

        // Return the TypeScript definitions as text
        const response = [
          `🔧 TypeScript APIs for requested tools: ${toolNames.join(', ')}`,
          `📊 Found ${requestedTools.length} of ${toolNames.length} requested tools`,
          "",
          "TypeScript Type Definitions:",
          "```typescript",
          generatedTypes.combinedTypes,
          "",
          generatedTypes.toolsNamespace,
          "```",
          "",
          "Tool Mapping:",
          ...requestedTools.map(tool =>
            `🔧 ${tool.name} → ${typeGenerator.createSafeFunctionName(tool.name, tool.serverId)}()`
          ),
        ];

        return {
          content: [
            {
              type: "text",
              text: response.join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error getting tool APIs: ${error}`,
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

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🚦 Request: ${req.method} ${req.url}`);
  console.log(`🏷️ Content-Type: ${req.headers['content-type']}`);
  next();
});

app.use(express.json());
app.use(cors({ origin: "*" }));

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP endpoint handlers (same pattern as the example server)
const mcpHandler = async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  console.log(`🔍 MCP request: ${req.method} ${req.url}`);
  console.log(`📋 Headers:`, req.headers);
  console.log(`📦 Body:`, req.body);
  console.log(`🆔 Session ID:`, sessionId);

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
  console.log(`🚀 CodeMode MCP Server listening on port ${CODEMODE_PORT} [DEBUG ENABLED]`);
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
