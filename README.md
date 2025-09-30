# CodeMesh MCP Implementation

A "poor man's Code Mode" inspired by Cloudflare's approach - execute complex TypeScript code against multiple MCP tools for advanced data processing and analysis.

## What is CodeMesh?

Instead of making individual tool calls, CodeMesh allows you to write TypeScript code that can call multiple MCP tools and process their results intelligently. This is ideal for:

- **Complex data analysis** (filtering, sorting, correlation)
- **Multi-step workflows** requiring coordination between tools
- **Custom logic** that would be difficult with individual tool calls
- **Cross-server data processing** combining results from different MCP servers

## Quick Start

1. **Start the servers:**

   ```bash
   # Terminal 1: Start example HTTP server
   pnpm dev:example-server

   # Terminal 2: Start CodeMesh server
   pnpm dev:codemesh-server
   ```

2. **Use the CodeMesh workflow:**

   ```bash
   # Step 1: Discover available tools
   pnpm cli discover-tools

   # Step 2: Get TypeScript APIs for tools you want
   pnpm cli get-tool-apis --tool-args-file tmp/tool-args.json

   # Step 3: Execute your TypeScript code
   pnpm cli execute-code --code-file tmp/your-code.ts
   ```

## The Three-Step CodeMesh Workflow

### 1. **discover-tools** - See what's available

Discovers all tools from configured MCP servers. Use this first to understand what tools you can work with.

### 2. **get-tool-apis** - Get TypeScript definitions

Get type-safe TypeScript function signatures for the specific tools you want to use in your code.

### 3. **execute-code** - Run your code

Execute TypeScript code that can call the tools and process results with custom logic.

## Example: Weather Severity Analysis

Instead of just calling `get_alerts`, you can write code to find and filter the most severe alerts:

```typescript
// Get weather alerts for North Carolina
const alerts = await get_alerts_weather_server({ state: 'NC' });
const alertsData = JSON.parse(alerts.content[0].text);

// Define severity hierarchy and find highest present
const severityHierarchy = ['Extreme', 'Severe', 'Moderate', 'Minor'];
let highestSeverityPresent = null;

for (const severity of severityHierarchy) {
  const hasThisSeverity = alertsData.features.some((alert) => alert.properties.severity === severity);
  if (hasThisSeverity) {
    highestSeverityPresent = severity;
    break;
  }
}

// Filter to only show alerts at the highest severity level
const mostSevereAlerts = alertsData.features.filter((alert) => alert.properties.severity === highestSeverityPresent);

return {
  totalAlerts: alertsData.features.length,
  highestSeverityLevel: highestSeverityPresent,
  mostSevereAlertsCount: mostSevereAlerts.length,
  summary: `Filtered ${alertsData.features.length} alerts to show only ${mostSevereAlerts.length} at "${highestSeverityPresent}" severity`,
};
```

## Multi-Server Support

CodeMesh works with multiple MCP servers simultaneously:

- **HTTP servers** (like our example server)
- **Stdio servers** (like weather-server, filesystem-server)
- **Third-party servers** (any compliant MCP server)

See `tmp/ultimate-multi-server-demo.ts` for an example using all three server types.

## Configuration

Edit `mcp-config.json` to add your MCP servers:

```json
{
  "servers": [
    {
      "id": "example-server",
      "type": "http",
      "url": "http://localhost:3000/mcp"
    },
    {
      "id": "weather-server",
      "type": "stdio",
      "command": ["node", "src/index.ts"],
      "cwd": "./packages/weather-server"
    }
  ]
}
```

## Why CodeMesh?

**Traditional MCP approach:**

- Agent calls individual tools one by one
- Context pollution with all available tools
- Difficult to implement complex logic
- Hard to correlate data across multiple calls

**CodeMesh approach:**

- Agent writes code that can call multiple tools
- Only loads APIs for tools actually needed
- Custom logic and data processing in TypeScript
- Intelligent analysis combining multiple data sources

Perfect for complex tasks that require more than simple tool calls! 🚀
