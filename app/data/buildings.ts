// Building Registry - Single source of truth for all buildings
// Generated buildings are imported from generated-buildings.json (created by asset pipeline)

// Import generated buildings (if file exists)
let generatedBuildings: Record<string, BuildingDefinition> = {};
try {
  generatedBuildings = require('./generated-buildings.json');
} catch {
  // File doesn't exist yet, that's okay
}

export type BuildingCategory =
  | "residential"
  | "commercial"
  | "civic"
  | "landmark"
  | "props";

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  footprint: { width: number; height: number };
  // For buildings where rotation changes the footprint (e.g., 3x4 becomes 4x3)
  footprintByOrientation?: {
    south?: { width: number; height: number };
    north?: { width: number; height: number };
    east?: { width: number; height: number };
    west?: { width: number; height: number };
  };
  // For sprites that are visually larger than their footprint (e.g., trees)
  // Used for slicing/depth calculations, not collision
  renderSize?: { width: number; height: number };
  sprites: {
    south: string;
    west?: string;
    north?: string;
    east?: string;
  };
  icon: string; // Emoji for UI
  supportsRotation?: boolean;
  isDecoration?: boolean; // If true, preserves underlying tile (like props)
}

// Helper to get the correct footprint for a building based on orientation
export function getBuildingFootprint(
  building: BuildingDefinition,
  orientation?: string
): { width: number; height: number } {
  if (!building.footprintByOrientation || !orientation) {
    return building.footprint;
  }

  const dirMap: Record<string, "south" | "north" | "east" | "west"> = {
    down: "south",
    up: "north",
    right: "east",
    left: "west",
  };

  const dir = dirMap[orientation];
  if (!dir) {
    return building.footprint;
  }
  return building.footprintByOrientation[dir] || building.footprint;
}

export const BUILDINGS: Record<string, BuildingDefinition> = {
  ...generatedBuildings,
};

// Helper to get building by ID
export function getBuilding(id: string): BuildingDefinition | undefined {
  return BUILDINGS[id];
}

// Helper to get all buildings in a category
export function getBuildingsByCategory(
  category: BuildingCategory
): BuildingDefinition[] {
  return Object.values(BUILDINGS).filter((b) => b.category === category);
}

// Helper to get all categories that have buildings (in display order)
const CATEGORY_ORDER: BuildingCategory[] = [
  "residential",
  "commercial",
  "props",
  "civic",
  "landmark",
];

export function getCategories(): BuildingCategory[] {
  const usedCategories = new Set(
    Object.values(BUILDINGS).map((b) => b.category)
  );
  return CATEGORY_ORDER.filter((cat) => usedCategories.has(cat));
}

// Category display names
export const CATEGORY_NAMES: Record<BuildingCategory, string> = {
  residential: "Residential",
  commercial: "Commercial",
  civic: "Civic",
  landmark: "Landmarks",
  props: "Props"
};
