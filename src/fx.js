import * as THREE from 'three';
import { scene } from './core.js';
import { glowTex, flashTex, smokeTex } from './textures.js';
import { rand } from './util.js';

const fx = [];
const add = THREE.AdditiveBlending;
export const MAT = {
  spark: new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, blending: add, depthWrite: false, transparent: true }),
  dust: new THREE.SpriteMaterial({ map: glowTex, color: 0x9c8d78, depthWrite: false, transparent: true, opacity: 0.55 }),
  puff: new THREE.SpriteMaterial({ map: glowTex, color: 0x7a1f1a, depthWrite: false, transparent: true, opacity: 0.7 }),
  gold: new THREE.SpriteMaterial({ map: glowTex, color: 0xffc94a, blending: add, depthWrite: false, transparent: true }),
  fire: new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a3a, blending: add, depthWrite: false, transparent: true }),
  muzzle: new THREE.SpriteMaterial({ map: flashTex, color: 0xffd28a, blending: add, depthWrite: false, transparent: true }),
};

/* light pool: created once so the shader light count never changes mid-game */
const lights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffc06a, 0, 10, 2); scene.add(l); lights.push({ l, t: 0, max: 1, peak: 0 }); }
let li = 0;
export function lightFlash(p, color, intensity, dist, life) {
  const s = lights[li++ % lights.length];
  s.l.position.copy(p); s.l.color.setHex(color); s.l.distance = dist; s.peak = intensity; s.t = s.max = life; s.l.intensity = intensity;
}

export function burst(p, mat, n, speed, size, life, grav = 6, opts = {}) {
  for (let i = 0; i < n; i++) {
    const m = opts.own ? mat.clone() : mat;
    const s = new THREE.Sprite(m);
    s.position.copy(p); s.scale.setScalar(size); scene.add(s);
    fx.push({ o: s, v: new THREE.Vector3(rand(-1, 1), rand(0, opts.up ?? 1.2), rand(-1, 1)).multiplyScalar(speed), life, max: life, size, grav, kind: 'p', grow: opts.grow, own: opts.own, op: m.opacity });
  }
}
export function muzzleFlash(p, size = 0.5) {
  const s = new THREE.Sprite(MAT.spark); s.position.copy(p); s.scale.setScalar(size); scene.add(s);
  fx.push({ o: s, v: new THREE.Vector3(), life: 0.05, max: 0.05, size, grav: 0, kind: 'p' });
}
const tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1);
const tracerMats = {};
export function tracer(a, b, col = 0xffd28a) {
  const len = a.distanceTo(b); if (len < 0.5) return;
  const mat = tracerMats[col] || (tracerMats[col] = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, blending: add, depthWrite: false }));
  const m = new THREE.Mesh(tracerGeo, mat);
  m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.scale.z = len; scene.add(m);
  fx.push({ o: m, life: 0.06, max: 0.06, kind: 't' });
}
const decalMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const scorchMat = new THREE.MeshBasicMaterial({ color: 0x14110e, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const decalGeo = new THREE.CircleGeometry(0.06, 8), scorchGeo = new THREE.CircleGeometry(1.6, 20);
const decals = [];
export function decal(p, n) {
  const d = new THREE.Mesh(decalGeo, decalMat);
  d.position.copy(p).addScaledVector(n, 0.01); d.lookAt(p.clone().add(n)); scene.add(d);
  decals.push(d); if (decals.length > 110) scene.remove(decals.shift());
}
export function scorch(p) {
  const d = new THREE.Mesh(scorchGeo, scorchMat);
  d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.015, p.z); scene.add(d);
  decals.push(d); if (decals.length > 110) scene.remove(decals.shift());
}
export function ringFx(x, z, col, y = 0.1) {
  const r = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.5, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: add }));
  r.rotation.x = -Math.PI / 2; r.position.set(x, y, z); scene.add(r);
  fx.push({ o: r, life: 0.6, max: 0.6, kind: 'r', own: true });
}
const smokeMat = new THREE.SpriteMaterial({ map: smokeTex, color: 0x6a6460, depthWrite: false, transparent: true, opacity: 0.8 });
export function explosion(p) {
  burst(p, MAT.fire, 16, 6, 1.5, 0.45, -2, { up: 1.4 });
  burst(p, smokeMat, 10, 2, 2.4, 1.8, -1.2, { own: true, grow: true, up: 1.6 });
  burst(p, MAT.spark, 22, 12, 0.12, 0.7, 14, { up: 1.5 });
  lightFlash(p.clone().setY(p.y + 1), 0xffa04a, 9, 22, 0.35);
  ringFx(p.x, p.z, 0xffa04a, Math.max(0.1, p.y));
  if (p.y < 0.4) scorch(p);
}
export function flashPop(p) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: add, depthWrite: false, transparent: true }));
  s.position.copy(p); s.scale.setScalar(6); scene.add(s);
  fx.push({ o: s, v: new THREE.Vector3(), life: 0.25, max: 0.25, size: 6, grav: 0, kind: 'p', own: true, op: 1 });
  lightFlash(p, 0xffffff, 14, 30, 0.3);
}

/* smoke cloud visual — one material per cloud, fades as a whole */
export function smokeCloud(pos) {
  const group = new THREE.Group(); group.position.copy(pos);
  const mat = new THREE.SpriteMaterial({ map: smokeTex, color: 0xc9c4bb, depthWrite: false, transparent: true, opacity: 0 });
  const puffs = [];
  for (let i = 0; i < 26; i++) {
    const s = new THREE.Sprite(mat);
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random());
    s.userData.base = new THREE.Vector3(Math.cos(a) * r, rand(0.1, 0.9), Math.sin(a) * r);
    s.userData.sz = rand(3, 4.6); s.userData.sp = rand(-0.3, 0.3);
    group.add(s); puffs.push(s);
  }
  scene.add(group);
  return {
    group, mat,
    set(radius, alpha, t) {
      mat.opacity = alpha;
      for (const s of puffs) {
        s.position.set(s.userData.base.x * radius, s.userData.base.y * radius * 0.7 + 0.4, s.userData.base.z * radius);
        s.scale.setScalar(s.userData.sz * (0.4 + radius / 5));
        s.material.rotation = t * s.userData.sp;
      }
    },
    dispose() { scene.remove(group); mat.dispose(); },
  };
}

export function update(dt) {
  for (const s of lights) if (s.t > 0) { s.t -= dt; s.l.intensity = s.t > 0 ? s.peak * (s.t / s.max) : 0; }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; const k = Math.max(f.life / f.max, 0);
    if (f.kind === 'p') {
      f.v.y -= f.grav * dt; f.o.position.addScaledVector(f.v, dt);
      if (f.grow) f.o.scale.setScalar(f.size * (1 + (1 - k) * 1.6)); else f.o.scale.setScalar(f.size * (0.3 + 0.7 * k));
      if (f.own) f.o.material.opacity = (f.op ?? 1) * k;
    } else if (f.kind === 'r') { f.o.scale.setScalar(1 + (1 - k) * 5); f.o.material.opacity = k; }
    else if (f.kind === 'h') {
      f.v.y -= 12 * dt; f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += dt * 9; f.o.rotation.z += dt * 6;
      if (f.o.position.y < 0.12) { f.o.position.y = 0.12; f.v.multiplyScalar(0.4); f.v.y = Math.abs(f.v.y) * 0.5; }
    }
    if (f.life <= 0) {
      if (f.kind === 'h') { if (f.onEnd) f.onEnd(); } else scene.remove(f.o);
      if (f.own) f.o.material.dispose();
      fx.splice(i, 1);
    }
  }
}
/* helmet flying off: object stays in scene until the owner respawns */
export function flyingHelmet(o, v, onEnd) { fx.push({ o, v, life: 3.5, max: 3.5, kind: 'h', onEnd }); }
export function cancelHelmet(o) { const i = fx.findIndex((f) => f.o === o); if (i >= 0) fx.splice(i, 1); }
export function clear() {
  for (const f of fx) { if (f.kind !== 'h') scene.remove(f.o); if (f.own) f.o.material.dispose(); }
  fx.length = 0;
  for (const d of decals) scene.remove(d);
  decals.length = 0;
}
