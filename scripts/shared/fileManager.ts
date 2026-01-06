/**
 * Shared file management utilities
 * Used by both asset generation pipelines (Step 1 and Step 2)
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
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
 * Save a sprite/image file to the output directory
 */
export async function saveSprite(
  spriteBuffer: Buffer,
  filename: string,
  outputDir: string,
  skipExisting: boolean = false
): Promise<string> {
  await ensureDirectoryExists(outputDir);
  const filepath = path.join(outputDir, filename);

  // Check if file exists
  if (await fileExists(filepath)) {
    if (skipExisting) {
      throw new Error('File exists and skip-existing flag is set');
    }
    // Overwrite existing file
  }

  await fs.writeFile(filepath, spriteBuffer);
  return filepath;
}

/**
 * Save a GLB file to disk
 */
export async function saveGLBFile(
  glbBuffer: Buffer,
  buildingId: string,
  outputDir: string
): Promise<string> {
  await ensureDirectoryExists(outputDir);

  const filename = `${buildingId}.glb`;
  const filepath = path.join(outputDir, filename);

  await fs.writeFile(filepath, glbBuffer);

  // Return relative path from project root
  const relativePath = path.relative(process.cwd(), filepath).replace(/\\/g, '/');
  return relativePath;
}

/**
 * Read addresses from input file (one per line)
 */
export async function readAddresses(inputFile: string): Promise<string[]> {
  const content = await fs.readFile(inputFile, 'utf-8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments
}

/**
 * Save processing results to JSON file with summary
 */
export async function saveResults(
  results: Array<{ status: 'success' | 'failed' | 'skipped'; [key: string]: any }>,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  await ensureDirectoryExists(dir);

  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    successful: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
  };

  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2), 'utf-8');
}
