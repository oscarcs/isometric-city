/**
 * Isometric sprite generation using Gemini Pro Image
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { InferredMetadata } from './types.js';
import { retryWithBackoff } from './utils.js';

/**
 * Generate an isometric sprite from a Google Maps screenshot
 */
export async function generateIsometricSprite(
  screenshot: Buffer,
  metadata: InferredMetadata,
  geminiApiKey: string
): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `Generate a clean isometric sprite of this building for a city-building game.

REQUIREMENTS:
- Isometric perspective: 2:1 ratio, 30° from top-down
- Canvas: 512x512 minimum
- Anchor: Building front corner at bottom-center
- Style: Clean, game-ready 3D asset in a high resolution photorealistic style.
- Isolation: ONLY the target building on a plain white background
- No ground plane, no shadows
`;

  const generateRefImage = async () => {
    const model = process.env.GEMINI_MODEL_IMAGE;
    if (!model) {
      throw new Error('GEMINI_MODEL_IMAGE is not defined in environment variables.');
    }

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: screenshot.toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error('Gemini did not return image data.');
    }

    return Buffer.from(imagePart.inlineData.data, 'base64');
  };

  return retryWithBackoff(generateRefImage, 3, 2000);
}
