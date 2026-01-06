# isometric-city

An isometric city builder engine built with Phaser 3 and Next.js. Place buildings, lay roads, and watch citizens and cars roam your city.

## Features

- **Isometric Rendering** - Classic 2:1 isometric projection with proper depth sorting
- **Building System** - Place multi-tile buildings with 4-direction rotation support
- **Road Network** - Auto-connecting roads with proper intersection handling
- **Animated Characters** - GIF-based walking animations in 4 directions
- **Vehicles** - Cars that drive along roads
- **Save/Load** - Persist your city to localStorage
- **Multiple Tile Types** - Grass, asphalt, snow, and more
- **Building Categories** - Residential, commercial, civic, landmarks, and props

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to start building.

## Tech Stack

- **Framework:** Next.js 16 with React 19
- **Game Engine:** Phaser 3.90
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript 5
- **GIF Support:** gifuct-js for character animations

## Project Structure

```
app/
├── components/
│   ├── game/
│   │   ├── phaser/           # Phaser game engine
│   │   │   ├── MainScene.ts  # Core rendering & game logic
│   │   │   └── PhaserGame.tsx# React wrapper
│   │   ├── GameBoard.tsx     # Main React component
│   │   ├── types.ts          # TypeScript types & enums
│   │   └── roadUtils.ts      # Road connection logic
│   └── ui/                   # React UI components
├── data/
│   └── buildings.ts          # Building registry
└── utils/
    └── sounds.ts             # Audio effects

public/
├── Building/                 # Building sprites by category
├── Tiles/                    # Ground tiles
├── Characters/               # Walking animations (GIFs)
└── cars/                     # Vehicle sprites
```

---

## How the Isometric System Works

### The Basics

Isometric projection creates a 3D-like view from 2D sprites. This engine uses **2:1 isometric** (also called "true isometric" or "dimetric"), where:

- Tiles are diamond-shaped, **32x16 pixels**
- The X-axis goes down-right
- The Y-axis goes down-left
- Depth (what's in front) is determined by position

### Coordinate Conversion

Converting between grid coordinates (x, y) and screen pixels:

```typescript
// Grid → Screen
function gridToScreen(gridX: number, gridY: number) {
  return {
    screenX: (gridX - gridY) * (TILE_WIDTH / 2),
    screenY: (gridX + gridY) * (TILE_HEIGHT / 2)
  };
}

// Screen → Grid
function screenToGrid(screenX: number, screenY: number) {
  return {
    gridX: Math.floor(screenX / TILE_WIDTH + screenY / TILE_HEIGHT),
    gridY: Math.floor(screenY / TILE_HEIGHT - screenX / TILE_WIDTH)
  };
}
```

### Depth Sorting

The key to isometric rendering is drawing things in the right order. Objects further "back" (higher up on screen) must be drawn first.

```typescript
// Basic depth formula
depth = (gridX + gridY) * DEPTH_MULTIPLIER;

// With layer offsets for different object types:
// 0.00 - Ground tiles
// 0.03 - Back fences
// 0.05 - Buildings
// 0.06 - Props/trees
// 0.10 - Cars
// 0.20 - Characters
```

### Multi-Tile Buildings

Large buildings occupy multiple grid cells but are rendered as a single sprite anchored at their "origin" tile (typically the front corner).

```typescript
interface BuildingDefinition {
  footprint: { width: number; height: number };
  sprites: {
    south: string;  // Default facing
    north?: string;
    east?: string;
    west?: string;
  };
}
```

### Sprite Standards

Building sprites follow these conventions:
- **Canvas size:** Typically 512x512 or larger
- **Anchor point:** Front corner at bottom-center of canvas
- **Naming:** `{width}x{height}{name}_{direction}.png`
  - Example: `4x4bookstore_south.png`

### Vertical Slicing (Tall Buildings)

Very tall buildings can cause depth sorting issues when characters walk "behind" them. The solution is to slice the sprite into horizontal strips and give each strip a different depth:

```typescript
// Slice a tall building into strips
for (let slice = 0; slice < numSlices; slice++) {
  const sliceDepth = baseDepth + (slice * 0.001);
  // Render slice at sliceDepth
}
```

---

## Inspiration

- **SimCity 3000/4** - The gold standard for city simulation
- **RollerCoaster Tycoon 1 & 2** - Chris Sawyer's masterpiece, hand-coded in assembly

---

## Adding Buildings

Buildings are defined in `app/data/buildings.ts`:

```typescript
"my-building": {
  id: "my-building",
  name: "My Building",
  category: "commercial",
  footprint: { width: 2, height: 2 },
  sprites: {
    south: "/Building/commercial/2x2my_building_south.png",
    north: "/Building/commercial/2x2my_building_north.png",
    east: "/Building/commercial/2x2my_building_east.png",
    west: "/Building/commercial/2x2my_building_west.png",
  },
  icon: "🏢",
  supportsRotation: true,
}
```

---

## Asset Pipeline

Want to make your own isometric buildings? Here's a modern AI-assisted pipeline:

### 1. Generate Concept Art

Use Nano Banana to generate isometric concept art.
- Prompt for "isometric view" or "3/4 view"
- Specify architectural style (Victorian, modern, brutalist, etc.)
- Include "game asset" or "video game building" for cleaner results

### 2. Convert to 3D
Turn your 2D concept into a 3D model. This gives you the ability to render from any angle consistently.

**Tools:**
- [Trellis](https://github.com/microsoft/TRELLIS) - Microsoft's image-to-3D
- [Hunyuan3D](https://github.com/Tencent/Hunyuan3D-1) - Tencent's image-to-3D
- Tripo, Meshy, or other image-to-3D services

### 3. Render Isometric Sprites

Run an automated pipeline to render out isometric sprites from the 3D model.

**Camera setup for 2:1 isometric:**
- Orthographic projection
- 30° rotation from top-down
- 90° rotation for each cardinal direction (0°, 90°, 180°, 270°)

### 4. Post-Processing
Clean up your renders and ensure consistency:
- Match the color palette of existing assets
- Ensure transparent backgrounds
- Check that the anchor point aligns with the grid

### Sprite Specifications

| Property | Value |
|----------|-------|
| Tile size | 32x16 pixels |
| Canvas size | 512x512 (or larger for big buildings) |
| Anchor point | Bottom-center (front corner of building) |
| Format | PNG with transparency |
| Directions | South (required), North/East/West (optional) |

---

## Contributing

Contributions are welcome! Some areas that could use help:

- **More buildings** - Different architectural styles, eras, themes
- **Performance** - Optimization for larger maps
- **Documentation** - Tutorials, examples, better docs
