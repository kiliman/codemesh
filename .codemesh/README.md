# CodeMesh Configuration

This directory contains the configuration file for CodeMesh MCP server hosting.

## Configuration Format

CodeMesh uses a simple JSON configuration format compatible with most MCP server documentation:

```json
{
  "servers": [
    {
      "id": "server-name",
      "name": "Human Readable Name",
      "type": "stdio",
      "command": ["npx", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "your-key-here",
        "OTHER_VAR": "value"
      }
    }
  ]
}
```

## Configuration Fields

### Required Fields

- **id**: Unique identifier for the server (used in tool names)
- **name**: Human-readable name for the server
- **type**: Connection type - `"stdio"`, `"http"`, or `"websocket"`

### Stdio Servers

For local MCP servers that communicate via stdin/stdout:

```json
{
  "id": "weather-server",
  "name": "Weather Server",
  "type": "stdio",
  "command": ["tsx", "/path/to/server/index.ts"],
  "cwd": "/optional/working/directory",
  "env": {
    "API_KEY": "your-api-key",
    "DEBUG": "*"
  }
}
```

### HTTP Servers

For MCP servers accessible via HTTP/SSE:

```json
{
  "id": "remote-server",
  "name": "Remote Server",
  "type": "http",
  "url": "https://api.example.com/mcp"
}
```

### Authentication

CodeMesh supports authentication through environment variables in the `env` field.

#### Option 1: Environment Variable Substitution (Recommended ✅)

Use `${VAR}` syntax to reference environment variables. This keeps secrets out of your config files:

```json
{
  "id": "github-server",
  "name": "GitHub MCP Server",
  "type": "stdio",
  "command": ["npx", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

With default values if the variable is not set:

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN:-your-default-token}",
    "DEBUG": "${DEBUG:-false}"
  }
}
```

**Benefits:**
- ✅ Safe to commit to version control
- ✅ Works with Doppler, 1Password, or any environment variable manager
- ✅ Different values per environment (dev/staging/prod)

**Example with Doppler:**
```bash
# Set your environment variables via Doppler
doppler secrets set BRAVE_API_KEY=your-key-here

# Run codemesh server with Doppler
doppler run -- npx codemesh-server
```

#### Option 2: Direct Values (Not Recommended ⚠️)

You can also hardcode values directly, but this is **not recommended** for production:

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
  }
}
```

⚠️ **Warning:** Never commit API keys or secrets directly in config files!

## Example Configuration

See `config.json` in this directory for a working example with multiple servers.

## Copy & Paste from MCP Docs

Most MCP servers document their configuration in this format, so you can usually copy their examples directly into your `config.json` file. Just make sure to:

1. Add the `"id"`, `"name"`, and `"type"` fields if not present
2. Convert any `args` arrays into the `command` array (combine command + args)
3. Keep the `env` field as-is for authentication

For example, if an MCP server's docs show:

```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "{token}"
  }
}
```

Convert it to:

```json
{
  "id": "github",
  "name": "GitHub Server",
  "type": "stdio",
  "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "your-actual-token"
  }
}
```
