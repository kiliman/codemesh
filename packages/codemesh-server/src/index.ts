#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import * as fs from 'node:fs'
import { ConfigLoader } from './config.js'
import { ToolDiscoveryService } from './toolDiscovery.js'
import { TypeGeneratorService } from './typeGenerator.js'
import { RuntimeWrapper } from './runtimeWrapper.js'
import { CodeExecutor } from './codeExecutor.js'
import { createServerObjectName, convertToolName } from './utils.js'
import { FileLogger } from './fileLogger.js'

// CodeMesh MCP Server - executes TypeScript code against discovered MCP tools
const getCodeMeshServer = () => {
  const server = new McpServer(
    {
      name: 'codemesh-server',
      version: '1.0.0',
      description:
        'CodeMesh MCP Server: Execute complex TypeScript code against multiple MCP tools. Weave together multiple servers into powerful workflows. Ideal for tasks requiring data analysis, filtering, or multi-tool coordination. Use discover-tools → get-tool-apis → execute-code workflow.',
    },
    { capabilities: { logging: {} } },
  )

  // Register the main execute-code tool
  server.registerTool(
    'execute-code',
    {
      title: 'Execute TypeScript Code',
      description:
        "CODEMESH STEP 3: Execute TypeScript code that can call multiple MCP tools and process their results.\n\n<critical>\nTools are available as server objects with methods. Use serverName.methodName() format (e.g., await weatherServer.getForecast({ latitude: 36.5, longitude: -76.2 })). Do NOT use direct function calls or 'tools.' prefixes.\n</critical>\n\n<augmentation_instruction>\nIMPORTANT: When exploring tool output, add a comment explaining what you're checking:\n// EXPLORING: checking output format of filesystemServer.getFileInfo\nconst result = await filesystemServer.getFileInfo({path: 'test.txt'});\nconsole.log(result);\n\nThis triggers augmentation guidance in the response.\n</augmentation_instruction>\n\n<augmentation_workflow>\nIf tool output is unclear/hard to parse, DO NOT trial-and-error different parsing approaches!\n\nREQUIRED WORKFLOW:\n1. Inspect raw output with console.log (include // EXPLORING comment)\n2. When you see unclear output, STOP and create augmentation markdown:\n\n# serverName.methodName\n## Output Format\n[Structure description]\n### Fields\n- field: type (description)\n### Example Output\n```\n[actual output]\n```\n### Parsing Example\n```typescript\n[working parse code]\n```\n\n3. Call add-augmentation with toolName and markdown\n4. Call get-tool-apis again to see enhanced JSDoc\n5. NOW write your parsing code with better understanding\n\nThis is MANDATORY when struggling with output parsing!\n</augmentation_workflow>",
      inputSchema: {
        code: z.string().describe('TypeScript code to execute'),
        toolNames: z
          .array(z.string())
          .optional()
          .describe('Array of tool names to make available (discovers all if not specified)'),
        serverId: z
          .string()
          .optional()
          .describe('Specific server ID to use tools from (searches all if not specified)'),
      },
    },
    async ({ code, toolNames, serverId }): Promise<CallToolResult> => {
      const startTime = Date.now()
      const fileLogger = FileLogger.getInstance()

      try {
        const configLoader = ConfigLoader.getInstance()
        const config = configLoader.loadConfigAuto()

        // Configure file logger if not already done
        if (!fileLogger.isEnabled() && config.logging) {
          fileLogger.configure(config.logging)
        }

        const serversToUse = serverId ? config.servers.filter((s) => s.id === serverId) : config.servers

        if (serversToUse.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : '❌ No servers configured for code execution',
              },
            ],
          }
        }

        // Discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance()
        const discoveryResults = await discoveryService.discoverAllTools(serversToUse)

        // Filter tools if specific ones were requested
        let toolsToUse: any[] = []
        for (const result of discoveryResults) {
          if (result.success) {
            if (toolNames) {
              // Only include requested tools
              toolsToUse.push(...result.tools.filter((tool) => toolNames.includes(tool.name)))
            } else {
              // Include all discovered tools
              toolsToUse.push(...result.tools)
            }
          }
        }

        if (toolsToUse.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: toolNames
                  ? `❌ None of the requested tools [${toolNames.join(', ')}] were found`
                  : '❌ No tools discovered for code execution',
              },
            ],
          }
        }

        // Create runtime wrapper and register tools
        const runtime = new RuntimeWrapper()
        await runtime.registerTools(toolsToUse, serversToUse)

        // Create the runtime API with both legacy functions and server objects
        const tools = runtime.createRuntimeApi()

        // Execute the TypeScript code with access to the tools
        const codeExecutor = CodeExecutor.getInstance()
        const executionResult = await codeExecutor.executeCode(code, tools)

        // Clean up runtime connections
        await runtime.cleanup()

        // Format the execution result (pass code for exploration detection)
        const resultText = codeExecutor.formatResult(executionResult, code)

        // Log the tool call
        const duration = Date.now() - startTime
        const isExploring = code.includes('// EXPLORING')
        fileLogger.logToolCall({
          tool: 'execute-code',
          args: { toolNames, serverId },
          code,
          duration,
          status: executionResult.success ? 'success' : 'error',
          response: executionResult.success ? executionResult.result : undefined,
          error: executionResult.success ? undefined : executionResult.error,
          consoleOutput: executionResult.logs?.join('\n') || undefined,
          isExploring,
        })

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
          isError: !executionResult.success,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = `❌ Error executing code: ${error}`

        fileLogger.logToolCall({
          tool: 'execute-code',
          args: { code, toolNames, serverId },
          code,
          duration,
          status: 'error',
          error: errorMessage,
        })

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
        }
      }
    },
  )

  // Register a tool to discover available MCP tools from configured servers
  server.registerTool(
    'discover-tools',
    {
      title: 'Discover MCP Tools',
      description:
        'CODEMESH STEP 1: Discover available tools from configured MCP servers. Use this first to see what tools are available before writing code. This is the preferred approach for complex tasks that require multiple tool calls or data processing across different MCP servers.',
      inputSchema: {
        serverId: z.string().optional().describe('Specific server ID to discover (discovers all if not specified)'),
      },
    },
    async ({ serverId }): Promise<CallToolResult> => {
      const startTime = Date.now()
      const fileLogger = FileLogger.getInstance()

      try {
        const configLoader = ConfigLoader.getInstance()
        const config = configLoader.loadConfigAuto()

        // Configure file logger if not already done
        if (!fileLogger.isEnabled() && config.logging) {
          fileLogger.configure(config.logging)
        }

        const serversToDiscover = serverId ? config.servers.filter((s) => s.id === serverId) : config.servers

        if (serversToDiscover.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : '❌ No servers configured for discovery',
              },
            ],
          }
        }

        // Use the ToolDiscoveryService to actually discover tools
        const discoveryService = ToolDiscoveryService.getInstance()
        const discoveryResults = await discoveryService.discoverAllTools(serversToDiscover)
        const summary = discoveryService.generateDiscoverySummary(discoveryResults)

        // Log the tool call
        const duration = Date.now() - startTime
        fileLogger.logToolCall({
          tool: 'discover-tools',
          args: serverId ? { serverId } : undefined,
          duration,
          status: 'success',
          response: summary,
        })

        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = `❌ Error discovering tools: ${error}`

        fileLogger.logToolCall({
          tool: 'discover-tools',
          args: serverId ? { serverId } : undefined,
          duration,
          status: 'error',
          error: errorMessage,
        })

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
        }
      }
    },
  )

  // Register a tool to generate TypeScript types from discovered tools
  server.registerTool(
    'generate-types',
    {
      title: 'Generate TypeScript Types',
      description:
        'CODEMESH OPTIONAL: Generate complete TypeScript type definitions for all discovered MCP tools. Prefer get-tool-apis for context efficiency unless you need all types.',
      inputSchema: {
        outputDir: z.string().optional().describe('Directory to save generated types (defaults to ./generated)'),
        serverId: z
          .string()
          .optional()
          .describe('Specific server ID to generate types for (generates for all if not specified)'),
      },
    },
    async ({ outputDir = './generated', serverId }): Promise<CallToolResult> => {
      try {
        const configLoader = ConfigLoader.getInstance()
        const config = configLoader.loadConfigAuto()

        const serversToProcess = serverId ? config.servers.filter((s) => s.id === serverId) : config.servers

        if (serversToProcess.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : '❌ No servers configured for type generation',
              },
            ],
          }
        }

        // First discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance()
        const discoveryResults = await discoveryService.discoverAllTools(serversToProcess)

        // Generate TypeScript types from discovered tools
        const typeGenerator = TypeGeneratorService.getInstance()
        const generatedTypes = await typeGenerator.generateTypes(discoveryResults)

        // Save the generated types to files
        await typeGenerator.saveGeneratedTypes(generatedTypes, outputDir)

        // Create a summary of what was generated
        const summary = [
          '🎯 TypeScript Type Generation Complete',
          `📊 Generated types for ${generatedTypes.tools.length} tools`,
          `📁 Output directory: ${outputDir}`,
          '',
          'Generated files:',
          '📄 types.ts - TypeScript interfaces for tool inputs',
          '📄 tools.ts - Tool function signatures and metadata',
          '📄 metadata.json - Runtime tool metadata',
          '',
          'Generated tool functions:',
          ...generatedTypes.tools.map((tool) => `🔧 ${tool.toolName} → ${tool.inputTypeName}`),
        ]

        return {
          content: [
            {
              type: 'text',
              text: summary.join('\n'),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error generating types: ${error}`,
            },
          ],
        }
      }
    },
  )

  // Register a tool to add/update augmentation documentation
  server.registerTool(
    'add-augmentation',
    {
      title: 'Add Tool Augmentation',
      description:
        'Save or update augmentation documentation for an MCP tool. Augmentations provide detailed output format descriptions, parsing examples, and field documentation that enhance the TypeScript APIs generated by get-tool-apis. The markdown will be saved to .codemesh/{serverId}.md and future get-tool-apis calls will include this documentation in the JSDoc.',
      inputSchema: {
        toolName: z
          .string()
          .describe(
            'Scoped tool name in serverName.methodName format (e.g., "filesystemServer.getFileInfo", "braveSearch.webSearch")',
          ),
        markdown: z
          .string()
          .describe(
            'Markdown content with sections: "# serverName.methodName", "## Output Format", "### Fields", "### Example Output", "### Parsing Example" (with TypeScript code block)',
          ),
        codemeshDir: z
          .string()
          .optional()
          .describe('Path to .codemesh directory (defaults to $PWD/.codemesh)'),
      },
    },
    async ({ toolName, markdown, codemeshDir }): Promise<CallToolResult> => {
      try {
        const path = await import('node:path')
        const fs = await import('node:fs/promises')

        // Determine .codemesh directory location
        const augmentationDir = codemeshDir || `${process.env.PWD || process.cwd()}/.codemesh`

        // Parse scoped tool name (e.g., "filesystemServer.getFileInfo")
        const scopedMatch = toolName.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/)
        if (!scopedMatch) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ Invalid tool name format: "${toolName}". Must use scoped format like "filesystemServer.getFileInfo"`,
              },
            ],
            isError: true,
          }
        }

        const [, serverObjectName] = scopedMatch
        const serverId = serverObjectName.replace(/Server$/, '-server') // e.g., filesystemServer → filesystem-server

        // Ensure .codemesh directory exists
        await fs.mkdir(augmentationDir, { recursive: true })

        // Path to the server's augmentation file
        const markdownPath = path.join(augmentationDir, `${serverId}.md`)

        // Read existing content or start fresh
        let existingContent = ''
        try {
          existingContent = await fs.readFile(markdownPath, 'utf8')
        } catch (e) {
          // File doesn't exist yet, will create it
        }

        // Normalize markdown to ensure proper section header
        const normalizedMarkdown = markdown.trim().startsWith('#')
          ? markdown.trim()
          : `# ${toolName}\n\n${markdown.trim()}`

        // Replace or append the tool's section
        const sectionRegex = new RegExp(`^# ${toolName.replace('.', '\\.')}[\\s\\S]*?(?=^# |$)`, 'm')
        const updatedContent = existingContent.match(sectionRegex)
          ? existingContent.replace(sectionRegex, normalizedMarkdown)
          : existingContent
            ? `${existingContent.trim()}\n\n${normalizedMarkdown}\n`
            : `${normalizedMarkdown}\n`

        // Write the updated content
        await fs.writeFile(markdownPath, updatedContent, 'utf8')

        return {
          content: [
            {
              type: 'text',
              text: [
                `✅ Augmentation saved successfully`,
                ``,
                `📁 File: ${markdownPath}`,
                `🔧 Tool: ${toolName}`,
                ``,
                `🎯 Next Steps:`,
                `1. Call get-tool-apis with ["${toolName}"] to see the enhanced API`,
                `2. Use execute-code with the improved JSDoc documentation`,
                ``,
                `The augmentation will now be included in all future get-tool-apis calls for this tool!`,
              ].join('\n'),
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error saving augmentation: ${error}`,
            },
          ],
          isError: true,
        }
      }
    },
  )

  // Register a tool to get TypeScript APIs for specific tools (context-efficient)
  server.registerTool(
    'get-tool-apis',
    {
      title: 'Get Tool APIs',
      description:
        "CODEMESH STEP 2: Get TypeScript type definitions for specific tools you want to use in your code. This generates the server object interfaces you'll need. Use this after discover-tools to get only the APIs you need. IMPORTANT: Tools are available as server objects with methods, NOT as direct functions. Use the format: await serverName.methodName() (e.g., await weatherServer.getForecast(), await geocodeServer.geocode()). Do NOT use direct function calls like geocode() or get_forecast().",
      inputSchema: {
        toolNames: z
          .array(z.string())
          .describe(
            'Array of scoped tool names from discover-tools output (e.g., ["weatherServer.getAlerts", "geocodeServer.geocode"]). Must use the serverName.toolName format.',
          ),
        serverId: z
          .string()
          .optional()
          .describe('Specific server ID to get tools from (searches all if not specified)'),
        codemeshDir: z
          .string()
          .optional()
          .describe('Path to .codemesh directory containing tool augmentation markdown files'),
      },
    },
    async ({ toolNames, serverId, codemeshDir }): Promise<CallToolResult> => {
      const startTime = Date.now()
      const fileLogger = FileLogger.getInstance()

      try {
        const configLoader = ConfigLoader.getInstance()
        const config = configLoader.loadConfigAuto()

        // Configure file logger if not already done
        if (!fileLogger.isEnabled() && config.logging) {
          fileLogger.configure(config.logging)
        }

        // Determine .codemesh directory location (defaults to project root)
        const augmentationDir = codemeshDir || `${process.env.PWD || process.cwd()}/.codemesh`

        const serversToSearch = serverId ? config.servers.filter((s) => s.id === serverId) : config.servers

        if (serversToSearch.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: serverId
                  ? `❌ Server with ID '${serverId}' not found in configuration`
                  : '❌ No servers configured',
              },
            ],
          }
        }

        // Discover tools from the servers
        const discoveryService = ToolDiscoveryService.getInstance()
        const discoveryResults = await discoveryService.discoverAllTools(serversToSearch)

        // Parse scoped tool names (e.g., "weatherServer.getAlerts" → server: "weatherServer", method: "getAlerts")
        const parsedToolRequests = toolNames.map((name) => {
          const scopedMatch = name.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/)
          if (!scopedMatch) {
            throw new Error(
              `Invalid tool name format: "${name}". Must use scoped format like "weatherServer.getAlerts"`,
            )
          }
          return { scopedName: name, serverObject: scopedMatch[1], methodName: scopedMatch[2] }
        })

        // Filter discovered tools to only the requested ones
        const requestedTools: any[] = []
        const notFoundTools: string[] = []

        for (const request of parsedToolRequests) {
          let found = false

          for (const result of discoveryResults) {
            if (result.success) {
              for (const tool of result.tools) {
                // Generate server object name to compare
                const serverObjectName = createServerObjectName(tool.serverId)
                const toolMethodName = convertToolName(tool.name)

                // Check if this tool matches the request (scoped format required)
                if (serverObjectName === request.serverObject && toolMethodName === request.methodName) {
                  requestedTools.push(tool)
                  found = true
                  break
                }
              }
              if (found) break
            }
          }

          if (!found) {
            notFoundTools.push(request.scopedName)
          }
        }

        if (requestedTools.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `❌ None of the requested tools [${toolNames.join(', ')}] were found in the configured servers`,
              },
            ],
          }
        }

        // Generate TypeScript types for only the requested tools
        const typeGenerator = TypeGeneratorService.getInstance()

        // Create a mock discovery result with only the requested tools
        const filteredResults = [
          {
            serverId: 'filtered',
            serverName: 'Filtered Tools',
            success: true,
            tools: requestedTools,
          },
        ]

        const generatedTypes = await typeGenerator.generateTypes(filteredResults, augmentationDir)

        // Return the TypeScript definitions as text
        const response = [
          `🔧 TypeScript APIs for requested tools`,
          `📊 Found ${requestedTools.length} of ${toolNames.length} requested tools`,
        ]

        // Add warning about not-found tools if any
        if (notFoundTools.length > 0) {
          response.push('')
          response.push(`⚠️ Not found: ${notFoundTools.join(', ')}`)
        }

        response.push(
          '',
          'TypeScript Type Definitions:',
          '```typescript',
          generatedTypes.combinedTypes,
          '',
          generatedTypes.toolsNamespace,
          '```',
          '',
          'Tool Mapping (use these scoped names in your code):',
          ...requestedTools.map((tool) => {
            const serverObjectName = createServerObjectName(tool.serverId)
            const methodName = convertToolName(tool.name)
            return `🔧 ${serverObjectName}.${methodName}() [from ${tool.serverName}]`
          }),
          '',
          '<augmentation_workflow>',
          '⚠️ IMPORTANT: If tool output is unclear, CREATE AN AUGMENTATION!',
          '',
          'DO NOT trial-and-error different parsing approaches. Follow this workflow:',
          '',
          '1. Call execute-code with // EXPLORING comment to inspect raw output',
          '2. When output is unclear/hard to parse, STOP and create augmentation',
          '3. Call add-augmentation with proper markdown documentation',
          '4. Call get-tool-apis again to see enhanced JSDoc',
          '5. THEN write parsing code with full understanding',
          '',
          'This is MANDATORY when struggling with output. See execute-code for template.',
          '</augmentation_workflow>',
        )

        const responseText = response.join('\n')

        // Log the tool call
        const duration = Date.now() - startTime
        fileLogger.logToolCall({
          tool: 'get-tool-apis',
          args: { toolNames, serverId, codemeshDir },
          duration,
          status: 'success',
          response: `Found ${requestedTools.length} of ${toolNames.length} requested tools`,
        })

        return {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = `❌ Error getting tool APIs: ${error}`

        fileLogger.logToolCall({
          tool: 'get-tool-apis',
          args: { toolNames, serverId, codemeshDir },
          duration,
          status: 'error',
          error: errorMessage,
        })

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
        }
      }
    },
  )

  return server
}

async function main() {
  const transport = new StdioServerTransport()

  // Log the PWD environment variable to verify we can access project root
  const logPath = '/Users/michael/Projects/learn/mcp/codemode/tmp/codemesh-server.log'
  fs.writeFileSync(
    logPath,
    `CodeMesh Server Started\n` +
      `Timestamp: ${new Date().toISOString()}\n` +
      `PWD: ${process.env.PWD}\n` +
      `CWD: ${process.cwd()}\n` +
      `Environment Keys: ${Object.keys(process.env).sort().join(', ')}\n\n`,
    { flag: 'a' },
  )

  const server = getCodeMeshServer()
  await server.connect(transport)
  console.error('CodeMesh MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
