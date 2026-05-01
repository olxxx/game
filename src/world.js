import * as THREE from 'three';
import { getDropId } from './items.js';

export class World {
  constructor(chunks, scene) {
    this.chunks = chunks;
    this.scene = scene;
  }

  findChunk(cx, cz) {
    for (const chunk of this.chunks) {
      if (chunk.chunkX === cx && chunk.chunkZ === cz) return chunk;
    }
    return null;
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= 80) return 0;
    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const chunk = this.findChunk(cx, cz);
    if (!chunk) return 0;
    const lx = ((wx % 16) + 16) % 16;
    const lz = ((wz % 16) + 16) % 16;
    return chunk.blocks[lx + lz * 16 + wy * 16 * 16];
  }

  setBlock(wx, wy, wz, blockId) {
    if (wy < 0 || wy >= 80) return { success: false, dropId: 0 };
    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const chunk = this.findChunk(cx, cz);
    if (!chunk) return { success: false, dropId: 0 };
    const lx = ((wx % 16) + 16) % 16;
    const lz = ((wz % 16) + 16) % 16;
    const index = lx + lz * 16 + wy * 16 * 16;

    const oldBlockId = chunk.blocks[index];

    if (blockId === 0) {
      const dropId = getDropId(oldBlockId);
      if (this.hasAdjacentWater(wx, wy, wz)) {
        chunk.blocks[index] = 4;
        this.spreadWater(wx, wy, wz, chunk);
      } else {
        chunk.blocks[index] = 0;
      }
      this.handleSandFall(wx, wy + 1, wz);
      this.rebuildChunk(chunk);
      return { success: true, dropId };
    }

    if (chunk.blocks[index] !== 0 && chunk.blocks[index] !== 4) return { success: false, dropId: 0 };
    chunk.blocks[index] = blockId;
    this.rebuildChunk(chunk);
    return { success: true, dropId: 0 };
  }

  rebuildChunk(chunk) {
    if (chunk.mesh) {
      this.scene.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
    }
    if (chunk.waterMesh) {
      this.scene.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
    }
    const { solidMesh, waterMesh } = chunk.buildMesh(this.chunks);
    this.scene.add(solidMesh);
    this.scene.add(waterMesh);
  }

  raycast(camera, maxDist) {
    const raycaster = new THREE.Raycaster();
    raycaster.far = maxDist;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const dir = raycaster.ray.direction.clone().normalize();
    const origin = raycaster.ray.origin.clone();

    let prevX = Math.floor(origin.x);
    let prevY = Math.floor(origin.y);
    let prevZ = Math.floor(origin.z);

    const step = 0.05;
    const pos = origin.clone();

    for (let t = 0; t < maxDist; t += step) {
      pos.copy(origin).addScaledVector(dir, t);

      const bx = Math.floor(pos.x);
      const by = Math.floor(pos.y);
      const bz = Math.floor(pos.z);

      if (bx === prevX && by === prevY && bz === prevZ) continue;

      const block = this.getBlock(bx, by, bz);
      if (block !== 0 && block !== 4) {
        const nx = prevX - bx;
        const ny = prevY - by;
        const nz = prevZ - bz;

        return {
          blockPos: new THREE.Vector3(bx, by, bz),
          placePos: new THREE.Vector3(bx + nx, by + ny, bz + nz),
          normal: new THREE.Vector3(nx, ny, nz),
          blockId: block,
        };
      }

      prevX = bx;
      prevY = by;
      prevZ = bz;
    }

    return null;
  }

  waterRaycast(camera, maxDist) {
    const raycaster = new THREE.Raycaster();
    raycaster.far = maxDist;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const dir = raycaster.ray.direction.clone().normalize();
    const origin = raycaster.ray.origin.clone();

    const step = 0.05;
    const pos = origin.clone();
    let prevBlock = 0;
    let waterPos = null;

    for (let t = 0; t < maxDist; t += step) {
      pos.copy(origin).addScaledVector(dir, t);

      const bx = Math.floor(pos.x);
      const by = Math.floor(pos.y);
      const bz = Math.floor(pos.z);
      const curBlock = this.getBlock(bx, by, bz);

      if (curBlock === 4) {
        waterPos = new THREE.Vector3(bx, by, bz);
      }

      if (curBlock !== prevBlock) {
        if (curBlock !== 4 && prevBlock === 4 && waterPos) {
          return {
            blockPos: waterPos,
            placePos: waterPos.clone(),
            normal: new THREE.Vector3(0, 1, 0),
            blockId: 4,
          };
        }
        prevBlock = curBlock;
      }
    }

    if (waterPos && prevBlock === 4) {
      return {
        blockPos: waterPos,
        placePos: waterPos.clone(),
        normal: new THREE.Vector3(0, 1, 0),
        blockId: 4,
      };
    }

    return null;
  }

  hasAdjacentWater(wx, wy, wz) {
    const dirs = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    for (const [dx, dy, dz] of dirs) {
      if (this.getBlock(wx + dx, wy + dy, wz + dz) === 4) return true;
    }
    return false;
  }

  spreadWater(wx, wy, wz, sourceChunk) {
    const MAX_LEVEL = 7;
    const visited = new Set();
    const results = new Map();

    const startKey = `${wx},${wy},${wz}`;
    visited.add(startKey);
    const queue = [{ x: wx, y: wy, z: wz, level: 1 }];

    while (queue.length > 0) {
      const { x, y, z, level } = queue.shift();

      // 重力优先：向下
      if (y > 0) {
        const belowKey = `${x},${y-1},${z}`;
        if (!visited.has(belowKey)) {
          visited.add(belowKey);
          const below = this.getBlock(x, y-1, z);
          if (below === 0) {
            results.set(belowKey, level);
            queue.unshift({ x, y: y-1, z, level });
          }
        }
      }

      // 水平扩散（等级递减）
      if (level < MAX_LEVEL) {
        const horiz = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
        for (const [dx, dy, dz] of horiz) {
          const nx = x+dx, nz = z+dz;
          const key = `${nx},${y},${nz}`;
          if (visited.has(key)) continue;
          visited.add(key);
          const block = this.getBlock(nx, y, nz);
          if (block === 0) {
            results.set(key, level + 1);
            queue.push({ x: nx, y, z: nz, level: level + 1 });
          }
        }
      }

      // 向上填充（需要四面都是水）
      if (y < 79 && level < MAX_LEVEL) {
        const aboveKey = `${x},${y+1},${z}`;
        if (!visited.has(aboveKey) && this.getBlock(x, y+1, z) === 0) {
          const hDirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
          const allWater = hDirs.every(([dx,,dz]) => {
            const nbBlock = this.getBlock(x+dx, y+1, z+dz);
            return nbBlock === 4 || results.has(`${x+dx},${y+1},${z+dz}`);
          });
          if (allWater) {
            visited.add(aboveKey);
            results.set(aboveKey, level + 1);
            queue.push({ x, y: y+1, z, level: level + 1 });
          }
        }
      }
    }

    // 批量写入
    const affectedChunks = new Set();
    for (const [key] of results) {
      const [sx, sy, sz] = key.split(',').map(Number);
      if (sy < 0 || sy >= 80) continue;
      const cx = Math.floor(sx / 16);
      const cz = Math.floor(sz / 16);
      const chunk = this.findChunk(cx, cz);
      if (!chunk) continue;
      const lx = ((sx % 16) + 16) % 16;
      const lz = ((sz % 16) + 16) % 16;
      chunk.blocks[lx + lz * 16 + sy * 16 * 16] = 4;
      affectedChunks.add(chunk);
    }

    affectedChunks.add(sourceChunk);
    for (const c of affectedChunks) {
      this.rebuildChunk(c);
    }
  }

  handleSandFall(wx, wy, wz) {
    let y = wy;
    const sandBlocks = [];

    while (y < 80) {
      const block = this.getBlock(wx, y, wz);
      if (block === 5) {
        sandBlocks.push(y);
        y++;
      } else {
        break;
      }
    }

    if (sandBlocks.length === 0) return;

    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const chunk = this.findChunk(cx, cz);
    if (!chunk) return;

    const lx = ((wx % 16) + 16) % 16;
    const lz = ((wz % 16) + 16) % 16;
    const baseIndex = lx + lz * 16;

    for (let i = 0; i < sandBlocks.length; i++) {
      const fromY = sandBlocks[i];
      const toY = fromY - 1;

      if (toY < 0) break;
      if (chunk.blocks[baseIndex + toY * 256] !== 0) break;

      chunk.blocks[baseIndex + fromY * 256] = 0;
      chunk.blocks[baseIndex + toY * 256] = 5;
    }

    this.rebuildChunk(chunk);
  }
}
