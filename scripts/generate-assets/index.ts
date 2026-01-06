#!/usr/bin/env node

/**
 * Autonomous Isometric Building Asset Generation Pipeline
 *
 * This script:
 * 1. Reads addresses from a text file
 * 2. Captures Google Maps 3D satellite views using Playwright
 * 3. Uses Gemini AI to infer metadata and generate isometric reference image
 * 4. Saves sprites to the configured output directory
 * 5. Updates app/data/generated-buildings.json
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import path from 'path';
import { config } from 'dotenv';
import type { ProcessingResult, BuildingDefinition } from './types.js';
import { validateEnv, generateBuildingId, generateFilename, delay } from './utils.js';
import { geocodeAddress, getPlaceDetails, inferMetadata } from './metadataService.js';
import { capture3DView } from './mapCapture.js';
import { generateIsometricSprite as generateIsometricRefImage } from './refImageService.js';
import { readAddresses, saveSprite, saveResults } from '../shared/fileManager.js';
import { addBuildingToRegistry, buildingExists } from '../shared/buildingRegistry.js';

config();

const program = new Command();

program
  .name('generate-assets')
  .description('Generate isometric building sprites from real-world addresses')
  .version('1.0.0')
  .option('-i, --input <file>', 'Input file with addresses', 'scripts/config/addresses.txt')
  .option('-o, --output <dir>', 'Output directory for generated images', 'assets/image-refs')
  .option('--headless <boolean>', 'Run browser in headless mode', 'true')
  .option('--skip-existing', 'Skip addresses that already have sprites', true)
  .option('--force-regenerate', 'Force regeneration of existing buildings', false)
  .parse();

const options = program.opts();

/**
 * Process a single address through the entire pipeline
 */
async function processAddress(
  address: string,
  spinner: Ora,
  config: {
    googleMapsApiKey: string;
    geminiApiKey: string;
    outputDir: string;
    headless: boolean;
    skipExisting: boolean;
    forceRegenerate: boolean;
  }
): Promise<ProcessingResult> {
  const startTime = Date.now();

  try {
    // Step 1: Geocode address
    spinner.text = `Geocoding: ${address}`;
    const geocodeResult = await geocodeAddress(address, config.googleMapsApiKey);
    spinner.succeed(
      `Geocoded: ${geocodeResult.formattedAddress} (${geocodeResult.lat}, ${geocodeResult.lng})`
    );

    // Step 2: Get place details
    spinner.start('Fetching place details...');
    const placeDetails = await getPlaceDetails(geocodeResult.placeId, config.googleMapsApiKey);
    if (placeDetails?.name) {
      spinner.succeed(`Place details: "${placeDetails.name}"`);
    } else {
      throw new Error('Place details unavailable: Name is required for deterministic asset generation.');
    }

    // Generate building ID early to check for existing buildings
    const buildingId = generateBuildingId(placeDetails?.name);

    // Check if building already exists (before expensive operations)
    if (!config.forceRegenerate && config.skipExisting && (await buildingExists(buildingId))) {
      spinner.warn(`Building "${buildingId}" already exists, skipping`);
      return {
        address,
        status: 'skipped',
        buildingId,
        timestamp: new Date().toISOString(),
      };
    }

    // Step 3: Capture screenshot (expensive operation)
    spinner.start('Capturing Google Maps 3D view...');
    const screenshot = await capture3DView(
      geocodeResult.lat,
      geocodeResult.lng,
      config.googleMapsApiKey,
      config.headless
    );
    spinner.succeed('Screenshot captured');

    // Step 4: Infer metadata from screenshot (expensive Gemini call)
    spinner.start('Inferring building metadata with Gemini...');
    const metadata = await inferMetadata(
      screenshot,
      geocodeResult.formattedAddress,
      placeDetails?.types,
      placeDetails?.name,
      config.geminiApiKey
    );
    spinner.succeed(
      `Metadata: ${metadata.category}, ${metadata.footprint.width}x${metadata.footprint.height}, "${metadata.name}" ${metadata.icon}`
    )

    // Step 5: Generate isometric ref image
    spinner.start('Generating isometric reference image with Gemini...');
    const refImageBuffer = await generateIsometricRefImage(screenshot, metadata, config.geminiApiKey);
    spinner.succeed('Reference image generated');

    // Step 6: Save ref image
    spinner.start('Saving reference image...');
    const filename = generateFilename({ name: placeDetails?.name });
    const refImagePath = await saveSprite(
      refImageBuffer,
      filename,
      config.outputDir,
      config.skipExisting
    );
    // Store relative path from project root (use forward slashes for web)
    const relativeRefImagePath = path.relative(process.cwd(), refImagePath).replace(/\\/g, '/');
    spinner.succeed(`Saved: ${relativeRefImagePath}`);

    // Step 7: Create building definition
    const buildingDefinition: BuildingDefinition = {
      id: buildingId,
      name: metadata.name,
      category: metadata.category,
      footprint: metadata.footprint,
      refImage: relativeRefImagePath,
      icon: metadata.icon,
      supportsRotation: true,
    };

    // Step 8: Add to registry
    spinner.start('Updating building registry...');
    await addBuildingToRegistry(buildingDefinition);
    spinner.succeed(`Added to registry: ${buildingId}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`✓ Completed in ${duration}s\n`));

    return {
      address,
      status: 'success',
      buildingId,
      refImagePath: relativeRefImagePath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    spinner.fail(`Failed: ${errorMessage}`);
    console.log(chalk.red(`✗ ${address}\n`));

    return {
      address,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Main pipeline execution
 */
async function runPipeline(): Promise<void> {
  console.log(chalk.bold.cyan('\nIsometric Building Asset Generator\n'));
  console.log(chalk.gray('===================================\n'));

  // Validate environment
  let googleMapsApiKey: string;
  let geminiApiKey: string;
  try {
    const env = validateEnv();
    googleMapsApiKey = env.googleMapsApiKey;
    geminiApiKey = env.geminiApiKey;
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }

  // Read configuration
  const inputFile = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const headless = options.headless === 'true';
  const forceRegenerate = options.forceRegenerate;
  const skipExisting = forceRegenerate ? false : options.skipExisting;
  const rateLimitDelayMs = parseInt(process.env.RATE_LIMIT_DELAY_MS || '2000', 10);

  console.log(chalk.bold('Configuration:'));
  console.log(chalk.gray(`  Input: ${inputFile}`));
  console.log(chalk.gray(`  Output: ${outputDir}`));
  console.log(chalk.gray(`  Headless: ${headless}`));
  console.log(chalk.gray(`  Skip existing: ${skipExisting}`));
  console.log(chalk.gray(`  Force regenerate: ${forceRegenerate}\n`));

  // Read addresses
  let addresses: string[];
  try {
    addresses = await readAddresses(inputFile);
  } catch (error) {
    console.error(
      chalk.red(`Failed to read addresses from ${inputFile}: ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exit(1);
  }

  if (addresses.length === 0) {
    console.error(chalk.red('No addresses found in input file'));
    process.exit(1);
  }

  console.log(chalk.bold(`Processing ${addresses.length} address(es)...\n`));

  // Process addresses
  const results: ProcessingResult[] = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const spinner = ora(`[${i + 1}/${addresses.length}] ${address}`).start();

    const result = await processAddress(address, spinner, {
      googleMapsApiKey,
      geminiApiKey,
      outputDir,
      headless,
      skipExisting,
      forceRegenerate,
    });

    results.push(result);

    // Rate limiting (except for last address)
    if (i < addresses.length - 1) {
      await delay(rateLimitDelayMs);
    }
  }

  // Save results
  const resultsPath = path.join(process.cwd(), 'assets', 'results.json');
  await saveResults(results, resultsPath);

  // Print summary
  console.log(chalk.gray('\n==================================='));
  console.log(chalk.bold('\nSummary:'));
  const successful = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  console.log(chalk.green(`  Successful: ${successful}`));
  if (failed > 0) {
    console.log(chalk.red(`  Failed: ${failed}`));
  }
  if (skipped > 0) {
    console.log(chalk.yellow(`  Skipped: ${skipped}`));
  }

  console.log(chalk.gray(`\nResults saved to: ${resultsPath}\n`));
}

// Run the pipeline
runPipeline().catch((error) => {
  console.error(chalk.red(`\nFatal error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
