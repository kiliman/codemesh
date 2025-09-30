import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from './logger.js';
import { createServerObjectName } from './utils.js';

/**
 * Tool augmentation from markdown documentation
 */
export interface ToolAugmentation {
  toolName: string; // e.g., "getFileInfo"
  serverObjectName: string; // e.g., "filesystemServer"
  documentation: string; // Raw markdown content for this tool
}

/**
 * Parse markdown file and extract tool-specific augmentations
 */
function parseMarkdownAugmentations(markdown: string, serverObjectName: string): ToolAugmentation[] {
  const augmentations: ToolAugmentation[] = [];

  // Split by H1 headers (# serverObject.methodName)
  const sections = markdown.split(/^# /m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0].trim();

    // Check if header matches pattern: serverObject.methodName
    const match = header.match(/^(\w+)\.(\w+)/);
    if (!match) {
      logger.warn(`Skipping augmentation section with invalid header: ${header}`);
      continue;
    }

    const [, serverObj, methodName] = match;

    // Verify it matches the expected server object name
    if (serverObj !== serverObjectName) {
      logger.warn(
        `Skipping augmentation for ${serverObj}.${methodName} - doesn't match server ${serverObjectName}`,
      );
      continue;
    }

    // Get the rest of the markdown (everything after the H1)
    const documentation = lines.slice(1).join('\n').trim();

    augmentations.push({
      toolName: methodName,
      serverObjectName,
      documentation,
    });

    logger.log(`Loaded augmentation for ${serverObj}.${methodName}`);
  }

  return augmentations;
}

/**
 * Load tool augmentations from .codemesh directory
 */
export function loadAugmentations(codemeshDir: string): Map<string, ToolAugmentation> {
  const augmentationMap = new Map<string, ToolAugmentation>();

  // Check if .codemesh directory exists
  if (!fs.existsSync(codemeshDir)) {
    logger.log(`No .codemesh directory found at ${codemeshDir}`);
    return augmentationMap;
  }

  logger.log(`Loading augmentations from ${codemeshDir}...`);

  // Read all .md files in the directory
  const files = fs.readdirSync(codemeshDir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    // Extract server object name from filename (e.g., "filesystem-server.md" -> "filesystemServer")
    const serverIdMatch = file.match(/^(.+)\.md$/);
    if (!serverIdMatch) continue;

    const serverId = serverIdMatch[1];
    // Convert server-id to serverObjectName using utility (e.g., "filesystem-server" -> "filesystemServer")
    const serverObjectName = createServerObjectName(serverId);

    const filePath = path.join(codemeshDir, file);
    logger.log(`Reading augmentation file: ${filePath}`);

    try {
      const markdown = fs.readFileSync(filePath, 'utf-8');
      const augmentations = parseMarkdownAugmentations(markdown, serverObjectName);

      for (const aug of augmentations) {
        const key = `${aug.serverObjectName}.${aug.toolName}`;
        augmentationMap.set(key, aug);
        logger.log(`Registered augmentation: ${key}`);
      }
    } catch (error) {
      logger.error(`Failed to load augmentation file ${filePath}:`, error);
    }
  }

  logger.log(`Loaded ${augmentationMap.size} tool augmentation(s)`);
  return augmentationMap;
}

/**
 * Get augmentation for a specific tool
 */
export function getAugmentation(
  augmentations: Map<string, ToolAugmentation>,
  serverObjectName: string,
  toolName: string,
): ToolAugmentation | undefined {
  const key = `${serverObjectName}.${toolName}`;
  return augmentations.get(key);
}