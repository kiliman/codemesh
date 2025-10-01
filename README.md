<div align="center">
  <img src="./assets/codemesh-logo.svg" alt="CodeMesh Logo" width="200" />
  <h1>CodeMesh MCP Server</h1>
  <p><strong>Agents Write Code. Orchestrate Everything.</strong></p>
</div>

> **Inspired by [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/)** - Execute TypeScript code against multiple MCP tools for advanced data processing and analysis.

## What is CodeMesh?

CodeMesh is an intelligent MCP server that **automatically writes and executes TypeScript code** to orchestrate multiple MCP tools. Just give it a natural language prompt, and CodeMesh:

- **Discovers** available tools from your configured MCP servers
- **Loads** type-safe APIs for the tools it needs
- **Writes** TypeScript code to accomplish your task
- **Executes** the code with intelligent data processing
- **Self-improves** by documenting unclear outputs for future runs

**The magic**: When CodeMesh encounters unclear tool outputs, it enters EXPLORATION mode, figures out the format, documents it, and saves that knowledge. The next agent benefits immediately - **CodeMesh gets smarter with every run!**

## Installation

### 1. Add CodeMesh to Claude Desktop

```bash
claude mcp add codemesh npx -y codemesh
```

Or manually add to your Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "codemesh": {
      "command": "npx",
      "args": ["-y", "codemesh"]
    }
  }
}
```

### 2. Create Configuration

Create a `.codemesh/config.json` file in your project directory to configure which MCP servers CodeMesh should connect to:

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "File System",
      "type": "stdio",
      "command": ["npx", "@modelcontextprotocol/server-filesystem", "/path/to/directory"],
      "timeout": 30000
    },
    {
      "id": "brave-search",
      "name": "Brave Search",
      "type": "stdio",
      "command": ["npx", "-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    },
    {
      "id": "weather",
      "name": "Weather Server",
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  ]
}
```

#### Server Configuration Options

Each server entry supports:

- **`id`** (required) - Unique identifier for the server
- **`name`** (required) - Human-readable name
- **`type`** (required) - Server type: `"stdio"`, `"http"`, or `"websocket"`
- **`command`** (stdio only) - Command array to start the server
- **`cwd`** (stdio only) - Working directory for the command
- **`url`** (http/websocket only) - Server URL
- **`env`** (optional) - Environment variables for the server
- **`timeout`** (optional) - Connection timeout in milliseconds

#### Environment Variable Substitution

Use `${VAR}` or `${VAR:-default}` syntax in your config for secure credential management:

```json
{
  "env": {
    "API_KEY": "${MY_API_KEY}",
    "ENDPOINT": "${API_ENDPOINT:-https://default.api.com}"
  }
}
```

This works with any environment variable manager (Doppler, 1Password, etc.) and keeps your config safe to commit.

## How It Works

CodeMesh uses an **intelligent three-step workflow** that happens automatically when you give it a prompt:

### Example: Real-World Usage

You ask Claude:

> _"Use CodeMesh to give me the top 3 weather alerts for Moyock, NC"_

**Behind the scenes, CodeMesh automatically:**

1. **Discovers Tools** (`discover-tools`)
   - Sees `geocode` tool (to convert "Moyock, NC" to coordinates)
   - Sees `getAlerts` tool from weather server
   - Context-efficient: only shows tool names and descriptions

2. **Loads APIs** (`get-tool-apis`)
   - Requests TypeScript function signatures for `geocode` and `getAlerts`
   - Generates type-safe APIs: `geocodeServer.geocode({ location })` and `weatherServer.getAlerts({ state })`
   - Includes any existing augmentation documentation from previous runs

3. **Writes & Executes Code** (`execute-code`)
   - CodeMesh writes TypeScript code that:
     - Calls `geocodeServer.geocode` to get coordinates
     - Calls `weatherServer.getAlerts` with the state
     - Parses results and filters to top 3 by severity
   - Executes in secure VM2 sandbox (30s timeout)
   - Returns formatted results

### Self-Improving Intelligence (Auto-Augmentation)

**The Problem**: Most MCP servers don't document their output formats. Is it JSON? Plain text? Key-value pairs? Arrays?

**CodeMesh's Solution**: When the agent struggles to parse output, it automatically:

1. **Enters EXPLORATION Mode**
   - Adds `// EXPLORING` comment to the code
   - Calls the tool to examine actual output structure
   - Figures out: Is it JSON? What fields exist? What's the structure?

2. **Gets Blocked by Design**
   - CodeMesh returns an ERROR (not success) for exploration mode
   - Forces the agent to document before proceeding
   - "You cannot parse until you create augmentation!"

3. **Creates Augmentation** (`add-augmentation`)
   - Agent writes markdown documentation with:
     - Output format description
     - Field definitions
     - Example output (actual data from exploration)
     - **Working parsing code** (TypeScript examples)
   - Saves to `.codemesh/[server-id].md`

4. **Enhanced for Next Time**
   - Next `get-tool-apis` call includes augmentation in JSDoc
   - Future agents see the parsing examples and data structure
   - **One-shot success** - no trial-and-error needed!

**Result**: Agent A struggles and documents. Agent B one-shots it. Agent C one-shots it. **Compound intelligence!**

## Example: What CodeMesh Writes For You

**Your prompt:**

> _"Find the 3 most severe weather alerts in North Carolina"_

**CodeMesh automatically writes:**

```typescript
// Step 1: Fetch weather alerts
const alerts = await get_alerts_weather_server({ state: 'NC' })
const alertsData = JSON.parse(alerts.content[0].text)

// Step 2: Define severity hierarchy
const severityHierarchy = ['Extreme', 'Severe', 'Moderate', 'Minor']
const highestSeverity = severityHierarchy.find((severity) =>
  alertsData.features.some((alert) => alert.properties.severity === severity),
)

// Step 3: Filter and return top 3
const topAlerts = alertsData.features.filter((alert) => alert.properties.severity === highestSeverity).slice(0, 3)

return {
  count: topAlerts.length,
  severity: highestSeverity,
  alerts: topAlerts,
}
```

**You get intelligent results** - no manual tool calls, no trial-and-error, just results!

## Why CodeMesh?

| Traditional MCP          | CodeMesh                                     |
| ------------------------ | -------------------------------------------- |
| All tools loaded upfront | Discovers, then loads only what's needed     |
| Context pollution        | Context-efficient tiered discovery           |
| One tool call at a time  | Multi-tool orchestration in single execution |
| Manual data processing   | Intelligent filtering, sorting, correlation  |
| Static documentation     | Self-improving augmentation system           |
| Trial-and-error parsing  | One-shot success after first exploration     |

**Perfect for**: Complex tasks requiring coordination, filtering, correlation, or custom logic across multiple MCP servers! 🚀

## Features

- ✅ Multi-server coordination (HTTP + stdio + websocket)
- ✅ Context-efficient tiered discovery (no tool pollution)
- ✅ Type-safe TypeScript execution in VM2 sandbox
- ✅ Auto-augmentation system (self-improving documentation)
- ✅ Secure authentication with environment variable substitution
- ✅ Works with any compliant MCP server

## Contributing

Want to contribute to CodeMesh development? See [CONTRIBUTING.md](./CONTRIBUTING.md) for developer setup, architecture details, and development workflows.

---

<div align="center">

![Built with Sonnet 4.5](./assets/built-with-sonnet-4_5.jpg)

Built with love for the [Anthropic MCP Hackathon](https://x.com/alexalbert__/status/1973071320025014306) 💙

</div>
