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

2. **Enhanced Client CLI Mode** (`packages/client/`)
   - Works in both interactive and CLI modes
   - **NEW**: `--tool-args-file` and `--code-file` options for clean argument passing
   - **NEW**: Supports HEREDOC patterns for complex JSON/TypeScript
   - Can connect to MCP servers and call tools without bash escaping hell

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

6. **Runtime API Wrapper** (`packages/codemode-server/src/runtimeWrapper.ts`)
   - ✅ Creates runtime that makes generated TypeScript functions callable
   - ✅ Proxies function calls to actual MCP tools with proper connection management
   - ✅ In-memory execution environment for agent code
   - ✅ Safe function name generation (tool_serverId pattern)

7. **Enhanced Execute-Code Tool**
   - ✅ Integrated runtime API wrapper with code execution tool
   - ✅ Injects tool APIs into TypeScript execution context
   - ✅ Shows execution environment ready with available tools
   - 🚧 Actual TypeScript execution with vm2/similar (next phase)

### 🚧 Next Phase
8. **Actual Code Execution**
   - Implement TypeScript code execution using vm2 or similar sandbox
   - Execute injected code with access to runtime wrapper tools
   - Return actual execution results instead of preview

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

# Test with CLI client - old way
pnpm client -- --connect http://localhost:3002/mcp --call-tool discover-tools

# Test with new file-based CLI - much cleaner!
npx tsx packages/client/index.ts --connect http://localhost:3002/mcp --call-tool execute-code --tool-args-file tmp/execute-args.json --code-file tmp/greet-claudia.ts

# Test with HEREDOC (no files needed)
npx tsx packages/client/index.ts --connect http://localhost:3002/mcp --call-tool execute-code --tool-args "$(cat <<'EOF'
{
  "code": "const result = await greet_example_server({ name: 'Claudia' }); return result;",
  "toolNames": ["greet"],
  "configPath": "/Users/michael/Projects/learn/mcp/codemode/mcp-config.json"
}
EOF
)"

# Build all packages
pnpm build
```

## Major Breakthrough

The **tiered discovery workflow** solves the major UX issue with MCP:

**Problem**: Traditional MCP clutters agent context with ALL available tools, even unused ones.

**Solution**: Our three-tier approach:
1. **`discover-tools`** - High-level overview of what's available
2. **`get-tool-apis`** - Load TypeScript APIs only for tools you'll actually use
3. **`execute-code`** - Execute code with access to only the loaded tools

This drastically reduces context usage while maintaining full functionality!

## Architecture Notes

- Uses pnpm monorepo structure
- TypeScript with ESM modules (.js extensions required)
- Express server for HTTP MCP transport with debug logging
- Streamable HTTP transport with SSE support
- Context-efficient tiered discovery prevents tool pollution
- File-based CLI arguments eliminate bash escaping hell

## Current Status

✅ **Runtime infrastructure complete** - All components working together:
- Tool discovery ✅
- Type generation ✅
- Runtime wrapper ✅
- Execute-code tool integration ✅
- Enhanced CLI with file support ✅

🚧 **Next**: Actual TypeScript code execution (vm2 integration)