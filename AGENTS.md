# AGENTS.md

## Overview

Minecraft-style voxel game. Three.js + Vite + vanilla JS (ES modules). No TypeScript, no tests, no lint, no framework.

## Commands

- `npm run dev` — start dev server (Vite)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build
- There are **no** test, lint, typecheck, or format commands

## Architecture

Single-page game. Entry: `index.html` → `src/main.js` (`Game` class).

| File | Role |
|---|---|
| `src/main.js` | Game loop, input, Three.js scene setup, mining/placement logic, hotbar UI |
| `src/chunk.js` | `Chunk` class — 16×16 columns, 80 blocks tall. Terrain gen via simplex noise, tree placement |
| `src/world.js` | `World` class — chunk registry, block get/set, raycasting, water spread (BFS), sand gravity |
| `src/meshing.js` | Greedy meshing: voxel data → Three.js `BufferGeometry`. Separate solid/transparent passes |
| `src/player.js` | `Player` class — AABB physics, collision resolution (8 iterations), water buoyancy |
| `src/items.js` | Block/tool definitions as numeric IDs. Mining speed, drop tables, tool effectiveness |
| `src/inventory.js` | `Inventory` class — 9 slots, 64-stack, default loadout, onChange callback |
| `src/texture.js` | Procedural canvas texture atlas (8×3 tiles, 16px each). `getBlockUV()` maps block ID + face → UV |
| `src/particles.js` | Mining particle effects (tiny cubes with lifetime) |

## Block ID registry (hardcoded everywhere)

Blocks: 1=Grass, 2=Dirt, 3=Stone, 4=Water, 5=Sand, 6=Log, 7=Leaves, 8=Cobblestone, 9=Planks
Tools: 10=Pickaxe, 11=Axe, 12=Shovel

When adding a new block or tool: update `ITEMS` in `items.js`, add colors in `main.js` (`getBlockColor`, `drawBlockIcon`), add texture tiles in `texture.js` (`drawTile` + `BLOCK_FACES`), and update `SOLID_BLOCKS` in `player.js` if it's solid.

## Key constants / gotchas

- Chunk size is 16×16, world height is 80 (hardcoded in `Chunk` constructor defaults and `World.getBlock`)
- World generates 7×7 chunks (−3 to +3 on X and Z) — change loop in `main.js` `init()`
- Textures are procedurally generated on canvas at startup, not loaded from files
- `TRANSPARENT_BLOCKS` in `meshing.js` is `Set([4])` — only water is transparent
- `SOLID_BLOCKS` in `player.js` is `Set([1,2,3,5,6,7,8,9])` — water (4) is not solid for collision
- Shared materials are lazily created module-level singletons in `chunk.js` (`getSharedMaterials()`)
- Raycast uses step-based marching (step=0.05), not Three.js Raycaster on meshes
- Mining progress resets if you look away (dot product < 0.5 check)
- The UI text in `index.html` is Chinese (controls hint)

## Conventions

- Pure ES modules (`"type": "module"` in package.json), no CommonJS
- No class inheritance — all classes are standalone
- Three.js objects are created inline, not imported from shared utils
- Block colors are duplicated across `main.js` functions (`getBlockColor`, `drawBlockIcon`) — keep them in sync
