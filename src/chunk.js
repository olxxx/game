import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { greedyMesh } from './meshing.js';
import { createTextureAtlas } from './texture.js';

const noise2D = createNoise2D();

let sharedTexture = null;
let sharedSolidMaterial = null;
let sharedWaterMaterial = null;

function getSharedMaterials() {
  if (!sharedTexture) {
    sharedTexture = createTextureAtlas();
    sharedSolidMaterial = new THREE.MeshStandardMaterial({
      map: sharedTexture,
    });
    sharedWaterMaterial = new THREE.MeshStandardMaterial({
      map: sharedTexture,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
  }
  return { solidMaterial: sharedSolidMaterial, waterMaterial: sharedWaterMaterial };
}

export class Chunk {
  constructor(chunkX, chunkZ, chunkSize = 16, worldHeight = 80) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    this.worldHeight = worldHeight;
    this.blocks = new Uint8Array(chunkSize * chunkSize * worldHeight);
    this.mesh = null;
    this.waterMesh = null;
  }

  getIndex(x, y, z) {
    return x + z * this.chunkSize + y * this.chunkSize * this.chunkSize;
  }

  getHeight(wx, wz) {
    const scale = 0.01;
    const n = noise2D(wx * scale, wz * scale);
    return Math.floor(30 + (n + 1) * 0.5 * 45);
  }

  generateTerrain() {
    for (let z = 0; z < this.chunkSize; z++) {
      for (let x = 0; x < this.chunkSize; x++) {
        const wx = this.chunkX * this.chunkSize + x;
        const wz = this.chunkZ * this.chunkSize + z;
        const surfaceHeight = this.getHeight(wx, wz);

        for (let y = 0; y < this.worldHeight; y++) {
          const index = this.getIndex(x, y, z);

          if (surfaceHeight < 40) {
            if (y < surfaceHeight) {
              this.blocks[index] = 5;
            } else if (y <= 40) {
              this.blocks[index] = 4;
            } else {
              this.blocks[index] = 0;
            }
          } else {
            if (y < surfaceHeight - 3) {
              this.blocks[index] = 3;
            } else if (y < surfaceHeight) {
              this.blocks[index] = 2;
            } else if (y === surfaceHeight) {
              this.blocks[index] = 1;
            } else {
              this.blocks[index] = 0;
            }
          }
        }
      }
    }

    this.generateTrees();
  }

  generateTrees() {
    const treePositions = [];
    for (let z = 2; z < this.chunkSize - 2; z++) {
      for (let x = 2; x < this.chunkSize - 2; x++) {
        const wx = this.chunkX * this.chunkSize + x;
        const wz = this.chunkZ * this.chunkSize + z;
        const h = this.getHeight(wx, wz);
        if (h < 45) continue;
        const hash = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453;
        if ((hash - Math.floor(hash)) > 0.02) continue;
        treePositions.push({ x, z, h });
      }
    }

    for (const t of treePositions) {
      this.placeTree(t.x, t.h + 1, t.z);
    }
  }

  placeTree(x, y, z) {
    const trunkH = 4;
    for (let i = 0; i < trunkH; i++) {
      if (y + i < this.worldHeight) {
        this.blocks[this.getIndex(x, y + i, z)] = 6;
      }
    }

    const leafBase = y + trunkH - 1;
    for (let dy = 0; dy < 3; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const lx = x + dx;
          const ly = leafBase + dy;
          const lz = z + dz;
          if (lx < 0 || lx >= this.chunkSize || lz < 0 || lz >= this.chunkSize || ly >= this.worldHeight) continue;
          if (dx === 0 && dz === 0 && dy < 2) continue;
          const idx = this.getIndex(lx, ly, lz);
          if (this.blocks[idx] === 0) {
            this.blocks[idx] = 7;
          }
        }
      }
    }
  }

  buildMesh() {
    const { solid, transparent } = greedyMesh(this.blocks, this.chunkSize, this.worldHeight);
    const { solidMaterial, waterMaterial } = getSharedMaterials();

    const solidMesh = new THREE.Mesh(solid, solidMaterial);
    solidMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);

    const waterMesh = new THREE.Mesh(transparent, waterMaterial);
    waterMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);

    this.mesh = solidMesh;
    this.waterMesh = waterMesh;

    return { solidMesh, waterMesh };
  }
}
