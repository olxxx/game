import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { Player } from './player.js';
import { World } from './world.js';
import { Inventory } from './inventory.js';
import { ParticleSystem } from './particles.js';
import { isTool, isBlock, getMineTime } from './items.js';
import { DayNightCycle, AmbientParticleSystem } from './daynight.js';

class Game {
  constructor() {
    this.keys = {};
    this.prevSpacePressed = false;
    this.yaw = 0;
    this.pitch = 0;
    this.isLocked = false;
    this.lastTime = performance.now();
    this.lastPlayerChunkX = null;
    this.lastPlayerChunkZ = null;
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 200);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.001, 500);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    this.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    this.directionalLight = directionalLight;
    this.ambientLight = ambientLight;

    const chunks = [];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const chunk = new Chunk(x, z);
        chunk.generateTerrain();
        chunks.push(chunk);
      }
    }

    this.world = new World(chunks, this.scene);

    this.daynight = new DayNightCycle(this.scene);
    this.ambientParticles = new AmbientParticleSystem(this.scene, this.daynight);

    this.torchLights = new Map();
    this.torchMeshes = new Map();
    this.torchStickGeo = new THREE.BoxGeometry(0.15, 0.7, 0.15);
    this.torchStickMat = new THREE.MeshStandardMaterial({ color: 0x8B5A2B });
    this.torchFlameGeo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    this.torchFlameMat = new THREE.MeshBasicMaterial({ color: 0xFFAA22 });
    this.cameraTorchLight = new THREE.PointLight(0xFFAA44, 1.5, 20);
    this.cameraTorchLight.visible = false;
    this.scene.add(this.cameraTorchLight);

    for (const chunk of chunks) {
      const { solidMesh, waterMesh } = chunk.buildMesh(this.world.chunkMap);
      this.scene.add(solidMesh);
      this.scene.add(waterMesh);
    }

    this.scanForTorches();

    this.lastPlayerChunkX = Math.floor(0 / 16);
    this.lastPlayerChunkZ = Math.floor(10 / 16);
    this.player = new Player(0, 70, 10);

    this.particles = new ParticleSystem(this.scene);

    this.inventory = new Inventory();
    this.inventory.setDefaultLoadout();
    this.inventory.onChange = () => this.updateHotbarUI();

    this.mining = {
      active: false,
      target: null,
      targetBlockId: 0,
      progress: 0,
      mineTime: 0,
      particleColor: 0x808080,
    };

    const hlGeo = new THREE.PlaneGeometry(1, 1);
    const edges = new THREE.EdgesGeometry(hlGeo);
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    }));
    this.highlight.renderOrder = 999;
    this.highlight.visible = false;
    this.scene.add(this.highlight);

    this.renderer.domElement.addEventListener('click', () => {
      this.renderer.domElement.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.renderer.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      this.yaw -= e.movementX * 0.002;
      this.pitch -= e.movementY * 0.002;
      this.pitch = Math.max(-Math.PI / 2 * 0.99, Math.min(Math.PI / 2 * 0.99, this.pitch));
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      const hit = this.world.raycast(this.camera, 8);

      if (e.button === 0) {
        if (!hit) return;
        if (e.shiftKey) {
          const bp = hit.blockPos;
          const blockId = this.world.getBlock(bp.x, bp.y, bp.z);
          if (blockId === 13) {
            this.removeTorchLight(bp.x, bp.y, bp.z);
            const result = this.world.setBlock(bp.x, bp.y, bp.z, 0);
            if (result.success) {
              this.inventory.add(13, 1);
            }
          }
          return;
        }
        this.startMining(hit);
      } else if (e.button === 2) {
        const selectedItemId = this.inventory.getSelectedItemId();
        if (isBlock(selectedItemId)) {
          const waterHit = this.world.waterRaycast(this.camera, 8);
          if (waterHit) {
            const result = this.world.setBlock(waterHit.placePos.x, waterHit.placePos.y, waterHit.placePos.z, selectedItemId);
            if (result.success) {
              this.inventory.removeSelected();
              if (selectedItemId === 13) {
                this.addTorchLight(waterHit.placePos.x, waterHit.placePos.y, waterHit.placePos.z);
              }
            }
          } else if (hit) {
            const p = hit.placePos;
            if (!this.world.getBlock(p.x, p.y, p.z)) {
              const result = this.world.setBlock(p.x, p.y, p.z, selectedItemId);
              if (result.success) {
                this.inventory.removeSelected();
                if (selectedItemId === 13) {
                  this.addTorchLight(p.x, p.y, p.z);
                }
              }
            }
          }
        }
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.stopMining();
      }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'ArrowLeft') {
        this.inventory.cycle(-1);
        e.preventDefault();
        return;
      }

      if (e.code === 'ArrowRight') {
        this.inventory.cycle(1);
        e.preventDefault();
        return;
      }

      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''));
        if (num >= 1 && num <= 9) {
          this.inventory.selectByNumber(num);
        }
      }

      if (e.code === 'KeyH') {
        this.toggleHelp();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.helpVisible = false;
    this.helpOverlay = document.getElementById('helpOverlay');

    this.animate();
    this.updateHotbarUI();
  }

  toggleHelp() {
    this.helpVisible = !this.helpVisible;
    if (this.helpOverlay) {
      this.helpOverlay.classList.toggle('visible', this.helpVisible);
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updatePlayer() {
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw)
    ).normalize();

    const right = new THREE.Vector3(
      Math.cos(this.yaw),
      0,
      -Math.sin(this.yaw)
    ).normalize();

    const moveDir = new THREE.Vector3(0, 0, 0);

    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyA']) moveDir.sub(right);
    if (this.keys['KeyD']) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    const spacePressed = !!this.keys['Space'];
    const spaceJustPressed = spacePressed && !this.prevSpacePressed;
    this.prevSpacePressed = spacePressed;

    return {
      moveDir,
      spacePressed,
      spaceJustPressed,
      ctrlPressed: !!this.keys['ControlLeft'] || !!this.keys['ControlRight'],
    };
  }

  updateHighlight() {
    const hit = this.world.raycast(this.camera, 8);

    if (hit) {
      this.highlight.position.set(
        hit.blockPos.x + 0.5 + hit.normal.x * 0.505,
        hit.blockPos.y + 0.5 + hit.normal.y * 0.505,
        hit.blockPos.z + 0.5 + hit.normal.z * 0.505
      );

      if (hit.normal.x !== 0) {
        this.highlight.rotation.set(0, Math.PI / 2, 0);
      } else if (hit.normal.y !== 0) {
        this.highlight.rotation.set(Math.PI / 2, 0, 0);
      } else {
        this.highlight.rotation.set(0, 0, 0);
      }

      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const input = this.updatePlayer();

    const eyePos = this.player.update(dt, this.world, input);
    this.camera.position.copy(eyePos);

    const pcx = Math.floor(this.player.position.x / 16);
    const pcz = Math.floor(this.player.position.z / 16);

    if (pcx !== this.lastPlayerChunkX || pcz !== this.lastPlayerChunkZ) {
      this.world.loadChunksAroundPlayer(
        this.player.position.x,
        this.player.position.z
      );
      this.scanForTorches();
      this.lastPlayerChunkX = pcx;
      this.lastPlayerChunkZ = pcz;
    }

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    this.updateMining(dt);
    this.updateHighlight();

    this.particles.update(dt);

    this.daynight.update(dt);

    const skyColor = this.daynight.getSkyColor();
    this.scene.background.setHex(skyColor);
    this.scene.fog.color.setHex(this.daynight.getFogColor());
    this.scene.fog.near = this.daynight.getFogNear();
    this.scene.fog.far = this.daynight.getFogFar();

    this.directionalLight.intensity = this.daynight.getSunIntensity();
    this.directionalLight.color.setHex(this.daynight.getSunColor());
    this.ambientLight.intensity = this.daynight.getAmbientIntensity();
    this.ambientLight.color.setHex(this.daynight.getAmbientColor());

    this.ambientParticles.update(dt, this.player.position);

    this.updateCameraTorch();

    this.renderer.render(this.scene, this.camera);
  }

  startMining(hit) {
    const bp = hit.blockPos;
    const blockId = this.world.getBlock(bp.x, bp.y, bp.z);
    if (blockId === 0 || blockId === 4) return;

    this.mining.active = true;
    this.mining.target = bp.clone();
    this.mining.targetBlockId = blockId;
    this.mining.progress = 0;

    const selectedItemId = this.inventory.getSelectedItemId();
    this.mining.mineTime = getMineTime(blockId, isTool(selectedItemId) ? selectedItemId : 0);

    this.mining.particleColor = this.getBlockColor(blockId);
  }

  stopMining() {
    this.mining.active = false;
    this.mining.target = null;
    this.mining.progress = 0;
  }

  addTorchLight(wx, wy, wz) {
    const key = `${wx},${wy},${wz}`;
    if (this.torchLights.has(key)) return;
    const light = new THREE.PointLight(0xFFAA44, 1.5, 20);
    light.position.set(wx + 0.5, wy + 0.8, wz + 0.5);
    this.scene.add(light);
    this.torchLights.set(key, light);

    const group = new THREE.Group();
    const stick = new THREE.Mesh(this.torchStickGeo, this.torchStickMat);
    stick.position.set(0, 0.35, 0);
    group.add(stick);
    const flame = new THREE.Mesh(this.torchFlameGeo, this.torchFlameMat);
    flame.position.set(0, 0.8, 0);
    group.add(flame);
    group.position.set(wx + 0.5, wy, wz + 0.5);
    this.scene.add(group);
    this.torchMeshes.set(key, group);
  }

  removeTorchLight(wx, wy, wz) {
    const key = `${wx},${wy},${wz}`;
    const light = this.torchLights.get(key);
    if (light) {
      this.scene.remove(light);
      light.dispose();
      this.torchLights.delete(key);
    }
    const mesh = this.torchMeshes.get(key);
    if (mesh) {
      this.scene.remove(mesh);
      this.torchMeshes.delete(key);
    }
  }

  updateCameraTorch() {
    const selectedId = this.inventory.getSelectedItemId();
    if (selectedId === 13) {
      this.cameraTorchLight.position.copy(this.camera.position);
      this.cameraTorchLight.visible = true;
    } else {
      this.cameraTorchLight.visible = false;
    }
  }

  scanForTorches() {
    for (const [, chunk] of this.world.chunkMap) {
      for (let y = 0; y < chunk.worldHeight; y++) {
        for (let z = 0; z < chunk.chunkSize; z++) {
          for (let x = 0; x < chunk.chunkSize; x++) {
            if (chunk.blocks[chunk.getIndex(x, y, z)] === 13) {
              const wx = chunk.chunkX * chunk.chunkSize + x;
              const wz = chunk.chunkZ * chunk.chunkSize + z;
              this.addTorchLight(wx, y, wz);
            }
          }
        }
      }
    }
  }

  getBlockColor(blockId) {
    const colors = {
      1: 0x5a8c3c,
      2: 0x866043,
      3: 0x808080,
      5: 0xd2c8a0,
      6: 0x64460a,
      7: 0x3c7a28,
      8: 0x828282,
      9: 0xb48c5a,
      13: 0xD4A040,
    };
    return colors[blockId] || 0x808080;
  }

  updateMining(dt) {
    if (!this.mining.active || !this.mining.target) return;

    const bp = this.mining.target;
    const currentBlock = this.world.getBlock(bp.x, bp.y, bp.z);
    if (currentBlock !== this.mining.targetBlockId) {
      this.stopMining();
      return;
    }

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const blockCenter = new THREE.Vector3(bp.x + 0.5, bp.y + 0.5, bp.z + 0.5);
    const toBlock = blockCenter.clone().sub(this.camera.position).normalize();
    if (camDir.dot(toBlock) < 0.5) {
      this.stopMining();
      return;
    }

    this.mining.progress += dt;

    this.particles.emitContinuous(
      new THREE.Vector3(bp.x + 0.5, bp.y + 1, bp.z + 0.5),
      this.mining.particleColor
    );

    if (this.mining.progress >= this.mining.mineTime) {
      const result = this.world.setBlock(bp.x, bp.y, bp.z, 0);
      this.removeTorchLight(bp.x, bp.y, bp.z);
      if (result.success && result.dropId > 0) {
        this.inventory.add(result.dropId, 1);
      }
      this.particles.emit(
        new THREE.Vector3(bp.x + 0.5, bp.y + 0.5, bp.z + 0.5),
        this.mining.particleColor,
        15
      );
      this.stopMining();
    }
  }

  drawBlockIcon(blockId) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const colors = {
      1: ['#5a8c3c', '#4a7a30', '#866043', '#705030'],
      2: ['#866043', '#705030', '#604020', '#503010'],
      3: ['#808080', '#686868', '#909090', '#585858'],
      4: ['#3264c8', '#4080e0', '#2850b0', '#50a0f0'],
      5: ['#d2c8a0', '#c0b890', '#b0a070', '#e0d8b0'],
      6: ['#64460a', '#503010', '#704a10', '#402000'],
      7: ['#3c7a28', '#2c6a18', '#4c8a38', '#1c5a08'],
      8: ['#828282', '#6a6a6a', '#989898', '#525252'],
      9: ['#b48c5a', '#a07040', '#c8a070', '#8c6030'],
    };
    const c1 = colors[blockId] || ['#808080', '#686868', '#909090', '#585858'];
    for (let py = 0; py < 32; py++) {
      for (let pxx = 0; pxx < 32; pxx++) {
        const hash = Math.sin(pxx * 12.9898 + py * 78.233) * 43758.5453;
        const r = hash - Math.floor(hash);
        ctx.fillStyle = r < 0.25 ? c1[0] : r < 0.5 ? c1[1] : r < 0.75 ? c1[2] : c1[3];
        ctx.fillRect(pxx, py, 1, 1);
      }
    }
    if (blockId === 1) {
      for (let pxx = 0; pxx < 32; pxx++) {
        const hash = Math.sin(pxx * 45.678) * 12345.6789;
        const h = 6 + Math.floor((hash - Math.floor(hash)) * 4);
        for (let py = 0; py < h; py++) {
          ctx.fillStyle = '#5a8c3c';
          ctx.fillRect(pxx, py, 1, 1);
        }
      }
    }
    return c;
  }

  drawTorch() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#00000000';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#8B5A2B';
    ctx.fillRect(14, 10, 4, 18);
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(12, 4, 8, 8);
    ctx.fillStyle = '#FFCC00';
    ctx.fillRect(13, 5, 6, 5);
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(14, 2, 4, 3);
    return c;
  }

  drawPickaxe() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7B4B2A';
    ctx.fillRect(14, 16, 4, 14);
    ctx.fillStyle = '#9B6B3A';
    ctx.fillRect(15, 17, 2, 12);
    ctx.fillStyle = '#C8C8C8';
    ctx.fillRect(8, 7, 16, 3);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(9, 7, 14, 2);
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(3, 5, 6, 3);
    ctx.fillRect(23, 5, 6, 3);
    ctx.fillStyle = '#D0D0D0';
    ctx.fillRect(4, 5, 4, 2);
    ctx.fillRect(24, 5, 4, 2);
    ctx.fillStyle = '#B0B0B0';
    ctx.fillRect(3, 6, 2, 3);
    ctx.fillRect(27, 6, 2, 3);
    ctx.fillRect(5, 8, 3, 2);
    ctx.fillRect(24, 8, 3, 2);
    ctx.fillRect(3, 4, 1, 2);
    ctx.fillRect(28, 4, 1, 2);
    return c;
  }

  drawAxe() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7B4B2A';
    ctx.fillRect(13, 14, 4, 16);
    ctx.fillStyle = '#9B6B3A';
    ctx.fillRect(14, 15, 2, 14);
    ctx.fillStyle = '#B0B0B0';
    ctx.fillRect(6, 2, 12, 6);
    ctx.fillRect(4, 4, 4, 6);
    ctx.fillRect(3, 6, 3, 4);
    ctx.fillRect(18, 3, 4, 4);
    ctx.fillRect(20, 4, 3, 3);
    ctx.fillStyle = '#D0D0D0';
    ctx.fillRect(7, 2, 10, 3);
    ctx.fillRect(5, 4, 4, 4);
    ctx.fillRect(18, 3, 3, 3);
    ctx.fillStyle = '#909090';
    ctx.fillRect(6, 7, 12, 2);
    ctx.fillRect(4, 9, 4, 2);
    ctx.fillRect(3, 9, 3, 2);
    ctx.fillRect(20, 4, 3, 2);
    return c;
  }

  drawShovel() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7B4B2A';
    ctx.fillRect(14, 16, 4, 14);
    ctx.fillStyle = '#9B6B3A';
    ctx.fillRect(15, 17, 2, 12);
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(10, 2, 12, 8);
    ctx.fillRect(11, 10, 10, 3);
    ctx.fillRect(12, 13, 8, 2);
    ctx.fillRect(13, 15, 6, 1);
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(11, 2, 10, 4);
    ctx.fillRect(12, 6, 8, 3);
    ctx.fillStyle = '#A0A0A0';
    ctx.fillRect(10, 10, 12, 3);
    ctx.fillRect(12, 13, 8, 2);
    ctx.fillRect(9, 2, 2, 8);
    ctx.fillRect(21, 2, 2, 8);
    return c;
  }

  drawToolIcon(toolId) {
    if (toolId === 10) return this.drawPickaxe();
    if (toolId === 11) return this.drawAxe();
    if (toolId === 12) return this.drawShovel();
    return null;
  }

  updateHotbarUI() {
    const slots = document.querySelectorAll('.hotbar-slot');
    slots.forEach((slot, i) => {
      const data = this.inventory.slots[i];
      const icon = slot.querySelector('.item-icon');
      const count = slot.querySelector('.item-count');

      if (data.itemId !== 0) {
        if (icon) {
          const existing = icon.querySelector('canvas');
          if (existing) existing.remove();

          let canvas;
          if (isTool(data.itemId)) {
            canvas = this.drawToolIcon(data.itemId);
          } else if (data.itemId === 13) {
            canvas = this.drawTorch();
          } else {
            canvas = this.drawBlockIcon(data.itemId);
          }
          if (canvas) icon.appendChild(canvas);
          icon.style.background = 'transparent';
        }
        if (count) {
          count.textContent = data.count > 1 ? data.count : '';
        }
      } else {
        if (icon) {
          const existing = icon.querySelector('canvas');
          if (existing) existing.remove();
          icon.style.background = 'transparent';
        }
        if (count) count.textContent = '';
      }

      slot.classList.toggle('active', i === this.inventory.selectedIndex);
    });
  }

}

new Game();
