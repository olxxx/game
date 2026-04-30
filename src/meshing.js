import * as THREE from 'three';

const BLOCK_COLORS = {
  1: [0.3, 0.69, 0.31],
  2: [0.55, 0.27, 0.07],
  3: [0.5, 0.5, 0.5],
  4: [0.13, 0.59, 0.95],
  5: [0.96, 0.89, 0.69],
};

const TRANSPARENT_BLOCKS = new Set([4]);

export function greedyMesh(blocks, chunkSize, worldHeight) {
  const solidPositions = [];
  const solidNormals = [];
  const solidColors = [];
  const solidIndices = [];

  const transPositions = [];
  const transNormals = [];
  const transColors = [];
  const transIndices = [];

  const dims = [chunkSize, worldHeight, chunkSize];

  function getBlock(x, y, z) {
    if (x < 0 || x >= chunkSize || y < 0 || y >= worldHeight || z < 0 || z >= chunkSize) {
      return 0;
    }
    return blocks[x + z * chunkSize + y * chunkSize * chunkSize];
  }

  function addQuad(target, axis, dir, x, y, z, w, h, blockType) {
    const { positions, normals, colors, indices } = target;
    const color = BLOCK_COLORS[blockType];
    const vi = positions.length / 3;
    const n = [0, 0, 0];
    n[axis] = dir;

    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;

    const p = [x, y, z];
    const du = [0, 0, 0];
    const dv = [0, 0, 0];
    du[u] = w;
    dv[v] = h;

    const c0 = [p[0], p[1], p[2]];
    const c1 = [p[0] + du[0], p[1] + du[1], p[2] + du[2]];
    const c2 = [p[0] + du[0] + dv[0], p[1] + du[1] + dv[1], p[2] + du[2] + dv[2]];
    const c3 = [p[0] + dv[0], p[1] + dv[1], p[2] + dv[2]];

    for (const c of [c0, c1, c2, c3]) {
      positions.push(c[0], c[1], c[2]);
      normals.push(n[0], n[1], n[2]);
      colors.push(color[0], color[1], color[2]);
    }

    if (dir > 0) {
      indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    } else {
      indices.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
    }
  }

  function shouldRenderFace(block, neighbor) {
    if (block === 0) return false;
    if (TRANSPARENT_BLOCKS.has(block)) {
      return neighbor === 0 || (neighbor !== block && !TRANSPARENT_BLOCKS.has(neighbor));
    }
    return neighbor === 0 || TRANSPARENT_BLOCKS.has(neighbor);
  }

  for (let face = 0; face < 6; face++) {
    const axis = face >> 1;
    const dir = (face & 1) === 0 ? 1 : -1;
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const uDim = dims[u];
    const vDim = dims[v];

    const mask = new Int32Array(uDim * vDim);

    for (let d = (dir > 0 ? 0 : dims[axis] - 1); dir > 0 ? d < dims[axis] : d >= 0; d += dir) {
      let idx = 0;
      for (let iv = 0; iv < vDim; iv++) {
        for (let iu = 0; iu < uDim; iu++) {
          const pos = [0, 0, 0];
          pos[axis] = d;
          pos[u] = iu;
          pos[v] = iv;

          const block = getBlock(pos[0], pos[1], pos[2]);

          const nPos = [pos[0], pos[1], pos[2]];
          nPos[axis] += dir;
          const neighbor = getBlock(nPos[0], nPos[1], nPos[2]);

          if (shouldRenderFace(block, neighbor)) {
            mask[idx] = block;
          } else if (shouldRenderFace(neighbor, block)) {
            mask[idx] = -neighbor;
          } else {
            mask[idx] = 0;
          }
          idx++;
        }
      }

      idx = 0;
      for (let iv = 0; iv < vDim; iv++) {
        let iu = 0;
        while (iu < uDim) {
          const val = mask[idx];
          if (val === 0) {
            iu++;
            idx++;
            continue;
          }

          let w = 1;
          while (iu + w < uDim && mask[idx + w] === val) {
            w++;
          }

          let h = 1;
          let done = false;
          while (iv + h < vDim && !done) {
            for (let k = 0; k < w; k++) {
              if (mask[idx + k + h * uDim] !== val) {
                done = true;
                break;
              }
            }
            if (!done) h++;
          }

          for (let dh = 0; dh < h; dh++) {
            for (let dw = 0; dw < w; dw++) {
              mask[idx + dw + dh * uDim] = 0;
            }
          }

          const blockType = Math.abs(val);
          const realDir = val > 0 ? 1 : -1;

          const startPos = [0, 0, 0];
          if (realDir > 0) {
            startPos[axis] = d + 1;
          } else {
            startPos[axis] = d;
          }
          startPos[u] = iu;
          startPos[v] = iv;

          const target = TRANSPARENT_BLOCKS.has(blockType)
            ? { positions: transPositions, normals: transNormals, colors: transColors, indices: transIndices }
            : { positions: solidPositions, normals: solidNormals, colors: solidColors, indices: solidIndices };

          addQuad(target, axis, realDir, startPos[0], startPos[1], startPos[2], w, h, blockType);

          iu += w;
          idx += w;
        }
      }
    }
  }

  const solid = new THREE.BufferGeometry();
  solid.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3));
  solid.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
  solid.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3));
  solid.setIndex(solidIndices);

  const transparent = new THREE.BufferGeometry();
  transparent.setAttribute('position', new THREE.Float32BufferAttribute(transPositions, 3));
  transparent.setAttribute('normal', new THREE.Float32BufferAttribute(transNormals, 3));
  transparent.setAttribute('color', new THREE.Float32BufferAttribute(transColors, 3));
  transparent.setIndex(transIndices);

  return { solid, transparent };
}
