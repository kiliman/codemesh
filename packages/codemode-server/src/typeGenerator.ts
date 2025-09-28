import { compile } from "json-schema-to-typescript";
import type { DiscoveredTool, DiscoveryResult } from "./toolDiscovery.js";

export interface GeneratedToolType {
  toolName: string;
  serverId: string;
  serverName: string;
  inputTypeName: string;
  inputTypeDefinition: string;
  functionSignature: string;
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
          functionSignatures.push(generatedTool.functionSignature);

          console.log(`✅ Generated types for ${tool.name}`);
        } catch (error) {
          console.error(`❌ Failed to generate types for ${tool.name}:`, error);
        }
      }
    }

    // Combine all type definitions
    const combinedTypes = this.generateCombinedTypes(typeDefinitions);

    // Generate tools namespace with all function signatures
    const toolsNamespace = this.generateToolsNamespace(functionSignatures, generatedTools);

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
    const inputTypeName = this.createSafeTypeName(tool.name, tool.serverId);

    // Convert JSON schema to TypeScript interface
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
      console.warn(`⚠️ Failed to generate schema for ${tool.name}, using empty interface:`, error);
      inputTypeDefinition = `// Input type for ${tool.name} tool from ${tool.serverName}\nexport interface ${inputTypeName} {}\n`;
    }

    // Generate function signature
    const functionSignature = this.generateFunctionSignature(tool, inputTypeName);

    return {
      toolName: tool.name,
      serverId: tool.serverId,
      serverName: tool.serverName,
      inputTypeName,
      inputTypeDefinition,
      functionSignature,
    };
  }

  /**
   * Create a safe TypeScript type name from tool name and server ID
   */
  private createSafeTypeName(toolName: string, serverId: string): string {
    // Convert to PascalCase and make it unique
    const safeName = toolName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

    const safeServerId = serverId
      .replace(/[^a-zA-Z0-9]/g, '_')
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

    return `${safeName}${safeServerId}Input`;
  }

  /**
   * Generate a TypeScript function signature for a tool
   */
  private generateFunctionSignature(tool: DiscoveredTool, inputTypeName: string): string {
    const description = tool.description ? `\n  /**\n   * ${tool.description}\n   * Server: ${tool.serverName}\n   */` : '';

    return `${description}
  ${this.createSafeFunctionName(tool.name, tool.serverId)}(input: ${inputTypeName}): Promise<ToolResult>;`;
  }

  /**
   * Create a safe function name from tool name and server ID
   */
  public createSafeFunctionName(toolName: string, serverId: string): string {
    // Convert to camelCase and make it unique
    const safeName = toolName.replace(/[^a-zA-Z0-9]/g, '_');
    const safeServerId = serverId.replace(/[^a-zA-Z0-9]/g, '_');

    return `${safeName}_${safeServerId}`;
  }

  /**
   * Combine all type definitions into a single TypeScript module
   */
  private generateCombinedTypes(typeDefinitions: string[]): string {
    const header = `// Generated TypeScript types for MCP tools
// This file is auto-generated by CodeMode - do not edit manually

`;

    const toolResultType = `export interface ToolResult {
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

`;

    return header + toolResultType + typeDefinitions.join('\n');
  }

  /**
   * Generate the tools namespace with all function signatures
   */
  private generateToolsNamespace(functionSignatures: string[], tools: GeneratedToolType[]): string {
    const header = `// Generated tools namespace for CodeMode execution
// This file is auto-generated by CodeMode - do not edit manually

export interface McpTools {`;

    const footer = `}

// Tool metadata for runtime resolution
export const TOOL_METADATA = {
${tools.map(tool => `  "${this.createSafeFunctionName(tool.toolName, tool.serverId)}": {
    originalName: "${tool.toolName}",
    serverId: "${tool.serverId}",
    serverName: "${tool.serverName}",
  }`).join(',\n')}
} as const;

// Export for runtime use
export type ToolName = keyof McpTools;
`;

    return header + functionSignatures.join('\n') + '\n' + footer;
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
      tools: generatedTypes.tools.map(tool => ({
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
}