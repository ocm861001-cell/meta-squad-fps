import * as THREE from 'three';
import { scene } from './core.js';
import { texConcrete, wallTex, containerTex, texCrate, texSand } from './textures.js';
import { rand } from './util.js';

export const solids = [];
export const boxes = [];
export const pads = [];
export const smokes = [];
export const ARENA = 40;

/* sky */
export const sky = new THREE.Mesh(
  new THREE.SphereGeometry(320, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2f6aa6) }, mid: { value: new THREE.Color(0xf0c79a) },
      bot: { value: new THREE.Color(0xcdb9a2) }, sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.3).normalize() },
    },
    vertexShader: 'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform vec3 top,mid,bot,sunDir;varying vec3 vP;void main(){vec3 d=normalize(vP);float h=d.y;vec3 c=h>0.?mix(mid,top,pow(clamp(h*1.5,0.,1.),.65)):bot;float s=max(dot(d,sunDir),0.);c+=vec3(1.,.85,.6)*(pow(s,600.)*2.+pow(s,8.)*.25);gl_FragColor=vec4(c,1.);}',
  })
);
scene.add(sky);

export const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ map: texConcrete, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xa48f74, roughness: 1 }));
outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; scene.add(outer);

function addBox(x, z, w, h, d, mat, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true;
  scene.add(m); solids.push(m);
  boxes.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top: y + h, bottom: y });
  return m;
}
const mWall = new THREE.MeshStandardMaterial({ map: wallTex([10, 1]), roughness: 0.9 });
addBox(0, -ARENA, ARENA * 2 + 2, 5, 1.2, mWall); addBox(0, ARENA, ARENA * 2 + 2, 5, 1.2, mWall);
const mWallS = new THREE.MeshStandardMaterial({ map: wallTex([10, 1]), roughness: 0.9 });
addBox(-ARENA, 0, 1.2, 5, ARENA * 2, mWallS); addBox(ARENA, 0, 1.2, 5, ARENA * 2, mWallS);

const conMats = ['#a3392b', '#2d5e8a', '#2f7a6d', '#c8742a', '#5c6b2f', '#7a7f86'].map(
  (c) => new THREE.MeshStandardMaterial({ map: containerTex(c), roughness: 0.7, metalness: 0.25 })
);
function container(x, z, rot, ci, y = 0) { return rot ? addBox(x, z, 2.44, 2.6, 6.1, conMats[ci], y) : addBox(x, z, 6.1, 2.6, 2.44, conMats[ci], y); }
container(-22, -18, 0, 0); container(-22, -15.5, 0, 1); container(-22, -18, 0, 2, 2.6);
container(19, 15, 1, 3); container(21.5, 15, 1, 4); container(19, 15, 1, 1, 2.6);
container(25, -21, 0, 2); container(10, -24, 0, 5); container(-12, 22, 1, 0); container(-28, 4, 1, 4);
container(28, 4, 1, 0); container(-5, -20, 0, 3); container(4, 13, 0, 5);
container(-30, -12, 1, 3); container(30, 12, 1, 2); container(14, -10, 1, 4); container(-14, 10, 1, 5);
const mCrate = new THREE.MeshStandardMaterial({ map: texCrate, roughness: 0.85 });
function crate(x, z, y = 0, s = 1.1) { addBox(x, z, s, s, s, mCrate, y); }
[[-8, -6], [-6.9, -6], [-8, -6, 1.1], [12, -3], [12, -4.1], [-17, 4], [-18.1, 4], [-17, 4, 1.1], [15, -14], [6, 20], [7.1, 20],
  [-31, -24], [-29.9, -24], [31, 24], [31, 25.1], [-2, -12], [22, -6], [-22, 14], [24, 22], [-24, -26]].forEach((c) => crate(c[0], c[1], c[2] || 0));
const mSand = new THREE.MeshStandardMaterial({ map: texSand, roughness: 1 });
[[0, -9, 4, 0.6], [-9, 4, 0.6, 4], [9, 4, 0.6, 4], [0, 19, 5, 0.6], [-26, -6, 0.6, 5], [26, -10, 0.6, 5],
  [-14, -28, 5, 0.6], [16, 28, 5, 0.6], [-16, 28, 5, 0.6], [14, -28, 5, 0.6]].forEach((s) => addBox(s[0], s[1], s[2], 0.95, s[3], mSand));
const mBunk = new THREE.MeshStandardMaterial({ map: wallTex([2, 1]), roughness: 0.9, color: 0xd0c8bb });
addBox(-3.4, 2, 0.5, 2.2, 4.5, mBunk); addBox(3.4, 2, 0.5, 2.2, 4.5, mBunk); addBox(0, 4, 7.3, 0.4, 0.5, mBunk, 2.2); addBox(0, 4.25, 6.3, 2.2, 0.5, mBunk);
const mPole = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.5, metalness: 0.6 });
[[-36, -36], [36, -36], [-36, 36], [36, 36]].forEach(([x, z]) => {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 12, 8), mPole); p.position.set(x, 6, z); p.castShadow = true; scene.add(p);
  const h = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.6), mPole); h.position.set(x, 12, z); scene.add(h);
});
/* team spawn markings */
function zoneStrip(z, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(64, 0.35), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, z); scene.add(m);
}
zoneStrip(27, 0x3d8bff); zoneStrip(-27, 0xff4a3d);

[[0, 0], [-31, 31], [31, -31], [31, 19], [-31, -19]].forEach(([x, z]) => {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.2, 28), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5, metalness: 0.6 }));
  base.position.set(x, 0.1, z); base.receiveShadow = true; scene.add(base);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.05, 32), new THREE.MeshBasicMaterial({ color: 0xffb43b, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.215, z); scene.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 2.4, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb43b, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.set(x, 1.4, z); scene.add(beam);
  pads.push({ x, z, ring, beam });
});

/* ---------- spawning ---------- */
export function freeSpot(x, z, m = 0.8) {
  if (Math.abs(x) > ARENA - 2 || Math.abs(z) > ARENA - 2) return false;
  for (const b of boxes) if (b.top > 0.4 && x > b.minX - m && x < b.maxX + m && z > b.minZ - m && z < b.maxZ + m) return false;
  for (const p of pads) if (Math.hypot(p.x - x, p.z - z) < 2) return false;
  return true;
}
export function teamSpawn(team) {
  const zs = team === 'A' ? [30, 36] : [-36, -30];
  for (let i = 0; i < 40; i++) {
    const x = rand(-32, 32), z = rand(zs[0], zs[1]);
    if (freeSpot(x, z)) return { x, z };
  }
  return { x: 0, z: team === 'A' ? 34 : -34 };
}
export function farSpawn(avoid) {
  let best = null, bd = -1;
  for (let i = 0; i < 14; i++) {
    const x = rand(-35, 35), z = rand(-35, 35);
    if (!freeSpot(x, z)) continue;
    let md = 1e9;
    for (const a of avoid) md = Math.min(md, Math.hypot(a.x - x, a.z - z));
    if (md > bd) { bd = md; best = { x, z }; }
  }
  return best || { x: 0, z: 30 };
}
export const WAVE_SPAWNS = [[-35, -35], [35, -35], [-35, 35], [35, 35], [0, -35], [0, 35], [-35, 0], [35, 0], [-18, -35], [18, 35], [-35, 18], [35, -12]];

/* ---------- collision ---------- */
function blocks(bx, y, h) { return y < bx.top - 0.36 && y + h > bx.bottom + 0.01; }
export function moveBody(pos, vel, dt, r, h) {
  pos.x += vel.x * dt;
  for (const b of boxes) {
    if (!blocks(b, pos.y, h)) continue;
    if (pos.z > b.minZ - r && pos.z < b.maxZ + r && pos.x > b.minX - r && pos.x < b.maxX + r) {
      if (vel.x > 0) pos.x = b.minX - r; else if (vel.x < 0) pos.x = b.maxX + r;
      else pos.x = pos.x - b.minX < b.maxX - pos.x ? b.minX - r : b.maxX + r;
      vel.x = 0;
    }
  }
  pos.z += vel.z * dt;
  for (const b of boxes) {
    if (!blocks(b, pos.y, h)) continue;
    if (pos.z > b.minZ - r && pos.z < b.maxZ + r && pos.x > b.minX - r && pos.x < b.maxX + r) {
      if (vel.z > 0) pos.z = b.minZ - r; else if (vel.z < 0) pos.z = b.maxZ + r;
      else pos.z = pos.z - b.minZ < b.maxZ - pos.z ? b.minZ - r : b.maxZ + r;
      vel.z = 0;
    }
  }
  let floor = 0; const rr = r * 0.7;
  for (const b of boxes) {
    if (pos.x > b.minX - rr && pos.x < b.maxX + rr && pos.z > b.minZ - rr && pos.z < b.maxZ + rr) {
      if (pos.y >= b.top - 0.36) floor = Math.max(floor, b.top);
      else if (vel.y > 0 && pos.y + h > b.bottom && pos.y < b.bottom) { pos.y = b.bottom - h; vel.y = 0; }
    }
  }
  pos.y += vel.y * dt;
  if (pos.y <= floor) { pos.y = floor; vel.y = 0; return true; }
  return false;
}

/* ---------- line of sight (solids + smoke) ---------- */
const ray = new THREE.Raycaster();
const dir = new THREE.Vector3(), cp = new THREE.Vector3();
export function segSphere(a, b, c, r) {
  dir.subVectors(b, a);
  const l2 = dir.lengthSq() || 1e-6;
  const t = Math.max(0, Math.min(1, cp.subVectors(c, a).dot(dir) / l2));
  cp.copy(a).addScaledVector(dir, t);
  return cp.distanceToSquared(c) < r * r;
}
export function losClear(a, b, ignoreSmoke = false) {
  if (!ignoreSmoke) for (const s of smokes) if (s.r > 1 && segSphere(a, b, s.pos, s.r * 0.85)) return false;
  dir.subVectors(b, a);
  const d = dir.length();
  if (d < 0.01) return true;
  ray.set(a, dir.divideScalar(d)); ray.far = d;
  return ray.intersectObjects(solids, false).length === 0;
}
export function inSmoke(p) {
  let k = 0;
  for (const s of smokes) { const d = p.distanceTo(s.pos); if (d < s.r) k = Math.max(k, 1 - d / s.r); }
  return k;
}
