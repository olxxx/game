import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { Player } from './player.js';
import { World } from './world.js';
import { Inventory } from './inventory.js';
import { ParticleSystem } from './particles.js';
import { isTool, isBlock, getMineTime } from './items.js';

class Game {
  constructor() {
    this.keys = {};
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

    const chunks = [];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const chunk = new Chunk(x, z);
        chunk.generateTerrain();
        chunks.push(chunk);
      }
    }

    this.world = new World(chunks, this.scene);

    for (const chunk of chunks) {
      const { solidMesh, waterMesh } = chunk.buildMesh(this.world.chunkMap);
      this.scene.add(solidMesh);
      this.scene.add(waterMesh);
    }

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
        this.startMining(hit);
      } else if (e.button === 2) {
        const selectedItemId = this.inventory.getSelectedItemId();
        if (isBlock(selectedItemId)) {
          const waterHit = this.world.waterRaycast(this.camera, 8);
          if (waterHit) {
            const result = this.world.setBlock(waterHit.placePos.x, waterHit.placePos.y, waterHit.placePos.z, selectedItemId);
            if (result.success) {
              this.inventory.removeSelected();
            }
          } else if (hit) {
            const p = hit.placePos;
            if (!this.world.getBlock(p.x, p.y, p.z)) {
              const result = this.world.setBlock(p.x, p.y, p.z, selectedItemId);
              if (result.success) {
                this.inventory.removeSelected();
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
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.animate();
    this.updateHotbarUI();
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
      this.player.velocity.x = moveDir.x * this.player.speed;
      this.player.velocity.z = moveDir.z * this.player.speed;
    } else {
      this.player.velocity.x = 0;
      this.player.velocity.z = 0;
    }

    if (this.keys['Space']) {
      this.player.jump();
    }
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

    this.updatePlayer();

    const eyePos = this.player.update(dt, this.world);
    this.camera.position.copy(eyePos);

    const pcx = Math.floor(this.player.position.x / 16);
    const pcz = Math.floor(this.player.position.z / 16);

    if (pcx !== this.lastPlayerChunkX || pcz !== this.lastPlayerChunkZ) {
      this.world.loadChunksAroundPlayer(
        this.player.position.x,
        this.player.position.z
      );
      this.lastPlayerChunkX = pcx;
      this.lastPlayerChunkZ = pcz;
    }

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    this.updateMining(dt);
    this.updateHighlight();

    this.particles.update(dt);

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

  drawPickaxe() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const brown = '#8B4513';
    const silver = '#D0D0D0';
    const grey = '#A0A0A0';
    ctx.fillStyle = brown;
    ctx.fillRect(4, 26, 4, 4);
    ctx.fillRect(8, 22, 4, 4);
    ctx.fillRect(12, 18, 4, 4);
    ctx.fillRect(16, 14, 4, 4);
    ctx.fillStyle = silver;
    ctx.fillRect(18, 8, 12, 4);
    ctx.fillRect(18, 12, 12, 4);
    ctx.fillStyle = grey;
    ctx.fillRect(18, 6, 12, 2);
    ctx.fillRect(18, 14, 12, 2);
    ctx.fillRect(28, 6, 2, 10);
    return c;
  }

  drawAxe() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const brown = '#8B4513';
    const silver = '#B0B0B0';
    const grey = '#808080';
    ctx.fillStyle = brown;
    ctx.fillRect(6, 24, 4, 6);
    ctx.fillRect(6, 18, 4, 6);
    ctx.fillRect(6, 12, 4, 6);
    ctx.fillRect(6, 6, 4, 6);
    ctx.fillStyle = silver;
    ctx.fillRect(10, 4, 8, 8);
    ctx.fillRect(18, 2, 8, 8);
    ctx.fillStyle = grey;
    ctx.fillRect(10, 2, 16, 2);
    ctx.fillRect(10, 12, 16, 2);
    ctx.fillRect(26, 2, 2, 12);
    return c;
  }

  drawShovel() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const brown = '#8B4513';
    const silver = '#D0D0D0';
    const grey = '#A0A0A0';
    ctx.fillStyle = brown;
    ctx.fillRect(13, 24, 6, 6);
    ctx.fillRect(13, 18, 6, 6);
    ctx.fillRect(13, 14, 6, 4);
    ctx.fillStyle = silver;
    ctx.fillRect(8, 4, 16, 10);
    ctx.fillStyle = grey;
    ctx.fillRect(8, 2, 16, 2);
    ctx.fillRect(8, 14, 16, 2);
    ctx.fillRect(6, 4, 2, 10);
    ctx.fillRect(24, 4, 2, 10);
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
