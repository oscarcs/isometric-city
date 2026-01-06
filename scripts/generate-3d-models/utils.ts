/**
 * Utility functions for 3D model generation pipeline
 */

/**
 * Delay execution for a specified number of milliseconds
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate that required environment variables are present
 */
export function validateEnv(): { falApiKey: string } {
  const falApiKey = process.env.FAL_KEY;

  if (!falApiKey) {
    throw new Error('FAL_KEY is required. Please set it in your .env file.');
  }

  return { falApiKey };
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}
