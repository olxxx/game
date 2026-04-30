import * as THREE from 'three';

const SOLID_BLOCKS = new Set([1, 2, 3, 5]);

export class Player {
  constructor(x, y, z) {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.width = 0.6;
    this.height = 1.8;
    this.depth = 0.6;
    this.gravity = -20;
    this.jumpSpeed = 8;
    this.speed = 6;
    this.onGround = false;
  }

  update(dt, chunks) {
    this.velocity.y += this.gravity * dt;

    const moveX = this.velocity.x * dt;
    const moveY = this.velocity.y * dt;
    const moveZ = this.velocity.z * dt;

    this.position.x += moveX;
    this.resolveCollisionX(chunks);

    this.position.y += moveY;
    this.resolveCollisionY(chunks);

    this.position.z += moveZ;
    this.resolveCollisionZ(chunks);

    return new THREE.Vector3(this.position.x, this.position.y + 1.6, this.position.z);
  }

  getBlock(chunks, wx, wy, wz) {
    if (wy < 0 || wy >= 80) return 0;

    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);

    for (const chunk of chunks) {
      if (chunk.chunkX === cx && chunk.chunkZ === cz) {
        const lx = ((wx % 16) + 16) % 16;
        const lz = ((wz % 16) + 16) % 16;
        return chunk.blocks[lx + lz * 16 + wy * 16 * 16];
      }
    }
    return 0;
  }

  isSolid(chunks, wx, wy, wz) {
    const block = this.getBlock(chunks, wx, wy, wz);
    return SOLID_BLOCKS.has(block);
  }

  collidesWithWorld(chunks) {
    const hw = this.width / 2;
    const hd = this.depth / 2;

    const minX = Math.floor(this.position.x - hw + 0.001);
    const maxX = Math.floor(this.position.x + hw - 0.001);
    const minY = Math.floor(this.position.y + 0.001);
    const maxY = Math.floor(this.position.y + this.height - 0.001);
    const minZ = Math.floor(this.position.z - hd + 0.001);
    const maxZ = Math.floor(this.position.z + hd - 0.001);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (this.isSolid(chunks, x, y, z)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  resolveCollisionX(chunks) {
    if (!this.collidesWithWorld(chunks)) return;

    const hw = this.width / 2;
    if (this.velocity.x > 0) {
      this.position.x = Math.floor(this.position.x + hw) - hw - 0.001;
    } else if (this.velocity.x < 0) {
      this.position.x = Math.floor(this.position.x - hw) + 1 + hw + 0.001;
    }
    this.velocity.x = 0;
  }

  resolveCollisionY(chunks) {
    this.onGround = false;
    if (!this.collidesWithWorld(chunks)) return;

    if (this.velocity.y < 0) {
      this.position.y = Math.floor(this.position.y) + 1 + 0.001;
      this.onGround = true;
    } else if (this.velocity.y > 0) {
      this.position.y = Math.ceil(this.position.y + this.height) - this.height - 0.001;
    }
    this.velocity.y = 0;
  }

  resolveCollisionZ(chunks) {
    if (!this.collidesWithWorld(chunks)) return;

    const hd = this.depth / 2;
    if (this.velocity.z > 0) {
      this.position.z = Math.floor(this.position.z + hd) - hd - 0.001;
    } else if (this.velocity.z < 0) {
      this.position.z = Math.floor(this.position.z - hd) + 1 + hd + 0.001;
    }
    this.velocity.z = 0;
  }

  jump() {
    if (this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }
  }
}
