# Contributing to CodeMesh

Thank you for your interest in contributing to CodeMesh! This guide covers everything you need to know to develop and test CodeMesh.

## Project Structure

```
packages/
├── codemesh-server/     # Main CodeMesh MCP server
│   ├── src/
│   │   ├── index.ts           # Server entry point, tool definitions
│   │   ├── config.ts          # Configuration loader with env var substitution
│   │   ├── toolDiscovery.ts   # Multi-server tool discovery
│   │   ├── typeGenerator.ts   # JSON Schema → TypeScript conversion
│   │   ├── runtimeWrapper.ts  # Tool execution wrapper
│   │   └── codeExecutor.ts    # VM2 sandbox for TypeScript execution
│   └── package.json
├── client/              # CLI client for testing
├── example-server/      # Demo HTTP MCP server
├── weather-server/      # Demo stdio weather MCP server
└── geocode-server/      # Demo stdio geocoding MCP server

.codemesh/               # Local configuration
├── config.json          # MCP server configuration
└── *.md                 # Auto-generated augmentations
```

## Architecture

### Core Components

1. **Configuration System** (`config.ts`)
   - Loads `.codemesh/config.json`
   - Supports stdio, HTTP, and websocket server types
   - Environment variable substitution with `${VAR}` syntax
   - Follows MCP SDK security practices

2. **Tool Discovery** (`toolDiscovery.ts`)
   - Connects to multiple MCP servers simultaneously
   - Extracts tool schemas, descriptions, metadata
   - Supports all three transport types (stdio, HTTP, websocket)
   - Proper connection lifecycle management

3. **Type Generation** (`typeGenerator.ts`)
   - Converts JSON schemas to TypeScript interfaces using `json-schema-to-typescript`
   - Generates type-safe function signatures
   - Creates comprehensive tool metadata for runtime

4. **Runtime Wrapper** (`runtimeWrapper.ts`)
   - Creates executable TypeScript functions from tool metadata
   - Proxies function calls to actual MCP tools
   - Manages connections across multiple servers
   - Safe function naming (`toolName_serverId` pattern)

5. **Code Executor** (`codeExecutor.ts`)
   - Sandboxed TypeScript execution using VM2
   - Compiles TypeScript to JavaScript
   - Injects tool functions into execution context
   - 30-second timeout, error handling
   - Exploration mode detection for auto-augmentation

### The Three-Step Workflow

**Step 1: `discover-tools`** - Returns high-level overview of available tools from all configured servers. Context-efficient.

**Step 2: `get-tool-apis`** - Generates and returns TypeScript function signatures for specific tools. Only loads what's needed.

**Step 3: `execute-code`** - Executes TypeScript code with injected tool functions in VM2 sandbox.

### Auto-Augmentation System

When code includes `// EXPLORING` comments, the executor:

1. Detects the exploration pattern
2. Returns results as an ERROR (nuclear option approach)
3. Forces agent to create augmentation documentation
4. Agent calls `add-augmentation` tool to save markdown to `.codemesh/[server-id].md`
5. Future `get-tool-apis` calls include enhanced JSDoc from augmentations

**Result**: Self-improving system where agents document unclear outputs for future benefit.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/kiliman/codemesh.git
cd codemesh

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development Commands

```bash
# Start example HTTP server (for testing multi-server support)
pnpm dev:example-server

# Start CodeMesh server in watch mode
pnpm dev:codemesh-server:watch

# Build all packages
pnpm build
```

### Testing with CLI Client

The `packages/client` provides a generic CLI for testing any MCP server:

#### Testing CodeMesh (stdio server)

```bash
# Discover tools from CodeMesh
npx tsx packages/client/index.ts \
  --stdio tsx packages/codemesh-server/src/index.ts \
  --list-tools

# Call discover-tools
npx tsx packages/client/index.ts \
  --stdio tsx packages/codemesh-server/src/index.ts \
  --call-tool discover-tools

# Call get-tool-apis
npx tsx packages/client/index.ts \
  --stdio tsx packages/codemesh-server/src/index.ts \
  --call-tool get-tool-apis \
  --tool-args-file tmp/tool-args.json

# Call execute-code
npx tsx packages/client/index.ts \
  --stdio tsx packages/codemesh-server/src/index.ts \
  --call-tool execute-code \
  --code-file tmp/test.ts \
  --tool-args-file tmp/execute-args.json
```

#### Testing HTTP servers (example-server)

```bash
# Make sure example-server is running first
pnpm dev:example-server

# Then test with client
npx tsx packages/client/index.ts \
  --connect http://localhost:3000/mcp \
  --list-tools
```

#### Interactive Mode

```bash
# Start interactive session with CodeMesh
npx tsx packages/client/index.ts \
  --stdio tsx packages/codemesh-server/src/index.ts \
  --interactive

# Or with HTTP server
npx tsx packages/client/index.ts \
  --connect http://localhost:3000/mcp \
  --interactive
```

## Configuration Format

The `.codemesh/config.json` file defines which MCP servers CodeMesh connects to:

```json
{
  "servers": [
    {
      "id": "example-http",
      "name": "Example HTTP Server",
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    {
      "id": "example-stdio",
      "name": "Example Stdio Server",
      "type": "stdio",
      "command": ["node", "dist/index.js"],
      "cwd": "./packages/example-server",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "id": "example-websocket",
      "name": "Example WebSocket Server",
      "type": "websocket",
      "url": "ws://localhost:3001/mcp"
    }
  ]
}
```

### Environment Variable Substitution

Supports `${VAR}` and `${VAR:-default}` syntax:

```json
{
  "servers": [
    {
      "id": "brave-search",
      "name": "Brave Search",
      "type": "stdio",
      "command": ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    }
  ]
}
```

Use `config.example.json` for version control with placeholders.

## Key Implementation Details

### Safe Function Names

Tools are exposed as `toolName_serverId` to avoid collisions:

```typescript
// Multiple servers can have a 'search' tool
await search_braveSearch({ query: 'test' })
await search_googleSearch({ query: 'test' })
```

### VM2 Sandbox Security

- 30-second execution timeout
- No `eval()` or `wasm` access
- Limited sandbox with only necessary globals
- Console output capture for debugging

### Multi-Server Coordination

Code can call tools from multiple servers in a single execution:

```typescript
// HTTP server
const greeting = await greet_example_server({ name: 'Developer' })

// Stdio server 1
const alerts = await get_alerts_weather_server({ state: 'NC' })

// Stdio server 2
const files = await list_directory_filesystem_server({ path: '/tmp' })

// Process results together
return { greeting, alertCount: alerts.length, fileCount: files.length }
```

## Testing Auto-Augmentation

To test the auto-augmentation workflow:

1. Configure a server with unclear output format
2. Execute code with `// EXPLORING` comment
3. Verify error is returned forcing augmentation
4. Call `add-augmentation` tool with documentation
5. Call `get-tool-apis` again to see enhanced JSDoc
6. Execute code without `// EXPLORING` to verify success

## Debugging Tips

- Use `console.log()` in executed code for debugging
- Check `.codemesh/*.md` files to see augmentations
- Run servers in separate terminals to see their logs
- Use `--tool-args-file` with CLI to avoid bash escaping issues

## Code Style

- TypeScript with strict mode
- ESM modules (`.js` extensions in imports required)
- Zod for schema validation
- Conventional commits for git messages

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with conventional commits
4. Run tests: `pnpm test`
5. Push to your fork: `git push origin feature/amazing-feature`
6. Open a Pull Request

## Questions?

Open an issue on GitHub or reach out to the maintainers!

---

Built with love by Michael and Claudia 💙
