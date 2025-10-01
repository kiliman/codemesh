# exampleServer.greet

## Output Format

The tool returns a JSON response with a single `content` array containing a text greeting.

### Fields

- **content**: Array of content objects (array)
  - **type**: Always "text" (string)
  - **text**: The greeting message (string)

### Example Output

```json
{
  "content": [
    {
      "type": "text",
      "text": "Hello, Claudia! Welcome to the example MCP server."
    }
  ]
}
```

### Parsing Example

```typescript
const result = await exampleServer.greet({ name: "Claudia" });
const greeting = result.content[0].text;
console.log(greeting); // "Hello, Claudia! Welcome to the example MCP server."
```
