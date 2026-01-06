#!/usr/bin/env node

/**
 * 3D Model Generation Pipeline - Step 2
 *
 * This script:
 * 1. Reads buildings from generated-buildings.json
 * 2. Uploads reference images to fal.ai storage
 * 3. Submits 3D generation jobs to Trellis-2 queue (parallel)
 * 4. Polls for completion and downloads GLB files
 * 5. Updates registry with 3D model paths
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import path from 'path';
import { config } from 'dotenv';
import type { ProcessingResult, QueuedJob } from './types.js';
import { validateEnv, delay, formatDuration } from './utils.js';
import {
  uploadImage,
  submit3DModelGeneration,
  check3DModelStatus,
  downloadGLB,
} from './falService.js';
import {
  getBuildingsWithout3DModels,
  getAllBuildingsWithRefImages,
  buildingHas3DModel,
  getBuilding,
  updateBuildingWith3DModel,
} from '../shared/buildingRegistry.js';
import { saveGLBFile, saveResults } from '../shared/fileManager.js';

config();

const program = new Command();

program
  .name('generate-3d-models')
  .description('Generate 3D models from reference images using Trellis-2')
  .version('1.0.0')
  .option('--building-id <id>', 'Process a specific building ID only')
  .option('-o, --output <dir>', 'Output directory for GLB files', 'assets/3d-models')
  .option('--force-regenerate', 'Regenerate even if 3D model already exists', false)
  .parse();

const options = program.opts();

// Polling constants
const INITIAL_POLL_INTERVAL_MS = 5000; // 5 seconds (fallback when no queue position available)

/**
 * Phase 1: Upload images and submit jobs to queue
 */
async function uploadAndQueuePhase(
  buildingIds: string[],
  config: {
    falApiKey: string;
    outputDir: string;
    forceRegenerate: boolean;
    uploadDelayMs: number;
  }
): Promise<{ queuedJobs: QueuedJob[]; results: ProcessingResult[] }> {
  console.log(chalk.bold('\nPhase 1: Uploading & Queueing'));
  console.log(chalk.gray('------------------------------\n'));

  const queuedJobs: QueuedJob[] = [];
  const results: ProcessingResult[] = [];

  for (let i = 0; i < buildingIds.length; i++) {
    const buildingId = buildingIds[i];
    const spinner = ora(`[${i + 1}/${buildingIds.length}] ${buildingId}`).start();

    try {
      // Check if already has 3D model
      if (!config.forceRegenerate && (await buildingHas3DModel(buildingId))) {
        spinner.warn(`Already has 3D model, skipping`);
        results.push({
          buildingId,
          status: 'skipped',
          timestamp: new Date().toISOString(),
        });
        console.log(''); // Add spacing
        continue;
      }

      // Get building definition
      const building = await getBuilding(buildingId);
      if (!building) {
        throw new Error(`Building ${buildingId} not found in registry`);
      }

      if (!building.refImage) {
        throw new Error(`Building ${buildingId} has no reference image (Step 1 must be completed first)`);
      }

      // Upload image to fal.ai storage
      spinner.text = `[${i + 1}/${buildingIds.length}] ${buildingId} - Uploading...`;
      const imagePath = path.join(process.cwd(), building.refImage);
      const imageUrl = await uploadImage(imagePath, config.falApiKey);
      spinner.succeed(`Uploaded to fal.ai`);

      // Submit to queue
      spinner.start(`[${i + 1}/${buildingIds.length}] ${buildingId} - Queueing...`);
      const requestId = await submit3DModelGeneration(imageUrl, config.falApiKey);
      spinner.succeed(`Queued (request: ${requestId.substring(0, 12)}...)`);

      queuedJobs.push({
        requestId,
        buildingId,
        imageUrl,
        submitTime: Date.now(),
      });

      console.log(''); // Add spacing

      // Rate limit between uploads
      if (i < buildingIds.length - 1) {
        await delay(config.uploadDelayMs);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed: ${errorMessage}`);
      results.push({
        buildingId,
        status: 'failed',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      console.log(''); // Add spacing
    }
  }

  return { queuedJobs, results };
}

/**
 * Phase 2: Poll for results and process completed jobs
 */
async function pollAndProcessPhase(
  queuedJobs: QueuedJob[],
  config: {
    falApiKey: string;
    outputDir: string;
  }
): Promise<ProcessingResult[]> {
  if (queuedJobs.length === 0) {
    return [];
  }

  console.log(chalk.bold(`\nSubmitted ${queuedJobs.length} job(s) to Trellis-2 queue\n`));
  console.log(chalk.bold('Phase 2: Processing Results'));
  console.log(chalk.gray('----------------------------'));
  console.log(chalk.gray('All jobs running in parallel...\n'));

  const results: ProcessingResult[] = [];
  const pending = new Map(queuedJobs.map((job) => [job.requestId, job]));

  while (pending.size > 0) {
    // Track queue positions to calculate next poll delay
    const queuePositions: number[] = [];

    // Check status for all pending jobs
    for (const [requestId, job] of pending.entries()) {
      const elapsed = Math.floor((Date.now() - job.submitTime) / 1000);
      const statusResult = await check3DModelStatus(requestId, config.falApiKey);

      if (statusResult.status === 'COMPLETED' && statusResult.result) {
        // Download and save GLB
        const spinner = ora(`[${job.buildingId}] Downloading GLB...`).start();

        try {
          let glbUrl = statusResult.result.model_glb;
          if (typeof glbUrl === 'object' && glbUrl !== null && 'url' in glbUrl) {
            glbUrl = glbUrl.url;
          }

          if (!glbUrl) {
            console.error('Result structure:', JSON.stringify(statusResult.result, null, 2));
            throw new Error('No GLB URL in result');
          }

          const glbBuffer = await downloadGLB(glbUrl);
          const glbPath = await saveGLBFile(glbBuffer, job.buildingId, config.outputDir);
          spinner.succeed(`Downloaded GLB`);

          // Update registry
          const updateSpinner = ora(`[${job.buildingId}] Updating registry...`).start();
          await updateBuildingWith3DModel(job.buildingId, glbPath);
          updateSpinner.succeed(`Saved: ${glbPath}`);

          const duration = Math.floor((Date.now() - job.submitTime) / 1000);
          console.log(chalk.green(`✓ ${job.buildingId} completed in ${formatDuration(duration)}\n`));

          results.push({
            buildingId: job.buildingId,
            status: 'success',
            glbPath,
            requestId,
            duration,
            timestamp: new Date().toISOString(),
          });

          pending.delete(requestId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          spinner.fail(`Failed to process: ${errorMessage}`);
          console.log('');

          results.push({
            buildingId: job.buildingId,
            status: 'failed',
            error: errorMessage,
            requestId,
            timestamp: new Date().toISOString(),
          });

          pending.delete(requestId);
        }
      } else if (statusResult.status === 'FAILED') {
        console.log(chalk.red(`✗ [${job.buildingId}] FAILED: ${statusResult.error || 'Unknown error'}\n`));

        results.push({
          buildingId: job.buildingId,
          status: 'failed',
          error: statusResult.error || 'Unknown error',
          requestId,
          timestamp: new Date().toISOString(),
        });

        pending.delete(requestId);
      } else {
        // Still in progress
        const statusIcon = statusResult.status === 'IN_QUEUE' ? '⏳' : '🔄';
        const queueInfo = statusResult.queue_position !== undefined
          ? ` (queue position: ${statusResult.queue_position})`
          : '';
        console.log(chalk.gray(`${statusIcon} [${job.buildingId}] ${statusResult.status}... (${elapsed}s elapsed)${queueInfo}`));

        // Track queue position for delay calculation
        if (statusResult.queue_position !== undefined) {
          queuePositions.push(statusResult.queue_position);
        }
      }
    }

    if (pending.size > 0) {
      // Calculate adaptive polling interval based on queue positions
      let interval: number;

      if (queuePositions.length > 0) {
        // Use minimum queue position (closest to completion)
        const minQueuePosition = Math.min(...queuePositions);
        // Each position in queue takes ~1 second, with minimum of 2s and maximum of 30s
        interval = Math.min(Math.max(minQueuePosition * 1000, 2000), 30000);
      } else {
        // Fallback to default polling if no queue position available
        interval = INITIAL_POLL_INTERVAL_MS;
      }

      console.log(chalk.gray(`\nPolling again in ${interval / 1000}s...\n`));
      await delay(interval);
    }
  }

  return results;
}

/**
 * Main pipeline execution
 */
async function runPipeline(): Promise<void> {
  console.log(chalk.bold.cyan('\n3D Model Generator (Trellis-2)'));
  console.log(chalk.gray('==============================\n'));

  // Validate environment
  let falApiKey: string;
  try {
    const env = validateEnv();
    falApiKey = env.falApiKey;
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  // Read configuration
  const outputDir = path.resolve(options.output);
  const forceRegenerate = options.forceRegenerate;
  const uploadDelayMs = parseInt(process.env.UPLOAD_DELAY_MS || '1000', 10);
  const registryPath = path.join(process.cwd(), 'app', 'data', 'generated-buildings.json');

  console.log(chalk.bold('Configuration:'));
  console.log(chalk.gray(`  Registry: ${registryPath}`));
  console.log(chalk.gray(`  Output: ${outputDir}`));
  console.log(chalk.gray(`  Force regenerate: ${forceRegenerate}`));

  // Get buildings to process
  let buildingIds: string[];
  try {
    if (options.buildingId) {
      buildingIds = [options.buildingId];
    } else if (forceRegenerate) {
      buildingIds = await getAllBuildingsWithRefImages();
    } else {
      buildingIds = await getBuildingsWithout3DModels();
    }
  } catch (error) {
    console.error(
      chalk.red(`Failed to read registry: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }

  if (buildingIds.length === 0) {
    console.log(chalk.yellow('\nNo buildings need 3D model generation.'));
    console.log(chalk.gray('All buildings either have 3D models or lack reference images.\n'));
    process.exit(0);
  }

  console.log(chalk.bold(`\nFound ${buildingIds.length} building(s) to process...`));

  const startTime = Date.now();

  // Phase 1: Upload and queue
  const { queuedJobs, results: phase1Results } = await uploadAndQueuePhase(buildingIds, {
    falApiKey,
    outputDir,
    forceRegenerate,
    uploadDelayMs,
  });

  // Phase 2: Poll and process
  const phase2Results = await pollAndProcessPhase(queuedJobs, {
    falApiKey,
    outputDir,
  });

  // Combine results
  const allResults = [...phase1Results, ...phase2Results];

  // Save results
  const resultsPath = path.join(process.cwd(), 'assets', '3d-models-results.json');
  await saveResults(allResults, resultsPath);

  // Print summary
  console.log(chalk.bold('\nSummary:'));
  console.log(chalk.gray('========'));
  const successful = allResults.filter((r) => r.status === 'success').length;
  const failed = allResults.filter((r) => r.status === 'failed').length;
  const skipped = allResults.filter((r) => r.status === 'skipped').length;

  console.log(chalk.green(`  Successful: ${successful}`));
  if (failed > 0) {
    console.log(chalk.red(`  Failed: ${failed}`));
  }
  if (skipped > 0) {
    console.log(chalk.yellow(`  Skipped: ${skipped}`));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(chalk.gray(`  Total time: ${formatDuration(totalTime)}`));

  console.log(chalk.gray(`\nResults saved to: ${resultsPath}\n`));
}

// Run the pipeline
runPipeline().catch((error) => {
  console.error(chalk.red(`\nFatal error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
