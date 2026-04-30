import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { greedyMesh } from './meshing.js';

const noise2D = createNoise2D();

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
              this.blocks[index] = 5; // sand
            } else if (y <= 40) {
              this.blocks[index] = 4; // water
            } else {
              this.blocks[index] = 0; // air
            }
          } else {
            if (y < surfaceHeight - 3) {
              this.blocks[index] = 3; // stone
            } else if (y < surfaceHeight) {
              this.blocks[index] = 2; // dirt
            } else if (y === surfaceHeight) {
              this.blocks[index] = 1; // grass
            } else {
              this.blocks[index] = 0; // air
            }
          }
        }
      }
    }
  }

  buildMesh() {
    const { solid, transparent } = greedyMesh(this.blocks, this.chunkSize, this.worldHeight);

    const solidMaterial = new THREE.MeshStandardMaterial({ vertexColors: true });
    const solidMesh = new THREE.Mesh(solid, solidMaterial);
    solidMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);

    const waterMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });
    const waterMesh = new THREE.Mesh(transparent, waterMaterial);
    waterMesh.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);

    this.mesh = solidMesh;
    this.waterMesh = waterMesh;

    return { solidMesh, waterMesh };
  }
}
