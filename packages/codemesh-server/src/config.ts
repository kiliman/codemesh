import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// MCP Server Configuration Schema (compatible with VSCode's .vscode/mcp.json)
const McpServerConfigSchema = z.object({
  id: z.string().describe('Unique identifier for the server'),
  name: z.string().describe('Human-readable name for the server'),
  type: z.enum(['stdio', 'http', 'websocket']).describe('Connection type'),

  // For stdio servers
  command: z.array(z.string()).optional().describe('Command and arguments to start the server'),
  cwd: z.string().optional().describe('Working directory for the server process'),
  env: z.record(z.string()).optional().describe('Environment variables for the server'),

  // For HTTP/WebSocket servers
  url: z.string().url().optional().describe('Server URL'),

  // Optional configuration
  timeout: z.number().optional().describe('Connection timeout in milliseconds'),
  retries: z.number().optional().describe('Number of connection retries'),
});

const McpConfigSchema = z.object({
  servers: z.array(McpServerConfigSchema).describe('List of MCP servers to connect to'),
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type McpConfig = z.infer<typeof McpConfigSchema>;

export class ConfigLoader {
  private static instance: ConfigLoader;
  private config: McpConfig | null = null;

  private constructor() {}

  public static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Auto-discover and load MCP configuration from project root
   * Looks for .codemesh/config.json in PWD (for stdio servers)
   */
  public loadConfigAuto(): McpConfig {
    // Use PWD if available, otherwise fall back to process.cwd()
    const pwd = process.env.PWD || process.cwd();

    const configPath = join(pwd, '.codemesh', 'config.json');

    if (!existsSync(configPath)) {
      throw new Error(
        `No .codemesh/config.json found in project root: ${pwd}\n` +
        `Please create ${configPath} with your MCP server configuration.`
      );
    }

    return this.loadConfig(configPath);
  }

  /**
   * Load MCP configuration from a JSON file
   */
  public loadConfig(configPath: string): McpConfig {
    try {
      const configFile = resolve(configPath);
      const configData = readFileSync(configFile, 'utf-8');
      const parsedConfig = JSON.parse(configData);

      // Validate the configuration against our schema
      this.config = McpConfigSchema.parse(parsedConfig);

      console.error(`📄 Loaded MCP configuration from ${configFile}`);
      console.error(`📡 Found ${this.config.servers.length} MCP server(s) configured`);

      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Invalid MCP configuration format:');
        error.errors.forEach((err) => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        throw new Error('Invalid MCP configuration format');
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in MCP configuration: ${error.message}`);
      } else {
        throw new Error(`Failed to load MCP configuration: ${error}`);
      }
    }
  }

  /**
   * Get the current loaded configuration
   */
  public getConfig(): McpConfig {
    if (!this.config) {
      throw new Error('No MCP configuration loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Get a specific server configuration by ID
   */
  public getServerConfig(serverId: string): McpServerConfig | null {
    if (!this.config) {
      return null;
    }
    return this.config.servers.find((server) => server.id === serverId) || null;
  }

  /**
   * Get all HTTP-based servers (easier to connect to for discovery)
   */
  public getHttpServers(): McpServerConfig[] {
    if (!this.config) {
      return [];
    }
    return this.config.servers.filter((server) => server.type === 'http');
  }

  /**
   * Get all stdio-based servers
   */
  public getStdioServers(): McpServerConfig[] {
    if (!this.config) {
      return [];
    }
    return this.config.servers.filter((server) => server.type === 'stdio');
  }

  /**
   * Validate if a configuration is valid without loading it
   */
  public static validateConfig(configData: unknown): boolean {
    try {
      McpConfigSchema.parse(configData);
      return true;
    } catch {
      return false;
    }
  }
}
