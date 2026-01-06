/**
 * Type definitions for the autonomous isometric building asset generation pipeline
 */

export type BuildingCategory = 'residential' | 'commercial' | 'civic' | 'landmark' | 'props';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
}

export interface PlaceDetails {
  name?: string;
  types?: string[];
  address: string;
}

export interface InferredMetadata {
  category: BuildingCategory;
  footprint: { width: number; height: number };
  name: string;
  icon: string;
}

export interface GeneratedSprite {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  footprint: { width: number; height: number };
  refImage?: string; // Intermediate reference image from Step 1
  sprites?: {
    south?: string;
    north?: string;
    east?: string;
    west?: string;
  };
  icon: string;
  supportsRotation?: boolean;
  '3dModel'?: string;
}

export interface BuildingAsset {
  id: string;
  definition: BuildingDefinition;
  refImagePath: string;
}

export interface ProcessingResult {
  address: string;
  status: 'success' | 'failed' | 'skipped';
  buildingId?: string;
  refImagePath?: string;
  error?: string;
  timestamp: string;
}

export interface Config {
  inputFile: string;
  outputDir: string;
  googleMapsApiKey: string;
  geminiApiKey: string;
  rateLimitDelayMs: number;
  browserHeadless: boolean;
  skipExisting: boolean;
}
