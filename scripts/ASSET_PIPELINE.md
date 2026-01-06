# Autonomous Asset Generation Pipeline - Step 1: Gemini Renders

This is the first step in the asset generation pipeline. It generates intermediate isometric building images from real-world addresses using Google Maps, Playwright browser automation, and Gemini AI. These images will be fed into a 3D model generation pipeline (Step 2) to create final game assets.

## Setup

### 1. Get API Keys

**Google Maps API Key:**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select existing
- Enable these APIs:
  - Maps JavaScript API
  - Geocoding API
  - Places API
- Create API key under "Credentials"

**Gemini API Key:**
- Get from [Google AI Studio](https://aistudio.google.com/api-keys)

### 2. Configure Environment

Copy the example environment file:

```bash
cp scripts/config/.env.example .env
```

Edit `.env` and add your API keys and model names:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_METADATA=gemini-2.5-flash-lite
GEMINI_MODEL_IMAGE=gemini-3-pro-image-preview
```

See the [Google Models list](https://ai.google.dev/models) for available models.

### 3. Prepare Address List

Create or edit `scripts/config/addresses.txt` with one address per line:

```
Ferry Building, San Francisco, CA
Flatiron Building, New York, NY
Painted Ladies, San Francisco, CA
```

## Usage

### Basic Usage

```bash
npm run generate-assets
```

This will:
1. Read addresses from `scripts/config/addresses.txt`
2. For each address:
   - Geocode using Google Geocoding API
   - Get place details using Google Places API
   - Capture 3D Google Maps satellite view screenshot using Playwright
   - Use Gemini to infer building metadata (category, size, name, icon)
   - Generate isometric sprite using Gemini
   - Save PNG to `assets/image-refs/{building-name}.png`
   - Register building in `app/data/generated-buildings.json`
3. Save processing results and summary to `results.json`

### Options

```bash
# Use custom address file (default: scripts/config/addresses.txt)
npm run generate-assets -- --input my-addresses.txt

# Use custom output directory (default: assets/image-refs)
npm run generate-assets -- --output assets/custom-renders

# Run browser in visible mode (default: true/headless)
npm run generate-assets -- --headless false

# Skip buildings that already exist (default: false)
npm run generate-assets -- --skip-existing
```

## Pipeline Flow

For each address:

1. **Geocode** → Get latitude/longitude and place ID from address using Google Geocoding API
2. **Place Details** → Get building name and types from Google Places API
3. **Screenshot** → Launch Playwright browser, navigate to 3D satellite view, wait 8s, capture image
4. **Infer Metadata** → Use Gemini (GEMINI_MODEL_METADATA) to determine:
   - Category: residential, commercial, civic, landmark, or props
   - Footprint: width and height in 1-8 grid cells
   - Name: Uses place name if available, otherwise generates concise 2-3 word name
   - Icon: Single emoji representing the building
5. **Generate Image** → Use Gemini (GEMINI_MODEL_IMAGE) to create isometric sprite:
   - Isometric perspective with 2:1 ratio, 30° angle
   - 512x512+ white background canvas
   - Building anchored at bottom-center
   - SimCity 4 style, high-resolution 3D asset
   - No ground plane or shadows, isolated building only
6. **Save** → Write PNG to `assets/image-refs/{building-name}.png`
7. **Register** → Add metadata entry to `app/data/generated-buildings.json`

## Output

### Generated Files

- **Intermediate Images**: `assets/image-refs/{building-name}.png`
- **Metadata Registry**: `app/data/generated-buildings.json`
- **Processing Log**: `results.json`

Note: These are intermediate images for the 3D modeling pipeline, not final game sprites.

### Metadata Entry

Each generated building creates a metadata entry like:

```json
{
  "ferry-building": {
    "id": "ferry-building",
    "name": "Ferry Building",
    "category": "landmark",
    "footprint": { "width": 6, "height": 4 },
    "sprites": {
      "south": "assets/image-refs/ferry-building.png"
    },
    "icon": "🏛️",
    "supportsRotation": false
  }
}
```

The sprite path points to the intermediate Gemini-generated image, which will be replaced after the 3D modeling step.

## Troubleshooting

### "GOOGLE_MAPS_API_KEY is required"
- Make sure `.env` file exists in project root with `GOOGLE_MAPS_API_KEY` defined
- Check that API key is valid and has Maps JavaScript API, Geocoding API, and Places API enabled

### "GEMINI_MODEL_IMAGE is not defined in environment variables"
- Add `GEMINI_MODEL_IMAGE` to your `.env` file (e.g., `gemini-3-pro-image-preview`)

### "GEMINI_MODEL_METADATA is not defined in environment variables"
- Add `GEMINI_MODEL_METADATA` to your `.env` file (e.g., `gemini-2.5-flash-lite`)

### Screenshots are blank or incomplete
- Verify the address is valid and Google Maps can display it
- Try increasing wait time or running with `--headless false` to see what's happening in the browser

### Gemini fails to generate sprite
- Check API quota limits in Google AI Studio
- Verify `GEMINI_API_KEY` and model names are correct
- Try with different addresses (some buildings may not work well with image generation)

### Building appears in wrong category or size
- Gemini inference isn't perfect - manually edit `app/data/generated-buildings.json` to fix
- Metadata can be refined before running the 3D pipeline step

### "Place details unavailable: Name is required"
- The address must exist in Google Maps with a valid place name
- Try using a more specific address or a known landmark
google_maps_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_METADATA=gemini-2.5-flash-lite
GEMINI_MODEL_IMAGE=gemini-3-pro-image-preview

# Optional (with defaults)
RATE_LIMIT_DELAY_MS=2000
```

Note: Input file and output directory are configured via command-line options, not environment variables.ptional (with defaults)
INPUT_FILE=scripts/config/addresses.txt
OUTPUT_DIR=assets/image-refs
RATE_LIMIT_DELAY_MS=2000
BROWSER_HEADLESS=true
```

## Pipeline Overview

This is **Step 1** of a multi-step asset generation pipeline:

1. **Gemini Renders** (this step) - Generate intermediate isometric images from real addresses
2. **3D Model Generation** (next step) - Convert images to 3D models using Trellis/Hunyuan3D
3. **Pixel Art Rendering** (final step) - Render 3D models as pixel art from 4 directions for use in game

## Next Steps

After running this step, the generated images in `assets/image-refs/` should be:
1. Fed into an image-to-3D pipeline (Trellis, Hunyuan3D, etc.)
2. The resulting 3D models rendered as pixel art from all 4 cardinal directions
3. Final sprites saved to `public/Building/{category}/` for use in the game
4. The `generated-buildings.json` sprite paths updated to point to final assets
