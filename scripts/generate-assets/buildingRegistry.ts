/**
 * Building registry management - read/write to generated-buildings.json
 */

import fs from 'fs/promises';
import path from 'path';
import type { BuildingDefinition } from './types.js';

const REGISTRY_PATH = path.join(process.cwd(), 'app', 'data', 'generated-buildings.json');

/**
 * Read existing buildings from the registry
 */
export async function readRegistry(): Promise<Record<string, BuildingDefinition>> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist yet, return empty object
    return {};
  }
}

/**
 * Add a building to the registry
 */
export async function addBuildingToRegistry(buildingDef: BuildingDefinition): Promise<void> {
  // Read existing buildings
  const buildings = await readRegistry();

  // Add new building
  buildings[buildingDef.id] = buildingDef;

  // Ensure directory exists
  const dir = path.dirname(REGISTRY_PATH);
  await fs.mkdir(dir, { recursive: true });

  // Write back to file
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(buildings, null, 2), 'utf-8');
}

/**
 * Check if a building ID already exists in the registry
 */
export async function buildingExists(buildingId: string): Promise<boolean> {
  const buildings = await readRegistry();
  return buildingId in buildings;
}
