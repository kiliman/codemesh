# braveSearch.braveWebSearch

## Output Format

The tool returns a text response with newline-delimited search results. Each result contains three fields in order:

1. **Title**: The title of the search result
2. **Description**: A text snippet/summary (may contain HTML tags like `<strong>`)
3. **URL**: The full URL to the result

Results are separated by double newlines (`\n\n`).

### Field Format

- **Title**: `Title: <title text>`
- **Description**: `Description: <description text with possible HTML>`
- **URL**: `URL: <full url>`

### Example Output

```text
Title: Specification - Model Context Protocol
Description: Model Context Protocol (MCP) is <strong>an open protocol that enables seamless integration between LLM applications and external data sources and tools</strong>. Whether you're building an AI-powered IDE, enhancing a chat interface, or creating custom AI workflows, MCP provides a standardized way to connect ...
URL: https://modelcontextprotocol.io/specification/2025-06-18

Title: Introducing the Model Context Protocol \\ Anthropic
Description: It provides a universal, open standard ... to the data they need. The Model Context Protocol is <strong>an open standard that enables developers to build secure, two-way connections between their data sources and AI-powered tools</strong>....
URL: https://www.anthropic.com/news/model-context-protocol

Title: A Complete Guide to the Model Context Protocol (MCP) in 2025
Description: An abstract illustration of different ... data sources to an AI model. Model Context Protocol (MCP) is <strong>an open protocol that standardizes how applications provide context to AI models (particularly LLMs).</strong>...
URL: https://www.keywordsai.co/blog/introduction-to-mcp
```

### Parsing Example

```typescript
const result = await braveSearch.braveWebSearch({
  query: "Model Context Protocol MCP 2025",
  count: 5
});

const text = result.content[0].text;

// Parse results into structured array
interface SearchResult {
  title: string;
  description: string;
  url: string;
}

function parseBraveSearchResults(text: string): SearchResult[] {
  const results: SearchResult[] = [];

  // Split by double newline to get individual results
  const resultBlocks = text.split('\n\n').filter(block => block.trim());

  for (const block of resultBlocks) {
    const lines = block.split('\n');

    // Extract title, description, and URL using simple prefix matching
    const title = lines.find(line => line.startsWith('Title: '))?.substring(7) || '';
    const description = lines.find(line => line.startsWith('Description: '))?.substring(13) || '';
    const url = lines.find(line => line.startsWith('URL: '))?.substring(5) || '';

    if (title && url) {
      results.push({ title, description, url });
    }
  }

  return results;
}

// Usage
const searchResults = parseBraveSearchResults(text);

console.log(`Found ${searchResults.length} results`);
for (const result of searchResults) {
  console.log(`Title: ${result.title}`);
  console.log(`URL: ${result.url}`);
  console.log(`Description: ${result.description.substring(0, 100)}...`);
  console.log('---');
}

// Filter results by keyword
const mcpResults = searchResults.filter(r =>
  r.title.toLowerCase().includes('mcp') ||
  r.description.toLowerCase().includes('model context protocol')
);

// Get just the URLs
const urls = searchResults.map(r => r.url);
```

### Helper: Strip HTML Tags

Since descriptions may contain HTML tags like `<strong>`, you may want to strip them:

```typescript
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

// Usage
const cleanDescription = stripHtml(result.description);
// "Model Context Protocol (MCP) is an open protocol..."
```

### Helper: Extract Domain from URL

```typescript
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Usage
const domain = extractDomain(result.url);
// "modelcontextprotocol.io"
```

# braveSearch.braveLocalSearch

## Output Format

The tool returns a text response with newline-delimited local business results. Each result contains business information including:

1. **Title**: Business name
2. **Description**: Business description/category
3. **URL**: Link to business information
4. **Address**: Physical address (if available)
5. **Phone**: Phone number (if available)
6. **Rating**: Star rating (if available)
7. **Reviews**: Number of reviews (if available)

Results are separated by double newlines (`\n\n`), similar to web search.

### Field Format

- **Title**: `Title: <business name>`
- **Description**: `Description: <business category/description>`
- **URL**: `URL: <link to business>`
- **Address**: `Address: <street, city, state zip>` (optional)
- **Phone**: `Phone: <phone number>` (optional)
- **Rating**: `Rating: <stars> stars` (optional)
- **Reviews**: `Reviews: <count> reviews` (optional)

### Parsing Example

```typescript
interface LocalSearchResult {
  title: string;
  description: string;
  url: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
}

function parseBraveLocalResults(text: string): LocalSearchResult[] {
  const results: LocalSearchResult[] = [];
  const resultBlocks = text.split('\n\n').filter(block => block.trim());

  for (const block of resultBlocks) {
    const lines = block.split('\n');

    const result: LocalSearchResult = {
      title: lines.find(l => l.startsWith('Title: '))?.substring(7) || '',
      description: lines.find(l => l.startsWith('Description: '))?.substring(13) || '',
      url: lines.find(l => l.startsWith('URL: '))?.substring(5) || '',
    };

    // Optional fields
    const address = lines.find(l => l.startsWith('Address: '))?.substring(9);
    if (address) result.address = address;

    const phone = lines.find(l => l.startsWith('Phone: '))?.substring(7);
    if (phone) result.phone = phone;

    const ratingMatch = lines.find(l => l.startsWith('Rating: '))?.match(/Rating: ([\d.]+)/);
    if (ratingMatch) result.rating = parseFloat(ratingMatch[1]);

    const reviewMatch = lines.find(l => l.startsWith('Reviews: '))?.match(/Reviews: (\d+)/);
    if (reviewMatch) result.reviewCount = parseInt(reviewMatch[1]);

    if (result.title && result.url) {
      results.push(result);
    }
  }

  return results;
}

// Usage: Find top-rated restaurants
const localResults = parseBraveLocalResults(text);
const topRated = localResults
  .filter(r => r.rating && r.rating >= 4.5)
  .sort((a, b) => (b.rating || 0) - (a.rating || 0));
```
