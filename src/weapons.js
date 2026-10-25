import * as THREE from 'three';

/* ---------- weapon definitions (fictional designations) ----------
   dmg: per bullet/pellet · head: headshot multiplier · rate: seconds between shots
   spread/moveSpread/hipPenalty: radians · zoom: degrees of FOV removed when aiming */
export const WEAPONS = {
  k9: {
    id: 'k9', name: 'K-9 카빈', cls: '돌격소총', slot: 0, dmg: 27, head: 2.2, rate: 0.095, auto: true, mag: 30, reserve: 210,
    spread: 0.009, moveSpread: 0.026, bloom: 0.005, pellets: 1, reload: 1.6, kick: 0.011, range: 220, zoom: 22, speed: 1, snd: 'ar', rf: 110,
    vis: { type: 'rifle', rl: 0.36, hl: 0.26, bl: 0.12, stock: 'fixed', mag: 'straight', optic: 'dot', fore: 'rail', color: 0x7a6a4e },
  },
  vx4: {
    id: 'vx4', name: 'VX-4 돌격소총', cls: '돌격소총', slot: 0, dmg: 34, head: 2.1, rate: 0.118, auto: true, mag: 30, reserve: 180,
    spread: 0.011, moveSpread: 0.03, bloom: 0.008, pellets: 1, reload: 1.9, kick: 0.016, range: 220, zoom: 20, speed: 0.97, snd: 'ar2', rf: 105,
    vis: { type: 'rifle', rl: 0.38, hl: 0.22, bl: 0.17, stock: 'wood', mag: 'curved', optic: 'iron', fore: 'wood', color: 0x2b2b2b },
  },
  stinger: {
    id: 'stinger', name: '스팅어 SMG', cls: '기관단총', slot: 0, dmg: 20, head: 1.9, rate: 0.066, auto: true, mag: 35, reserve: 245,
    spread: 0.014, moveSpread: 0.012, bloom: 0.004, pellets: 1, reload: 1.45, kick: 0.008, range: 140, zoom: 16, speed: 1.08, snd: 'smg', rf: 70,
    vis: { type: 'rifle', rl: 0.26, hl: 0.1, bl: 0.06, stock: 'skel', mag: 'straight', optic: 'holo', fore: 'slim', color: 0x3b3a35, bulk: 1.05 },
  },
  t12: {
    id: 't12', name: 'T-12 펌프 샷건', cls: '산탄총', slot: 0, dmg: 14, head: 1.6, rate: 0.8, auto: true, mag: 6, reserve: 36,
    spread: 0.055, moveSpread: 0.02, bloom: 0, pellets: 9, reload: 2.2, kick: 0.045, range: 34, zoom: 10, speed: 1, snd: 'sg', rf: 24,
    vis: { type: 'rifle', rl: 0.3, hl: 0.2, bl: 0.36, stock: 'wood', mag: 'tube', optic: 'iron', fore: 'pump', color: 0x232427 },
  },
  dmr: {
    id: 'dmr', name: 'M-21 지정사수소총', cls: '지정사수소총', slot: 0, dmg: 52, head: 2.2, rate: 0.26, auto: false, mag: 15, reserve: 75,
    spread: 0.004, moveSpread: 0.03, hipPenalty: 0.02, bloom: 0.006, pellets: 1, reload: 2.1, kick: 0.028, range: 260, zoom: 42, speed: 0.95, snd: 'dmr', rf: 220, scope: true,
    vis: { type: 'rifle', rl: 0.4, hl: 0.32, bl: 0.2, stock: 'fixed', mag: 'straight', optic: 'scope', fore: 'rail', color: 0x4d5340 },
  },
  longbow: {
    id: 'longbow', name: '롱보우 저격소총', cls: '저격소총', slot: 0, dmg: 115, head: 2.6, rate: 1.25, auto: false, mag: 5, reserve: 30,
    spread: 0.0015, moveSpread: 0.07, hipPenalty: 0.06, bloom: 0, pellets: 1, reload: 2.6, kick: 0.05, range: 320, zoom: 58, speed: 0.9, snd: 'sn', rf: 300, scope: true,
    vis: { type: 'rifle', rl: 0.42, hl: 0.3, bl: 0.4, stock: 'fixed', mag: 'box', optic: 'scope', fore: 'slim', color: 0x2f3b2f, bulk: 0.95 },
  },
  hammer: {
    id: 'hammer', name: '해머 경기관총', cls: '경기관총', slot: 0, dmg: 29, head: 2.0, rate: 0.082, auto: true, mag: 100, reserve: 200,
    spread: 0.016, moveSpread: 0.035, bloom: 0.004, pellets: 1, reload: 4.2, kick: 0.013, range: 220, zoom: 18, speed: 0.86, snd: 'lmg', rf: 100,
    vis: { type: 'rifle', rl: 0.46, hl: 0.3, bl: 0.26, stock: 'fixed', mag: 'drum', optic: 'holo', fore: 'rail', color: 0x2b2b2b, bulk: 1.25, bipod: true },
  },
  p17: {
    id: 'p17', name: 'P-17 권총', cls: '권총', slot: 1, dmg: 25, head: 2.0, rate: 0.13, auto: false, mag: 17, reserve: 85,
    spread: 0.012, moveSpread: 0.012, bloom: 0.006, pellets: 1, reload: 1.2, kick: 0.02, range: 150, zoom: 12, speed: 1.1, snd: 'pi', rf: 60,
    vis: { type: 'pistol', model: 'auto', color: 0x2a2b2e },
  },
  mag44: {
    id: 'mag44', name: '.44 매그넘', cls: '권총', slot: 1, dmg: 58, head: 2.1, rate: 0.48, auto: false, mag: 6, reserve: 36,
    spread: 0.008, moveSpread: 0.02, bloom: 0.01, pellets: 1, reload: 2.0, kick: 0.06, range: 180, zoom: 14, speed: 1.08, snd: 'rv', rf: 70,
    vis: { type: 'pistol', model: 'revolver', color: 0x8d9097 },
  },
  mp9: {
    id: 'mp9', name: 'MP-9 기관권총', cls: '권총', slot: 1, dmg: 17, head: 1.8, rate: 0.058, auto: true, mag: 20, reserve: 120,
    spread: 0.02, moveSpread: 0.012, bloom: 0.005, pellets: 1, reload: 1.4, kick: 0.009, range: 110, zoom: 10, speed: 1.1, snd: 'smg', rf: 50,
    vis: { type: 'pistol', model: 'mp', color: 0x26272a },
  },
  knife: {
    id: 'knife', name: '전투 나이프', cls: '근접', slot: 2, dmg: 55, back: 150, rate: 0.5, auto: true, melee: true, mag: 0, reserve: 0,
    range: 2.4, speed: 1.15, zoom: 0, spread: 0, moveSpread: 0, kick: 0, snd: 'kn',
    vis: { type: 'knife' },
  },
};
export const PRIMARIES = ['k9', 'vx4', 'stinger', 't12', 'dmr', 'longbow', 'hammer'];
export const SECONDARIES = ['p17', 'mag44', 'mp9'];
export const BOT_WEAPONS = { k9: 3, vx4: 2.2, stinger: 2, t12: 1, dmr: 1, hammer: 0.8, longbow: 0.6 };

/* stat bars for the arsenal (0..1) */
export function weaponStats(w) {
  const dps = (w.dmg * (w.pellets || 1)) / w.rate;
  return [
    ['피해량', Math.min(1, (w.dmg * (w.pellets || 1)) / 120)],
    ['연사력', Math.min(1, 0.06 / w.rate + 0.05)],
    ['사거리', Math.min(1, (w.rf || 10) / 300)],
    ['기동성', Math.min(1, Math.max(0, (w.speed - 0.8) / 0.35))],
    ['DPS', Math.min(1, dps / 420)],
  ];
}

/* ---------- procedural gun models ---------- */
const MAT = {
  metal: new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.35, metalness: 0.8 }),
  metal2: new THREE.MeshStandardMaterial({ color: 0x2f3134, roughness: 0.45, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.55 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x15283a, roughness: 0.05, metalness: 0.9, emissive: 0x0a1a2c }),
  blade: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.22, metalness: 1 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff3322 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x34302a, roughness: 0.85 }),
};
const polyCache = {};
function poly(hex) {
  return polyCache[hex] || (polyCache[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65, metalness: 0.1 }));
}
const BX = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (r1, r2, h, s = 12) => new THREE.CylinderGeometry(r1, r2, h, s);
function add(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  g.add(m); return m;
}

/** Gun group: origin just above the pistol grip, barrel along -Z, metres. */
export function buildGun(v) {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  if (v.type === 'pistol') return buildPistol(v, g, muzzle);
  if (v.type === 'knife') return buildKnife(g, muzzle);
  const pc = poly(v.color || 0x3b3a35);
  const rl = v.rl, hl = v.hl, bl = v.bl, bh = 0.085 * (v.bulk || 1);
  const rear = 0.08, fz = rear - rl;
  add(g, BX(0.064, bh, rl), MAT.metal, 0, 0, rear - rl / 2);
  add(g, BX(0.067, 0.026, 0.075), MAT.metal2, 0.001, 0.012, rear - rl * 0.45);
  add(g, BX(0.03, 0.012, rl * 0.9), MAT.dark, 0, bh / 2 + 0.006, rear - rl / 2);
  let pump = null;
  if (v.fore === 'wood') add(g, BX(0.062, 0.068, hl), MAT.wood, 0, -0.006, fz - hl / 2);
  else if (v.fore === 'pump') pump = add(g, CY(0.031, 0.031, hl * 0.8, 14), MAT.wood, 0, -0.028, fz - hl / 2, Math.PI / 2);
  else if (v.fore === 'slim') add(g, BX(0.05, 0.06, hl), pc, 0, 0, fz - hl / 2);
  else {
    add(g, BX(0.062, 0.07, hl), pc, 0, 0, fz - hl / 2);
    const n = Math.max(1, Math.floor(hl / 0.05));
    for (let i = 0; i < n; i++) add(g, BX(0.066, 0.012, 0.024), MAT.dark, 0, 0.037, fz - 0.03 - i * 0.05);
  }
  const bz = fz - hl;
  const br = v.mag === 'tube' ? 0.017 : 0.011;
  add(g, CY(br, br, bl + 0.06, 10), MAT.metal, 0, v.mag === 'tube' ? 0.02 : 0.01, bz - bl / 2 + 0.03, Math.PI / 2);
  if (v.mag !== 'tube') add(g, CY(0.018, 0.018, 0.06, 10), MAT.metal, 0, 0.01, bz - bl, Math.PI / 2);
  muzzle.position.set(0, v.mag === 'tube' ? 0.02 : 0.01, bz - bl - 0.04);
  g.add(muzzle);
  switch (v.mag) {
    case 'curved': {
      const a = add(g, BX(0.044, 0.1, 0.075), MAT.dark, 0, -0.085, -0.07, 0.1);
      add(g, BX(0.044, 0.1, 0.07), MAT.dark, 0, -0.17, -0.1, 0.45); a.userData.mag = true; break;
    }
    case 'drum': add(g, CY(0.075, 0.075, 0.055, 18), MAT.dark, 0, -0.1, -0.08, 0, 0, Math.PI / 2); break;
    case 'box': add(g, BX(0.045, 0.07, 0.08), MAT.dark, 0, -0.07, -0.07); break;
    case 'tube': add(g, CY(0.016, 0.016, bl * 0.85, 10), MAT.metal, 0, -0.02, bz - bl * 0.35, Math.PI / 2); break;
    default: add(g, BX(0.044, 0.17, 0.075), MAT.dark, 0, -0.115, -0.075, 0.15);
  }
  add(g, BX(0.04, 0.1, 0.046), MAT.dark, 0, -0.075, 0.06, -0.32);
  add(g, BX(0.01, 0.012, 0.06), MAT.dark, 0, -0.052, 0.01);
  switch (v.stock) {
    case 'wood': add(g, BX(0.05, 0.085, 0.28), MAT.wood, 0, -0.03, rear + 0.13, 0.12); break;
    case 'skel':
      add(g, BX(0.012, 0.012, 0.22), MAT.metal, 0, 0.02, rear + 0.11);
      add(g, BX(0.012, 0.012, 0.22), MAT.metal, 0, -0.035, rear + 0.11);
      add(g, BX(0.05, 0.1, 0.022), MAT.dark, 0, -0.01, rear + 0.22); break;
    case 'none': break;
    default:
      add(g, BX(0.05, 0.075, 0.22), pc, 0, -0.012, rear + 0.11);
      add(g, BX(0.052, 0.115, 0.026), MAT.dark, 0, -0.024, rear + 0.235);
      add(g, BX(0.03, 0.03, 0.12), MAT.dark, 0, 0.04, rear + 0.12);
  }
  let sightY = 0.07;
  switch (v.optic) {
    case 'dot': {
      const t = add(g, CY(0.03, 0.03, 0.1, 16), MAT.metal, 0, 0.095, -0.05, Math.PI / 2);
      t.material = MAT.metal;
      add(g, new THREE.CircleGeometry(0.004, 8), MAT.red, 0, 0.095, -0.098);
      add(g, BX(0.03, 0.03, 0.05), MAT.metal, 0, 0.065, -0.05);
      sightY = 0.095; break;
    }
    case 'holo': {
      add(g, BX(0.05, 0.012, 0.09), MAT.metal, 0, 0.062, -0.04);
      add(g, BX(0.006, 0.06, 0.09), MAT.metal, 0.025, 0.09, -0.04);
      add(g, BX(0.006, 0.06, 0.09), MAT.metal, -0.025, 0.09, -0.04);
      add(g, BX(0.05, 0.008, 0.09), MAT.metal, 0, 0.122, -0.04);
      add(g, new THREE.RingGeometry(0.006, 0.008, 16), MAT.red, 0, 0.098, -0.086);
      sightY = 0.098; break;
    }
    case 'scope': {
      add(g, CY(0.022, 0.022, 0.24, 16), MAT.metal, 0, 0.1, -0.06, Math.PI / 2);
      add(g, CY(0.034, 0.024, 0.07, 16), MAT.metal, 0, 0.1, -0.2, Math.PI / 2);
      add(g, CY(0.026, 0.03, 0.05, 16), MAT.metal, 0, 0.1, 0.07, Math.PI / 2);
      add(g, new THREE.CircleGeometry(0.03, 16), MAT.glass, 0, 0.1, -0.236, 0, Math.PI);
      add(g, BX(0.02, 0.04, 0.03), MAT.metal, 0, 0.07, -0.12);
      add(g, BX(0.02, 0.04, 0.03), MAT.metal, 0, 0.07, 0.0);
      sightY = 0.1; break;
    }
    default:
      add(g, BX(0.008, 0.03, 0.01), MAT.metal, 0, bh / 2 + 0.02, bz + 0.02);
      add(g, BX(0.03, 0.025, 0.012), MAT.metal, 0, bh / 2 + 0.018, rear - 0.02);
      sightY = bh / 2 + 0.03;
  }
  if (v.bipod) {
    add(g, BX(0.008, 0.14, 0.008), MAT.metal, 0.02, -0.07, bz + 0.03, 0.4, 0, 0.15);
    add(g, BX(0.008, 0.14, 0.008), MAT.metal, -0.02, -0.07, bz + 0.03, 0.4, 0, -0.15);
  }
  return { g, muzzle, pump, foreZ: fz - hl * 0.45, sightY, type: 'rifle' };
}

function buildPistol(v, g, muzzle) {
  const pc = poly(v.color || 0x2a2b2e);
  if (v.model === 'revolver') {
    add(g, BX(0.03, 0.05, 0.12), pc, 0, 0.012, -0.04);
    add(g, CY(0.028, 0.028, 0.045, 12), pc, 0, 0.018, -0.045, Math.PI / 2);
    add(g, BX(0.022, 0.026, 0.17), pc, 0, 0.034, -0.17);
    add(g, BX(0.018, 0.012, 0.16), MAT.metal2, 0, 0.012, -0.17);
    add(g, BX(0.032, 0.115, 0.05), MAT.wood, 0, -0.055, 0.03, -0.35);
    add(g, BX(0.006, 0.014, 0.01), MAT.metal, 0, 0.054, -0.25);
    add(g, BX(0.01, 0.01, 0.06), MAT.dark, 0, -0.022, -0.02);
    muzzle.position.set(0, 0.034, -0.27);
    g.add(muzzle);
    return { g, muzzle, foreZ: 0, sightY: 0.058, type: 'pistol' };
  }
  const long = v.model === 'mp' ? 1.15 : 1;
  add(g, BX(0.032, 0.034, 0.19 * long), pc, 0, 0.034, -0.06 * long);
  add(g, BX(0.03, 0.026, 0.16 * long), MAT.dark, 0, 0.006, -0.05 * long);
  add(g, BX(0.03, 0.11, 0.046), MAT.dark, 0, -0.05, 0.015, -0.22);
  add(g, BX(0.033, 0.01, 0.03), MAT.metal2, 0, 0.042, -0.0);
  add(g, BX(0.006, 0.01, 0.008), MAT.metal, 0, 0.056, -0.145 * long);
  add(g, BX(0.024, 0.01, 0.008), MAT.metal, 0, 0.056, 0.025);
  if (v.model === 'mp') {
    add(g, BX(0.026, 0.18, 0.04), MAT.dark, 0, -0.11, 0.02, -0.22);
    add(g, BX(0.024, 0.07, 0.03), MAT.dark, 0, -0.03, -0.14, 0.2);
    add(g, CY(0.014, 0.014, 0.05, 10), MAT.metal, 0, 0.032, -0.19, Math.PI / 2);
    muzzle.position.set(0, 0.032, -0.22);
  } else muzzle.position.set(0, 0.032, -0.16);
  g.add(muzzle);
  return { g, muzzle, foreZ: 0, sightY: 0.058, type: 'pistol' };
}

function buildKnife(g, muzzle) {
  add(g, CY(0.015, 0.017, 0.11, 10), MAT.dark, 0, 0, 0.02, Math.PI / 2);
  add(g, BX(0.06, 0.012, 0.012), MAT.metal, 0, 0, -0.04);
  const b = add(g, BX(0.004, 0.032, 0.17), MAT.blade, 0, 0.004, -0.13);
  b.scale.set(1, 1, 1);
  add(g, BX(0.004, 0.02, 0.04), MAT.blade, 0, 0.0, -0.225, 0.5);
  g.add(muzzle);
  return { g, muzzle, foreZ: 0, sightY: 0.02, type: 'knife' };
}

const UP = new THREE.Vector3(0, 1, 0);
function limb(parent, from, to, r1, r2, mat) {
  const d = new THREE.Vector3().subVectors(to, from);
  const m = new THREE.Mesh(CY(r2, r1, d.length(), 10), mat);
  m.position.copy(from).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(m); return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** First-person model: gun plus gloved hands and sleeves. */
export function buildViewmodel(def, sleeveMat) {
  const root = new THREE.Group();
  const gun = buildGun(def.vis);
  root.add(gun.g);
  const gl = MAT.glove;
  let hip, ads;
  if (gun.type === 'rifle') {
    add(root, BX(0.052, 0.1, 0.06), gl, 0.012, -0.085, 0.065, -0.3);
    limb(root, V(0.015, -0.12, 0.1), V(0.13, -0.32, 0.5), 0.045, 0.058, sleeveMat);
    add(root, BX(0.076, 0.05, 0.11), gl, -0.012, -0.045, gun.foreZ);
    limb(root, V(-0.03, -0.07, gun.foreZ + 0.05), V(-0.24, -0.32, 0.2), 0.045, 0.058, sleeveMat);
    hip = V(0.165, -0.155, -0.29);
    ads = V(0, -gun.sightY, def.scope ? -0.18 : -0.235);
  } else if (gun.type === 'pistol') {
    add(root, BX(0.05, 0.095, 0.06), gl, 0.012, -0.06, 0.02, -0.25);
    add(root, BX(0.05, 0.085, 0.06), gl, -0.018, -0.07, 0.015, -0.25);
    limb(root, V(0.02, -0.1, 0.06), V(0.13, -0.32, 0.42), 0.042, 0.055, sleeveMat);
    limb(root, V(-0.025, -0.1, 0.06), V(-0.16, -0.32, 0.42), 0.042, 0.055, sleeveMat);
    hip = V(0.13, -0.135, -0.34);
    ads = V(0, -gun.sightY, -0.32);
  } else {
    gun.g.rotation.set(0.25, -0.15, -0.35);
    add(root, BX(0.05, 0.09, 0.07), gl, 0.0, -0.01, 0.03);
    limb(root, V(0.01, -0.04, 0.07), V(0.12, -0.3, 0.45), 0.042, 0.055, sleeveMat);
    hip = V(0.16, -0.15, -0.32);
    ads = hip.clone();
  }
  return { g: root, gun: gun.g, muzzle: gun.muzzle, pump: gun.pump, hip, ads, type: gun.type };
}

/* ---------- grenades ---------- */
export const NADES = {
  frag: { name: '세열 수류탄', short: '세열', key: 'G', fuse: 2.2, color: 0x4a5236 },
  flash: { name: '섬광탄', short: '섬광', key: 'F', fuse: 1.5, color: 0x8b9096 },
  smoke: { name: '연막탄', short: '연막', key: 'V', fuse: 1.2, color: 0x5d6b5a },
};
const nadeGeo = {
  frag: new THREE.SphereGeometry(0.055, 12, 10),
  flash: new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12),
  smoke: new THREE.CylinderGeometry(0.04, 0.04, 0.14, 12),
};
const nadeMat = {};
for (const k in NADES) nadeMat[k] = new THREE.MeshStandardMaterial({ color: NADES[k].color, roughness: 0.55, metalness: 0.3 });
export function buildNade(type) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(nadeGeo[type], nadeMat[type]); b.castShadow = true; g.add(b);
  const top = new THREE.Mesh(BX(0.02, 0.03, 0.05), MAT.metal2);
  top.position.y = type === 'frag' ? 0.06 : 0.07; g.add(top);
  return g;
}
