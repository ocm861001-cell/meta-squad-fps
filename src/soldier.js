import * as THREE from 'three';
import { camoTex } from './textures.js';
import { buildGun, WEAPONS } from './weapons.js';

export const SKINS = [0xc99a7a, 0x8d5e43, 0xe2b896, 0x6b4532, 0xb58060];
export const LOOKS = {
  urban: { camo: camoTex(['#6b7078', '#464a51', '#8d9199', '#2c2f34']), vest: 0x3a3e44, helmet: 0x464a50 },
  navy: { camo: camoTex(['#4a5566', '#323a47', '#6c7686', '#232831']), vest: 0x2f3744, helmet: 0x3a4250 },
  desert: { camo: camoTex(['#b49d74', '#8d7552', '#cdb995', '#6e5a3e']), vest: 0x9a8460, helmet: 0xa38d68 },
  olive: { camo: camoTex(['#5d6142', '#3f4330', '#7a7756', '#2c2e22']), vest: 0x4a4f36, helmet: 0x565a3f },
  elite: { camo: camoTex(['#26282c', '#1a1b1e', '#3a3c41']), vest: 0x1f2124, helmet: 0x2a2c30 },
  boss: { camo: camoTex(['#2e2a26', '#1c1a18', '#4a3b2a']), vest: 0x24211e, helmet: 0x33302b },
};
export const TEAM_LOOKS = { A: ['urban', 'navy'], B: ['desert', 'olive'] };
export const ANY_LOOKS = ['urban', 'navy', 'desert', 'olive'];
export const TEAM_COLOR = { A: 0x3d8bff, B: 0xff4a3d };

const SPH = new THREE.SphereGeometry(1, 20, 14);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 12);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/* merge every direct mesh child of each group by material → far fewer draw calls */
function mergeGeos(list) {
  let vCount = 0, iCount = 0;
  const parts = list.map((m) => {
    m.updateMatrix();
    const g = m.geometry.index ? m.geometry.clone() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
    const n = g.attributes.position.count;
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[io + i] = a[i] + vo; io += a.length; }
    else { for (let i = 0; i < n; i++) idx[io + i] = vo + i; io += n; }
    vo += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
function mergeTree(root, out, shadow) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh) groups.push(o); });
  for (const grp of groups) {
    const buckets = new Map();
    for (const c of [...grp.children]) {
      if (!c.isMesh) continue;
      const key = c.material.uuid + (c.userData.head ? 'h' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: c.material, head: !!c.userData.head, list: [] });
      buckets.get(key).list.push(c);
      grp.remove(c);
    }
    for (const b of buckets.values()) {
      const m = new THREE.Mesh(mergeGeos(b.list), b.mat);
      m.userData.head = b.head;
      m.castShadow = shadow; m.receiveShadow = true;
      grp.add(m); out.push(m);
    }
  }
}

export function buildSoldier({ look = 'olive', skin = SKINS[0], kind = 'normal', teamColor = null, wid = 'k9', shadow = true }) {
  const L = LOOKS[look];
  const elite = kind === 'elite', boss = kind === 'boss';
  const M = {
    skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.58 }),
    cloth: new THREE.MeshStandardMaterial({ map: L.camo, roughness: 0.93 }),
    vest: new THREE.MeshStandardMaterial({ color: L.vest, roughness: 0.86 }),
    gear: new THREE.MeshStandardMaterial({ color: 0x26272a, roughness: 0.65, metalness: 0.15 }),
    boot: new THREE.MeshStandardMaterial({ color: 0x2a231c, roughness: 0.75 }),
    helmet: new THREE.MeshStandardMaterial({ color: L.helmet, roughness: 0.78 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x2c2723, roughness: 0.85 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.12, metalness: 0.7, emissive: elite || boss ? 0xff7a1a : 0x331a10, emissiveIntensity: elite || boss ? 1.4 : 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x202124, roughness: 0.38, metalness: 0.75 }),
    band: new THREE.MeshStandardMaterial({ color: teamColor ?? 0x55585e, roughness: 0.6, emissive: teamColor ?? 0x000000, emissiveIntensity: teamColor ? 0.35 : 0 }),
  };
  const mk = (geo, mat, parent, x = 0, y = 0, z = 0, head = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.head = head; parent.add(m); return m;
  };
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.98; body.add(hips);
  mk(B(0.34, 0.2, 0.22), M.cloth, hips);
  mk(B(0.37, 0.06, 0.25), M.gear, hips, 0, 0.08, 0);
  mk(B(0.08, 0.07, 0.04), M.metal, hips, 0, 0.08, 0.13);
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = new THREE.Group(); thigh.position.set(0.1 * s, -0.06, 0); hips.add(thigh);
    mk(cap(0.085, 0.27), M.cloth, thigh, 0, -0.2, 0);
    if (s > 0) mk(B(0.06, 0.15, 0.13), M.vest, thigh, 0.095, -0.17, 0);
    else mk(B(0.05, 0.13, 0.1), M.gear, thigh, -0.09, -0.12, 0);
    const knee = new THREE.Group(); knee.position.y = -0.42; thigh.add(knee);
    mk(B(0.11, 0.11, 0.05), M.gear, knee, 0, -0.02, 0.075);
    mk(cap(0.07, 0.27), M.cloth, knee, 0, -0.2, 0);
    mk(B(0.135, 0.13, 0.29), M.boot, knee, 0, -0.44, 0.04);
    mk(B(0.14, 0.03, 0.3), M.gear, knee, 0, -0.5, 0.04);
    legs.push({ thigh, knee });
  }
  const spine = new THREE.Group(); spine.position.y = 0.08; hips.add(spine);
  mk(cap(0.165, 0.26), M.cloth, spine, 0, 0.28, 0).scale.set(1.12, 1, 0.74);
  mk(B(0.4, 0.37, 0.28), M.vest, spine, 0, 0.29, 0);
  mk(B(0.34, 0.3, 0.03), M.vest, spine, 0, 0.31, 0.15);
  for (const px of [-0.11, 0, 0.11]) mk(B(0.085, 0.13, 0.065), M.vest, spine, px, 0.2, 0.18);
  mk(B(0.12, 0.08, 0.05), M.gear, spine, 0.1, 0.38, 0.17);
  mk(B(0.17, 0.24, 0.09), M.gear, spine, 0.05, 0.3, -0.18);
  mk(new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4), M.gear, spine, 0.11, 0.6, -0.19);
  for (const s of [-1, 1]) mk(B(0.07, 0.03, 0.3), M.gear, spine, 0.13 * s, 0.47, 0);
  if (boss) {
    mk(B(0.46, 0.42, 0.34), M.vest, spine, 0, 0.29, 0);
    mk(B(0.3, 0.12, 0.05), M.metal, spine, 0, 0.12, 0.18);
  }
  mk(new THREE.CylinderGeometry(0.055, 0.066, 0.1, 12), M.skin, spine, 0, 0.55, 0, true);
  const head = new THREE.Group(); head.position.y = 0.6; spine.add(head);
  mk(SPH, M.skin, head, 0, 0.1, 0.005, true).scale.set(0.097, 0.118, 0.106);
  mk(SPH, M.skin, head, 0, 0.035, 0.035, true).scale.set(0.074, 0.058, 0.075);
  mk(B(0.028, 0.045, 0.035), M.skin, head, 0, 0.088, 0.105, true);
  mk(B(0.15, 0.022, 0.03), M.skin, head, 0, 0.155, 0.088, true);
  for (const s of [-1, 1]) mk(SPH, M.skin, head, 0.096 * s, 0.1, -0.005, true).scale.set(0.012, 0.03, 0.022);
  mk(new THREE.CylinderGeometry(0.085, 0.1, 0.07, 14), M.cloth, head, 0, 0.0, 0.01, true);
  mk(B(0.2, 0.045, 0.06), M.gear, head, 0, 0.132, 0.078, true);
  for (const s of [-1, 1]) mk(B(0.078, 0.042, 0.022), M.lens, head, 0.044 * s, 0.132, 0.107, true);
  if (boss) mk(B(0.2, 0.13, 0.03), M.lens, head, 0, 0.08, 0.12, true);
  const helmet = new THREE.Group(); helmet.position.y = 0.125; head.add(helmet);
  mk(new THREE.SphereGeometry(0.138, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), M.helmet, helmet, 0, 0, 0, true).scale.set(1, 0.98, 1.1);
  mk(B(0.07, 0.045, 0.03), M.metal, helmet, 0, 0.07, 0.135, true);
  for (const s of [-1, 1]) mk(B(0.02, 0.035, 0.16), M.gear, helmet, 0.135 * s, 0.0, 0, true);
  mk(B(0.1, 0.05, 0.06), M.gear, helmet, 0, 0.08, -0.12, true);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.235 * s, 0.47, 0); spine.add(sh);
    mk(SPH, M.vest, sh).scale.set(boss ? 0.11 : 0.078, boss ? 0.09 : 0.07, boss ? 0.11 : 0.08);
    mk(cap(0.06, 0.21), M.cloth, sh, 0, -0.15, 0);
    if (s > 0) mk(new THREE.CylinderGeometry(0.066, 0.066, 0.05, 12), M.band, sh, 0, -0.1, 0);
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    mk(cap(0.054, 0.19), M.cloth, el, 0, -0.13, 0);
    mk(B(0.085, 0.1, 0.065), M.glove, el, 0, -0.29, 0);
    arms.push({ sh, el });
  }
  const gunData = buildGun(WEAPONS[wid].vis);
  const gun = gunData.g;
  gun.rotation.y = Math.PI;
  gun.position.set(-0.05, 0.31, 0.22);
  spine.add(gun);
  const muzzle = gunData.muzzle;
  const pose = () => {
    arms[0].sh.rotation.set(-0.55, 0, 0.12); arms[0].el.rotation.set(-1.15, 0, 0);
    arms[1].sh.rotation.set(-1.05, 0, -0.5); arms[1].el.rotation.set(-0.55, 0, 0);
    legs[0].knee.rotation.set(0, 0, 0); legs[1].knee.rotation.set(0, 0, 0);
    root.rotation.x = 0; body.position.y = 0;
  };
  pose();
  if (boss) root.scale.setScalar(1.3);
  else if (elite) root.scale.setScalar(1.06);
  const meshes = [];
  mergeTree(root, meshes, shadow);
  const helmetHome = { parent: head, pos: helmet.position.clone() };
  return { root, body, hips, spine, head, helmet, helmetHome, legs, arms, gun, muzzle, meshes, M, resetPose: pose };
}

export function disposeSoldier(s) {
  for (const m of s.meshes) m.geometry.dispose();
  for (const k in s.M) s.M[k].dispose();
}
