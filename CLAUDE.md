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
   - ✅ **Multi-server support**: HTTP, stdio, and websocket server types
   - Singleton ConfigLoader with Zod validation

2. **Enhanced Client CLI Mode** (`packages/client/`)
   - Works in both interactive and CLI modes
   - ✅ `--tool-args-file` and `--code-file` options for clean argument passing
   - ✅ Supports HEREDOC patterns for complex JSON/TypeScript
   - Can connect to MCP servers and call tools without bash escaping hell

3. **Multi-Server Tool Discovery** (`packages/codemode-server/src/toolDiscovery.ts`)
   - ✅ **HTTP servers**: Full StreamableHTTPClientTransport support
   - ✅ **Stdio servers**: Complete StdioClientTransport integration
   - ✅ Connects to and enumerates tools from multiple server types simultaneously
   - ✅ Extracts tool schemas, descriptions, and metadata from all configured servers
   - ✅ Proper connection management with error handling and cleanup

4. **TypeScript Type Generation** (`packages/codemode-server/src/typeGenerator.ts`)
   - ✅ Converts JSON schemas to TypeScript interfaces using json-schema-to-typescript
   - ✅ Generates type-safe function signatures for discovered tools
   - ✅ Creates comprehensive tool metadata for runtime resolution

5. **Tiered Discovery Workflow** (`packages/codemode-server/src/index.ts`)
   - ✅ `discover-tools` - High-level tool overview (context-efficient)
   - ✅ `get-tool-apis` - Selective TypeScript API loading for specific tools
   - ✅ `generate-types` - File-based type generation for development/debugging

6. **Multi-Server Runtime Wrapper** (`packages/codemode-server/src/runtimeWrapper.ts`)
   - ✅ **HTTP & Stdio support**: Works with both transport types seamlessly
   - ✅ Creates runtime that makes generated TypeScript functions callable
   - ✅ Proxies function calls to actual MCP tools with proper connection management
   - ✅ In-memory execution environment for agent code
   - ✅ Safe function name generation (tool_serverId pattern)

7. **Complete Code Execution System** (`packages/codemode-server/src/codeExecutor.ts`)
   - ✅ **VM2 integration**: Sandboxed TypeScript execution with timeout
   - ✅ **Tool injection**: Runtime tools available as callable functions
   - ✅ **TypeScript compilation**: Compiles TypeScript to JavaScript before execution
   - ✅ **Error handling**: Proper error capture and formatting
   - ✅ **Multi-server execution**: Can call tools from multiple MCP servers in single code block

8. **Enhanced Execute-Code Tool**
   - ✅ Integrated runtime API wrapper with code execution tool
   - ✅ Injects tool APIs into TypeScript execution context
   - ✅ **LIVE EXECUTION**: Full TypeScript code execution with real tool calls
   - ✅ **Multi-server coordination**: Executes code that calls tools from both HTTP and stdio servers
   - ✅ **Intelligent data processing**: CodeMode enables advanced filtering, analysis, and transformation

### 🎯 **BREAKTHROUGH ACHIEVED**
✅ **Full Multi-Server CodeMode Implementation Complete!**
   - ✅ HTTP servers + Stdio servers + Third-party servers working together
   - ✅ Live TypeScript execution with real tool calls across multiple server types
   - ✅ Intelligent data processing capabilities (severity filtering, etc.)
   - ✅ Context-efficient tiered discovery prevents tool pollution
   - ✅ **Fresh Claude session testing SUCCESS** - CodeMode workflow is intuitive!
   - ✅ Enhanced tool descriptions with explicit workflow guidance
   - ✅ **MCP Output Schemas** - JSON structure definition for better type generation
   - This is a "poor man's Code Mode" that rivals Cloudflare's approach!

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

## Fresh Claude Session Testing 🧪

### Test Results
✅ **SUCCESSFULLY tested with a completely fresh Claude session!**

**User Request**: *"Use the codemode mcp to return the 3 most severe weather alerts for North Carolina"*

**Results**:
- ✅ Fresh Claude **immediately understood** the 3-step CodeMode workflow
- ✅ Perfect execution: discover-tools → get-tool-apis → execute-code
- ✅ Successfully wrote TypeScript code to filter weather alerts by severity
- ✅ Delivered exactly what was requested after figuring out tool access patterns

**Key Learnings**:
- ✅ Enhanced tool descriptions with "CODEMODE STEP 1/2/3" work perfectly
- ✅ Tool access pattern hints eliminated most confusion
- ✅ MCP output schemas provide critical structure information
- ✅ CodeMode workflow is genuinely intuitive for fresh sessions

### Recent Enhancements

**9. Enhanced Tool Descriptions** (`packages/codemode-server/src/index.ts`)
   - ✅ **Explicit workflow guidance**: "CODEMODE STEP 1/2/3" in all descriptions
   - ✅ **Tool access examples**: `await get_alerts_weather_server({ state: 'NC' })`
   - ✅ **Clear warnings**: "Do NOT use 'tools.' or 'mcpTools.' prefixes"
   - ✅ **Context hints**: When to use each tool in the workflow

**10. MCP Output Schemas** (`packages/weather-server/src/index.ts`)
   - ✅ **JSON Schema definitions**: Complete structure for weather alerts and forecasts
   - ✅ **Severity enums**: Explicit 'Extreme' | 'Severe' | 'Moderate' | 'Minor' types
   - ✅ **Structured content**: Enables better type generation and intellisense
   - ✅ **No more guessing**: Fresh Claude sessions know exact data structures

**11. Third-Party Server Validation**
   - ✅ **Filesystem MCP Server**: Successfully integrated official @modelcontextprotocol/server-filesystem
   - ✅ **21 tools from 3 servers**: HTTP + Stdio + Third-party working seamlessly
   - ✅ **Universal compatibility**: Proves CodeMode works with any compliant MCP server

## Current Status

✅ **Multi-Server CodeMode Complete + Battle-Tested** - Full implementation working:
- Multi-server tool discovery (HTTP + Stdio + Third-party) ✅
- Enhanced tool descriptions with workflow guidance ✅
- MCP output schemas for structure definition ✅
- Type generation for all server types ✅
- Multi-server runtime wrapper ✅
- Live TypeScript code execution ✅
- Multi-server coordination in single code blocks ✅
- Enhanced CLI with file support ✅
- **Fresh Claude session validation** ✅

## Multi-Server Examples

### Example 1: Multi-Server Greeting + Weather
```typescript
// Uses HTTP server (example-server) + Stdio server (weather-server)
const greeting = await greet_example_server({ name: "Michael" });
console.log("🎉", greeting.content[0].text);

const alerts = await get_alerts_weather_server({ state: "NC" });
const alertsData = JSON.parse(alerts.content[0].text);
console.log(`🌦️ Found ${alertsData.features.length} weather alerts`);

return "Successfully used both HTTP and stdio MCP servers!";
```

### Example 2: Ultimate Multi-Server Demo
```typescript
// 🚀 ULTIMATE MULTI-SERVER CODEMODE DEMO
// Demonstrates HTTP + 2 Stdio servers working together seamlessly!

// 1. 🎉 Greet using HTTP server
const greeting = await greet_example_server({ name: "Michael" });
console.log("🌐 HTTP Server (Example):", greeting.content[0].text);

// 2. 🌦️ Get weather using stdio weather server
const alerts = await get_alerts_weather_server({ state: "NC" });
const alertsData = JSON.parse(alerts.content[0].text);
console.log(`📡 Stdio Server (Weather): Found ${alertsData.features.length} weather alerts in NC`);

// 3. 🗂️ List project files using stdio filesystem server
const projectFiles = await list_directory_filesystem_server({
  path: "/Users/michael/Projects/learn/mcp/codemode"
});
const fileList = projectFiles.content[0].text.split('\n').filter(line => line.includes('[FILE]'));
console.log(`🗂️ Stdio Server (Filesystem): Found ${fileList.length} files in project`);

// 4. 🧠 Intelligent multi-server analysis
const highestSeverity = alertsData.features.length > 0 ?
  alertsData.features[0].properties.severity : 'None';

const analysis = {
  greeting: greeting.content[0].text,
  weatherSummary: {
    totalAlerts: alertsData.features.length,
    highestSeverity: highestSeverity,
    areas: alertsData.features.slice(0, 2).map(f => f.properties.areaDesc)
  },
  projectSummary: {
    totalFiles: fileList.length,
    hasReadme: fileList.some(f => f.includes('CLAUDE.md')),
    projectName: "Multi-Server CodeMode Implementation"
  }
};

return {
  status: "SUCCESS",
  serversUsed: 3,
  transportsUsed: ["HTTP", "Stdio", "Stdio"],
  toolsCalled: 4,
  dataProcessed: analysis,
  message: "🚀 Ultimate Multi-Server CodeMode Demo Complete!"
};
```

### Example 3: Intelligent Data Processing
```typescript
// CodeMode's superpower: intelligent filtering and analysis
const alerts = await get_alerts_weather_server({ state: "NC" });
const alertsData = JSON.parse(alerts.content[0].text);

// Find highest severity level present
const severityHierarchy = ['Extreme', 'Severe', 'Moderate', 'Minor'];
const highestSeverity = severityHierarchy.find(severity =>
  alertsData.features.some(alert => alert.properties.severity === severity)
);

// Filter to show only most severe alerts
const mostSevereAlerts = alertsData.features.filter(alert =>
  alert.properties.severity === highestSeverity
);

return {
  totalAlerts: alertsData.features.length,
  highestSeverityLevel: highestSeverity,
  mostSevereAlerts: mostSevereAlerts.length,
  summary: `Filtered ${alertsData.features.length} to ${mostSevereAlerts.length} most severe`
};
```

### Running Multi-Server Examples
```bash
# Multi-server greeting + weather
node packages/client/index.ts --connect http://localhost:3002/mcp --call-tool execute-code --code-file tmp/greet-and-weather.ts --tool-args-file tmp/multi-server-args.json

# Intelligent severity filtering
node packages/client/index.ts --connect http://localhost:3002/mcp --call-tool execute-code --code-file tmp/most-severe-alerts.ts --tool-args-file tmp/alerts-args.json
```