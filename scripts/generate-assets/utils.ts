/**
 * Shared utilities for the asset generation pipeline
 */

/**
 * Delay execution for a specified number of milliseconds
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a kebab-case ID from a name
 * Example: "Corner Cafe" → "corner-cafe"
 */
export function generateBuildingId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a safe filename from metadata
 * Example: "Corner Cafe" → "corner-cafe.png"
 */
export function generateFilename(
  metadata: { name: string }
): string {
  const safeName = metadata.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${safeName}.png`;
}

/**
 * Validate that required environment variables are present
 */
export function validateEnv(): { googleMapsApiKey: string; geminiApiKey: string } {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!googleMapsApiKey) {
    throw new Error(
      'GOOGLE_MAPS_API_KEY environment variable is required. Please set it in your .env file.'
    );
  }

  if (!geminiApiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is required. Please set it in your .env file.'
    );
  }

  return { googleMapsApiKey, geminiApiKey };
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = initialDelay * Math.pow(2, attempt - 1);
        await delay(delayMs);
      }
    }
  }

  throw new Error(
    `Failed after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
}
