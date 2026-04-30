import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { Player } from './player.js';

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
    this.scene.fog = new THREE.Fog(0x87CEEB, 80, 160);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);

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

    this.player = new Player(0, 70, 10);

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

    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
