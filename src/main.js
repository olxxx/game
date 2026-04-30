import * as THREE from 'three';
import { Chunk } from './chunk.js';

class Game {
  constructor() {
    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 70, 20);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Lights
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    this.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Chunks
    this.chunks = [];
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const chunk = new Chunk(x, z);
        chunk.generateTerrain();
        const mesh = chunk.buildMesh();
        this.scene.add(mesh);
        this.chunks.push(chunk);
      }
    }

    // Event Listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Animation Loop
    this.animate();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
