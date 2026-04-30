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
    if (!this.onGround) {
      this.velocity.y += this.gravity * dt;
    }

    this.position.x += this.velocity.x * dt;
    this.resolveAxis(chunks, 'x');

    this.position.y += this.velocity.y * dt;
    this.resolveAxis(chunks, 'y');

    this.position.z += this.velocity.z * dt;
    this.resolveAxis(chunks, 'z');

    if (this.position.y < -20) {
      this.position.set(0, 80, 10);
      this.velocity.set(0, 0, 0);
    }

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
    return SOLID_BLOCKS.has(this.getBlock(chunks, wx, wy, wz));
  }

  resolveAxis(chunks, axis) {
    const hw = this.width / 2;
    const hd = this.depth / 2;

    const minBX = Math.floor(this.position.x - hw);
    const maxBX = Math.floor(this.position.x + hw);
    const minBY = Math.floor(this.position.y);
    const maxBY = Math.floor(this.position.y + this.height);
    const minBZ = Math.floor(this.position.z - hd);
    const maxBZ = Math.floor(this.position.z + hd);

    for (let by = minBY; by <= maxBY; by++) {
      for (let bz = minBZ; bz <= maxBZ; bz++) {
        for (let bx = minBX; bx <= maxBX; bx++) {
          if (!this.isSolid(chunks, bx, by, bz)) continue;

          const overlapX = this.position.x + hw > bx && this.position.x - hw < bx + 1;
          const overlapY = this.position.y + this.height > by && this.position.y < by + 1;
          const overlapZ = this.position.z + hd > bz && this.position.z - hd < bz + 1;

          if (!overlapX || !overlapY || !overlapZ) continue;

          if (axis === 'x') {
            const penLeft = (this.position.x + hw) - bx;
            const penRight = (bx + 1) - (this.position.x - hw);
            if (penLeft < penRight) {
              this.position.x = bx - hw;
            } else {
              this.position.x = bx + 1 + hw;
            }
            this.velocity.x = 0;
          } else if (axis === 'y') {
            const penDown = (this.position.y + this.height) - by;
            const penUp = (by + 1) - this.position.y;
            if (penDown < penUp) {
              this.position.y = by - this.height;
            } else {
              this.position.y = by + 1;
              this.onGround = true;
            }
            this.velocity.y = 0;
          } else if (axis === 'z') {
            const penFront = (this.position.z + hd) - bz;
            const penBack = (bz + 1) - (this.position.z - hd);
            if (penFront < penBack) {
              this.position.z = bz - hd;
            } else {
              this.position.z = bz + 1 + hd;
            }
            this.velocity.z = 0;
          }
        }
      }
    }

    if (axis === 'y') {
      const minBX2 = Math.floor(this.position.x - hw);
      const maxBX2 = Math.floor(this.position.x + hw);
      const minBZ2 = Math.floor(this.position.z - hd);
      const maxBZ2 = Math.floor(this.position.z + hd);
      const checkY = Math.floor(this.position.y - 0.01);
      let grounded = false;
      for (let bz = minBZ2; bz <= maxBZ2 && !grounded; bz++) {
        for (let bx = minBX2; bx <= maxBX2 && !grounded; bx++) {
          if (this.isSolid(chunks, bx, checkY, bz)) {
            grounded = true;
          }
        }
      }
      if (!grounded) this.onGround = false;
    }
  }

  jump() {
    if (this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    }
  }
}
