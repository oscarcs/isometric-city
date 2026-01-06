/**
 * Metadata service for geocoding, place details, and AI-powered metadata inference
 */

import { GoogleGenAI } from '@google/genai';
import type { GeocodeResult, PlaceDetails, InferredMetadata } from './types.js';
import { retryWithBackoff } from './utils.js';

/**
 * Geocode an address to get latitude/longitude and place ID
 */
export async function geocodeAddress(
  address: string,
  apiKey: string
): Promise<GeocodeResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results && data.results[0]) {
    const result = data.results[0];
    const location = result.geometry.location;
    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: result.formatted_address,
      placeId: result.place_id || '',
    };
  } else {
    throw new Error(`Geocoding failed: ${data.status} - ${data.error_message || ''}`);
  }
}

/**
 * Get place details from Google Maps Places API
 * Returns undefined if not available (will fall back to Gemini inference)
 */
export async function getPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetails | undefined> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,types,formatted_address&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      return {
        name: data.result.name,
        types: data.result.types,
        address: data.result.formatted_address || '',
      };
    } else {
      // Not an error - just no place details available
      return undefined;
    }
  } catch (error) {
    // Return undefined to fall back to Gemini inference
    return undefined;
  }
}

/**
 * Use Gemini to infer building metadata from a screenshot
 */
export async function inferMetadata(
  screenshot: Buffer,
  address: string,
  placeTypes: string[] | undefined,
  placeName: string | undefined,
  geminiApiKey: string
): Promise<InferredMetadata> {
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const prompt = `Analyze this building from Google Maps.

Address: "${address}"
Place Name: "${placeName || 'unknown'}"
Google Place Types: ${placeTypes?.join(', ') || 'unknown'}

Determine for a city-building game:
1. Category: residential, commercial, civic, landmark, or props
2. Footprint: width and height in 1-8 grid cells
3. Name: If the Place Name is provided, use it (or a concise version of it). Otherwise, generate a concise name (2-3 words).
4. Icon: Single emoji

Return valid JSON filling in this schema:
{
  "category": "category_here",
  "footprint": { "width": 1, "height": 1 },
  "name": "Name Here",
  "icon": "🏛️"
}`;

  const generateContent = async () => {
    const model = process.env.GEMINI_MODEL_METADATA;
    if (!model) {
      throw new Error('GEMINI_MODEL_METADATA is not defined in environment variables.');
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
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini did not return a response');
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not extract JSON from Gemini response: ${text}`);
    }

    const metadata = JSON.parse(jsonMatch[0]) as InferredMetadata;

    // Validate the metadata
    if (!metadata.category || !metadata.footprint || !metadata.name || !metadata.icon) {
      throw new Error('Invalid metadata structure from Gemini');
    }

    return metadata;
  };

  return retryWithBackoff(generateContent, 3, 1000);
}
