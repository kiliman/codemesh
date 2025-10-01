#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const baseDir = process.argv[2] || './test-files';

function randomContent(minChars, maxChars) {
  const length = Math.floor(Math.random() * (maxChars - minChars + 1)) + minChars;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \n';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateFiles(dir, depth, maxDepth) {
  if (depth > maxDepth) return;

  // Create 4-5 files at this level
  const numFiles = Math.floor(Math.random() * 2) + 4; // 4 or 5
  for (let i = 0; i < numFiles; i++) {
    const fileName = `file-${depth}-${i}.txt`;
    const filePath = join(dir, fileName);
    const content = randomContent(100, 500);
    writeFileSync(filePath, content);
  }

  // Create 2-3 subdirectories if not at max depth
  if (depth < maxDepth) {
    const numDirs = Math.floor(Math.random() * 2) + 2; // 2 or 3
    for (let i = 0; i < numDirs; i++) {
      const dirName = `level-${depth + 1}-dir-${i}`;
      const subDir = join(dir, dirName);
      mkdirSync(subDir, { recursive: true });
      generateFiles(subDir, depth + 1, maxDepth);
    }
  }
}

console.log(`Generating nested files in: ${baseDir}`);
mkdirSync(baseDir, { recursive: true });
generateFiles(baseDir, 1, 3);
console.log('✅ Done! Created 3 levels of nested directories with 4-5 files each.');
