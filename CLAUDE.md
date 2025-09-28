# CodeMode MCP Implementation

This project implements a "CodeMode" MCP server inspired by Cloudflare's approach - instead of many granular MCP tools, we provide a single tool that executes TypeScript code against discovered MCP tools.

## Project Structure

```
packages/
├── client/              # MCP client with CLI and interactive modes
├── example-server/      # Demo MCP server for testing
└── codemode-server/     # Main CodeMode MCP server
```

## Current Implementation Status

### ✅ Completed
1. **MCP Configuration System** (`packages/codemode-server/src/config.ts`)
   - VSCode-compatible MCP configuration format
   - Supports HTTP, stdio, and websocket server types
   - Singleton ConfigLoader with Zod validation

2. **Client CLI Mode** (`packages/client/`)
   - Works in both interactive and CLI modes
   - Can connect to MCP servers and call tools
   - Useful for testing during development

3. **Basic Server Discovery** (`packages/codemode-server/src/index.ts`)
   - `discover-tools` tool that reads MCP configuration
   - Successfully loads and validates server configurations

### 🚧 In Progress
4. **Tool Schema Extraction** (`packages/codemode-server/src/toolDiscovery.ts`)
   - Created ToolDiscoveryService to connect to MCP servers
   - Extracts tool schemas and generates summaries
   - Currently has module resolution issues with client SDK

### 📋 Pending
5. **TypeScript Type Generation**
   - Generate TypeScript definitions from discovered tool schemas
   - Create runtime-accessible type information

6. **Code Execution Runtime**
   - Implement actual TypeScript code execution against MCP tools
   - Create API wrapper that proxies calls to actual MCP servers

## Key Files

- `mcp-config.json` - MCP server configuration (VSCode format)
- `packages/codemode-server/src/index.ts` - Main server with tools
- `packages/codemode-server/src/config.ts` - Configuration loader
- `packages/codemode-server/src/toolDiscovery.ts` - Tool discovery service
- `packages/client/index.ts` - CLI client for testing

## Development Commands

```bash
# Start example server (for testing)
pnpm dev:example-server

# Start codemode server
pnpm dev:codemode-server:watch

# Test with CLI client
pnpm client -- --connect http://localhost:3002/mcp --call-tool discover-tools

# Build all packages
pnpm build
```

## Current Issue

The ToolDiscoveryService has a module resolution issue importing MCP client modules. Need to either:
1. Fix the import paths for the client SDK
2. Use a different approach for connecting to MCP servers
3. Move the tool discovery logic to the existing client package

## Architecture Notes

- Uses pnpm monorepo structure
- TypeScript with ESM modules (.js extensions required)
- Express server for HTTP MCP transport
- Streamable HTTP transport with SSE support

## Next Steps

1. Fix module resolution for MCP client imports
2. Complete tool schema extraction implementation
3. Generate TypeScript type definitions
4. Implement code execution runtime
5. Add comprehensive testing