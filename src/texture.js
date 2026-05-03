import * as THREE from 'three';

const TILE = 16;
const COLS = 9;
const ROWS = 3;

export const FACE_TOP = 0;
export const FACE_SIDE = 1;
export const FACE_BOTTOM = 2;

export function createTextureAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * COLS;
  canvas.height = TILE * ROWS;
  const ctx = canvas.getContext('2d');

  function drawTile(col, row, baseR, baseG, baseB, noiseFn) {
    const ox = col * TILE;
    const oy = row * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const [r, g, b] = noiseFn(x, y, baseR, baseG, baseB);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  function noiseGrassTop(x, y, r, g, b) {
    const d = Math.random() > 0.7 ? -30 : (Math.random() > 0.5 ? 15 : 0);
    return [clamp(r + d - 10), clamp(g + d + 20), clamp(b + d - 10)];
  }

  function noiseGrassSide(x, y, r, g, b) {
    if (y > 10) {
      const d = (Math.random() - 0.5) * 20;
      return [clamp(139 + d), clamp(69 + d), clamp(19 + d)];
    }
    if (y > 8) {
      return [clamp(r - 20), clamp(g - 10), clamp(b - 20)];
    }
    const d = (Math.random() - 0.5) * 16;
    return [clamp(r + d), clamp(g + d + 10), clamp(b + d)];
  }

  function noiseDirt(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 30;
    return [clamp(r + d), clamp(g + d), clamp(b + d)];
  }

  function noiseStone(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 40;
    return [clamp(r + d), clamp(g + d), clamp(b + d)];
  }

  function noiseSand(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 20;
    return [clamp(r + d + 5), clamp(g + d), clamp(b + d - 15)];
  }

  function noiseWater(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 15;
    return [clamp(r + d), clamp(g + d), clamp(b + d + 10)];
  }

  function noiseLog(x, y, r, g, b) {
    const stripe = (y % 4 < 2) ? 10 : -10;
    const d = (Math.random() - 0.5) * 15;
    return [clamp(r + d + stripe), clamp(g + d), clamp(b + d - 10)];
  }

  function noiseLeaves(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 35;
    return [clamp(r + d - 20), clamp(g + d + 10), clamp(b + d - 20)];
  }

  function noiseCobblestone(x, y, r, g, b) {
    const d = (Math.random() - 0.5) * 50;
    const crack = (x % 5 < 1 || y % 4 < 1) ? -20 : 0;
    return [clamp(130 + d + crack), clamp(130 + d + crack), clamp(130 + d + crack)];
  }

  function noisePlanks(x, y, r, g, b) {
    const stripe = (y % 4 < 1) ? -15 : 5;
    const d = (Math.random() - 0.5) * 15;
    return [clamp(180 + d + stripe), clamp(140 + d + stripe), clamp(90 + d + stripe)];
  }

  drawTile(0, 0, 90, 170, 60, noiseGrassTop);
  drawTile(1, 0, 76, 153, 50, noiseGrassSide);
  drawTile(2, 0, 90, 170, 60, noiseGrassTop);

  drawTile(0, 1, 134, 96, 67, noiseDirt);
  drawTile(1, 1, 134, 96, 67, noiseDirt);
  drawTile(2, 1, 134, 96, 67, noiseDirt);

  drawTile(0, 2, 128, 128, 128, noiseStone);
  drawTile(1, 2, 128, 128, 128, noiseStone);
  drawTile(2, 2, 128, 128, 128, noiseStone);

  drawTile(3, 0, 210, 200, 170, noiseSand);
  drawTile(3, 1, 210, 200, 170, noiseSand);
  drawTile(3, 2, 210, 200, 170, noiseSand);

  drawTile(4, 0, 50, 100, 200, noiseWater);
  drawTile(4, 1, 50, 100, 200, noiseWater);
  drawTile(4, 2, 50, 100, 200, noiseWater);

  drawTile(5, 0, 100, 70, 40, noiseLog);
  drawTile(5, 1, 100, 70, 40, noiseLog);
  drawTile(5, 2, 100, 70, 40, noiseLog);

  drawTile(0, 0, 90, 170, 60, noiseGrassTop);

  drawTile(0, 1, 60, 120, 40, noiseLeaves);
  drawTile(0, 2, 60, 120, 40, noiseLeaves);

  drawTile(6, 0, 130, 130, 130, noiseCobblestone);
  drawTile(6, 1, 130, 130, 130, noiseCobblestone);
  drawTile(6, 2, 130, 130, 130, noiseCobblestone);

  drawTile(7, 0, 180, 140, 90, noisePlanks);
  drawTile(7, 1, 180, 140, 90, noisePlanks);
  drawTile(7, 2, 180, 140, 90, noisePlanks);

  function noiseTorch(x, y, r, g, b) {
    const cx = 8, cy = 8;
    const dist = Math.abs(x - cx);
    if (dist <= 1 && y >= 2 && y <= 14) {
      const d = (Math.random() - 0.5) * 10;
      return [clamp(139 + d), clamp(90 + d), clamp(43 + d)];
    }
    if (dist <= 2 && y <= 3) {
      const d = (Math.random() - 0.5) * 20;
      return [clamp(255 + d), clamp(160 + d), clamp(30 + d)];
    }
    return [0, 0, 0];
  }

  drawTile(8, 0, 0, 0, 0, noiseTorch);
  drawTile(8, 1, 0, 0, 0, noiseTorch);
  drawTile(8, 2, 0, 0, 0, noiseTorch);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

const BLOCK_FACES = {
  1: { top: [0, 0], side: [1, 0], bottom: [2, 0] },
  2: { top: [0, 1], side: [1, 1], bottom: [2, 1] },
  3: { top: [0, 2], side: [1, 2], bottom: [2, 2] },
  4: { top: [4, 0], side: [4, 1], bottom: [4, 2] },
  5: { top: [3, 0], side: [3, 1], bottom: [3, 2] },
  6: { top: [5, 0], side: [5, 1], bottom: [5, 2] },
  7: { top: [0, 1], side: [0, 1], bottom: [0, 2] },
  8: { top: [6, 0], side: [6, 1], bottom: [6, 2] },
  9: { top: [7, 0], side: [7, 1], bottom: [7, 2] },
  13: { top: [8, 0], side: [8, 1], bottom: [8, 2] },
};

export function getBlockUV(blockType, faceAxis, dir) {
  const faces = BLOCK_FACES[blockType];
  if (!faces) {
    return { u0: 0, v0: 0, u1: 1 / COLS, v1: 1 / ROWS };
  }

  let tile;
  if (faceAxis === 1 && dir > 0) {
    tile = faces.top;
  } else if (faceAxis === 1 && dir < 0) {
    tile = faces.bottom;
  } else {
    tile = faces.side;
  }

  const u0 = tile[0] / COLS;
  const v0 = tile[1] / ROWS;
  const u1 = (tile[0] + 1) / COLS;
  const v1 = (tile[1] + 1) / ROWS;

  return { u0, v0, u1, v1 };
}
