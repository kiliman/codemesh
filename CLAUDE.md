# CodeMesh MCP Server

CodeMesh is a "Code Mode" MCP server that executes TypeScript code against multiple MCP tools. Think of it as a universal adapter that lets agents write code to orchestrate ANY MCP server.

## 🎯 Core Concept

Instead of exposing individual MCP tools, CodeMesh provides:

1. **`discover-tools`** - See what's available (context-efficient overview)
2. **`get-tool-apis`** - Get TypeScript APIs for specific tools
3. **`execute-code`** - Execute TypeScript that calls multiple tools
4. **`add-augmentation`** - Document unclear outputs (self-improving!)

## 🏗️ Project Structure

```
packages/
├── codemesh-server/    # Main CodeMesh MCP server
├── client/             # CLI for testing
├── example-server/     # Demo HTTP server
├── weather-server/     # Demo stdio server
└── geocode-server/     # Demo stdio server
```

## 🚀 Key Features

### Multi-Server Support

- ✅ HTTP, stdio, and websocket transports
- ✅ Connect to multiple servers simultaneously
- ✅ Execute code that calls tools from different servers
- ✅ Works with any MCP-compliant server

### Context Efficiency

- ✅ Tiered discovery prevents context pollution
- ✅ Load only the tool APIs you need
- ✅ Single execute-code tool vs dozens of individual tools

### Self-Improving Architecture 🎉

- ✅ **Auto-augmentation**: Agents document unclear outputs
- ✅ **`// EXPLORING` comment**: Triggers mandatory documentation workflow
- ✅ **Nuclear option**: Returns ERROR until augmentation created
- ✅ **Proven effective**: Agent B one-shotted what Agent A struggled with!
- ✅ Knowledge compounds: Each exploration helps future agents

### Security

- ✅ MCP SDK compliant env var handling
- ✅ Environment variable substitution: `${VAR:-default}`
- ✅ Principle of least privilege
- ✅ Safe to commit configs (use env vars for secrets)

## 📝 Auto-Augmentation Workflow

**The Problem**: Agents trial-and-error unclear tool outputs instead of documenting them.

**The Solution**: Make exploration without documentation an ERROR!

### How It Works

1. **Agent explores** with `// EXPLORING` comment:

   ```typescript
   // EXPLORING: checking output format
   const result = await filesystemServer.getFileInfo({ path: 'test.txt' })
   console.log(result)
   ```

2. **CodeMesh returns ERROR** with output + mandatory instructions

3. **Agent creates augmentation** using `add-augmentation`:
   - Output format description
   - Field documentation
   - Example output
   - Parsing code

4. **Future agents benefit** via enhanced JSDoc in `get-tool-apis`

### Validation

- **Agent A**: Used `// EXPLORING`, forced to create 2 augmentations
- **Agent B**: Same task, one-shot success using A's docs
- **Result**: PROVEN self-improving system! 🎉

## 🔧 Development Commands

```bash
# Build
pnpm build

# Run codemesh server (stdio)
npx tsx packages/codemesh-server/src/index.ts

# Test with client
npx tsx packages/client/index.ts --stdio npx tsx packages/codemesh-server/src/index.ts --call-tool discover-tools
```

## 📁 Key Files

- `.codemesh/config.json` - MCP server configuration
- `.codemesh/*.md` - Tool augmentation docs (self-improving!)
- `packages/codemesh-server/src/index.ts` - Main tools
- `packages/codemesh-server/src/codeExecutor.ts` - Code execution + exploration detection
- `packages/codemesh-server/src/typeGenerator.ts` - TypeScript type generation
- `packages/codemesh-server/src/config.ts` - Configuration with env var substitution

## 💡 Usage Example

```typescript
// 1. Discover available tools
discover - tools()

// 2. Get TypeScript APIs for specific tools
get -
  tool -
  apis({
    toolNames: ['filesystemServer.directoryTree', 'filesystemServer.getFileInfo'],
  })

// 3. Execute TypeScript code
execute -
  code({
    code: `
    const tree = await filesystemServer.directoryTree({ path: "/project" });
    const files = JSON.parse(tree.content[0].text);
    return files.length;
  `,
  })
```

## 🎖️ What Makes CodeMesh Special

1. **Context Efficient**: Load only what you need vs flooding context with all tools
2. **Multi-Server**: Coordinate tools from different MCP servers in single code block
3. **Self-Improving**: Agents document unclear outputs, helping all future agents
4. **Battle-Tested**: Fresh Claude sessions one-shot tasks using augmentations
5. **Production Ready**: Authentication, security, error handling all complete

## 🏆 Competition Notes

CodeMesh was built for the Anthropic MCP Hackathon. Key innovations:

- **Novel approach**: "Code Mode" pattern for MCP (inspired by Cloudflare)
- **Self-improving**: Auto-augmentation via forced documentation (no one else has this!)
- **Validated**: Agent A documents → Agent B succeeds (proven compound intelligence)
- **Production ready**: Multi-server, auth, security all working

**Title**: "From Claudia, with Love ❤️" - Built with help from Claude Code using Sonnet 4.5

---

## Important Notes for Future Claude Sessions

- **Config location**: `.codemesh/config.json` (not `mcp-config.json`)
- **Augmentation files**: `.codemesh/{serverId}.md`
- **Exploration trigger**: `// EXPLORING` comment in code
- **Nuclear option**: Returns ERROR to force augmentation (this is intentional!)
- **Testing**: Use `npx tsx packages/client/index.ts --stdio npx tsx packages/codemesh-server/src/index.ts`
