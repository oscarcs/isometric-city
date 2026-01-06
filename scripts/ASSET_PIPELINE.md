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
   - Generate isometric reference image using Gemini
   - Save PNG to `assets/image-refs/{building-name}.png`
   - Register building in `app/data/generated-buildings.json`
3. Save processing results and summary to `assets/results.json`

### Options

```bash
# Use custom address file (default: scripts/config/addresses.txt)
npm run generate-assets -- --input my-addresses.txt

# Use custom output directory (default: assets/image-refs)
npm run generate-assets -- --output assets/custom-renders

# Run browser in visible mode (default: true/headless)
npm run generate-assets -- --headless false

# Force regenerate existing buildings (overrides --skip-existing)
npm run generate-assets -- --force-regenerate
```

## Pipeline Flow

For each address:

1. **Geocode** → Get latitude/longitude and place ID from address using Google Geocoding API
2. **Place Details** → Get building name and types from Google Places API
3. **Check Existence** → Generate building ID and check if it already exists in registry
   - If exists and not forcing regeneration: **skip remaining steps** (saves API costs)
   - If not exists or forcing regeneration: continue to next step
4. **Screenshot** → Launch Playwright browser, navigate to 3D satellite view, wait 8s, capture image
5. **Infer Metadata** → Use Gemini (GEMINI_MODEL_METADATA) to determine:
   - Category: residential, commercial, civic, landmark, or props
   - Footprint: width and height in 1-8 grid cells
   - Name: Uses place name if available, otherwise generates concise 2-3 word name
   - Icon: Single emoji representing the building
6. **Generate Image** → Use Gemini (GEMINI_MODEL_IMAGE) to create isometric sprite:
   - Isometric perspective with 2:1 ratio, 30° angle
   - 512x512+ white background canvas
   - Building anchored at bottom-center
   - SimCity 4 style, high-resolution 3D asset
   - No ground plane or shadows, isolated building only
7. **Save** → Write PNG to `assets/image-refs/{building-name}.png`
8. **Register** → Add metadata entry to `app/data/generated-buildings.json`

## Output

### Generated Files

- **Intermediate Images**: `assets/image-refs/{building-name}.png`
- **Metadata Registry**: `app/data/generated-buildings.json`
- **Processing Log**: `assets/results.json`

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
    "refImage": "assets/image-refs/ferry-building.png",
    "icon": "🏛️",
    "supportsRotation": true
  }
}
```

The `refImage` field stores the intermediate Gemini-generated image. The `sprites` field will be populated in Step 3 (pixel art rendering) with the final game assets.

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

---

# Step 2: 3D Model Generation (Trellis-2)

After generating reference images in Step 1, convert them to 3D models using fal.ai's Trellis-2 API.

## Setup

### 1. Get fal.ai API Key

- Sign up at [fal.ai](https://fal.ai/)
- Get your API key from [Dashboard → Keys](https://fal.ai/dashboard/keys)

### 2. Configure Environment

Add to your `.env` file (or copy from `scripts/config/.env.example`):

```env
FAL_KEY=your_fal_api_key_here
```

## Usage

### Basic Usage

```bash
npm run generate-3d-models
```

This will:
1. Read buildings from `app/data/generated-buildings.json`
2. Find buildings with reference images but no 3D models
3. **Phase 1: Upload & Queue**
   - Upload reference images to fal.ai storage
   - Submit all jobs to Trellis-2 queue (returns immediately)
4. **Phase 2: Poll & Process**
   - Poll all jobs intelligently based on queue position
   - Download GLB files as they complete
   - Update registry with `3dModel` field
5. Save results to `assets/3d-models-results.json`

**Key Features:**
- **Parallel Processing** - All buildings are processed in parallel via fal.ai's queue system. 4 buildings that would take ~10 minutes sequentially complete in ~2.5 minutes.
- **Smart Polling** - Uses queue position to determine optimal polling interval. If you're 10th in queue, it waits ~10 seconds before polling again, minimizing unnecessary API calls.

### Options

```bash
# Generate 3D model for a specific building only
npm run generate-3d-models -- --building-id ferry-building

# Use custom output directory (default: assets/3d-models)
npm run generate-3d-models -- --output assets/custom-3d-models

# Force regenerate existing 3D models
npm run generate-3d-models -- --force-regenerate
```

**Note:** The pipeline is **incremental by default** - buildings that already have a `3dModel` field are skipped to avoid expensive API calls ($0.35 per generation, 2-3 minutes each).

## Pipeline Flow

For each building:

1. **Check Existence** → Skip if `3dModel` field exists and not forcing regeneration
2. **Upload Image** → Upload reference image from `assets/image-refs/` to fal.ai storage
3. **Queue Job** → Submit to Trellis-2 queue (returns request ID immediately)
4. **Poll Status** → Check job status every 5-10 seconds
5. **Download GLB** → When completed, download .glb file from fal.ai
6. **Save Model** → Write to `assets/3d-models/{building-id}.glb`
7. **Update Registry** → Add `"3dModel": "assets/3d-models/..."` to building entry

All jobs run in **parallel** on fal.ai's infrastructure.

## Output

### Generated Files

- **3D Models**: `assets/3d-models/{building-id}.glb`
- **Updated Registry**: `app/data/generated-buildings.json` (with `3dModel` field)
- **Processing Log**: `assets/3d-models-results.json`

### Updated Registry Entry

Each processed building gets a `3dModel` field added:

```json
{
  "ferry-building": {
    "id": "ferry-building",
    "name": "Ferry Building",
    "category": "landmark",
    "footprint": { "width": 6, "height": 4 },
    "refImage": "assets/image-refs/ferry-building.png",
    "icon": "🏛️",
    "supportsRotation": true,
    "3dModel": "assets/3d-models/ferry-building.glb"
  }
}
```

## Troubleshooting

### "FAL_KEY is required"
- Make sure `.env` file exists in project root with `FAL_KEY` defined
- Get your key from https://fal.ai/dashboard/keys

### "Building has no reference image"
- The building must have completed Step 1 (Gemini image generation)
- Check that `refImage` field exists in `generated-buildings.json`

### Job fails with "Invalid image format"
- The reference image may be corrupted or in an unsupported format
- Try regenerating the reference image with `npm run generate-assets -- --force-regenerate`

### Jobs stuck in "IN_QUEUE" for a long time
- fal.ai may be experiencing high load
- Jobs will eventually process - the script will continue polling
- You can stop and restart later (completed jobs won't be re-queued)

### Upload fails
- Check internet connection
- Verify FAL_KEY is valid
- Check file exists at the specified path

## Next Steps

After running this step, you'll have 3D models ready for the final step: rendering them as pixel art sprites from 4 cardinal directions for use in the game.
