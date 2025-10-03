<div align="center">
  <img src="./assets/codemesh-logo.svg" alt="CodeMesh Logo" width="200" />
  <h1>CodeMesh</h1>
  <p><strong>Agents Write Code. Orchestrate Everything.</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/codemesh"><img src="https://img.shields.io/npm/v/codemesh?color=0ad7f9" alt="npm version" /></a>
    <a href="https://github.com/kiliman/codemesh/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?color=2dd4bf" alt="License" /></a>
    <a href="https://www.codemeshmcp.com"><img src="https://img.shields.io/badge/docs-codemeshmcp.com-34d399" alt="Documentation" /></a>
  </p>

  <p><em>The world's first self-improving MCP server</em></p>
</div>

## 📺 See It In Action

[![CodeMesh Demo](https://img.youtube.com/vi/kb6JkeiQXAM/maxresdefault.jpg)](https://www.youtube.com/watch?v=kb6JkeiQXAM)

**Watch:** How Agent A explores and documents, then Agent B one-shots the same task - **2.6x faster!**

📖 **Read the story:** [Building CodeMesh - From Idea to Self-Improving Intelligence](https://www.codemeshmcp.com/blog/building-codemesh)

## What is CodeMesh?

CodeMesh lets AI agents write **TypeScript code** to orchestrate **ANY MCP server**. One prompt. One code block. Multiple servers working together.

Instead of exposing dozens of individual tools, CodeMesh provides just **3 tools**:

1. **`discover-tools`** - See what's available (context-efficient overview)
2. **`get-tool-apis`** - Get TypeScript APIs for specific tools
3. **`execute-code`** - Execute TypeScript that calls multiple tools

### 🎉 The Innovation: Auto-Augmentation

When agents encounter unclear tool outputs, CodeMesh **forces documentation before proceeding**. This creates compound intelligence - each exploration helps ALL future agents.

**Proven:** Agent A explored and documented. Agent B one-shot the same task. **2.6x faster!** 🚀

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
  "logging": {
    "enabled": true,
    "level": "info",
    "logDir": ".codemesh/logs"
  },
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

#### Logging Configuration

Enable markdown-based file logging to track tool calls, code execution, and responses:

```json
{
  "logging": {
    "enabled": true,
    "level": "info",
    "logDir": ".codemesh/logs"
  }
}
```

**Options:**
- **`enabled`** (boolean) - Enable/disable file logging
- **`level`** ("debug" | "info" | "warn" | "error") - Minimum log level to record
- **`logDir`** (string) - Directory for log files (defaults to `.codemesh/logs`)

**Log Format:**

Logs are saved as markdown files (`.codemesh/logs/YYYY-MM-DD.md`) with syntax highlighting:

```markdown
## 14:52:45 - execute-code
**Duration:** 2.1s
**Status:** ✅ Success

### Request
` ``typescript
const alerts = await weatherServer.getAlerts({ state: 'CA' })
return alerts
` ``

### Console Output
` ``
Found 3 alerts
` ``

### Response
` ``json
{ "count": 3, "alerts": [...] }
` ``
```

Perfect for debugging, demo preparation, and understanding what CodeMesh is doing! 🎯

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

### ❌ The Problem

- **Traditional MCP:** Expose 50+ tools, flood agent context
- Agents can't coordinate tools from different servers
- Trial-and-error on unclear tool outputs wastes tokens
- Every agent repeats the same mistakes

### ✨ The CodeMesh Way

- **Just 3 tools:** discover, get APIs, execute code
- Agents write TypeScript calling multiple servers at once
- Auto-augmentation forces documentation of outputs
- **Knowledge compounds:** Agent A helps Agent B

### 🏆 Key Features

- 🧠 **Self-Improving** - Agents document unclear outputs, future agents benefit
- 🔗 **Multi-Server Orchestration** - Coordinate tools from different MCP servers in single code block (HTTP + stdio + websocket)
- 🎯 **Context Efficient** - Load only the tools you need, 3 tools vs 50+
- 🚀 **Zero Configuration** - Point to your MCP servers and go, works with ANY compliant MCP server
- ⚡ **Production Ready** - Type-safe TypeScript execution in VM2 sandbox, authentication, error handling
- 🔒 **Secure by Default** - Environment variable substitution, principle of least privilege

## Best Practices

### Use Subagents for Maximum Context Efficiency

While CodeMesh is context-efficient internally (tiered discovery prevents tool pollution), **we strongly recommend spawning a subagent** to execute CodeMesh operations. This keeps your main agent's context clean while CodeMesh does the heavy lifting.

**Example with Claude Code:**

```
User: "Analyze the weather data and file structure for my project"
Main Agent: Let me spawn a subagent to handle this task...
```

Main agent uses the Task tool to spawn a codemesh subagent with the prompt: "Use CodeMesh to analyze weather alerts for NC and correlate with local file timestamps"

**Benefits:**
- 🧹 Main context stays clean
- ⚡ Subagent can iterate on CodeMesh without polluting parent
- 🎯 Specialized subagent focused solely on orchestration
- 📦 Results summarized back to main agent when complete

**When NOT to use subagents:**
- Simple single-tool calls (just use the tool directly)
- When you need tight integration with main conversation flow

See [`examples/codemesh-agent.md`](./examples/codemesh-agent.md) for a ready-to-use Claude Code agent configuration.

## Contributing

Want to contribute to CodeMesh development? See [CONTRIBUTING.md](./CONTRIBUTING.md) for developer setup, architecture details, and development workflows.

---

<div align="center">

![Built with Sonnet 4.5](./assets/built-with-sonnet-4_5.jpg)

**From Claudia, with Love ❤️**

_Built with [Claude Code](https://claude.com/claude-code) using Sonnet 4.5 for the [Anthropic MCP Hackathon](https://x.com/alexalbert__/status/1973071320025014306)_

**[🌐 Website](https://www.codemeshmcp.com)** • **[📖 Blog](https://www.codemeshmcp.com/blog/building-codemesh)** • **[📦 NPM](https://www.npmjs.com/package/codemesh)** • **[📺 Demo Video](https://www.youtube.com/watch?v=kb6JkeiQXAM)**

</div>
