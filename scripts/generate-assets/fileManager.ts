/**
 * File management utilities for saving sprites and managing file system operations
 */

import fs from 'fs/promises';
import path from 'path';
import type { BuildingCategory } from './types.js';

/**
 * Ensure a directory exists, creating it if necessary
 * Returns the output directory (flat structure, no category subdirectories)
 */
export async function ensureDirectoryExists(outputDir: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
}

/**
 * Check if a file exists
 */
export async function fileExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a sprite to the output directory (flat structure)
 */
export async function saveSprite(
  spriteBuffer: Buffer,
  filename: string,
  outputDir: string,
  skipExisting: boolean = false
): Promise<string> {
  const dir = await ensureDirectoryExists(outputDir);
  const filepath = path.join(dir, filename);

  // Check if file exists
  if (await fileExists(filepath)) {
    if (skipExisting) {
      throw new Error('File exists and skip-existing flag is set');
    }
    // For now, we'll overwrite. In a real CLI, we'd prompt the user
    // But since this is automated, we'll just overwrite
  }

  await fs.writeFile(filepath, spriteBuffer);
  return filepath;
}

/**
 * Read addresses from input file (one per line)
 */
export async function readAddresses(inputFile: string): Promise<string[]> {
  const content = await fs.readFile(inputFile, 'utf-8');
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments
}

/**
 * Save processing results to a JSON file
 */
export async function saveResults(results: any[], outputPath: string): Promise<void> {
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8');
}
