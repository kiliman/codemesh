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
import { RuntimeWrapper } from "./runtimeWrapper.js";
import { CodeExecutor } from "./codeExecutor.js";

// CodeMode MCP Server - executes TypeScript code against discovered MCP tools
const getCodeModeServer = () => {
  const server = new McpServer(
    {
      name: "codemode-server",
      version: "1.0.0",
      description: "CodeMode MCP Server: Execute complex TypeScript code against multiple MCP tools. Ideal for tasks requiring data analysis, filtering, or multi-tool coordination. Use discover-tools → get-tool-apis → execute-code workflow.",
    },
    { capabilities: { logging: {} } }
  );

  // Register the main execute-code tool
  server.registerTool(
    "execute-code",
    {
      title: "Execute TypeScript Code",
      description: "CODEMODE STEP 3: Execute TypeScript code that can call multiple MCP tools and process their results. Tools are available as global functions using their generated names (e.g., await get_alerts_weather_server({ state: 'NC' })). Do NOT use 'tools.' or 'mcpTools.' prefixes. This approach is ideal for complex tasks requiring data analysis, filtering, correlation, or multi-step processing that would be difficult with individual tool calls.",
      inputSchema: {
        code: z.string().describe("TypeScript code to execute"),
        toolNames: z
          .array(z.string())
          .optional()
          .describe("Array of tool names to make available (discovers all if not specified)"),
        configPath: z
          .string()
          .optional()
          .describe("Path to MCP configuration file (defaults to ./mcp-config.json)"),
        serverId: z
          .string()
          .optional()
          .describe("Specific server ID to use tools from (searches all if not specified)"),
      },
    },
    async ({
      code,
      toolNames,
      configPath = "./mcp-config.json",
      serverId
    }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance();
        const config = configLoader.loadConfig(configPath);

        const serversToUse = serverId
          ? config.servers.filter((s) => s.id === serverId)
          : config.servers;

        if (serversToUse.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : "❌ No servers configured for code execution",
              },
            ],
          };
        }

        // Discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance();
        const discoveryResults = await discoveryService.discoverAllTools(serversToUse);

        // Filter tools if specific ones were requested
        let toolsToUse: any[] = [];
        for (const result of discoveryResults) {
          if (result.success) {
            if (toolNames) {
              // Only include requested tools
              toolsToUse.push(...result.tools.filter(tool => toolNames.includes(tool.name)));
            } else {
              // Include all discovered tools
              toolsToUse.push(...result.tools);
            }
          }
        }

        if (toolsToUse.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: toolNames
                  ? `❌ None of the requested tools [${toolNames.join(', ')}] were found`
                  : "❌ No tools discovered for code execution",
              },
            ],
          };
        }

        // Create runtime wrapper and register tools
        const runtime = new RuntimeWrapper();
        await runtime.registerTools(toolsToUse, serversToUse);

        // Create the tools object that will be available in the execution context
        const tools = runtime.createToolsObject();

        // Execute the TypeScript code with access to the tools
        const codeExecutor = CodeExecutor.getInstance();
        const executionResult = await codeExecutor.executeCode(code, tools);

        // Clean up runtime connections
        await runtime.cleanup();

        // Format the execution result
        const resultText = codeExecutor.formatResult(executionResult);

        return {
          content: [
            {
              type: "text",
              text: resultText,
            },
          ],
          isError: !executionResult.success,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Error executing code: ${error}`,
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
        "CODEMODE STEP 1: Discover available tools from configured MCP servers. Use this first to see what tools are available before writing code. This is the preferred approach for complex tasks that require multiple tool calls or data processing across different MCP servers.",
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
      description: "CODEMODE OPTIONAL: Generate complete TypeScript type definitions for all discovered MCP tools. Prefer get-tool-apis for context efficiency unless you need all types.",
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
      description: "CODEMODE STEP 2: Get TypeScript type definitions for specific tools you want to use in your code. This generates the imports and function signatures you'll need. Use this after discover-tools to get only the APIs you need. The tools will be available as global functions in your execution environment (e.g., await get_alerts_weather_server({ state: 'NC' })).",
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
