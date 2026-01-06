/**
 * Shared building registry management - read/write to generated-buildings.json
 * Used by both asset generation pipelines (Step 1 and Step 2)
 */

import fs from 'fs/promises';
import path from 'path';
import type { BuildingDefinition } from '../generate-assets/types.js';

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
 * Add or update a building in the registry
 */
export async function addBuildingToRegistry(buildingDef: BuildingDefinition): Promise<void> {
  // Read existing buildings
  const buildings = await readRegistry();

  // Add or update building
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

/**
 * Get a specific building definition
 */
export async function getBuilding(buildingId: string): Promise<BuildingDefinition | null> {
  const buildings = await readRegistry();
  return buildings[buildingId] || null;
}

/**
 * Update a building entry with a 3D model path
 */
export async function updateBuildingWith3DModel(
  buildingId: string,
  glbPath: string
): Promise<void> {
  const buildings = await readRegistry();

  if (!buildings[buildingId]) {
    throw new Error(`Building ${buildingId} not found in registry`);
  }

  buildings[buildingId]['3dModel'] = glbPath;

  await fs.writeFile(REGISTRY_PATH, JSON.stringify(buildings, null, 2), 'utf-8');
}

/**
 * Check if a building already has a 3D model
 */
export async function buildingHas3DModel(buildingId: string): Promise<boolean> {
  const buildings = await readRegistry();
  return Boolean(buildings[buildingId]?.['3dModel']);
}

/**
 * Get all buildings that need 3D models generated
 * (have a reference image but no 3D model)
 */
export async function getBuildingsWithout3DModels(): Promise<string[]> {
  const buildings = await readRegistry();

  return Object.keys(buildings).filter((buildingId) => {
    const building = buildings[buildingId];
    // Must have a reference image from Step 1
    // Must not have a 3D model yet
    return building.refImage && !building['3dModel'];
  });
}

/**
 * Get all buildings that have a reference image
 * (Used when force-regenerating or checking overall status)
 */
export async function getAllBuildingsWithRefImages(): Promise<string[]> {
  const buildings = await readRegistry();

  return Object.keys(buildings).filter((buildingId) => {
    const building = buildings[buildingId];
    // Must have a reference image from Step 1
    return building.refImage;
  });
}
