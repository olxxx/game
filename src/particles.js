import * as THREE from 'three';

const PARTICLE_LIFETIME = 0.6;
const PARTICLE_SIZE = 0.08;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.geometry = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
  }

  emit(position, color, count = 5) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.position.set(
        position.x + (Math.random() - 0.5) * 0.5,
        position.y + (Math.random() - 0.5) * 0.5,
        position.z + (Math.random() - 0.5) * 0.5
      );
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 3
      );
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity, life: PARTICLE_LIFETIME });
    }
  }

  emitContinuous(position, color) {
    if (Math.random() < 0.3) {
      this.emit(position, color, 1);
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      } else {
        p.velocity.y -= 10 * dt;
        p.mesh.position.addScaledVector(p.velocity, dt);
        p.mesh.material.opacity = p.life / PARTICLE_LIFETIME;
      }
    }
  }

  dispose() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.particles.length = 0;
    this.geometry.dispose();
  }
}
