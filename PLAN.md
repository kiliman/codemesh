# CodeMode MCP Server Implementation Plan

## Overview
Create a single MCP server that accepts TypeScript code and executes it against available tools/APIs, inspired by Cloudflare's Code Mode approach.

## Architecture

### Core Components

#### 1. CodeMode MCP Server (`packages/codemode-server/`)
- **Single MCP Tool**: `execute-code`
- **Input**: TypeScript code as string
- **Output**: Execution results with proper error handling
- **Runtime**: Node.js with TypeScript compilation/execution

#### 2. Tool Registry & API Generation
- **Tool Discovery**: Scan available MCP servers and extract their tools
- **Type Generation**: Generate TypeScript definitions for all available tools
- **API Wrapper**: Create importable modules that proxy calls to actual MCP tools

#### 3. Code Execution Engine
- **TypeScript Compiler**: Compile provided code on-the-fly
- **Sandbox Environment**: Safe execution context with limited capabilities
- **Import Resolution**: Handle imports of generated API modules
- **Result Serialization**: Convert execution results back to MCP format

#### 4. Example Target Server (already exists)
- **Current server**: Keep as-is for testing
- **Tools**: greet, multi-greet, collect-user-info, etc.
- **Will be exposed via**: Generated TypeScript API

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Create codemode-server package structure**
   - `packages/codemode-server/index.ts` - Main MCP server
   - `packages/codemode-server/package.json` - Dependencies
   - `packages/codemode-server/tsconfig.json` - TypeScript config

2. **Basic MCP Server Setup**
   - Register single `execute-code` tool
   - Accept TypeScript code as input parameter
   - Basic execution framework

### Phase 2: Tool Discovery & Type Generation
3. **MCP Server Discovery**
   - Connect to existing MCP servers (our example server)
   - Fetch available tools via `tools/list`
   - Extract tool schemas and descriptions

4. **TypeScript Type Generation**
   - Convert tool input schemas to TypeScript interfaces
   - Generate function signatures for each tool
   - Create importable module definitions

5. **API Module Generation**
   - Create runtime API that proxies to actual MCP tools
   - Handle async tool calls
   - Proper error handling and type safety

### Phase 3: Code Execution
6. **TypeScript Compilation**
   - Set up in-memory TypeScript compiler
   - Support for generated type definitions
   - Handle import resolution for API modules

7. **Safe Execution Environment**
   - VM-based sandbox for code execution
   - Limited API surface (no file system, network, etc.)
   - Timeout and resource limits

8. **Result Handling**
   - Capture execution results
   - Format for MCP response
   - Error reporting with stack traces

### Phase 4: Integration & Testing
9. **Client Integration**
   - Update existing client to connect to codemode server
   - Test with generated TypeScript code
   - Verify tool proxying works correctly

10. **End-to-End Testing**
    - Test complex multi-tool scenarios
    - Verify type safety and error handling
    - Performance optimization

## Key Dependencies
- `typescript` - For code compilation
- `vm2` or `isolated-vm` - For safe code execution
- `json-schema-to-typescript` - For type generation
- `@modelcontextprotocol/sdk` - MCP protocol

## Example Usage

### Input (to codemode server):
```typescript
import { tools } from './api';

const greeting = await tools.greet({ name: 'Michael' });
const info = await tools.collectUserInfo({ infoType: 'contact' });

return {
  greeting: greeting.content[0].text,
  infoCollected: info.content[0].text
};
```

### Generated API (`./api.ts`):
```typescript
export const tools = {
  greet: async (params: { name: string }) => {
    // Proxy call to actual MCP server
  },
  collectUserInfo: async (params: { infoType: 'contact' | 'preferences' | 'feedback' }) => {
    // Proxy call to actual MCP server
  }
};
```

## Success Criteria
- ✅ Single MCP tool that accepts TypeScript code
- ✅ Auto-generated TypeScript APIs for discovered tools
- ✅ Safe code execution with proper error handling
- ✅ Type-safe tool interactions
- ✅ Seamless integration with existing MCP ecosystem

## Future Enhancements
- Multiple MCP server discovery
- Caching of compiled code
- Enhanced security sandbox
- Streaming execution results
- Code validation and linting