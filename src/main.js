import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { Player } from './player.js';
import { World } from './world.js';

class Game {
  constructor() {
    this.keys = {};
    this.yaw = 0;
    this.pitch = 0;
    this.isLocked = false;
    this.lastTime = performance.now();
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

    this.chunks = [];
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const chunk = new Chunk(x, z);
        chunk.generateTerrain();
        const { solidMesh, waterMesh } = chunk.buildMesh();
        this.scene.add(solidMesh);
        this.scene.add(waterMesh);
        this.chunks.push(chunk);
      }
    }

    this.world = new World(this.chunks, this.scene);
    this.player = new Player(0, 70, 10);

    const hlGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
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

    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    document.body.appendChild(crosshair);

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
      if (!hit) return;

      if (e.button === 0) {
        this.world.setBlock(hit.blockPos.x, hit.blockPos.y, hit.blockPos.z, 0);
      } else if (e.button === 2) {
        const p = hit.placePos;
        if (!this.world.getBlock(p.x, p.y, p.z)) {
          this.world.setBlock(p.x, p.y, p.z, 1);
        }
      }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.animate();
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
        hit.blockPos.x + 0.5,
        hit.blockPos.y + 0.5,
        hit.blockPos.z + 0.5
      );
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

    const eyePos = this.player.update(dt, this.chunks);
    this.camera.position.copy(eyePos);

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    this.updateHighlight();

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
