# AGENTS.md

## Overview

Minecraft-style voxel game built with Three.js + Vite + vanilla JS (ES modules). No TypeScript, no tests, no lint, no framework.

## Commands

- `npm run dev` — start dev server (Vite)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build
- No test, lint, typecheck, or format commands

## Project Structure

```
index.html          — Entry HTML (UI shell, help overlay, links src/main.js)
style.css           — Full-bleed layout, crosshair, hotbar, help overlay styling
vite.config.js      — Minimal Vite config (root='.', publicDir='public')
src/
  main.js           — Game class: loop, input, scene, mining/placement, hotbar UI
  chunk.js          — Chunk class: terrain generation, mesh building
  world.js          — World class: chunk registry, block ops, raycast, water/sand
  meshing.js        — Greedy meshing: voxel data → BufferGeometry
  player.js         — Player class: AABB physics, collision, water buoyancy
  items.js          — Block/tool definitions, mining speed, drop tables
  inventory.js      — Inventory class: 9 slots, 64-stack, hotbar management
  texture.js        — Procedural canvas texture atlas
  particles.js      — Mining particle effects
```

## Architecture

Single-page game. `index.html` → `src/main.js` (`Game` class) drives everything.

| File | Responsibility |
|---|---|
| `src/main.js` | Game loop (`animate`), pointer lock input, Three.js scene/camera/renderer setup, mining state machine, block placement, hotbar UI rendering, number-key selection, ArrowLeft/ArrowRight hotbar cycling, dynamic chunk loading trigger, help overlay toggle (`H` key) |
| `src/chunk.js` | `Chunk` class — 16×16 columns, 80 blocks tall. Multi-octave simplex noise terrain (3 frequencies: 0.01/0.05/0.005), biome split (height<40 → desert/sand, ≥40 → grass/dirt/stone), tree generation (2% chance, height≥45 only, chunk-local) |
| `src/world.js` | `World` class — `Map<string, Chunk>` keyed by `"cx,cz"`. Block get/set with negative coord handling, step-based raycast (step=0.05), BFS water spread (MAX_LEVEL=7), sand gravity (single-block), dynamic 5×5 chunk loading |
| `src/meshing.js` | `greedyMesh()` — standard greedy algorithm, returns `{ solid, transparent }` BufferGeometry. `TRANSPARENT_BLOCKS = Set([4])` (water only). Solid/transparent rendered as separate meshes |
| `src/player.js` | `Player` class — AABB (0.6×1.8×0.6), gravity=-20, jumpSpeed=8, speed=6. 8-iteration collision resolution. Water physics uses state machine (`surfaceJumping`/`surfaceJumpTimer`) with separated `updateWaterPhysics()`/`updateLandPhysics()`. `isInWater()` checks 3 points (feet/mid/head). `isNearWaterSurface()` multi-point scan. Surface jump: speed=7, 0.15s protection period with reduced drag. `Space` ascend + `Ctrl` descend in water. Void respawn at y<-20 → (0,80,10). Eye height offset=1.6 |
| `src/items.js` | `ITEMS` array indexed by numeric ID. `ITEM_MAP` for O(1) lookup. Exports: `getItem`, `isTool`, `isBlock`, `getMineTime`, `getDropId`. BARE_HAND_SPEED=0.3 |
| `src/inventory.js` | `Inventory` — 9 slots × 64 stack. Default loadout: pickaxe, axe, shovel, grass×64, cobblestone×64, planks×64. `onChange` callback for UI sync |
| `src/texture.js` | Procedural canvas atlas: 8 cols × 3 rows, 16px tiles (128×48 total). `getBlockUV(blockId, faceAxis, dir)` → UV coords. NearestFilter for pixel art look |
| `src/particles.js` | `ParticleSystem` — tiny 0.08 cubes, 0.6s lifetime, gravity=-10. `emit()` for bursts, `emitContinuous()` for mining (30% chance/frame) |

## Block/Tool ID Registry

| ID | Name | Type | Hardness | Drops | Effective Tool |
|---|---|---|---|---|---|
| 0 | Air | — | — | — | — |
| 1 | Grass | block | 0.6 | 1 (self) | Shovel |
| 2 | Dirt | block | 0.5 | 2 (self) | Shovel |
| 3 | Stone | block | 1.5 | 8 (Cobblestone) | Pickaxe |
| 4 | Water | block | ∞ | — (unbreakable) | — |
| 5 | Sand | block | 0.5 | 5 (self) | Shovel |
| 6 | Log | block | 2.0 | 9 (Planks) | Axe |
| 7 | Leaves | block | 0.2 | 0 (nothing) | — |
| 8 | Cobblestone | block | 2.0 | 8 (self) | Pickaxe |
| 9 | Planks | block | 2.0 | 9 (self) | Axe |
| 10 | Pickaxe | tool | — | — | speed=4.0, effective: [3,8] |
| 11 | Axe | tool | — | — | speed=3.0, effective: [6,9] |
| 12 | Shovel | tool | — | — | speed=3.0, effective: [1,2,5] |

Adding a new block/tool requires changes in:
1. `items.js` — add to `ITEMS` array
2. `texture.js` — add tile drawing in `drawTile()`, add entry in `BLOCK_FACES`
3. `main.js` — add color in `getBlockColor()` and `drawBlockIcon()`
4. `player.js` — add to `SOLID_BLOCKS` if solid

## Key Constants

| Constant | Value | Location |
|---|---|---|
| Chunk size | 16×16 | `chunk.js` constructor, `world.js` getBlock/setBlock |
| World height | 80 | `chunk.js` constructor, `world.js` getBlock (hardcoded `>= 80`) |
| Initial chunks | 7×7 (−3 to +3) | `main.js` init |
| Dynamic load radius | 2 (5×5 area) | `world.js` loadChunksAroundPlayer |
| Player start | (0, 70, 10) | `main.js` init |
| Void respawn | y < -20 → (0, 80, 10) | `player.js` update |
| Raycast step | 0.05 | `world.js` raycast/waterRaycast |
| Raycast max dist | 8 | `main.js` (passed to raycast) |
| Mining cancel dot | 0.5 | `main.js` updateMining |
| Mouse sensitivity | 0.002 | `main.js` mousemove |
| Pitch clamp | ±(π/2 × 0.99) | `main.js` mousemove |
| Camera FOV | 70 | `main.js` init |
| Fog range | 100–200 | `main.js` init |
| Max dt cap | 0.05s | `main.js` animate |
| Water opacity | 0.6 | `chunk.js` getSharedMaterials |
| Water accel | 15 | `player.js` |
| Water drag | 4 | `player.js` |
| Water vertical accel | 12 | `player.js` |
| Water max speed | 4 | `player.js` |
| Water surface jump | 7 | `player.js` |
| Water surface snap | 0.5 | `player.js` |
| Water spread MAX_LEVEL | 7 | `world.js` spreadWater |
| Terrain height range | ~30–75 | `chunk.js` getHeight |
| Tree threshold | height ≥ 45, ~2% chance | `chunk.js` generateTrees |
| Tree trunk height | 4 | `chunk.js` placeTile |
| Tile size | 16px | `texture.js` TILE |
| Atlas | 8 cols × 3 rows (128×48px) | `texture.js` |
| Max stack | 64 | `inventory.js` |
| Hotbar slots | 9 | `inventory.js` |
| Particle lifetime | 0.6s | `particles.js` |
| Particle size | 0.08 | `particles.js` |

## Conventions

- Pure ES modules (`"type": "module"` in package.json), no CommonJS
- No class inheritance — all classes standalone
- Three.js objects created inline, not from shared utils
- Block colors duplicated in `getBlockColor()` and `drawBlockIcon()` — keep in sync
- Chunks keyed by `"cx,cz"` string — use `World.findChunk(cx, cz)` for O(1) lookup
- Textures are procedural canvas, not loaded files
- Shared materials are lazy-init module-level singletons in `chunk.js`
- Seed is `Math.random()` per session — terrain not reproducible
- UI text in `index.html` is Chinese (lang="zh-CN", help overlay)
- Hotbar selection supports number keys and wraparound left/right arrow cycling
