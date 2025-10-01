# CodeMesh MCP Implementation

> **Inspired by [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/)** - A "poor man's Code Mode" that executes TypeScript code against multiple MCP tools for advanced data processing and analysis.

## What is CodeMesh?

Instead of making individual tool calls, write TypeScript code that calls multiple MCP tools and processes their results intelligently:

- **Complex data analysis** - filtering, sorting, correlation
- **Multi-step workflows** - coordinate between multiple tools
- **Custom logic** - implement logic that's difficult with individual tool calls
- **Cross-server processing** - combine results from different MCP servers

## Quick Start

```bash
# Terminal 1: Start CodeMesh server
pnpm dev:codemesh-server

# Terminal 2: Use the three-step workflow
pnpm cli discover-tools                                  # Step 1: See what's available
pnpm cli get-tool-apis --tool-args-file tmp/args.json   # Step 2: Load TypeScript APIs
pnpm cli execute-code --code-file tmp/your-code.ts      # Step 3: Execute your code
```

## The Three-Step Workflow

1. **discover-tools** - See all available tools from configured MCP servers
2. **get-tool-apis** - Load type-safe TypeScript APIs for specific tools
3. **execute-code** - Run TypeScript code that calls tools and processes results

## Example: Weather Severity Analysis

Instead of just calling `get_alerts`, you can write code to find and filter the most severe alerts:

```typescript
// Get weather alerts for North Carolina
const alerts = await get_alerts_weather_server({ state: 'NC' })
const alertsData = JSON.parse(alerts.content[0].text)

// Define severity hierarchy and find highest present
const severityHierarchy = ['Extreme', 'Severe', 'Moderate', 'Minor']
let highestSeverityPresent = null

for (const severity of severityHierarchy) {
  const hasThisSeverity = alertsData.features.some((alert) => alert.properties.severity === severity)
  if (hasThisSeverity) {
    highestSeverityPresent = severity
    break
  }
}

// Filter to only show alerts at the highest severity level
const mostSevereAlerts = alertsData.features.filter((alert) => alert.properties.severity === highestSeverityPresent)

return {
  totalAlerts: alertsData.features.length,
  highestSeverityLevel: highestSeverityPresent,
  mostSevereAlertsCount: mostSevereAlerts.length,
  summary: `Filtered ${alertsData.features.length} alerts to show only ${mostSevereAlerts.length} at "${highestSeverityPresent}" severity`,
}
```

## Multi-Server Support

Works with HTTP, stdio, and third-party MCP servers simultaneously. See `tmp/ultimate-multi-server-demo.ts` for examples.

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

Traditional MCP clutters context with all tools and makes complex logic difficult. CodeMesh only loads needed APIs and enables intelligent multi-tool workflows in TypeScript.

Perfect for tasks that require more than simple tool calls! 🚀

## Features

- ✅ Multi-server coordination (HTTP + stdio + third-party)
- ✅ Context-efficient tiered discovery
- ✅ Type-safe TypeScript execution in VM2 sandbox
- ✅ Auto-augmentation system for self-improving documentation
- ✅ Secure authentication with environment variable substitution

Built with love for the [Anthropic MCP Hackathon](https://x.com/alexalbert__/status/1973071320025014306) 💙
