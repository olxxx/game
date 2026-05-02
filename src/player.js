import * as THREE from 'three';

const SOLID_BLOCKS = new Set([1, 2, 3, 5, 6, 7, 8, 9]);

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

  update(dt, world) {
    const inWater = this.isInWater(world);
    this.inWater = inWater;

    if (inWater) {
      this.velocity.y *= 0.95;
    }

    if (!this.onGround) {
      const gravity = inWater ? this.gravity * 0.2 : this.gravity;
      this.velocity.y += gravity * dt;
    }

    const speedMult = inWater ? 0.5 : 1.0;
    this.position.x += this.velocity.x * dt * speedMult;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt * speedMult;

    for (let iter = 0; iter < 8; iter++) {
      const collision = this.findCollision(world);
      if (!collision) break;
      this.resolve(collision);
    }

    this.checkGround(world);

    if (this.position.y < -20) {
      this.position.set(0, 80, 10);
      this.velocity.set(0, 0, 0);
    }

    return new THREE.Vector3(this.position.x, this.position.y + 1.6, this.position.z);
  }

  isSolid(world, wx, wy, wz) {
    return SOLID_BLOCKS.has(world.getBlock(wx, wy, wz));
  }

  findCollision(world) {
    const hw = this.width / 2;
    const hd = this.depth / 2;
    const px = this.position.x;
    const py = this.position.y;
    const pz = this.position.z;

    const minX = Math.floor(px - hw);
    const maxX = Math.floor(px + hw);
    const minY = Math.floor(py);
    const maxY = Math.floor(py + this.height);
    const minZ = Math.floor(pz - hd);
    const maxZ = Math.floor(pz + hd);

    let bestPen = Infinity;
    let bestAxis = -1;
    let bestDir = 0;

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (!this.isSolid(world, bx, by, bz)) continue;

          const overlapX = px + hw > bx && px - hw < bx + 1;
          const overlapY = py + this.height > by && py < by + 1;
          const overlapZ = pz + hd > bz && pz - hd < bz + 1;
          if (!overlapX || !overlapY || !overlapZ) continue;

          const penNX = px + hw - bx;
          const penPX = bx + 1 - (px - hw);
          const penNY = py + this.height - by;
          const penPY = by + 1 - py;
          const penNZ = pz + hd - bz;
          const penPZ = bz + 1 - (pz - hd);

          if (penNX < bestPen) { bestPen = penNX; bestAxis = 0; bestDir = -1; }
          if (penPX < bestPen) { bestPen = penPX; bestAxis = 0; bestDir = 1; }
          if (penNY < bestPen) { bestPen = penNY; bestAxis = 1; bestDir = -1; }
          if (penPY < bestPen) { bestPen = penPY; bestAxis = 1; bestDir = 1; }
          if (penNZ < bestPen) { bestPen = penNZ; bestAxis = 2; bestDir = -1; }
          if (penPZ < bestPen) { bestPen = penPZ; bestAxis = 2; bestDir = 1; }
        }
      }
    }

    if (bestAxis === -1) return null;
    return { axis: bestAxis, dir: bestDir, pen: bestPen };
  }

  resolve(col) {
    const { axis, dir, pen } = col;
    const eps = 0.0001;

    if (axis === 0) {
      this.position.x += dir * (pen + eps);
      if (dir < 0) this.velocity.x = Math.min(this.velocity.x, 0);
      else this.velocity.x = Math.max(this.velocity.x, 0);
    } else if (axis === 1) {
      this.position.y += dir * (pen + eps);
      if (dir < 0) this.velocity.y = Math.min(this.velocity.y, 0);
      else this.velocity.y = Math.max(this.velocity.y, 0);
    } else {
      this.position.z += dir * (pen + eps);
      if (dir < 0) this.velocity.z = Math.min(this.velocity.z, 0);
      else this.velocity.z = Math.max(this.velocity.z, 0);
    }
  }

  checkGround(world) {
    const hw = this.width / 2;
    const hd = this.depth / 2;
    const checkY = Math.floor(this.position.y - 0.01);
    if (checkY < 0) { this.onGround = false; return; }

    const minX = Math.floor(this.position.x - hw);
    const maxX = Math.floor(this.position.x + hw);
    const minZ = Math.floor(this.position.z - hd);
    const maxZ = Math.floor(this.position.z + hd);

    this.onGround = false;
    for (let z = minZ; z <= maxZ && !this.onGround; z++) {
      for (let x = minX; x <= maxX && !this.onGround; x++) {
        if (this.isSolid(world, x, checkY, z)) {
          this.onGround = true;
        }
      }
    }
  }

  jump() {
    if (this.onGround) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
    } else if (this.inWater) {
      this.velocity.y = this.jumpSpeed * 0.6;
    }
  }

  isInWater(world) {
    const block = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.9),
      Math.floor(this.position.z)
    );
    return block === 4;
  }
}
