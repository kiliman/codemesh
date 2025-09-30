import { compile } from 'json-schema-to-typescript';
import type { DiscoveredTool, DiscoveryResult } from './toolDiscovery.js';

export interface GeneratedToolType {
  toolName: string;
  serverId: string;
  serverName: string;
  inputTypeName: string;
  inputTypeDefinition: string;
  outputTypeName?: string;
  outputTypeDefinition?: string;
  functionSignature: string;
  // New properties for namespaced API
  namespacedServerName: string;
  namespacedInputTypeName: string;
  namespacedOutputTypeName?: string;
  camelCaseMethodName: string;
  serverObjectName: string;
  // Store original schemas for JSDoc generation
  inputSchema?: unknown;
  outputSchema?: unknown;
  description?: string;
}

export interface GeneratedTypes {
  tools: GeneratedToolType[];
  combinedTypes: string;
  toolsNamespace: string;
}

export class TypeGeneratorService {
  private static instance: TypeGeneratorService;

  private constructor() {}

  public static getInstance(): TypeGeneratorService {
    if (!TypeGeneratorService.instance) {
      TypeGeneratorService.instance = new TypeGeneratorService();
    }
    return TypeGeneratorService.instance;
  }

  /**
   * Generate TypeScript types from discovered tools
   */
  async generateTypes(discoveryResults: DiscoveryResult[]): Promise<GeneratedTypes> {
    console.log(`🔧 Generating TypeScript types for discovered tools...`);

    const generatedTools: GeneratedToolType[] = [];
    const typeDefinitions: string[] = [];
    const functionSignatures: string[] = [];

    // Process each successful discovery result
    for (const result of discoveryResults) {
      if (!result.success) {
        console.log(`⚠️ Skipping ${result.serverName} due to discovery failure`);
        continue;
      }

      console.log(`📝 Processing ${result.tools.length} tools from ${result.serverName}...`);

      for (const tool of result.tools) {
        try {
          const generatedTool = await this.generateToolType(tool);
          generatedTools.push(generatedTool);
          typeDefinitions.push(generatedTool.inputTypeDefinition);
          if (generatedTool.outputTypeDefinition) {
            typeDefinitions.push(generatedTool.outputTypeDefinition);
          }
          functionSignatures.push(generatedTool.functionSignature);

          console.log(`✅ Generated types for ${tool.name}`);
        } catch (error) {
          console.error(`❌ Failed to generate types for ${tool.name}:`, error);
        }
      }
    }

    // Generate clean namespaced types and server interfaces
    const namespacedTypes = this.generateNamespacedTypes(generatedTools);

    // Use only namespaced types
    const combinedTypes = namespacedTypes;

    // Generate tools namespace with only namespaced server objects
    const toolsNamespace = this.generateNamespacedToolsNamespace(generatedTools);

    console.log(`🎯 Generated TypeScript types for ${generatedTools.length} tools`);

    return {
      tools: generatedTools,
      combinedTypes,
      toolsNamespace,
    };
  }

  /**
   * Generate TypeScript types for a single tool
   */
  private async generateToolType(tool: DiscoveredTool): Promise<GeneratedToolType> {
    // Create a safe type name from tool name
    const inputTypeName = this.createSafeTypeName(tool.name, tool.serverId, 'Input');
    const outputTypeName = this.createSafeTypeName(tool.name, tool.serverId, 'Output');

    // Convert input JSON schema to TypeScript interface
    let inputTypeDefinition: string;
    try {
      if (tool.inputSchema && typeof tool.inputSchema === 'object') {
        inputTypeDefinition = await compile(tool.inputSchema as any, inputTypeName, {
          bannerComment: `// Input type for ${tool.name} tool from ${tool.serverName}`,
          style: {
            singleQuote: false,
          },
        });
      } else {
        // Fallback for tools without schemas
        inputTypeDefinition = `// Input type for ${tool.name} tool from ${tool.serverName}\nexport interface ${inputTypeName} {}\n`;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to generate input schema for ${tool.name}, using empty interface:`, error);
      inputTypeDefinition = `// Input type for ${tool.name} tool from ${tool.serverName}\nexport interface ${inputTypeName} {}\n`;
    }

    // Convert output JSON schema to TypeScript interface (if present)
    let outputTypeDefinition: string | undefined;
    if (tool.outputSchema && typeof tool.outputSchema === 'object') {
      try {
        outputTypeDefinition = await compile(tool.outputSchema as any, outputTypeName, {
          bannerComment: `// Output type for ${tool.name} tool from ${tool.serverName}`,
          style: {
            singleQuote: false,
          },
        });
        console.log(`✨ Generated output type for ${tool.name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to generate output schema for ${tool.name}:`, error);
        outputTypeDefinition = undefined;
      }
    }

    // Generate function signature
    const functionSignature = this.generateFunctionSignature(
      tool,
      inputTypeName,
      outputTypeDefinition ? outputTypeName : undefined,
    );

    // Generate namespaced properties
    const namespacedServerName = this.convertServerName(tool.serverId);
    const namespacedInputTypeName = this.createNamespacedTypeName(tool.name, 'Input');
    const namespacedOutputTypeName = outputTypeDefinition
      ? this.createNamespacedTypeName(tool.name, 'Output')
      : undefined;
    const camelCaseMethodName = this.convertToolName(tool.name);
    const serverObjectName = this.createServerObjectName(tool.serverId);

    return {
      toolName: tool.name,
      serverId: tool.serverId,
      serverName: tool.serverName,
      inputTypeName,
      inputTypeDefinition,
      outputTypeName: outputTypeDefinition ? outputTypeName : undefined,
      outputTypeDefinition,
      functionSignature,
      // New namespaced properties
      namespacedServerName,
      namespacedInputTypeName,
      namespacedOutputTypeName,
      camelCaseMethodName,
      serverObjectName,
      // Store original schemas for JSDoc
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      description: tool.description,
    };
  }

  /**
   * Create a safe TypeScript type name from tool name and server ID
   */
  private createSafeTypeName(toolName: string, serverId: string, suffix: string): string {
    // Convert to PascalCase and make it unique
    const safeName = toolName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

    const safeServerId = serverId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

    return `${safeName}${safeServerId}${suffix}`;
  }

  /**
   * Create a namespaced type name for use within server namespace
   */
  private createNamespacedTypeName(toolName: string, suffix: string): string {
    // Simple PascalCase name for use within namespace
    const safeName = this.toPascalCase(toolName);
    return `${safeName}${suffix}`;
  }

  /**
   * Generate a TypeScript function signature for a tool
   */
  private generateFunctionSignature(tool: DiscoveredTool, inputTypeName: string, outputTypeName?: string): string {
    const description = tool.description
      ? `\n  /**\n   * ${tool.description}\n   * Server: ${tool.serverName}\n   */`
      : '';

    // Use structured output type if available, otherwise fall back to ToolResult
    const returnType = outputTypeName ? `Promise<ToolResultWithOutput<${outputTypeName}>>` : 'Promise<ToolResult>';

    return `${description}
  ${this.createSafeFunctionName(tool.name, tool.serverId)}(input: ${inputTypeName}): ${returnType};`;
  }

  /**
   * Generate detailed JSDoc comment for a tool method
   */
  private generateDetailedJSDoc(tool: DiscoveredTool): string {
    const lines: string[] = ['  /**'];

    // Add main description
    if (tool.description) {
      lines.push(`   * ${tool.description}`);
      lines.push('   *');
    }

    // Add input schema details
    if (tool.inputSchema && typeof tool.inputSchema === 'object') {
      const schema = tool.inputSchema as any;

      if (schema.properties) {
        lines.push('   * @param input - Tool input parameters:');
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const prop = propSchema as any;
          const required = schema.required?.includes(propName) ? '(required)' : '(optional)';
          const typeInfo = prop.type ? `{${prop.type}}` : '';
          const description = prop.description || '';
          lines.push(`   *   - ${propName} ${typeInfo} ${required} ${description}`.trim());
        }
        lines.push('   *');
      }
    }

    // Add output schema details
    if (tool.outputSchema && typeof tool.outputSchema === 'object') {
      const schema = tool.outputSchema as any;
      lines.push('   * @returns Tool result with structured output:');

      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const prop = propSchema as any;
          const typeInfo = prop.type ? `{${prop.type}}` : '';
          const description = prop.description || '';
          lines.push(`   *   - ${propName} ${typeInfo} ${description}`.trim());
        }
      } else if (schema.type) {
        lines.push(`   *   Type: ${schema.type}`);
        if (schema.description) {
          lines.push(`   *   ${schema.description}`);
        }
      }
      lines.push('   *');
    }

    // Add server info
    lines.push(`   * @server ${tool.serverName} (${tool.serverId})`);
    lines.push('   */');

    return lines.join('\n');
  }

  /**
   * Convert string to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  }

  /**
   * Convert string to PascalCase
   */
  private toPascalCase(str: string): string {
    const camelCase = this.toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
  }

  /**
   * Convert server ID to proper server name
   */
  private convertServerName(serverId: string): string {
    // "weather-server" → "WeatherServer"
    // "geocode-server" → "GeocodeServer"
    // "example-server" → "ExampleServer"
    return this.toPascalCase(serverId.replace(/-server$/, ''));
  }

  /**
   * Convert tool name to camelCase method name
   */
  public convertToolName(toolName: string): string {
    // "get_forecast" → "getForecast"
    // "geocode" → "geocode"
    return this.toCamelCase(toolName);
  }

  /**
   * Create a safe function name from tool name and server ID
   */
  public createSafeFunctionName(toolName: string, serverId: string): string {
    // For backwards compatibility - still used in runtime wrapper
    const safeName = toolName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeServerId = serverId.replace(/[^a-zA-Z0-9]/g, '_');

    return `${safeName}_${safeServerId}`;
  }

  /**
   * Create server object name for namespaced API
   */
  public createServerObjectName(serverId: string): string {
    // "weather-server" → "weatherServer"
    const baseServerId = serverId.replace(/-server$/, '');
    return this.toCamelCase(baseServerId) + 'Server';
  }

  /**
   * Combine all type definitions into a single TypeScript module
   */
  private generateCombinedTypes(typeDefinitions: string[]): string {
    const header = `// Generated TypeScript types for MCP tools
// This file is auto-generated by CodeMesh - do not edit manually

`;

    const toolResultType = `// Import CallToolResult from MCP SDK
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Re-export for consistency
export type ToolResult = CallToolResult;

export interface ToolResultWithOutput<T> extends ToolResult {
  structuredContent?: T;
}

`;

    // Legacy flat types for backwards compatibility
    const legacyTypes = `// Legacy flat types for backwards compatibility
${typeDefinitions.join('\n')}

`;

    return header + toolResultType + legacyTypes;
  }

  /**
   * Generate namespaced types and server interfaces
   */
  private generateNamespacedTypes(tools: GeneratedToolType[]): string {
    // Group tools by server
    const serverGroups = new Map<string, GeneratedToolType[]>();
    for (const tool of tools) {
      const serverName = tool.namespacedServerName;
      if (!serverGroups.has(serverName)) {
        serverGroups.set(serverName, []);
      }
      serverGroups.get(serverName)!.push(tool);
    }

    // Add preamble with type definitions
    let namespacedTypes = `// Import CallToolResult from MCP SDK
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Re-export for consistency
export type ToolResult = CallToolResult;

export interface ToolResultWithOutput<T> extends ToolResult {
  structuredContent?: T;
}

`;

    // Generate namespace and interface for each server
    for (const [serverName, serverTools] of serverGroups) {
      const serverObjectName = serverTools[0].serverObjectName;

      // Generate namespace with types
      namespacedTypes += `// ${serverName} namespace with input/output types\n`;
      namespacedTypes += `export namespace ${serverName} {\n`;

      // Add input/output types to namespace
      for (const tool of serverTools) {
        // Generate simplified types for namespace (without banners)
        namespacedTypes += `  export interface ${tool.namespacedInputTypeName} {\n`;
        // Extract the interface content from the generated type definition
        const inputInterface = this.extractInterfaceContent(tool.inputTypeDefinition, tool.inputTypeName);
        namespacedTypes += inputInterface.split('\n').map(line => `    ${line}`).join('\n');
        namespacedTypes += `\n  }\n\n`;

        if (tool.outputTypeDefinition && tool.namespacedOutputTypeName) {
          namespacedTypes += `  export interface ${tool.namespacedOutputTypeName} {\n`;
          const outputInterface = this.extractInterfaceContent(tool.outputTypeDefinition, tool.outputTypeName!);
          namespacedTypes += outputInterface.split('\n').map(line => `    ${line}`).join('\n');
          namespacedTypes += `\n  }\n\n`;
        }
      }

      namespacedTypes += `}\n\n`;

      // Generate server interface
      namespacedTypes += `// ${serverName} interface with methods\n`;
      namespacedTypes += `export interface ${serverName} {\n`;

      for (const tool of serverTools) {
        const inputType = `${serverName}.${tool.namespacedInputTypeName}`;
        const returnType = tool.namespacedOutputTypeName
          ? `Promise<ToolResultWithOutput<${serverName}.${tool.namespacedOutputTypeName}>>`
          : 'Promise<ToolResult>';

        // Generate detailed JSDoc with full schema information
        const detailedJSDoc = this.generateDetailedJSDoc({
          name: tool.toolName,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          serverId: tool.serverId,
          serverName: tool.serverName,
        } as DiscoveredTool);

        namespacedTypes += detailedJSDoc + '\n';
        namespacedTypes += `  ${tool.camelCaseMethodName}(input: ${inputType}): ${returnType};\n\n`;
      }

      namespacedTypes += `}\n\n`;
    }

    return namespacedTypes;
  }

  /**
   * Extract interface content from generated type definition
   */
  private extractInterfaceContent(typeDefinition: string, typeName: string): string {
    // Remove banner comments and extract just the interface body
    const lines = typeDefinition.split('\n');
    const interfaceStartIndex = lines.findIndex(line => line.includes(`export interface ${typeName}`));
    if (interfaceStartIndex === -1) return '  // No properties';

    const interfaceStart = lines[interfaceStartIndex];
    const openBraceIndex = interfaceStart.indexOf('{');
    let content = '';
    let braceCount = 0;
    let started = false;

    for (let i = interfaceStartIndex; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount > 0) {
        // Extract content inside the interface
        const lineContent = i === interfaceStartIndex
          ? line.substring(openBraceIndex + 1).trim()
          : line.trim();

        if (lineContent) {
          content += `  ${lineContent}\n`;
        }
      }

      if (started && braceCount === 0) {
        break;
      }
    }

    return content || '    // No properties';
  }

  /**
   * Generate the tools namespace with all function signatures
   */
  private generateToolsNamespace(functionSignatures: string[], tools: GeneratedToolType[]): string {
    const header = `// Generated tools namespace for CodeMesh execution
// This file is auto-generated by CodeMesh - do not edit manually

export interface McpTools {`;

    // Group tools by server for server object declarations
    const serverGroups = new Map<string, GeneratedToolType[]>();
    for (const tool of tools) {
      const serverObjectName = tool.serverObjectName;
      if (!serverGroups.has(serverObjectName)) {
        serverGroups.set(serverObjectName, []);
      }
      serverGroups.get(serverObjectName)!.push(tool);
    }

    // Generate server object declarations
    let serverDeclarations = '\n  // Namespaced server objects\n';
    for (const [serverObjectName, serverTools] of serverGroups) {
      const serverTypeName = serverTools[0].namespacedServerName;
      serverDeclarations += `  ${serverObjectName}: ${serverTypeName};\n`;
    }

    const footer = `}

// Tool metadata for runtime resolution
export const TOOL_METADATA = {
${tools
  .map(
    (tool) => `  "${this.createSafeFunctionName(tool.toolName, tool.serverId)}": {
    originalName: "${tool.toolName}",
    serverId: "${tool.serverId}",
    serverName: "${tool.serverName}",
  }`,
  )
  .join(',\n')}
} as const;

// Server metadata for namespaced API
export const SERVER_METADATA = {
${Array.from(serverGroups.entries())
  .map(
    ([serverObjectName, serverTools]) => `  "${serverObjectName}": {
    serverId: "${serverTools[0].serverId}",
    serverName: "${serverTools[0].serverName}",
    namespacedServerName: "${serverTools[0].namespacedServerName}",
  }`,
  )
  .join(',\n')}
} as const;

// Export for runtime use
export type ToolName = keyof McpTools;
export type ServerObjectName = keyof typeof SERVER_METADATA;
`;

    return header + functionSignatures.join('\n') + serverDeclarations + '\n' + footer;
  }

  /**
   * Save generated types to files
   */
  async saveGeneratedTypes(generatedTypes: GeneratedTypes, outputDir: string): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Save combined types
    const typesPath = path.join(outputDir, 'types.ts');
    await fs.writeFile(typesPath, generatedTypes.combinedTypes, 'utf-8');
    console.log(`📁 Saved types to ${typesPath}`);

    // Save tools namespace
    const toolsPath = path.join(outputDir, 'tools.ts');
    await fs.writeFile(toolsPath, generatedTypes.toolsNamespace, 'utf-8');
    console.log(`📁 Saved tools namespace to ${toolsPath}`);

    // Save metadata as JSON for runtime use
    const metadataPath = path.join(outputDir, 'metadata.json');
    const metadata = {
      generatedAt: new Date().toISOString(),
      tools: generatedTypes.tools.map((tool) => ({
        toolName: tool.toolName,
        serverId: tool.serverId,
        serverName: tool.serverName,
        inputTypeName: tool.inputTypeName,
        functionName: this.createSafeFunctionName(tool.toolName, tool.serverId),
      })),
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`📁 Saved metadata to ${metadataPath}`);
  }

  /**
   * Generate clean tools namespace with only namespaced server objects
   */
  private generateNamespacedToolsNamespace(tools: GeneratedToolType[]): string {
    // Group tools by server
    const serverGroups = new Map<string, GeneratedToolType[]>();
    for (const tool of tools) {
      if (!serverGroups.has(tool.serverObjectName)) {
        serverGroups.set(tool.serverObjectName, []);
      }
      serverGroups.get(tool.serverObjectName)!.push(tool);
    }

    const serverObjects = Array.from(serverGroups.keys())
      .map(serverObjectName => `  ${serverObjectName}: ${serverObjectName.charAt(0).toUpperCase() + serverObjectName.slice(1).replace('Server', '')};`)
      .join('\n');

    const serverMetadata = Array.from(serverGroups.entries())
      .map(([serverObjectName, serverTools]) => {
        const firstTool = serverTools[0];
        return `  "${serverObjectName}": {
    serverId: "${firstTool.serverId}",
    serverName: "${firstTool.serverName}",
    namespacedServerName: "${firstTool.namespacedServerName}",
  }`;
      })
      .join(',\n');

    return `// Generated tools namespace for CodeMesh execution
// This file is auto-generated by CodeMesh - do not edit manually

export interface McpTools {
${serverObjects}
}

// Server metadata for namespaced API
export const SERVER_METADATA = {
${serverMetadata}
} as const;

// Export for runtime use
export type ServerObjectName = keyof typeof SERVER_METADATA;
`;
  }
}
