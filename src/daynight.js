import * as THREE from 'three';

const GRADIENT = [
  { t: 0.00, sky: 0x87CEEB, sunI: 1.0,  ambI: 0.4,  amb: 0xffffff, sun: 0xffffff, fog: 0x87CEEB },
  { t: 0.18, sky: 0x6CA0C8, sunI: 0.7,  ambI: 0.3,  amb: 0xeeeedd, sun: 0xffeedd, fog: 0x6CA0C8 },
  { t: 0.25, sky: 0xCC6633, sunI: 0.4,  ambI: 0.2,  amb: 0xddaa77, sun: 0xffcc88, fog: 0xCC6633 },
  { t: 0.30, sky: 0x1A1A3A, sunI: 0.25, ambI: 0.2,  amb: 0x444466, sun: 0x556688, fog: 0x1A1A3A },
  { t: 0.50, sky: 0x10102A, sunI: 0.15, ambI: 0.15, amb: 0x333355, sun: 0x445577, fog: 0x10102A },
  { t: 0.70, sky: 0x1A1A3A, sunI: 0.25, ambI: 0.2,  amb: 0x444466, sun: 0x556688, fog: 0x1A1A3A },
  { t: 0.75, sky: 0xE8956A, sunI: 0.4,  ambI: 0.2,  amb: 0xddaa77, sun: 0xffcc88, fog: 0xE8956A },
  { t: 0.82, sky: 0x87CEEB, sunI: 1.0,  ambI: 0.4,  amb: 0xffffff, sun: 0xffffff, fog: 0x87CEEB },
];

function lerpColor(a, b, f) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * f);
  const g = Math.round(ag + (bg - ag) * f);
  const bl = Math.round(ab + (bb - ab) * f);
  return (r << 16) | (g << 8) | bl;
}

function interpolateGradient(t, key) {
  const g = GRADIENT;
  const last = g[g.length - 1];
  if (t <= g[0].t) return g[0][key];
  if (t >= last.t) {
    const f = (t - last.t) / (1 - last.t);
    const a = last[key], b = g[0][key];
    return (typeof a === 'number' && a <= 1) ? a + (b - a) * f : lerpColor(a, b, f);
  }

  for (let i = 0; i < g.length - 1; i++) {
    if (t >= g[i].t && t <= g[i + 1].t) {
      const f = (t - g[i].t) / (g[i + 1].t - g[i].t);
      const a = g[i][key], b = g[i + 1][key];
      if (typeof a === 'number' && a <= 1 && typeof b === 'number' && b <= 1) {
        return a + (b - a) * f;
      }
      return lerpColor(a, b, f);
    }
  }
  return g[0][key];
}

export class DayNightCycle {
  constructor(scene) {
    this.CYCLE_DURATION = 300;
    this.timeOfDay = 0;

    const sunGeo = new THREE.SphereGeometry(5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    scene.add(this.sun);

    const moonGeo = new THREE.SphereGeometry(4, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xDDDDFF });
    this.moon = new THREE.Mesh(moonGeo, moonMat);
    scene.add(this.moon);
  }

  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt / this.CYCLE_DURATION) % 1;

    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2;
    const radius = 150;

    this.sun.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    this.sun.visible = this.sun.position.y > -10;

    const moonAngle = angle + Math.PI;
    this.moon.position.set(Math.cos(moonAngle) * radius, Math.sin(moonAngle) * radius, 0);
    this.moon.visible = this.moon.position.y > -10;
  }

  getSkyColor() { return interpolateGradient(this.timeOfDay, 'sky'); }
  getFogColor() { return interpolateGradient(this.timeOfDay, 'fog'); }
  getFogNear() { return 80 + (100 - 80) * this._dayFactor(); }
  getFogFar() { return 150 + (200 - 150) * this._dayFactor(); }
  getSunIntensity() { return interpolateGradient(this.timeOfDay, 'sunI'); }
  getSunColor() { return interpolateGradient(this.timeOfDay, 'sun'); }
  getAmbientIntensity() { return interpolateGradient(this.timeOfDay, 'ambI'); }
  getAmbientColor() { return interpolateGradient(this.timeOfDay, 'amb'); }

  isNight() {
    return this.timeOfDay >= 0.28 && this.timeOfDay <= 0.72;
  }

  getNightFactor() {
    const t = this.timeOfDay;
    if (t >= 0.30 && t <= 0.70) return 1;
    if (t >= 0.28 && t < 0.30) return (t - 0.28) / 0.02;
    if (t > 0.70 && t <= 0.72) return (0.72 - t) / 0.02;
    return 0;
  }

  _dayFactor() {
    const nf = this.getNightFactor();
    return 1 - nf;
  }
}

export class AmbientParticleSystem {
  constructor(scene, daynight) {
    this.scene = scene;
    this.daynight = daynight;

    const starCount = 200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 400;
      starPositions[i * 3 + 1] = 120;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ size: 1.5, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    this.stars = new THREE.Points(starGeo, starMat);
    scene.add(this.stars);

    this.fireflyPool = [];
    this.activeFireflies = [];
    this.fireflyGroup = new THREE.Group();
    scene.add(this.fireflyGroup);
    this.fireflyGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xCCFF44 });
    for (let i = 0; i < 30; i++) {
      const mesh = new THREE.Mesh(this.fireflyGeo, fireflyMat.clone());
      mesh.visible = false;
      this.fireflyGroup.add(mesh);
      this.fireflyPool.push(mesh);
    }

    this.spawnTimer = 0;
  }

  update(dt, playerPos) {
    const nightFactor = this.daynight.getNightFactor();

    this.stars.material.opacity = nightFactor;
    this.stars.position.x = playerPos.x;
    this.stars.position.z = playerPos.z;

    this.spawnTimer += dt;
    const spawnInterval = 0.2;
    while (this.spawnTimer >= spawnInterval) {
      this.spawnTimer -= spawnInterval;
      if (nightFactor > 0.5 && this.fireflyPool.length > 0) {
        const mesh = this.fireflyPool.pop();
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 30;
        mesh.position.set(
          playerPos.x + Math.cos(angle) * dist,
          playerPos.y - 2 + Math.random() * 6,
          playerPos.z + Math.sin(angle) * dist
        );
        const speed = 0.3 + Math.random() * 0.5;
        const vx = (Math.random() - 0.5) * speed;
        const vy = (Math.random() - 0.3) * speed;
        const vz = (Math.random() - 0.5) * speed;
        mesh.userData = { vx, vy, vz, life: 3 + Math.random() * 2, maxLife: 0 };
        mesh.userData.maxLife = mesh.userData.life;
        mesh.visible = true;
        mesh.material.opacity = 1;
        mesh.material.transparent = true;
        this.activeFireflies.push(mesh);
      }
    }

    for (let i = this.activeFireflies.length - 1; i >= 0; i--) {
      const mesh = this.activeFireflies[i];
      const d = mesh.userData;
      d.life -= dt;
      mesh.position.x += d.vx * dt;
      mesh.position.y += d.vy * dt;
      mesh.position.z += d.vz * dt;
      const fadeStart = d.maxLife * 0.4;
      mesh.material.opacity = d.life > fadeStart ? 1 : d.life / fadeStart;
      if (d.life <= 0) {
        mesh.visible = false;
        this.activeFireflies.splice(i, 1);
        this.fireflyPool.push(mesh);
      }
    }
  }

  dispose() {
    this.scene.remove(this.stars);
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.scene.remove(this.fireflyGroup);
    this.fireflyGeo.dispose();
    for (const mesh of this.fireflyPool) { mesh.material.dispose(); }
    for (const mesh of this.activeFireflies) { mesh.material.dispose(); }
    this.fireflyPool = [];
    this.activeFireflies = [];
  }
}
