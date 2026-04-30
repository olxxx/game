import * as THREE from 'three';

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
    if (wy < 0 || wy >= 80) return false;
    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const chunk = this.findChunk(cx, cz);
    if (!chunk) return false;
    const lx = ((wx % 16) + 16) % 16;
    const lz = ((wz % 16) + 16) % 16;
    chunk.blocks[lx + lz * 16 + wy * 16 * 16] = blockId;
    this.rebuildChunk(chunk);
    return true;
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
    const { solidMesh, waterMesh } = chunk.buildMesh();
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
}
