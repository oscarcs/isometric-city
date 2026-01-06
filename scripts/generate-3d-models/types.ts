/**
 * Type definitions for 3D model generation pipeline
 */

export interface ProcessingResult {
  buildingId: string;
  status: 'success' | 'failed' | 'skipped';
  glbPath?: string;
  requestId?: string;
  error?: string;
  duration?: number; // Generation time in seconds
  timestamp: string;
}

export interface QueuedJob {
  requestId: string;
  buildingId: string;
  imageUrl: string;
  submitTime: number;
}

export interface Config {
  falApiKey: string;
  inputRegistry: string; // Path to generated-buildings.json
  outputDir: string; // Path to assets/3d-models/
  forceRegenerate: boolean;
  uploadDelayMs: number; // Delay between uploads
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: string;
  footprint: { width: number; height: number };
  refImage?: string; // Intermediate reference image from Step 1
  sprites?: {
    south?: string;
    north?: string;
    east?: string;
    west?: string;
  };
  icon: string;
  supportsRotation: boolean;
  '3dModel'?: string;
}
