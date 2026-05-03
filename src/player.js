import * as THREE from 'three';

const SOLID_BLOCKS = new Set([1, 2, 3, 5, 6, 7, 8, 9, 13]);

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

    // Water physics
    this.inWater = false;
    this.waterAccel = 15;
    this.waterMaxSpeed = 4;
    this.waterDrag = 4;
    this.waterVerticalAccel = 12;
    this.waterMaxVerticalSpeed = 3;
    this.waterVerticalDrag = 3;
    this.waterSurfaceJumpSpeed = 7;
    this.surfaceSnap = 0.5;

    // Surface jump state tracking
    this.surfaceJumping = false;
    this.surfaceJumpTimer = 0;
    this.surfaceJumpDuration = 0.15; // seconds of reduced drag after jump
  }

  isInWater(world) {
    const px = Math.floor(this.position.x);
    const pz = Math.floor(this.position.z);

    // Check at feet, mid, and head heights
    const feetY = Math.floor(this.position.y + 0.2);
    const midY = Math.floor(this.position.y + 0.9);
    const headY = Math.floor(this.position.y + this.height - 0.1);

    const feetBlock = world.getBlock(px, feetY, pz);
    const midBlock = world.getBlock(px, midY, pz);
    const headBlock = world.getBlock(px, headY, pz);

    // In water if any of these points is water
    return feetBlock === 4 || midBlock === 4 || headBlock === 4;
  }

  isNearWaterSurface(world) {
    const px = Math.floor(this.position.x);
    const pz = Math.floor(this.position.z);
    const py = this.position.y;

    // Check if player's upper body is near water surface
    // Look for water at feet/mid and air above
    for (let checkY = Math.floor(py); checkY <= Math.floor(py + 1.5); checkY++) {
      const block = world.getBlock(px, checkY, pz);
      const above = world.getBlock(px, checkY + 1, pz);

      // Near surface if current is water and above is not solid
      if (block === 4 && !SOLID_BLOCKS.has(above)) {
        return true;
      }
    }

    return false;
  }

  update(dt, world, input = {}) {
    const wasInWater = this.inWater;
    this.inWater = this.isInWater(world);

    // Update surface jump timer
    if (this.surfaceJumping) {
      this.surfaceJumpTimer -= dt;
      if (this.surfaceJumpTimer <= 0 || !this.inWater) {
        this.surfaceJumping = false;
      }
    }

    if (this.inWater) {
      this.updateWaterPhysics(dt, world, input);
    } else {
      this.updateLandPhysics(dt, world, input);
    }

    // Apply velocity
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Collision resolution
    for (let iter = 0; iter < 8; iter++) {
      const collision = this.findCollision(world);
      if (!collision) break;
      this.resolve(collision);
    }

    this.checkGround(world);

    // Void respawn
    if (this.position.y < -20) {
      this.position.set(0, 80, 10);
      this.velocity.set(0, 0, 0);
    }

    return new THREE.Vector3(this.position.x, this.position.y + 1.6, this.position.z);
  }

  updateWaterPhysics(dt, world, input) {
    // Horizontal movement
    let dirX = input.moveDir?.x || 0;
    let dirZ = input.moveDir?.z || 0;
    const lenSq = dirX * dirX + dirZ * dirZ;
    if (lenSq > 1e-6) {
      const invLen = 1 / Math.sqrt(lenSq);
      dirX *= invLen;
      dirZ *= invLen;
      this.velocity.x += dirX * this.waterAccel * dt;
      this.velocity.z += dirZ * this.waterAccel * dt;
    }

    // Surface jump check
    const nearSurface = this.isNearWaterSurface(world);
    const shouldSurfaceJump = input.spaceJustPressed && nearSurface;

    if (shouldSurfaceJump && !this.surfaceJumping) {
      this.surfaceJumping = true;
      this.surfaceJumpTimer = this.surfaceJumpDuration;
      this.velocity.y = this.waterSurfaceJumpSpeed;
      // Small position boost to help clear water
      this.position.y += 0.05;
    }

    // Vertical movement (only if not surface jumping)
    if (!this.surfaceJumping) {
      const verticalInput = (input.spacePressed ? 1 : 0) + (input.ctrlPressed ? -1 : 0);
      if (verticalInput !== 0) {
        this.velocity.y += verticalInput * this.waterVerticalAccel * dt;
      }
    }

    // Apply drag (reduced during surface jump)
    const dragMultiplier = this.surfaceJumping ? 0.5 : 1.0;
    this.velocity.x -= this.velocity.x * this.waterDrag * dt * dragMultiplier;
    this.velocity.z -= this.velocity.z * this.waterDrag * dt * dragMultiplier;

    // Vertical drag - minimal during surface jump
    if (!this.surfaceJumping) {
      this.velocity.y -= this.velocity.y * this.waterVerticalDrag * dt;
    } else {
      // Only apply gravity-like effect, not full drag
      this.velocity.y -= 2 * dt;
    }

    // Speed limits
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > this.waterMaxSpeed) {
      const scale = this.waterMaxSpeed / horizSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    // Vertical speed limit (bypassed during surface jump)
    if (!this.surfaceJumping) {
      if (this.velocity.y > this.waterMaxVerticalSpeed) this.velocity.y = this.waterMaxVerticalSpeed;
      if (this.velocity.y < -this.waterMaxVerticalSpeed) this.velocity.y = -this.waterMaxVerticalSpeed;
    }
  }

  updateLandPhysics(dt, world, input) {
    // Horizontal movement
    let dirX = input.moveDir?.x || 0;
    let dirZ = input.moveDir?.z || 0;
    const lenSq = dirX * dirX + dirZ * dirZ;
    if (lenSq > 1e-6) {
      const invLen = 1 / Math.sqrt(lenSq);
      dirX *= invLen;
      dirZ *= invLen;
      this.velocity.x = dirX * this.speed;
      this.velocity.z = dirZ * this.speed;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }

    // Jump
    if (input.spacePressed) {
      this.jump();
    }

    // Gravity
    if (!this.onGround) {
      this.velocity.y += this.gravity * dt;
    }
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
    }
  }
}
