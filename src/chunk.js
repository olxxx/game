import * as THREE from 'three';

export class Chunk {
  constructor(chunkX, chunkZ, chunkSize = 16, worldHeight = 80) {
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    this.worldHeight = worldHeight;
    this.blocks = new Uint8Array(chunkSize * chunkSize * worldHeight);
    this.mesh = null;
  }

  getIndex(x, y, z) {
    return x + z * this.chunkSize + y * this.chunkSize * this.chunkSize;
  }

  generateTerrain() {
    for (let y = 0; y < this.worldHeight; y++) {
      for (let z = 0; z < this.chunkSize; z++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const index = this.getIndex(x, y, z);
          if (y < 60) {
            this.blocks[index] = 3; // stone
          } else if (y < 63) {
            this.blocks[index] = 2; // dirt
          } else if (y === 63) {
            this.blocks[index] = 1; // grass
          } else {
            this.blocks[index] = 0; // air
          }
        }
      }
    }
  }

  buildMesh() {
    const group = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    const materials = {
      1: new THREE.MeshStandardMaterial({ color: 0x4CAF50 }), // grass
      2: new THREE.MeshStandardMaterial({ color: 0x8B4513 }), // dirt
      3: new THREE.MeshStandardMaterial({ color: 0x808080 }), // stone
    };

    for (let y = 0; y < this.worldHeight; y++) {
      for (let z = 0; z < this.chunkSize; z++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const index = this.getIndex(x, y, z);
          const blockType = this.blocks[index];

          if (blockType !== 0) {
            const mesh = new THREE.Mesh(geometry, materials[blockType]);
            mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
            group.add(mesh);
          }
        }
      }
    }

    group.position.set(this.chunkX * this.chunkSize, 0, this.chunkZ * this.chunkSize);
    this.mesh = group;
    return group;
  }
}
