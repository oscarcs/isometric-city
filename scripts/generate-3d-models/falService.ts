/**
 * fal.ai API service for Trellis-2 3D model generation
 */

import { fal } from '@fal-ai/client';
import fs from 'fs/promises';

/**
 * Upload an image file to fal.ai storage
 */
export async function uploadImage(localPath: string, falApiKey: string): Promise<string> {
  fal.config({ credentials: falApiKey });
  const fileBuffer = await fs.readFile(localPath);
  const file = new File([fileBuffer], localPath.split('/').pop() || 'image.png', {
    type: 'image/png',
  });

  const uploadedUrl = await fal.storage.upload(file);
  return uploadedUrl;
}

/**
 * Submit a 3D model generation job to the Trellis-2 queue
 * Returns immediately with a request ID
 */
export async function submit3DModelGeneration(
  imageUrl: string,
  falApiKey: string
): Promise<string> {
  fal.config({ credentials: falApiKey });
  const result = await fal.queue.submit('fal-ai/trellis-2', {
    input: {
      "resolution": 1024,
      "ss_guidance_strength": 8.6,
      "ss_guidance_rescale": 0.7,
      "ss_sampling_steps": 12,
      "ss_rescale_t": 5,
      "shape_slat_guidance_strength": 7.5,
      "shape_slat_guidance_rescale": 0.5,
      "shape_slat_sampling_steps": 12,
      "shape_slat_rescale_t": 3,
      "tex_slat_guidance_strength": 1,
      "tex_slat_sampling_steps": 12,
      "tex_slat_rescale_t": 3,
      "decimation_target": 500000,
      "texture_size": 2048,
      "remesh": true,
      "remesh_band": 1,
      image_url: imageUrl,
    },
  });

  return result.request_id;
}

/**
 * Check the status of a queued 3D model generation job
 */
export async function check3DModelStatus(
  requestId: string,
  falApiKey: string
): Promise<{ status: string; result?: any; error?: string; queue_position?: number }> {
  fal.config({ credentials: falApiKey });
  try {
    const status = await fal.queue.status('fal-ai/trellis-2', {
      requestId,
      logs: false,
    });

    let result;
    if (status.status === 'COMPLETED') {
      const response = await fal.queue.result('fal-ai/trellis-2', {
        requestId,
      });
      result = response.data;
    }

    return {
      status: status.status,
      result,
      queue_position: (status as any).queue_position,
    };
  } catch (error) {
    return {
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Download a GLB file from a URL
 */
export async function downloadGLB(glbUrl: string): Promise<Buffer> {
  const response = await fetch(glbUrl);

  if (!response.ok) {
    throw new Error(`Failed to download GLB: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
