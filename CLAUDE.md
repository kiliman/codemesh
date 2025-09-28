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

3. **Tool Discovery Service** (`packages/codemode-server/src/toolDiscovery.ts`)
   - Connects to and enumerates tools from configured MCP servers
   - Extracts tool schemas, descriptions, and metadata
   - Proper connection management with error handling

4. **TypeScript Type Generation** (`packages/codemode-server/src/typeGenerator.ts`)
   - Converts JSON schemas to TypeScript interfaces using json-schema-to-typescript
   - Generates type-safe function signatures for discovered tools
   - Creates comprehensive tool metadata for runtime resolution

5. **Tiered Discovery Workflow** (`packages/codemode-server/src/index.ts`)
   - `discover-tools` - High-level tool overview (context-efficient)
   - `get-tool-apis` - Selective TypeScript API loading for specific tools
   - `generate-types` - File-based type generation for development/debugging

### 🚧 In Progress
6. **Runtime API Wrapper**
   - Create runtime that makes generated TypeScript functions callable
   - Proxy function calls to actual MCP tools
   - In-memory execution environment for agent code

### 📋 Pending
7. **Enhanced Execute-Code Tool**
   - Integrate runtime API wrapper with code execution
   - Inject tool APIs into TypeScript execution context
   - Complete end-to-end CodeMode functionality

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