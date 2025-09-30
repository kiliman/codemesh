# filesystemServer.getFileInfo

## Output Format

The tool returns a text response with newline-delimited key-value pairs in the format `key: value`.

### Fields

- **size**: File size in bytes (number)
- **created**: File creation timestamp (ISO date string)
- **modified**: File last modified timestamp (ISO date string)
- **accessed**: File last accessed timestamp (ISO date string)
- **isDirectory**: Boolean indicating if path is a directory (boolean)
- **isFile**: Boolean indicating if path is a file (boolean)
- **permissions**: Unix file permissions in octal notation (string, e.g., "644")

### Example Output

```text
size: 38075
created: Tue Sep 30 2025 10:52:47 GMT-0400 (Eastern Daylight Time)
modified: Tue Sep 30 2025 10:52:47 GMT-0400 (Eastern Daylight Time)
accessed: Tue Sep 30 2025 10:55:07 GMT-0400 (Eastern Daylight Time)
isDirectory: false
isFile: true
permissions: 644
```

### Parsing Example

```typescript
const result = await filesystemServer.getFileInfo({ path: "index.ts" });
const text = result.content[0].text;
const fileInfo = Object.fromEntries(
  text.split('\n').map(line => {
    const [key, ...valueParts] = line.split(': ');
    return [key, valueParts.join(': ')];
  })
);
console.log(fileInfo.size); // "38075"
console.log(fileInfo.permissions); // "644"
```

# filesystemServer.listDirectoryWithSizes

## Output Format

The tool returns a text response with newline-delimited entries. Each line represents a file or directory with the format:
- `[DIR] name` for directories (no size shown)
- `[FILE] name    size` for files (size is right-aligned with human-readable format)

The output ends with summary statistics:
- Total count of files and directories
- Combined size of all files

### Entry Format

- **[DIR]**: Prefix indicating a directory
- **[FILE]**: Prefix indicating a file
- **name**: Name of the file or directory (left-aligned, padded to ~40 characters)
- **size**: Human-readable file size (e.g., "37.18 KB", "4.21 KB", "608 B")

### Summary Format

After the entries, two lines provide totals:
1. `Total: X files, Y directories`
2. `Combined size: Z` (human-readable total size)

### Example Output

```text
[DIR] .codemesh
[DIR] dist
[FILE] index.ts                         37.18 KB
[DIR] node_modules
[FILE] package-lock.json                 4.21 KB
[FILE] package.json                        608 B
[DIR] tmp
[FILE] tsconfig.json                       407 B

Total: 4 files, 4 directories
Combined size: 42.38 KB
```

### Parsing Example

```typescript
// Helper function to convert human-readable size to bytes
function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
  if (!match) return 0;

  const [, value, unit] = match;
  const num = parseFloat(value);

  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 ** 2,
    'GB': 1024 ** 3,
    'TB': 1024 ** 4,
  };

  return Math.round(num * (multipliers[unit.toUpperCase()] || 1));
}

const result = await filesystemServer.listDirectoryWithSizes({ path: "." });
const text = result.content[0].text;
const lines = text.split('\n');

// Parse entries (skip summary lines at the end)
const entries = lines
  .filter(line => line.startsWith('[DIR]') || line.startsWith('[FILE]'))
  .map(line => {
    const isDir = line.startsWith('[DIR]');
    const parts = line.substring(6).trim().split(/\s+/);
    const name = parts[0];
    const sizeStr = isDir ? null : parts.slice(1).join(' ');
    const sizeBytes = sizeStr ? parseSize(sizeStr) : null;
    return { name, isDir, size: sizeStr, sizeBytes };
  });

// Parse summary
const totalLine = lines.find(line => line.startsWith('Total:'));
const sizeLine = lines.find(line => line.startsWith('Combined size:'));
const [filesCount, dirsCount] = totalLine?.match(/(\d+) files?, (\d+) directories/)?.slice(1) || [];
const totalSizeStr = sizeLine?.split(': ')[1];
const totalSizeBytes = totalSizeStr ? parseSize(totalSizeStr) : 0;

console.log(`Found ${filesCount} files and ${dirsCount} directories`);
console.log(`Total size: ${totalSizeStr} (${totalSizeBytes} bytes)`);
console.log('Files:', entries.filter(e => !e.isDir));
```

# filesystemServer.directoryTree

## Output Format

The tool returns a JSON array as a text string. Each element in the array represents a file or directory in the specified path. The JSON is formatted with 2-space indentation for readability.

### Entry Structure

Each entry is an object with the following properties:

- **name** (string): The name of the file or directory
- **type** (string): Either `"file"` or `"directory"`
- **children** (array, optional): Only present for directories. Contains child entries in the same structure. Empty array `[]` for empty directories. Files never have a `children` property.

The structure is recursive - directories contain children arrays which may themselves contain directories with children.

### Example Output

```json
[
  {
    "name": ".codemesh",
    "type": "directory",
    "children": [
      {
        "name": "config.json",
        "type": "file"
      },
      {
        "name": "filesystem-server.md",
        "type": "file"
      }
    ]
  },
  {
    "name": "index.ts",
    "type": "file"
  },
  {
    "name": "dist",
    "type": "directory",
    "children": [
      {
        "name": "index.js",
        "type": "file"
      }
    ]
  }
]
```

### Parsing Example

```typescript
interface TreeEntry {
  name: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

const result = await filesystemServer.directoryTree({ path: "." });
const text = result.content[0].text;
const tree: TreeEntry[] = JSON.parse(text);

// Recursive function to count files and directories
function countEntries(entries: TreeEntry[]): { files: number; dirs: number } {
  let files = 0;
  let dirs = 0;

  for (const entry of entries) {
    if (entry.type === 'file') {
      files++;
    } else if (entry.type === 'directory') {
      dirs++;
      if (entry.children) {
        const childCounts = countEntries(entry.children);
        files += childCounts.files;
        dirs += childCounts.dirs;
      }
    }
  }

  return { files, dirs };
}

// Recursive function to find all files matching a pattern
function findFiles(entries: TreeEntry[], pattern: RegExp, path = ''): string[] {
  const matches: string[] = [];

  for (const entry of entries) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.type === 'file' && pattern.test(entry.name)) {
      matches.push(fullPath);
    } else if (entry.type === 'directory' && entry.children) {
      matches.push(...findFiles(entry.children, pattern, fullPath));
    }
  }

  return matches;
}

const counts = countEntries(tree);
console.log(`Total: ${counts.files} files, ${counts.dirs} directories`);

const tsFiles = findFiles(tree, /\.ts$/);
console.log('TypeScript files:', tsFiles);
```