# CodeMesh

> Weave together multiple MCP servers into powerful TypeScript workflows

**CodeMesh** is an MCP (Model Context Protocol) server that executes TypeScript code against multiple discovered MCP tools. Instead of cluttering your agent's context with dozens of individual tools, CodeMesh provides a clean 3-step workflow for intelligent multi-server orchestration.

## Installation

```bash
npm install -g codemesh
```

## Quick Start

1. **Create configuration** - Create `.codemesh/config.json` in your project:

```json
{
  "servers": [
    {
      "id": "weather-server",
      "name": "Weather Server",
      "type": "stdio",
      "command": ["npx", "@modelcontextprotocol/server-weather"]
    }
  ]
}
```

2. **Add to Claude Desktop** - Add CodeMesh to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codemesh": {
      "command": "npx",
      "args": ["codemesh"]
    }
  }
}
```

3. **Use the 3-step workflow:**
   - **Step 1**: `discover-tools` - See what's available
   - **Step 2**: `get-tool-apis` - Get TypeScript definitions
   - **Step 3**: `execute-code` - Run your code

## Why CodeMesh?

### Traditional MCP Approach
- ❌ Agent sees 50+ individual tools
- ❌ Context pollution
- ❌ Difficult to coordinate multi-tool workflows
- ❌ Limited data processing capabilities

### CodeMesh Approach
- ✅ Agent sees 3 clean steps
- ✅ Context-efficient tiered discovery
- ✅ Seamless multi-server coordination
- ✅ Full TypeScript for data processing

## Example

```typescript
// Get weather alerts and filter by severity
const alerts = await weatherServer.getAlerts({ state: 'NC' });
const alertsData = JSON.parse(alerts.content[0].text);

// Find highest severity
const severityHierarchy = ['Extreme', 'Severe', 'Moderate', 'Minor'];
const highestSeverity = severityHierarchy.find(severity =>
  alertsData.features.some(alert => alert.properties.severity === severity)
);

// Return filtered results
return {
  total: alertsData.features.length,
  highestSeverity,
  critical: alertsData.features.filter(
    alert => alert.properties.severity === highestSeverity
  ).length
};
```

## Features

- 🕸️ **Multi-Server Orchestration** - Coordinate HTTP, stdio, and websocket servers
- 📝 **TypeScript Execution** - Write type-safe code with full IDE support
- 🎨 **Intelligent Composition** - Combine and process data from multiple sources
- ⚡ **Context-Efficient** - Tiered discovery prevents context pollution
- 🔌 **Universal Compatibility** - Works with any compliant MCP server

## Configuration

The `.codemesh/config.json` file supports:

- **HTTP servers**: `{ "type": "http", "url": "http://..." }`
- **Stdio servers**: `{ "type": "stdio", "command": ["node", "server.js"] }`
- **WebSocket servers**: `{ "type": "websocket", "url": "ws://..." }`

See [full documentation](https://github.com/yourusername/codemesh) for details.

## License

ISC

## Links

- [GitHub](https://github.com/yourusername/codemesh)
- [Issues](https://github.com/yourusername/codemesh/issues)
- [MCP Documentation](https://modelcontextprotocol.io)