import * as THREE from 'three';
import { $, rand, pick, clamp, store, fmtTime, escapeHtml, weightedPick } from './util.js';
import { renderer, scene, camera, vmScene, vmCam, sun, settings, saveSettings, applyGfx, isTouch } from './core.js';
import { audio } from './audio.js';
import { WEAPONS, PRIMARIES, SECONDARIES, BOT_WEAPONS, NADES, weaponStats, buildViewmodel, buildGun, buildNade } from './weapons.js';
import { buildSoldier, disposeSoldier, LOOKS, TEAM_LOOKS, ANY_LOOKS, TEAM_COLOR, SKINS } from './soldier.js';
import { solids, boxes, pads, smokes, ground, sky, moveBody, losClear, inSmoke, teamSpawn, farSpawn, WAVE_SPAWNS } from './world.js';
import { labelTex } from './textures.js';
import * as FX from './fx.js';

const V3 = THREE.Vector3;
const tA = new V3(), tB = new V3(), tC = new V3(), tD = new V3();
const camDir = new V3(), camRight = new V3(), camUp = new V3(), origin = new V3(), playerEye = new V3();
const raycaster = new THREE.Raycaster();
if (isTouch) document.body.classList.add('touch');

/* ================= modes ================= */
const MODES = {
  wave: { key: 'wave', name: '웨이브 서바이벌', desc: '몰려오는 적 분대를 버티기', wave: true },
  tdm3: { key: 'tdm3', name: '팀 데스매치 3:3', desc: '먼저 25킬', team: 3, limit: 25 },
  tdm5: { key: 'tdm5', name: '팀 데스매치 5:5', desc: '먼저 40킬', team: 5, limit: 40 },
  tdm8: { key: 'tdm8', name: '팀 데스매치 8:8', desc: '먼저 60킬', team: 8, limit: 60 },
  ffa: { key: 'ffa', name: '개인전', desc: '8인 난전 · 먼저 15킬', ffa: true, limit: 15, bots: 7 },
};
const DIFF = {
  easy: { name: '쉬움', acc: -0.12, dmg: 0.65, react: 1.4 },
  normal: { name: '보통', acc: 0, dmg: 1, react: 1 },
  hard: { name: '어려움', acc: 0.1, dmg: 1.25, react: 0.75 },
};
const MATCH_TIME = 480;
const NAMES_A = ['이글', '팰컨', '아틀라스', '오로라', '세이버', '라이언', '볼트', '노바', '코멧', '레인저'];
const NAMES_B = ['레이븐', '바이퍼', '코브라', '타이탄', '섀도우', '블레이드', '팬텀', '리퍼', '울프', '스톰', '고스트', '노마드', '킹스네이크'];
const TRACER = { A: 0x8fc0ff, B: 0xff8a5a, F: 0xffd28a };

let mode = MODES[store.get('msf_mode', 'tdm5')] || MODES.tdm5;
let diffKey = DIFF[store.get('msf_diff', 'normal')] ? store.get('msf_diff', 'normal') : 'normal';
let diff = DIFF[diffKey];

/* ================= player & game state ================= */
const savedLoadout = store.json('msf_loadout', ['k9', 'p17']);
const P = {
  isPlayer: true, team: 'A', name: '나', pos: new V3(0, 0, 30), vel: new V3(), yaw: 0, pitch: 0, kick: 0, onGround: true, crouch: 0,
  hp: 100, maxHp: 100, alive: true, kills: 0, deaths: 0, heads: 0,
  loadout: [WEAPONS[savedLoadout[0]] ? savedLoadout[0] : 'k9', WEAPONS[savedLoadout[1]] ? savedLoadout[1] : 'p17'],
  slot: 0, ammo: {}, fireCd: 0, reloadT: 0, reloadMax: 1, switchT: 0, firing: false, firedPress: false, ads: false, adsK: 0, bloom: 0,
  lastHurt: -10, walkT: 0, nades: { frag: 2, flash: 2, smoke: 1 }, nadeType: 'frag', nadeCd: 0, respawnT: 0, protectT: 0,
  blindT: 0, blindMax: 1, killer: null, radius: 0.38, meleeT: 0, throwT: 0,
};
const G = {
  state: 'menu', time: 0, matchT: MATCH_TIME, teamScore: { A: 0, B: 0 }, ended: false,
  score: 0, shots: 0, hits: 0, wave: 0, toSpawn: 0, spawnT: 0, waveDelay: 0, bossPending: false, boss: null, coins: 0,
  perk: { dmg: 1, reload: 1, speed: 1, head: 1, mag: 1, leech: 0, magnet: 1 },
  combo: 1, comboT: 0, streakN: 0, streakT: 0, od: 0, odT: 0, shake: 0,
  noLock: false, hadLock: false, arsenal: false, arsenalFrom: null, settingsFrom: null,
};
let bots = [], botMeshes = [], menuBots = [];
const drops = [], pickups = [], nades = [];
const keys = {};

const curId = () => (P.slot === 2 ? 'knife' : P.loadout[P.slot]);
const curW = () => WEAPONS[curId()];
const magSize = (w) => Math.max(1, Math.round(w.mag * (mode.wave ? G.perk.mag : 1)));
function ammoOf(id) {
  if (!P.ammo[id]) { const w = WEAPONS[id]; P.ammo[id] = { mag: magSize(w), res: w.reserve }; }
  return P.ammo[id];
}
const isEnemy = (a, b) => a !== b && (mode.ffa || a.team !== b.team);
const everyone = () => [P, ...bots];
function eye(c, out) {
  if (c.isPlayer) return out.copy(playerEye);
  return out.set(c.pos.x, c.pos.y + c.eyeH, c.pos.z);
}
function center(c, out) {
  if (c.isPlayer) return out.set(P.pos.x, P.pos.y + 1.0 - P.crouch * 0.3, P.pos.z);
  return out.set(c.pos.x, c.pos.y + c.eyeH * 0.62, c.pos.z);
}
const relClass = (c) => (c === P ? 'me' : mode.ffa ? 'foe' : c.team === P.team ? 'ally' : 'foe');

/* ================= viewmodels ================= */
const sleeveMat = new THREE.MeshStandardMaterial({ map: LOOKS.urban.camo, roughness: 0.9 });
const vmCache = {};
function vmFor(id) {
  if (!vmCache[id]) { const v = buildViewmodel(WEAPONS[id], sleeveMat); v.g.visible = false; vmCam.add(v.g); vmCache[id] = v; }
  return vmCache[id];
}
function showVM() { const id = curId(); for (const k in vmCache) vmCache[k].g.visible = k === id && P.alive; vmFor(id).g.visible = P.alive; }
const vmFlash = new THREE.Sprite(FX.MAT.muzzle);
vmFlash.scale.setScalar(0.22); vmFlash.visible = false; vmScene.add(vmFlash);
let vmRecoil = 0, vmFlashT = 0;

/* ================= HUD helpers ================= */
const elAnn = $('announce'), elFeed = $('feed');
function announce(t, sub) {
  const d = document.createElement('div'); d.className = 'ann';
  d.innerHTML = escapeHtml(t) + (sub ? '<small>' + escapeHtml(sub) + '</small>' : '');
  elAnn.innerHTML = ''; elAnn.appendChild(d);
}
function feed(k, v, o) {
  const d = document.createElement('div');
  const w = o.nade ? NADES[o.nade].short : WEAPONS[o.wid] ? WEAPONS[o.wid].name : '';
  d.innerHTML = (k && k !== v ? '<span class="' + relClass(k) + '">' + escapeHtml(k.name) + '</span>' : '') +
    '<span class="fw">' + escapeHtml(w) + '</span>' +
    '<span class="' + relClass(v) + '">' + escapeHtml(v.name) + '</span>' + (o.head ? '<span class="hs">HEADSHOT</span>' : '');
  if (k === P || v === P) d.classList.add('mine');
  elFeed.prepend(d);
  while (elFeed.children.length > 6) elFeed.lastChild.remove();
  setTimeout(() => d.remove(), 5500);
}
function dmgNum(p, val, head) {
  tA.copy(p).project(camera); if (tA.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmg' + (head ? ' head' : ''); d.textContent = Math.round(val);
  d.style.left = ((tA.x + 1) / 2) * innerWidth + 'px'; d.style.top = ((1 - tA.y) / 2) * innerHeight - 20 + 'px';
  d.style.setProperty('--dx', rand(-20, 20) + 'px'); document.body.appendChild(d); setTimeout(() => d.remove(), 800);
}
let hmT = 0;
function hitMarker(head) { const h = $('hm'); h.className = head ? 'head' : ''; h.style.opacity = 1; hmT = 0.14; }
let toastT = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

/* ================= bots ================= */
function rebuildBotMeshes() { botMeshes = []; for (const b of bots) if (b.alive) botMeshes.push(...b.s.meshes); }
function makeTag(b) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(b.name, '#8fc0ff'), depthTest: false, transparent: true }));
  sp.scale.set(1.1, 0.275, 1); sp.position.y = 2.15; sp.renderOrder = 10;
  b.s.root.add(sp); b.tag = sp;
}
function botHp(kind) {
  if (!mode.wave) return kind === 'boss' ? 600 : 100;
  if (kind === 'boss') return 1300 + G.wave * 90;
  if (kind === 'elite') return 180 + G.wave * 10;
  return 90 + G.wave * 8;
}
function makeBot({ team, kind = 'normal', wid, name, x, z, demo = false }) {
  wid = wid || (kind === 'boss' ? 'hammer' : weightedPick(BOT_WEAPONS));
  const lookKey = kind === 'elite' ? 'elite' : kind === 'boss' ? 'boss' : pick(mode.ffa && !demo ? ANY_LOOKS : TEAM_LOOKS[team] || ANY_LOOKS);
  const s = buildSoldier({ look: lookKey, skin: pick(SKINS), kind, teamColor: mode.ffa && !demo ? null : TEAM_COLOR[team], wid, shadow: settings.gfx !== 'low' });
  s.root.position.set(x, 0, z); scene.add(s.root);
  const scale = kind === 'boss' ? 1.3 : kind === 'elite' ? 1.06 : 1;
  const b = {
    isPlayer: false, team, kind, name, s, wid, wd: WEAPONS[wid], pos: s.root.position, vel: new V3(), yaw: Math.atan2(-x, -z),
    hp: 0, maxHp: 0, alive: true, kills: 0, deaths: 0, heads: 0, eyeH: 1.55 * scale, scale, demo,
    target: null, lastSeen: new V3(x, 0, z), lastSeenT: -99, losT: Math.random() * 0.3, react: 0, fireT: rand(0.8, 1.6), burst: 0, burstT: 0,
    strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(1, 2.5), flank: rand(-0.7, 0.7), walk: Math.random() * 6, flashT: 0, stagger: 0,
    stuckT: 0, lastPos: new V3(x, 0, z), blindT: 0, deathT: 0, respawnT: 0, protectT: 1.5, spawnT: 0.5, spottedT: 0,
    nades: { frag: 1, flash: Math.random() < 0.35 ? 1 : 0, smoke: Math.random() < 0.35 ? 1 : 0 }, nadeCd: rand(5, 12),
  };
  b.maxHp = b.hp = botHp(kind);
  for (const m of s.meshes) m.userData.bot = b;
  if (!demo && !mode.ffa && team === P.team) makeTag(b);
  if (demo) menuBots.push(b);
  else { bots.push(b); if (mode.wave) FX.ringFx(x, z, kind === 'boss' ? 0xff7a1a : 0xff4433); rebuildBotMeshes(); }
  return b;
}
function removeBot(b) {
  scene.remove(b.s.root);
  if (b.helmetLoose) { FX.cancelHelmet(b.s.helmet); scene.remove(b.s.helmet); }
  if (b.tag) { b.tag.material.map.dispose(); b.tag.material.dispose(); }
  disposeSoldier(b.s);
  const arr = b.demo ? menuBots : bots;
  const i = arr.indexOf(b); if (i >= 0) arr.splice(i, 1);
}
function flashBot(b) { b.flashT = 0.09; for (const k of ['cloth', 'vest', 'skin', 'helmet']) b.s.M[k].emissive.setHex(0x661a10); }
function restoreHelmet(b) {
  if (!b.helmetLoose) return;
  const h = b.s.helmet; FX.cancelHelmet(h); scene.remove(h);
  b.s.helmetHome.parent.add(h); h.position.copy(b.s.helmetHome.pos); h.rotation.set(0, 0, 0);
  b.helmetLoose = false;
}
function respawnBot(b) {
  const sp = mode.ffa ? farSpawn(everyone().filter((c) => c !== b && c.alive).map((c) => c.pos)) : teamSpawn(b.team);
  b.pos.set(sp.x, 0, sp.z); b.vel.set(0, 0, 0);
  b.hp = b.maxHp; b.alive = true; b.deathT = 0; b.blindT = 0; b.target = null; b.protectT = 1.5; b.spawnT = 0.4;
  b.yaw = Math.atan2(-sp.x, -sp.z); b.s.resetPose(); restoreHelmet(b);
  b.s.root.position.y = 0; b.s.root.rotation.x = 0;
  b.nades = { frag: 1, flash: Math.random() < 0.35 ? 1 : 0, smoke: Math.random() < 0.35 ? 1 : 0 };
  if (b.tag) b.tag.visible = true;
  rebuildBotMeshes();
}
function nearestEnemy(b) {
  let best = null, bd = 1e9;
  for (const c of everyone()) if (c.alive && isEnemy(b, c)) { const d = c.pos.distanceToSquared(b.pos); if (d < bd) { bd = d; best = c; } }
  return best;
}
function acquire(b) {
  if (b.blindT > 0) { b.target = null; return; }
  const range = b.wd.rf > 200 ? 95 : 70;
  eye(b, tB);
  let best = null, bd = range;
  for (const c of everyone()) {
    if (!c.alive || !isEnemy(b, c)) continue;
    const d = c.pos.distanceTo(b.pos);
    if (d >= bd) continue;
    if (losClear(tB, eye(c, tC))) { best = c; bd = d; }
  }
  if (best && best !== b.target) b.react = rand(0.3, 0.55) * diff.react;
  b.target = best;
  if (best) {
    b.lastSeen.copy(best.pos); b.lastSeenT = G.time;
    if (!mode.ffa && b.team === P.team && !best.isPlayer) best.spottedT = 1.5;
  }
}
function updateDemo(b, dt) {
  const s = b.s; b.walk += dt;
  s.spine.scale.y = 1 + Math.sin(b.walk * 2) * 0.008;
  s.spine.rotation.y = Math.sin(b.walk * 0.5) * 0.06;
  s.head.rotation.y = Math.sin(b.walk * 0.37 + 1) * 0.3;
  s.root.rotation.y = b.yaw + Math.sin(b.walk * 0.3) * 0.04;
}
function updateBot(b, dt) {
  const s = b.s;
  if (b.flashT > 0) { b.flashT -= dt; if (b.flashT <= 0) for (const k of ['cloth', 'vest', 'skin', 'helmet']) s.M[k].emissive.setHex(0); }
  if (b.spottedT > 0) b.spottedT -= dt;
  if (!b.alive) {
    b.deathT += dt;
    const k = Math.min(b.deathT / 0.55, 1), e = 1 - Math.pow(1 - k, 3);
    s.root.rotation.x = -1.48 * e; s.body.position.y = 0.12 * e;
    s.legs[0].knee.rotation.x = 0.5 * e; s.arms[1].sh.rotation.x = -1.05 - 1.2 * e; s.arms[0].sh.rotation.z = 0.12 + 0.9 * e;
    if (mode.wave) {
      if (b.deathT > 3.2) s.root.position.y = -(b.deathT - 3.2) * 0.9;
      if (b.deathT > 4.4) removeBot(b);
    } else {
      if (b.deathT > 2.6) s.root.position.y = -Math.min(b.deathT - 2.6, 1) * 0.9;
      b.respawnT -= dt; if (b.respawnT <= 0 && !G.ended) respawnBot(b);
    }
    return;
  }
  if (b.protectT > 0) b.protectT -= dt;
  if (b.blindT > 0) b.blindT -= dt;
  if (b.spawnT > 0) b.spawnT -= dt;
  if (b.react > 0) b.react -= dt;
  b.losT -= dt;
  if (b.losT <= 0) { b.losT = 0.22 + Math.random() * 0.1; acquire(b); }
  const tgt = b.target && b.target.alive ? b.target : null;
  if (!tgt) b.target = null;
  let gx = 0, gz = 0;
  if (tgt) { gx = tgt.pos.x; gz = tgt.pos.z; }
  else if (G.time - b.lastSeenT < 4) { gx = b.lastSeen.x; gz = b.lastSeen.z; }
  else { const n = nearestEnemy(b); if (n) { gx = n.pos.x; gz = n.pos.z; } }
  tA.set(gx - b.pos.x, 0, gz - b.pos.z);
  const dist = tA.length() || 0.001; tA.divideScalar(dist);
  let mx = 0, mz = 0, sp = (b.kind === 'boss' ? 2.3 : 3.2) + (mode.wave ? Math.min(G.wave, 10) * 0.08 : 0.3);
  b.strafeT -= dt; if (b.strafeT <= 0) { b.strafeT = rand(1, 2.6); b.strafe *= -1; }
  const keep = b.wd.rf > 200 ? 26 : b.wd.rf < 30 ? 5 : 14;
  if (b.blindT > 0) { mx = Math.sin(G.time * 1.3 + b.flank * 5); mz = Math.cos(G.time * 1.1 + b.flank * 3); sp *= 0.45; }
  else if (!tgt || dist > keep) { const c = Math.cos(b.flank), sn = Math.sin(b.flank); mx = tA.x * c - tA.z * sn; mz = tA.x * sn + tA.z * c; }
  else { mx = -tA.z * b.strafe; mz = tA.x * b.strafe; sp *= 0.55; if (dist < keep * 0.4) { mx -= tA.x; mz -= tA.z; } }
  if (b.burst > 0) sp *= 0.5;
  for (const o of bots) {
    if (o === b || !o.alive) continue;
    const dx = b.pos.x - o.pos.x, dz = b.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < 1.3 && d2 > 1e-4) { const d = Math.sqrt(d2); mx += (dx / d) * 0.8; mz += (dz / d) * 0.8; }
  }
  const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
  b.vel.x += (mx * sp - b.vel.x) * Math.min(1, 8 * dt); b.vel.z += (mz * sp - b.vel.z) * Math.min(1, 8 * dt); b.vel.y = 0;
  if (b.stagger > 0) { b.stagger -= dt; b.vel.multiplyScalar(0.6); }
  moveBody(b.pos, b.vel, dt, 0.35 * b.scale, 1.8 * b.scale); b.pos.y = 0;
  b.stuckT += dt;
  if (b.stuckT > 0.9) { if (b.pos.distanceTo(b.lastPos) < 0.6) { b.flank = rand(-1.5, 1.5); b.strafe *= -1; } b.lastPos.copy(b.pos); b.stuckT = 0; }
  const want = tgt ? Math.atan2(tgt.pos.x - b.pos.x, tgt.pos.z - b.pos.z) : Math.atan2(b.vel.x, b.vel.z);
  let dy = want - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); b.yaw += dy * Math.min(1, 10 * dt);
  s.root.rotation.y = b.yaw;
  const spd = Math.hypot(b.vel.x, b.vel.z), amp = Math.min(spd / 3.2, 1);
  const fwd = b.vel.x * Math.sin(b.yaw) + b.vel.z * Math.cos(b.yaw);
  b.walk += dt * spd * 2.6 * (fwd < -0.3 ? -1 : 1);
  const w = b.walk;
  s.legs[0].thigh.rotation.x = Math.sin(w) * 0.65 * amp; s.legs[1].thigh.rotation.x = -Math.sin(w) * 0.65 * amp;
  s.legs[0].knee.rotation.x = (0.15 + Math.max(0, -Math.cos(w)) * 0.9) * amp; s.legs[1].knee.rotation.x = (0.15 + Math.max(0, Math.cos(w)) * 0.9) * amp;
  s.body.position.y = -Math.abs(Math.sin(w)) * 0.04 * amp;
  s.spine.rotation.x = 0.08 * amp + (b.stagger > 0 ? -0.25 : 0); s.spine.rotation.y = Math.sin(w) * 0.08 * amp;
  if (b.blindT > 0) { s.arms[1].sh.rotation.x = -2.2; s.head.rotation.x = 0.4; }
  else {
    s.arms[1].sh.rotation.x = -1.05;
    const pitch = tgt ? Math.atan2(eye(tgt, tC).y - (b.pos.y + b.eyeH), Math.max(dist, 0.1)) : 0;
    s.head.rotation.x = -pitch * 0.6; s.gun.rotation.x = -pitch * 0.4;
  }
  if (tgt && b.react <= 0 && b.blindT <= 0 && b.spawnT <= 0 && G.state === 'playing' && !G.ended && dist < 80) {
    if (b.burst > 0) { b.burstT -= dt; if (b.burstT <= 0) { b.burst--; b.burstT = Math.max(b.wd.rate, 0.09); botShoot(b, tgt, dist); } }
    else {
      b.fireT -= dt;
      if (b.fireT <= 0) {
        b.burst = b.wd.auto && b.wd.pellets === 1 ? 2 + ((Math.random() * 4) | 0) + (b.kind === 'boss' ? 6 : 0) : 1;
        b.burstT = 0;
        b.fireT = (b.wd.auto && b.wd.pellets === 1 ? rand(0.6, 1.3) : Math.max(b.wd.rate, 0.5) + rand(0.2, 0.8)) * diff.react;
        if (mode.wave) b.fireT -= Math.min(G.wave * 0.04, 0.4);
      }
    }
  }
  b.nadeCd -= dt;
  if (b.nadeCd <= 0 && G.state === 'playing' && !G.ended && (!mode.wave || G.wave >= 3)) botNade(b, dist, gx, gz, tgt);
}
function distVol(p) { return clamp(1 - p.distanceTo(camera.position) / 75, 0.03, 1) * 0.55; }
function botShoot(b, t, dist) {
  b.s.muzzle.getWorldPosition(tB);
  const wd = b.wd;
  let chance = 0.42 + diff.acc + (b.kind === 'elite' ? 0.1 : 0) - dist / wd.rf;
  const tv = Math.hypot(t.vel.x, t.vel.z);
  if (tv > 3) chance -= 0.12;
  if (t.isPlayer && !P.onGround) chance -= 0.1;
  if (t.isPlayer && P.crouch > 0.5) chance -= 0.05;
  if (mode.wave) chance += G.wave * 0.015;
  chance = clamp(chance, 0.05, 0.72);
  const hit = Math.random() < chance;
  center(t, tC); tC.y += 0.25;
  const end = tC.clone();
  if (!hit) end.add(new V3(rand(-1.3, 1.3), rand(-0.6, 0.9), rand(-1.3, 1.3)));
  FX.tracer(tB.clone(), end, TRACER[mode.ffa ? 'F' : b.team] || TRACER.F);
  FX.muzzleFlash(tB);
  audio.shot(wd.snd, distVol(tB));
  b.spottedT = Math.max(b.spottedT, 1.6);
  if (!hit) return;
  let dmg = wd.dmg * 0.55;
  if (wd.pellets > 1) dmg = wd.dmg * wd.pellets * clamp(1.15 - dist / wd.range, 0.12, 1) * 0.6;
  const head = Math.random() < (wd.rf > 200 ? 0.06 : 0.1);
  if (head) dmg *= Math.min(wd.head, 2);
  if (t.isPlayer) dmg *= diff.dmg * (mode.wave ? 1 + G.wave * 0.04 : 1) * (b.kind === 'boss' ? 0.75 : 1);
  damage(t, dmg, b, { head, wid: b.wid });
}
function throwArc(from, tx, tz, theta = 0.7) {
  const dx = tx - from.x, dz = tz - from.z, d = Math.max(Math.hypot(dx, dz), 2);
  const v = Math.min(Math.sqrt((d * NADE_G) / Math.sin(2 * theta)), 20);
  return new V3((dx / d) * v * Math.cos(theta), v * Math.sin(theta), (dz / d) * v * Math.cos(theta));
}
function botNade(b, dist, gx, gz, tgt) {
  b.nadeCd = rand(6, 14);
  const from = tA.set(b.pos.x, b.pos.y + 1.6 * b.scale, b.pos.z).clone();
  const lost = !tgt && G.time - b.lastSeenT < 3;
  if (b.nades.frag > 0 && lost && dist > 7 && dist < 28 && Math.random() < 0.55) {
    b.nades.frag--; launchNade('frag', from, throwArc(from, b.lastSeen.x + rand(-1, 1), b.lastSeen.z + rand(-1, 1)), b);
  } else if (tgt && b.nades.flash > 0 && dist > 9 && dist < 24 && Math.random() < 0.3) {
    b.nades.flash--; launchNade('flash', from, throwArc(from, gx - (gx - b.pos.x) * 0.15, gz - (gz - b.pos.z) * 0.15, 0.55), b);
  } else if (tgt && b.nades.smoke > 0 && b.hp < b.maxHp * 0.55 && Math.random() < 0.5) {
    b.nades.smoke--; launchNade('smoke', from, throwArc(from, b.pos.x + (gx - b.pos.x) * 0.35, b.pos.z + (gz - b.pos.z) * 0.35, 0.6), b);
  }
}

/* ================= grenades ================= */
const NADE_G = 20;
function launchNade(type, pos, vel, owner) {
  const m = buildNade(type); m.position.copy(pos); scene.add(m);
  nades.push({ type, pos: m.position, vel, owner, team: owner.team, fuse: NADES[type].fuse, m, spin: new V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)) });
  if (owner.isPlayer) audio.pin();
}
function nadeCollide(n) {
  const p = n.pos, v = n.vel, r = 0.07;
  let bounced = false;
  if (p.y < r) { p.y = r; if (v.y < 0) { v.y = -v.y * 0.32; v.x *= 0.62; v.z *= 0.62; bounced = Math.abs(v.y) > 0.6; } }
  for (const b of boxes) {
    if (p.x > b.minX - r && p.x < b.maxX + r && p.z > b.minZ - r && p.z < b.maxZ + r && p.y > b.bottom - r && p.y < b.top + r) {
      const pen = [p.x - (b.minX - r), b.maxX + r - p.x, p.z - (b.minZ - r), b.maxZ + r - p.z, p.y - (b.bottom - r), b.top + r - p.y];
      let mi = 0; for (let i = 1; i < 6; i++) if (pen[i] < pen[mi]) mi = i;
      if (mi === 0) { p.x = b.minX - r; v.x = -Math.abs(v.x) * 0.4; }
      else if (mi === 1) { p.x = b.maxX + r; v.x = Math.abs(v.x) * 0.4; }
      else if (mi === 2) { p.z = b.minZ - r; v.z = -Math.abs(v.z) * 0.4; }
      else if (mi === 3) { p.z = b.maxZ + r; v.z = Math.abs(v.z) * 0.4; }
      else if (mi === 4) { p.y = b.bottom - r; v.y = -Math.abs(v.y) * 0.3; }
      else { p.y = b.top + r; v.y = Math.abs(v.y) * 0.32; v.x *= 0.62; v.z *= 0.62; }
      bounced = v.length() > 1.2;
    }
  }
  if (bounced) audio.clink(distVol(p) * 2);
}
function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) {
    const n = nades[i];
    n.vel.y -= NADE_G * dt;
    const steps = 3;
    for (let k = 0; k < steps; k++) { n.pos.addScaledVector(n.vel, dt / steps); nadeCollide(n); }
    const sp = n.vel.length();
    n.m.rotation.x += n.spin.x * dt * Math.min(sp / 5, 1); n.m.rotation.z += n.spin.z * dt * Math.min(sp / 5, 1);
    n.fuse -= dt;
    if (n.fuse <= 0) { scene.remove(n.m); nades.splice(i, 1); detonate(n); }
  }
}
function detonate(n) {
  const p = n.pos.clone();
  if (n.type === 'frag') {
    FX.explosion(p); audio.boom(clamp(1.2 - p.distanceTo(camera.position) / 60, 0.1, 1.2));
    const dCam = p.distanceTo(camera.position);
    G.shake = Math.max(G.shake, clamp(1 - dCam / 22, 0, 1) * 0.9);
    const from = p.clone(); from.y += 0.3;
    for (const c of everyone()) {
      if (!c.alive) continue;
      center(c, tC);
      const d = tC.distanceTo(p);
      if (d > 7.5) continue;
      if (!mode.ffa && c.team === n.team && c !== n.owner) continue;
      if (!losClear(from, tC, true)) continue;
      let dmg = 140 * Math.pow(1 - d / 7.5, 1.2) + 8;
      if (c === n.owner) dmg *= 0.6;
      tD.subVectors(tC, p).setY(0).normalize().multiplyScalar(8 * (1 - d / 7.5));
      c.vel.add(tD); if (c.isPlayer) c.vel.y += 3 * (1 - d / 7.5);
      damage(c, dmg, n.owner, { nade: 'frag', wid: 'frag' });
    }
  } else if (n.type === 'flash') {
    FX.flashPop(p); audio.bang(clamp(1.2 - p.distanceTo(camera.position) / 50, 0.15, 1.2));
    for (const c of everyone()) {
      if (!c.alive || c.protectT > 0) continue;
      if (!mode.ffa && c.team === n.team && c !== n.owner) continue;
      eye(c, tC);
      const d = tC.distanceTo(p);
      if (d > 20 || !losClear(p, tC)) continue;
      tD.subVectors(p, tC).normalize();
      let facing;
      if (c.isPlayer) { camera.getWorldDirection(camDir); facing = camDir.dot(tD); }
      else facing = Math.sin(c.yaw) * tD.x + Math.cos(c.yaw) * tD.z;
      const k = (1 - d / 20) * (0.3 + 0.7 * Math.max(0, facing));
      const dur = 0.4 + 4 * k;
      if (c.isPlayer) { if (dur > P.blindT) { P.blindT = dur; P.blindMax = dur; } audio.ring(k); }
      else { c.blindT = Math.max(c.blindT, dur * 0.9); c.target = null; }
    }
  } else {
    audio.hiss();
    p.y = Math.max(p.y, 0.05);
    smokes.push({ pos: p, r: 0, t: 15, max: 15, vis: FX.smokeCloud(p) });
  }
}
function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    const s = smokes[i]; s.t -= dt;
    const age = s.max - s.t;
    s.r = Math.min(5, 0.6 + age * 2.6);
    const a = Math.min(1, age * 1.5) * Math.min(1, s.t / 3) * 0.92;
    s.vis.set(s.r, a, G.time);
    if (s.t <= 0) { s.vis.dispose(); smokes.splice(i, 1); }
  }
}
function playerThrow(type) {
  if (!P.alive || G.state !== 'playing' || P.nadeCd > 0 || P.nades[type] <= 0) { if (P.nades[type] <= 0) audio.click(); return; }
  P.nades[type]--; P.nadeCd = 0.7; P.throwT = 0.35;
  camera.getWorldDirection(camDir);
  const from = camera.position.clone().addScaledVector(camDir, 0.5); from.y -= 0.1;
  const vel = camDir.clone().multiplyScalar(17).add(new V3(0, 3.2, 0)).addScaledVector(P.vel, 0.5);
  launchNade(type, from, vel, P);
  P.nadeType = type;
}

/* ================= damage & kills ================= */
let dirIndT = 0;
function damage(t, dmg, att, o) {
  if (!t.alive || G.ended || t.protectT > 0) return;
  if (t.isPlayer) {
    if (G.state !== 'playing') return;
    P.hp -= dmg; P.lastHurt = G.time; audio.hurt();
    const f = $('hurt'); f.style.opacity = 1; setTimeout(() => { f.style.opacity = 0; }, 70);
    if (att && att !== P) { const a = Math.atan2(att.pos.x - P.pos.x, att.pos.z - P.pos.z); $('dirInd').style.transform = 'rotate(' + -(a - (P.yaw + Math.PI)) + 'rad)'; dirIndT = 1; }
    P.kick += 0.008;
    if (P.hp <= 0) { P.hp = 0; kill(P, att, o); }
  } else {
    t.hp -= dmg; flashBot(t); if (t.kind !== 'boss') t.stagger = 0.12;
    if (att && att !== t && att.alive) { t.lastSeen.copy(att.pos); t.lastSeenT = G.time; t.losT = Math.min(t.losT, 0.05); }
    if (t.hp <= 0) kill(t, att, o);
  }
}
const STREAK = ['', '', '더블 킬', '트리플 킬', '쿼드라 킬', '멀티 킬', '몬스터 킬'];
function kill(v, k, o) {
  v.alive = false; v.hp = 0; v.deaths++;
  const valid = k && k !== v;
  if (valid) { k.kills++; if (o.head) k.heads++; }
  if (!mode.wave && !mode.ffa && valid && k.team !== v.team) G.teamScore[k.team]++;
  feed(k, v, o);
  if (k === P && v !== P) onPlayerKill(v, o);
  if (v.isPlayer) onPlayerDeath(k);
  else {
    v.deathT = 0; v.respawnT = 4; v.target = null;
    if (v.tag) v.tag.visible = false;
    if (o.head) popHelmet(v);
    createDrop(v.wid, v.pos, { mag: magSize(WEAPONS[v.wid]), res: Math.round(WEAPONS[v.wid].reserve * 0.4) });
    if (Math.random() < 0.22) spawnPickup('hp', v.pos.x, v.pos.z);
    if (mode.wave && v === G.boss) { G.boss = null; announce('보스 격파!', '+2000'); G.score += 2000; for (let i = 0; i < 6; i++) spawnPickup('coin', v.pos.x, v.pos.z); spawnPickup('ammo', v.pos.x, v.pos.z); }
    rebuildBotMeshes();
  }
  checkMatchEnd();
}
function popHelmet(b) {
  const hm = b.s.helmet; hm.getWorldPosition(tA); hm.parent.remove(hm);
  hm.position.copy(tA); scene.add(hm); b.helmetLoose = true;
  FX.flyingHelmet(hm, new V3(rand(-1.5, 1.5), 4.5, rand(-1.5, 1.5)));
}
function onPlayerKill(v, o) {
  G.comboT = 4; G.combo = Math.min(G.combo + 1, 6);
  if (G.streakT > 0) G.streakN++; else G.streakN = 1;
  G.streakT = 3;
  G.score += ((v.kind === 'boss' ? 0 : v.kind === 'elite' ? 250 : 100) + (o.head ? 60 : 0)) * Math.max(1, G.combo - 1);
  G.od = Math.min(1, G.od + (v.kind === 'elite' ? 0.3 : 0.18));
  if (mode.wave && G.perk.leech) P.hp = Math.min(P.maxHp, P.hp + G.perk.leech);
  audio.kill();
  if (G.streakN >= 2) { announce(STREAK[Math.min(G.streakN, 6)], '+' + G.streakN * 50 + ' 보너스'); G.score += G.streakN * 50; }
  else if (o.nade) announce('수류탄 킬!');
  else if (o.wid === 'knife') announce('나이프 킬!');
  else if (o.head) announce('헤드샷!');
  if (mode.wave) {
    spawnPickup('coin', v.pos.x, v.pos.z);
    if (Math.random() < 0.3) spawnPickup('coin', v.pos.x, v.pos.z);
    if (Math.random() < (P.hp < 50 ? 0.4 : 0.15)) spawnPickup('hp', v.pos.x, v.pos.z);
    if (Math.random() < 0.25) spawnPickup('ammo', v.pos.x, v.pos.z);
  }
}
function onPlayerDeath(k) {
  P.firing = false; P.ads = false; P.killer = k && k !== P ? k : null;
  P.deathPos = P.pos.clone();
  showVM(); vmFlash.visible = false;
  if (mode.wave) { gameOver(); return; }
  P.respawnT = 4;
  $('deathBox').hidden = false;
}
function respawnPlayer() {
  const sp = mode.ffa ? farSpawn(bots.filter((b) => b.alive).map((b) => b.pos)) : teamSpawn(P.team);
  P.pos.set(sp.x, 0, sp.z); P.vel.set(0, 0, 0);
  P.yaw = Math.atan2(sp.x, sp.z); P.pitch = 0;
  P.hp = P.maxHp; P.alive = true; P.protectT = 2; P.blindT = 0;
  P.ammo = {}; P.reloadT = 0; P.switchT = 0.3; P.slot = 0;
  P.nades = { frag: 2, flash: 2, smoke: 1 };
  $('deathBox').hidden = true;
  showVM();
}

/* ================= drops & pickups ================= */
function createDrop(wid, pos, ammo) {
  const gun = buildGun(WEAPONS[wid].vis).g;
  gun.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  const g = new THREE.Group(); g.add(gun);
  gun.rotation.set(0, rand(0, 6.28), Math.PI / 2); gun.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28), new THREE.MeshBasicMaterial({ color: 0xffb43b, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  g.position.set(pos.x, Math.max(0, pos.y), pos.z); scene.add(g);
  drops.push({ g, ring, wid, ammo, ttl: 25 });
  if (drops.length > 14) removeDrop(drops[0]);
}
function removeDrop(d) { scene.remove(d.g); d.ring.material.dispose(); d.ring.geometry.dispose(); drops.splice(drops.indexOf(d), 1); }
let nearDrop = null;
function updateDrops(dt) {
  nearDrop = null; let nd = 1.8;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.ttl -= dt;
    d.ring.material.opacity = 0.35 + Math.sin(G.time * 4 + i) * 0.2;
    if (d.ttl <= 0) { removeDrop(d); continue; }
    if (!P.alive) continue;
    const dist = Math.hypot(d.g.position.x - P.pos.x, d.g.position.z - P.pos.z);
    if (dist < nd && Math.abs(d.g.position.y - P.pos.y) < 1.5 && d.wid !== P.loadout[0]) { nd = dist; nearDrop = d; }
  }
  const pr = $('prompt');
  if (nearDrop) { pr.hidden = false; pr.innerHTML = (isTouch ? '' : '<kbd>E</kbd> ') + '줍기 · ' + escapeHtml(WEAPONS[nearDrop.wid].name); }
  else pr.hidden = true;
}
function pickupDrop() {
  if (!nearDrop || !P.alive) return;
  const d = nearDrop, old = P.loadout[0];
  createDrop(old, P.pos, P.ammo[old] || { mag: magSize(WEAPONS[old]), res: WEAPONS[old].reserve });
  P.loadout[0] = d.wid; P.ammo[d.wid] = { ...d.ammo };
  removeDrop(d); equipSlot(0, true);
  toast(WEAPONS[d.wid].name + ' 획득');
}
const coinGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 20);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.9, roughness: 0.25, emissive: 0x6a3f00, emissiveIntensity: 0.6 });
const hpMat = new THREE.MeshStandardMaterial({ color: 0x56d68f, emissive: 0x1a6b3c, emissiveIntensity: 0.8, roughness: 0.4 });
const ammoMat = new THREE.MeshStandardMaterial({ color: 0x5b5f3a, roughness: 0.6 });
const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffb43b, emissive: 0x5a3a00, roughness: 0.5 });
function spawnPickup(type, x, z) {
  const o = new THREE.Group();
  if (type === 'coin') { const c = new THREE.Mesh(coinGeo, coinMat); c.rotation.x = Math.PI / 2; o.add(c); }
  else if (type === 'hp') { o.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.14), hpMat), new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), hpMat)); }
  else { o.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.26), ammoMat), new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.05, 0.27), stripeMat)); }
  o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  o.position.set(x + rand(-0.5, 0.5), 0.6, z + rand(-0.5, 0.5)); scene.add(o);
  pickups.push({ o, type, t: Math.random() * 6, ttl: 20 });
}
function updatePickups(dt) {
  const range = 1.5 * (mode.wave ? G.perk.magnet : 1);
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i]; p.t += dt; p.ttl -= dt;
    p.o.rotation.y += dt * 2.4; p.o.position.y = 0.6 + Math.sin(p.t * 3) * 0.1;
    const dx = P.pos.x - p.o.position.x, dz = P.pos.z - p.o.position.z, d = Math.hypot(dx, dz);
    if (P.alive && d < range * 2.2 && d > 0.01 && P.pos.y < 3) {
      const s = Math.min(d, dt * 9 * (mode.wave ? G.perk.magnet : 1));
      p.o.position.x += (dx / d) * s; p.o.position.z += (dz / d) * s;
    }
    if (P.alive && d < range * 0.6 && P.pos.y < 2.5) {
      if (p.type === 'coin') { G.coins++; G.score += 25 * G.combo; G.od = Math.min(1, G.od + 0.06); audio.coin(); FX.burst(p.o.position, FX.MAT.gold, 6, 2, 0.25, 0.4); }
      else if (p.type === 'hp') { P.hp = Math.min(P.maxHp, P.hp + 35); audio.heal(); }
      else { for (const id of P.loadout) ammoOf(id).res += Math.round(WEAPONS[id].reserve * 0.3); P.nades.frag = Math.min(P.nades.frag + 1, 3); audio.reload(); }
      scene.remove(p.o); pickups.splice(i, 1); continue;
    }
    if (p.ttl <= 0) { scene.remove(p.o); pickups.splice(i, 1); }
    else if (p.ttl < 4) p.o.visible = Math.floor(p.ttl * 8) % 2 === 0;
  }
}

/* ================= player weapons ================= */
function equipSlot(slot, force) {
  if (!P.alive || (slot === P.slot && !force)) return;
  P.reloadT = 0; P.slot = slot; P.switchT = 0.35; P.ads = false;
  ammoOf(curId()); showVM(); audio.click();
}
function equipWeapon(slot, id) {
  P.loadout[slot] = id;
  store.setJson('msf_loadout', P.loadout);
  ammoOf(id);
  if (P.alive && G.state === 'playing') equipSlot(slot, true);
  renderArsenal();
}
function reload() {
  const w = curW(); if (w.melee) return;
  const a = ammoOf(w.id);
  if (P.reloadT > 0 || a.mag >= magSize(w) || a.res <= 0 || G.odT > 0) return;
  P.reloadT = P.reloadMax = w.reload / (mode.wave ? G.perk.reload : 1); audio.reload();
}
function finishReload() {
  const w = curW(), a = ammoOf(w.id);
  const n = Math.min(magSize(w) - a.mag, a.res); a.mag += n; a.res -= n;
}
function aimedTargets() { return [ground, ...solids, ...botMeshes]; }
function tryFire() {
  const w = curW();
  if (P.fireCd > 0 || P.reloadT > 0 || P.switchT > 0 || P.throwT > 0) return false;
  if (w.melee) { melee(); return true; }
  const a = ammoOf(w.id);
  if (a.mag <= 0) { audio.click(); P.fireCd = 0.25; reload(); return true; }
  P.fireCd = w.rate / (G.odT > 0 ? 1.6 : 1);
  if (G.odT <= 0) a.mag--;
  G.shots++;
  camera.updateMatrixWorld();
  camera.getWorldPosition(origin); camera.getWorldDirection(camDir);
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const spread = currentSpread(w);
  P.bloom = Math.min(P.bloom + (w.bloom || 0), 0.04);
  const mw = new V3(0.14 * (1 - P.adsK), -0.1, -0.7).applyMatrix4(camera.matrixWorld);
  const targets = aimedTargets();
  const dmgMap = new Map();
  for (let i = 0; i < w.pellets; i++) {
    const ang = Math.random() * 6.283, r = Math.sqrt(Math.random()) * spread;
    const d = camDir.clone().addScaledVector(camRight, Math.cos(ang) * r).addScaledVector(camUp, Math.sin(ang) * r).normalize();
    raycaster.set(origin, d); raycaster.far = w.range;
    const h = raycaster.intersectObjects(targets, false)[0];
    const end = h ? h.point : origin.clone().addScaledVector(d, w.range);
    if (i < 3) FX.tracer(mw, end);
    if (!h) continue;
    const bot = h.object.userData.bot;
    if (bot && bot.alive) {
      if (!isEnemy(P, bot)) continue;
      const head = !!h.object.userData.head;
      let dmg = w.dmg * (mode.wave ? G.perk.dmg : 1) * (G.odT > 0 ? 1.25 : 1) * (head ? w.head * (mode.wave ? G.perk.head : 1) : 1);
      if (w.pellets > 1) dmg *= clamp(1.25 - h.distance / w.range, 0.3, 1);
      else if (h.distance > w.rf * 1.2) dmg *= 0.75;
      const e = dmgMap.get(bot) || { dmg: 0, head: false, p: h.point }; e.dmg += dmg; e.head = e.head || head; dmgMap.set(bot, e);
      FX.burst(h.point, FX.MAT.puff, 3, 1.2, 0.12, 0.3, 2);
    } else {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new V3(0, 1, 0);
      FX.decal(h.point, n);
      if (i < 4) { FX.burst(h.point, FX.MAT.spark, 3, 3, 0.08, 0.18, 8); FX.burst(h.point, FX.MAT.dust, 2, 0.8, 0.3, 0.5, -0.5); }
    }
  }
  let anyHead = false;
  dmgMap.forEach((e, bot) => { G.hits++; dmgNum(e.p, e.dmg, e.head); anyHead = anyHead || e.head; damage(bot, e.dmg, P, { head: e.head, wid: w.id }); });
  if (dmgMap.size) { hitMarker(anyHead); anyHead ? audio.head() : audio.hit(); }
  audio.shot(w.snd, 0.9);
  P.kick += w.kick * (1 - P.adsK * 0.4) * (1 - P.crouch * 0.25); P.pitch += w.kick * 0.25;
  vmRecoil = 1;
  if (!(w.scope && P.adsK > 0.8)) { vmFlash.visible = true; vmFlashT = 0.045; vmFlash.material.rotation = Math.random() * 6; }
  FX.lightFlash(origin.clone().addScaledVector(camDir, 1), 0xffc06a, 2.2, 9, 0.06);
  if (a.mag === 0 && a.res > 0) setTimeout(reload, 180);
  return true;
}
function melee() {
  const w = curW();
  P.fireCd = w.rate; P.meleeT = 0.3; audio.whoosh();
  setTimeout(() => {
    if (!P.alive) return;
    camera.getWorldDirection(camDir);
    let best = null, bd = w.range;
    for (const b of bots) {
      if (!b.alive || !isEnemy(P, b)) continue;
      center(b, tA); tB.subVectors(tA, camera.position); const d = tB.length();
      if (d < bd && tB.normalize().dot(camDir) > 0.72) { best = b; bd = d; }
    }
    if (!best) return;
    const back = Math.sin(best.yaw) * camDir.x + Math.cos(best.yaw) * camDir.z > 0.5;
    const dmg = back ? w.back : w.dmg;
    audio.stab(); hitMarker(back); dmgNum(center(best, tA), dmg, back);
    FX.burst(tA, FX.MAT.puff, 5, 1.4, 0.14, 0.35, 2);
    damage(best, dmg, P, { wid: 'knife', head: back });
  }, 110);
}
function currentSpread(w) {
  const moving = Math.hypot(P.vel.x, P.vel.z) > 1;
  let s = w.spread + (moving ? w.moveSpread : 0) + (P.onGround ? 0 : 0.03) + (w.hipPenalty || 0) * (1 - P.adsK);
  s *= (1 - P.adsK * 0.7) * (1 - P.crouch * 0.3);
  return s + P.bloom;
}
function activateOD() {
  if (G.od < 1 || G.odT > 0 || !P.alive) return;
  G.od = 0; G.odT = 7; audio.od(); announce('오버드라이브', '연사 +60% · 탄약 무한'); P.reloadT = 0;
}

/* ================= waves & perks ================= */
const PERKS = [
  { id: 'dmg', t: '강화 탄두', d: '모든 총기 피해량 +15%', f: () => (G.perk.dmg *= 1.15) },
  { id: 'reload', t: '퀵 핸즈', d: '재장전 속도 +30%', f: () => (G.perk.reload *= 1.3) },
  { id: 'plate', t: '방탄 플레이트', d: '최대 체력 +25, 체력 전부 회복', f: () => { P.maxHp += 25; P.hp = P.maxHp; } },
  { id: 'speed', t: '스프린터', d: '이동 속도 +12%', f: () => (G.perk.speed *= 1.12) },
  { id: 'head', t: '데드아이', d: '헤드샷 피해량 +35%', f: () => (G.perk.head *= 1.35) },
  { id: 'mag', t: '확장 탄창', d: '탄창 용량 +30%, 예비 탄약 보충', f: () => { G.perk.mag *= 1.3; for (const id of P.loadout) ammoOf(id).res += WEAPONS[id].reserve; } },
  { id: 'leech', t: '흡혈 탄', d: '적 처치 시 체력 +8', f: () => (G.perk.leech += 8) },
  { id: 'magnet', t: '자석 장갑', d: '아이템 흡수 범위 2배', f: () => (G.perk.magnet *= 2) },
  { id: 'od', t: '과충전 코어', d: '오버드라이브 게이지 즉시 100%', f: () => (G.od = 1) },
  { id: 'nades', t: '폭발물 조끼', d: '세열 +2 · 섬광 +1 · 연막 +1', f: () => { P.nades.frag += 2; P.nades.flash++; P.nades.smoke++; } },
];
function startWave(n) {
  G.wave = n; G.toSpawn = 4 + n * 2; G.spawnT = 1.2; G.bossPending = n % 5 === 0;
  if (G.bossPending) G.toSpawn = Math.round(G.toSpawn * 0.6);
  announce('웨이브 ' + n, G.bossPending ? '보스 웨이브: 저거너트 출현' : '적 ' + G.toSpawn + '명 접근');
  audio.wave();
  P.nades.frag = Math.max(P.nades.frag, 2); P.nades.flash = Math.max(P.nades.flash, 1); P.nades.smoke = Math.max(P.nades.smoke, 1);
}
const aliveFoes = () => bots.reduce((c, b) => c + (b.alive ? 1 : 0), 0);
function spawnTick(dt) {
  if (G.bossPending) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      G.bossPending = false;
      const far = WAVE_SPAWNS.filter((s) => Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z) > 24);
      const s = pick(far.length ? far : WAVE_SPAWNS);
      G.boss = makeBot({ team: 'B', kind: 'boss', name: '저거너트', x: s[0], z: s[1] });
      announce('저거너트', '보스가 전장에 들어왔습니다');
      G.spawnT = 2;
    }
    return;
  }
  if (G.toSpawn > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0 && aliveFoes() < Math.min(4 + G.wave, 10)) {
      const opts = WAVE_SPAWNS.filter((s) => Math.hypot(s[0] - P.pos.x, s[1] - P.pos.z) > 24);
      const s = pick(opts.length ? opts : WAVE_SPAWNS);
      const elite = G.wave >= 3 && Math.random() < Math.min(0.12 + G.wave * 0.03, 0.35);
      makeBot({ team: 'B', kind: elite ? 'elite' : 'normal', name: pick(NAMES_B), x: s[0] + rand(-2, 2), z: s[1] + rand(-2, 2) });
      G.toSpawn--; G.spawnT = rand(0.6, 1.4);
    }
  } else if (aliveFoes() === 0 && G.waveDelay <= 0 && !G.boss) {
    G.waveDelay = 1.6; announce('웨이브 클리어', '+' + G.wave * 200 + ' 점'); G.score += G.wave * 200; audio.wave();
  }
  if (G.waveDelay > 0) { G.waveDelay -= dt; if (G.waveDelay <= 0) showPerks(); }
}
function showPerks() {
  G.state = 'perk'; document.body.classList.remove('playing'); P.firing = false;
  exitLock();
  const pool = PERKS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  $('perkKicker').textContent = 'WAVE ' + G.wave + ' CLEAR · 다음 웨이브 ' + (G.wave + 1);
  const c = $('cards'); c.innerHTML = '';
  pool.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'card'; b.id = 'perk_' + p.id;
    b.innerHTML = '<span class="tag">CARD ' + (i + 1) + '</span><h3>' + p.t + '</h3><p>' + p.d + '</p>';
    b.addEventListener('click', () => { p.f(); $('perk').hidden = true; resumePlay(); for (const b of [...bots]) if (!b.alive) removeBot(b); startWave(G.wave + 1); });
    c.appendChild(b);
  });
  $('perk').hidden = false;
}

/* ================= game flow ================= */
function clearWorld() {
  for (const b of [...bots]) removeBot(b);
  for (const b of [...menuBots]) removeBot(b);
  for (const p of pickups) scene.remove(p.o); pickups.length = 0;
  for (const d of [...drops]) removeDrop(d);
  for (const n of nades) scene.remove(n.m); nades.length = 0;
  for (const s of smokes) s.vis.dispose(); smokes.length = 0;
  FX.clear(); rebuildBotMeshes();
}
function newGame() {
  audio.init();
  clearWorld();
  settings.nick = ($('nick').value || '').trim().slice(0, 10); saveSettings();
  P.name = settings.nick || '나';
  Object.assign(P, { hp: 100, maxHp: 100, alive: true, kills: 0, deaths: 0, heads: 0, kick: 0, slot: 0, ammo: {}, fireCd: 0, reloadT: 0, switchT: 0,
    bloom: 0, lastHurt: -10, protectT: 2, blindT: 0, nades: { frag: 2, flash: 2, smoke: 1 }, nadeCd: 0, respawnT: 0, team: mode.ffa ? 'F0' : 'A', crouch: 0 });
  Object.assign(G, { time: 0, matchT: MATCH_TIME, teamScore: { A: 0, B: 0 }, ended: false, score: 0, shots: 0, hits: 0, wave: 0, toSpawn: 0, combo: 1,
    comboT: 0, streakN: 0, streakT: 0, coins: 0, od: 0, odT: 0, waveDelay: 0, bossPending: false, boss: null, shake: 0,
    perk: { dmg: 1, reload: 1, speed: 1, head: 1, mag: 1, leech: 0, magnet: 1 } });
  const used = new Set();
  const nameFrom = (list) => { const free = list.filter((n) => !used.has(n)); const n = pick(free.length ? free : list); used.add(n); return n; };
  if (mode.wave) {
    P.pos.set(0, 0, 30); P.yaw = 0;
  } else if (mode.ffa) {
    for (let i = 0; i < mode.bots; i++) { const sp = farSpawn(bots.map((b) => b.pos)); makeBot({ team: 'F' + (i + 1), name: nameFrom(NAMES_B.concat(NAMES_A)), x: sp.x, z: sp.z }); }
    const sp = farSpawn(bots.map((b) => b.pos)); P.pos.set(sp.x, 0, sp.z); P.yaw = Math.atan2(sp.x, sp.z);
  } else {
    for (let i = 0; i < mode.team - 1; i++) { const sp = teamSpawn('A'); makeBot({ team: 'A', name: nameFrom(NAMES_A), x: sp.x, z: sp.z }); }
    for (let i = 0; i < mode.team; i++) { const sp = teamSpawn('B'); makeBot({ team: 'B', name: nameFrom(NAMES_B), x: sp.x, z: sp.z }); }
    const sp = teamSpawn('A'); P.pos.set(sp.x, 0, sp.z); P.yaw = 0;
  }
  P.pitch = 0; P.vel.set(0, 0, 0);
  ammoOf(P.loadout[0]); ammoOf(P.loadout[1]);
  for (const id of ['menu', 'over', 'result', 'pause', 'perk']) $(id).hidden = true;
  $('menuChars').hidden = true; $('deathBox').hidden = true;
  buildTop(); showVM(); resumePlay();
  if (mode.wave) startWave(1);
  else announce(mode.name, mode.ffa ? '먼저 ' + mode.limit + '킬을 달성하세요' : '먼저 ' + mode.limit + '킬을 달성한 팀이 승리');
}
function lockPointer() {
  if (isTouch) { G.noLock = true; return; }
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; }
}
function exitLock() { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* ignore */ } }
function resumePlay() {
  audio.init(); G.state = 'playing'; document.body.classList.add('playing');
  $('pause').hidden = true; lockPointer();
}
function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused'; document.body.classList.remove('playing'); P.firing = false; $('pause').hidden = false;
}
function toMenu() {
  exitLock();
  G.state = 'menu'; document.body.classList.remove('playing');
  for (const id of ['over', 'result', 'pause', 'perk', 'arsenal']) $(id).hidden = true;
  G.arsenal = false; $('deathBox').hidden = true; $('board').hidden = true;
  $('menu').hidden = false; $('menuChars').hidden = false;
  setupMenu(); renderRecords();
}
function checkMatchEnd() {
  if (G.ended || mode.wave) return;
  if (mode.ffa) { const top = everyone().find((c) => c.kills >= mode.limit); if (top) endMatch(top); }
  else if (G.teamScore.A >= mode.limit) endMatch('A');
  else if (G.teamScore.B >= mode.limit) endMatch('B');
}
function endMatch(winner) {
  if (G.ended) return;
  G.ended = true;
  let title, sub, win;
  if (mode.ffa) {
    const rank = everyone().slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const place = rank.indexOf(P) + 1;
    win = place === 1;
    title = win ? '1위 달성' : place + '위';
    sub = (winner && winner.name ? winner.name : rank[0].name) + ' 님이 ' + rank[0].kills + '킬로 우승했습니다';
  } else {
    if (winner === 'draw') { title = '무승부'; win = false; }
    else { win = winner === P.team; title = win ? '승리' : '패배'; }
    sub = '블루 ' + G.teamScore.A + ' : ' + G.teamScore.B + ' 레드';
  }
  announce(win ? '승리!' : '경기 종료');
  win ? audio.win() : audio.lose();
  saveMatch(win ? '승리' : title === '무승부' ? '무승부' : mode.ffa ? title : '패배');
  setTimeout(() => {
    G.state = 'result'; document.body.classList.remove('playing'); P.firing = false; exitLock();
    $('rKicker').textContent = mode.name + ' · ' + diff.name;
    $('rTitle').textContent = title; $('rTitle').className = win ? 'win' : '';
    $('rSub').textContent = sub;
    $('rK').textContent = P.kills; $('rD').textContent = P.deaths;
    $('rKD').textContent = (P.kills / Math.max(1, P.deaths)).toFixed(2);
    $('rHs').textContent = (P.kills ? Math.round((P.heads / P.kills) * 100) : 0) + '%';
    $('rBoard').innerHTML = boardHtml();
    $('result').hidden = false;
    lastShare = mode.ffa
      ? '메타 스쿼드 FPS 개인전에서 ' + title + '! ' + P.kills + '킬 ' + P.deaths + '데스'
      : '메타 스쿼드 FPS ' + mode.name + ' ' + title + ' (' + sub + ') · ' + P.kills + '킬';
  }, 1600);
}
function endMatchByTime() {
  if (mode.ffa) endMatch(null);
  else endMatch(G.teamScore.A === G.teamScore.B ? 'draw' : G.teamScore.A > G.teamScore.B ? 'A' : 'B');
}
function gameOver() {
  G.ended = true;
  setTimeout(() => {
    G.state = 'over'; document.body.classList.remove('playing'); P.firing = false; exitLock();
    const rec = store.json('msf_records', { waves: [], matches: [] });
    const entry = { name: P.name, score: G.score, wave: G.wave, kills: P.kills, diff: diffKey, date: new Date().toISOString().slice(0, 10) };
    rec.waves.push(entry); rec.waves.sort((a, b) => b.score - a.score); rec.waves = rec.waves.slice(0, 10);
    store.setJson('msf_records', rec);
    const rank = rec.waves.indexOf(entry) + 1;
    $('oScore').textContent = G.score.toLocaleString(); $('oWave').textContent = G.wave; $('oKills').textContent = P.kills;
    $('oHs').textContent = (P.kills ? Math.round((P.heads / P.kills) * 100) : 0) + '%';
    $('oBest').textContent = rank === 1 ? '새 최고 기록입니다.' : rank > 0 ? '내 기록 ' + rank + '위에 올랐습니다.' : '최고 기록 ' + (rec.waves[0] ? rec.waves[0].score.toLocaleString() : 0) + '점';
    $('over').hidden = false;
    lastShare = '메타 스쿼드 FPS 웨이브 서바이벌에서 웨이브 ' + G.wave + ' 도달, ' + G.score.toLocaleString() + '점!';
  }, 700);
}
function saveMatch(result) {
  const rec = store.json('msf_records', { waves: [], matches: [] });
  rec.matches.unshift({ mode: mode.name, result, k: P.kills, d: P.deaths, diff: diffKey, date: new Date().toISOString().slice(0, 10) });
  rec.matches = rec.matches.slice(0, 12);
  store.setJson('msf_records', rec);
}

/* ================= share ================= */
let lastShare = '';
async function share() {
  const url = location.origin && location.origin !== 'null' ? location.origin + location.pathname : '';
  const text = lastShare + (url ? ' 같이 해요 → ' + url : '');
  try { if (navigator.share) { await navigator.share({ title: '메타 스쿼드 FPS', text: lastShare, url: url || undefined }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('결과와 링크를 복사했어요'); }
  catch (e) { const t = $('shareText'); t.hidden = false; t.value = text; t.select(); toast('아래 문구를 복사해 공유하세요'); }
}

/* ================= input ================= */
const canvas = renderer.domElement;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { G.hadLock = true; G.noLock = false; }
  else if (G.state === 'playing' && G.hadLock && !G.arsenal && !G.ended) pauseGame();
});
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Tab') { e.preventDefault(); if (G.state === 'playing' && !mode.wave) { $('board').innerHTML = boardHtml(); $('board').hidden = false; } return; }
  if (G.arsenal) { if (e.code === 'KeyB' || e.code === 'Escape') closeArsenal(); return; }
  if (G.state !== 'playing') return;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  switch (e.code) {
    case 'KeyR': reload(); break;
    case 'Digit1': equipSlot(0); break;
    case 'Digit2': equipSlot(1); break;
    case 'Digit3': equipSlot(2); break;
    case 'KeyQ': activateOD(); break;
    case 'KeyG': playerThrow('frag'); break;
    case 'KeyF': playerThrow('flash'); break;
    case 'KeyV': playerThrow('smoke'); break;
    case 'KeyE': pickupDrop(); break;
    case 'KeyB': openArsenal('game'); break;
    case 'KeyM': toast(audio.toggleMute() ? '소리 끔' : '소리 켬'); break;
    case 'Escape': if (G.noLock) pauseGame(); break;
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Tab') $('board').hidden = true; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; P.firing = false; $('board').hidden = true; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousedown', (e) => {
  if (G.state !== 'playing' || isTouch || G.arsenal) return;
  if (e.target !== canvas && !e.target.closest('#hud')) return;
  if (e.button === 0) { P.firing = true; P.firedPress = false; }
  if (e.button === 2) P.ads = true;
  if (!G.noLock && document.pointerLockElement !== canvas) lockPointer();
});
addEventListener('mouseup', (e) => { if (e.button === 0) P.firing = false; if (e.button === 2) P.ads = false; });
addEventListener('mousemove', (e) => {
  if (G.state !== 'playing' || isTouch || !P.alive || G.arsenal) return;
  if (document.pointerLockElement !== canvas && !G.noLock) return;
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return; // drop pointer-lock spikes
  const k = 0.0022 * settings.sens * (camera.fov / settings.fov);
  P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k, -1.45, 1.45);
});
addEventListener('wheel', (e) => { if (G.state === 'playing' && !G.arsenal) equipSlot((P.slot + (e.deltaY > 0 ? 1 : 2)) % 3); }, { passive: true });

/* touch */
const touch = { mx: 0, my: 0, stickId: null, lookId: null, lx: 0, ly: 0, jump: false, crouch: false };
const stick = $('stick'), knob = $('knob');
function stickMove(t) {
  const r = stick.getBoundingClientRect(); let dx = t.clientX - (r.left + 60), dy = t.clientY - (r.top + 60);
  const d = Math.hypot(dx, dy), m = 48; if (d > m) { dx *= m / d; dy *= m / d; }
  knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; touch.mx = dx / m; touch.my = -dy / m;
}
function tbtn(id, down, up) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
  if (up) el.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
}
tbtn('tFire', () => { P.firing = true; P.firedPress = false; }, () => (P.firing = false));
tbtn('tAim', () => (P.ads = !P.ads));
tbtn('tJump', () => (touch.jump = true));
tbtn('tCrouch', () => (touch.crouch = !touch.crouch));
tbtn('tReload', () => reload());
tbtn('tSwap', () => equipSlot((P.slot + 1) % 3));
tbtn('tNade', () => playerThrow(P.nadeType));
tbtn('tNadeType', () => { const order = ['frag', 'flash', 'smoke']; P.nadeType = order[(order.indexOf(P.nadeType) + 1) % 3]; $('tNadeType').textContent = NADES[P.nadeType].short; });
tbtn('tOD', () => activateOD());
tbtn('tBuy', () => openArsenal('game'));
tbtn('tUse', () => pickupDrop());
tbtn('tPause', () => pauseGame());
stick.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.changedTouches[0]; touch.stickId = t.identifier; stickMove(t); }, { passive: false });
addEventListener('touchstart', (e) => {
  if (G.state !== 'playing') return;
  for (const t of e.changedTouches) {
    if (t.target.closest && t.target.closest('.tb,#stick')) continue;
    if (touch.lookId === null && t.clientX > innerWidth * 0.35) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
  }
}, { passive: true });
addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) stickMove(t);
    else if (t.identifier === touch.lookId) {
      const k = 0.005 * settings.sens * (camera.fov / settings.fov);
      P.yaw -= (t.clientX - touch.lx) * k; P.pitch = clamp(P.pitch - (t.clientY - touch.ly) * k, -1.4, 1.4);
      touch.lx = t.clientX; touch.ly = t.clientY;
    }
  }
  if (G.state === 'playing' && !G.arsenal) e.preventDefault();
}, { passive: false });
addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.stickId) { touch.stickId = null; touch.mx = touch.my = 0; knob.style.transform = ''; }
    if (t.identifier === touch.lookId) touch.lookId = null;
  }
});

/* ================= player update ================= */
function updatePlayer(dt) {
  const w = curW();
  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.mx, iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0) + touch.my;
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  const crouchHeld = keys.KeyC || keys.ControlLeft || touch.crouch;
  P.crouch += ((crouchHeld && P.onGround ? 1 : 0) - P.crouch) * Math.min(1, 12 * dt);
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && iz > 0.3 && !P.ads && !P.firing && P.crouch < 0.3;
  const sp = 6.3 * w.speed * (mode.wave ? G.perk.speed : 1) * (sprint ? 1.45 : 1) * (P.ads ? 0.62 : 1) * (1 - P.crouch * 0.5) * (G.odT > 0 ? 1.2 : 1);
  const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  const wx = (-sy * iz + cy * ix) * sp, wz = (-cy * iz - sy * ix) * sp;
  const acc = P.onGround ? 13 : 3.5;
  P.vel.x += (wx - P.vel.x) * Math.min(1, acc * dt); P.vel.z += (wz - P.vel.z) * Math.min(1, acc * dt);
  if ((keys.Space || touch.jump) && P.onGround) { P.vel.y = 7.2; P.onGround = false; }
  touch.jump = false;
  P.vel.y -= 22 * dt;
  P.onGround = moveBody(P.pos, P.vel, dt, P.radius, 1.75 - P.crouch * 0.6);
  for (const pd of pads) {
    if (P.onGround && P.pos.y < 0.4 && Math.hypot(P.pos.x - pd.x, P.pos.z - pd.z) < 1.2) {
      P.vel.y = 14.5; P.onGround = false; audio.jump();
      FX.burst(new V3(pd.x, 0.3, pd.z), FX.MAT.gold, 10, 4, 0.3, 0.5, 2); FX.ringFx(pd.x, pd.z, 0xffb43b);
    }
  }
  P.fireCd -= dt; P.bloom = Math.max(0, P.bloom - dt * 0.08);
  if (P.nadeCd > 0) P.nadeCd -= dt;
  if (P.throwT > 0) P.throwT -= dt;
  if (P.meleeT > 0) P.meleeT -= dt;
  if (P.protectT > 0) P.protectT -= dt;
  if (P.blindT > 0) P.blindT -= dt;
  if (P.switchT > 0) P.switchT -= dt;
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { P.reloadT = 0; finishReload(); } }
  if (P.firing && (w.auto || !P.firedPress)) { if (tryFire()) P.firedPress = true; }
  P.adsK += ((P.ads && P.reloadT <= 0 && !w.melee ? 1 : 0) - P.adsK) * Math.min(1, 14 * dt);
  P.kick *= Math.exp(-dt * 11);
  if (G.time - P.lastHurt > 4.5 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + (mode.wave ? 7 : 12) * dt);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (P.onGround && hs > 0.5) P.walkT += dt * hs * 1.7;
  const bob = P.onGround ? Math.sin(P.walkT * 2) * 0.035 * Math.min(hs / 6, 1) * (1 - P.adsK * 0.7) : 0;
  camera.position.set(P.pos.x, P.pos.y + 1.62 - P.crouch * 0.52 + bob, P.pos.z);
  let shx = 0, shy = 0;
  if (G.shake > 0) { shx = rand(-1, 1) * G.shake * 0.04; shy = rand(-1, 1) * G.shake * 0.04; G.shake = Math.max(0, G.shake - dt * 2.2); }
  camera.rotation.set(P.pitch + P.kick + shx, P.yaw + shy, 0);
  const fov = settings.fov - (w.zoom || 0) * P.adsK;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  playerEye.copy(camera.position);
  // viewmodel
  const vm = vmFor(w.id);
  vmRecoil *= Math.exp(-dt * 16);
  const base = vm.hip.clone().lerp(vm.ads, P.adsK);
  const amp = Math.min(hs / 6, 1) * (1 - P.adsK * 0.85);
  vm.g.position.set(base.x + Math.sin(P.walkT) * 0.012 * amp, base.y + Math.abs(Math.cos(P.walkT)) * 0.01 * amp - (P.switchT > 0 ? P.switchT * 0.8 : 0) - (P.throwT > 0 ? Math.sin((P.throwT / 0.35) * Math.PI) * 0.15 : 0), base.z + vmRecoil * 0.05);
  let rx = vmRecoil * (vm.type === 'pistol' ? 0.25 : 0.08), ry = 0, rz = 0;
  if (P.reloadT > 0) { const e = Math.sin((1 - P.reloadT / P.reloadMax) * Math.PI); rx -= e * 0.55; rz = e * 0.4; vm.g.position.y -= e * 0.08; }
  if (sprint) { rz += 0.35; rx -= 0.15; vm.g.position.x -= 0.04; }
  if (P.meleeT > 0) { const e = Math.sin((1 - P.meleeT / 0.3) * Math.PI); ry = e * 0.9; rx -= e * 0.4; vm.g.position.x -= e * 0.12; vm.g.position.z -= e * 0.1; }
  vm.g.rotation.set(rx, ry, rz);
  const scoped = !!w.scope && P.adsK > 0.82;
  vm.g.visible = !scoped;
  $('scope').classList.toggle('on', scoped);
  if (vm.pump) vm.pump.position.z = vm.pump.userData.z0 ?? (vm.pump.userData.z0 = vm.pump.position.z);
  if (vm.pump && P.fireCd > 0.15) vm.pump.position.z = vm.pump.userData.z0 + Math.sin((1 - P.fireCd / w.rate) * Math.PI) * 0.08;
  if (vmFlashT > 0) { vmFlashT -= dt; vm.muzzle.getWorldPosition(vmFlash.position); if (vmFlashT <= 0) vmFlash.visible = false; }
}
function updateDeathCam(dt) {
  P.respawnT -= dt;
  const k = P.killer && P.killer.alive ? P.killer : null;
  const dp = P.deathPos || P.pos;
  tA.set(dp.x, 3.4, dp.z + 0.01);
  camera.position.lerp(tA, Math.min(1, dt * 3));
  if (k) { center(k, tB); camera.lookAt(tB); } else camera.lookAt(dp.x, 0, dp.z);
  if (Math.abs(camera.fov - settings.fov) > 0.01) { camera.fov = settings.fov; camera.updateProjectionMatrix(); }
  $('scope').classList.remove('on');
  playerEye.copy(camera.position);
  $('deathTxt').innerHTML = (P.killer ? '<b class="' + relClass(P.killer) + '">' + escapeHtml(P.killer.name) + '</b> 님에게 당했습니다' : '전사했습니다') +
    '<small>' + Math.max(0, P.respawnT).toFixed(1) + '초 후 리스폰 · ' + (isTouch ? '무기 버튼' : 'B 키') + '로 무기 변경</small>';
  if (P.respawnT <= 0 && !G.ended) respawnPlayer();
}

/* ================= HUD ================= */
const hud = {};
['hpNum', 'hpFill', 'ammo', 'wName', 'reloadTip', 'odFill', 'odBox', 'odLbl', 'odVig', 'vig', 'comboBox', 'comboTxt', 'comboFill', 'nadeBox', 'tgtName', 'fps', 'bossBox', 'bossFill', 'flashbang', 'smokeOv', 'protect', 'slots']
  .forEach((id) => (hud[id] = $(id)));
const xh = ['t', 'b', 'l', 'r'].map((c) => document.querySelector('#xh .' + c));
let topRefs = {};
function buildTop() {
  const t = $('topBox');
  if (mode.wave) {
    t.className = 'hud wave';
    t.innerHTML = '<div><b class="num" id="tWave">1</b><span>웨이브</span></div><div><b class="num" id="tScore">0</b><span>점수</span></div><div><b class="num" id="tLeft">0</b><span>남은 적</span></div><div><b class="num" id="tCoins">0</b><span>코인</span></div>';
  } else if (mode.ffa) {
    t.className = 'hud ffa';
    t.innerHTML = '<div><b class="num" id="tMine">0</b><span>내 킬</span></div><div class="clock"><b class="num" id="tTime">08:00</b><span>목표 ' + mode.limit + '킬</span></div><div><b class="num" id="tLead">0</b><span id="tLeadName">1위</span></div>';
  } else {
    t.className = 'hud team';
    t.innerHTML = '<div class="ts a"><b class="num" id="tA">0</b><span>블루</span></div><div class="clock"><b class="num" id="tTime">08:00</b><span>목표 ' + mode.limit + '킬</span></div><div class="ts b"><b class="num" id="tB">0</b><span>레드</span></div>' +
      '<div class="bars"><i class="ba" id="tBarA"></i><i class="bb" id="tBarB"></i></div>';
  }
  topRefs = {};
  t.querySelectorAll('[id]').forEach((e) => (topRefs[e.id] = e));
}
function boardHtml() {
  const row = (c) => '<tr class="' + relClass(c) + (c.alive ? '' : ' dead') + '"><td>' + escapeHtml(c.name) + (c === P ? ' (나)' : '') + '</td><td>' + c.kills + '</td><td>' + c.deaths + '</td><td>' + (c.kills / Math.max(1, c.deaths)).toFixed(1) + '</td></tr>';
  const sortK = (a, b) => b.kills - a.kills || a.deaths - b.deaths;
  const head = '<thead><tr><th>이름</th><th>킬</th><th>데스</th><th>K/D</th></tr></thead>';
  if (mode.ffa) return '<div class="tb-wrap"><table>' + head + '<tbody>' + everyone().sort(sortK).map(row).join('') + '</tbody></table></div>';
  const side = (team, label, score) => '<div class="tb-wrap"><h4 class="' + (team === P.team ? 'ally' : 'foe') + '">' + label + ' <b>' + score + '</b></h4><table>' + head + '<tbody>' + everyone().filter((c) => c.team === team).sort(sortK).map(row).join('') + '</tbody></table></div>';
  return side('A', '블루 팀', G.teamScore.A) + side('B', '레드 팀', G.teamScore.B);
}
let lastAmmoStr = '', hudFrame = 0;
function updateHud(dt) {
  hudFrame++;
  hud.hpNum.textContent = Math.ceil(P.hp);
  hud.hpFill.style.width = (P.hp / P.maxHp) * 100 + '%';
  hud.hpFill.style.background = P.hp < 35 ? 'var(--danger)' : 'var(--hp)';
  const w = curW(), a = w.melee ? null : ammoOf(w.id);
  const ammoStr = (w.melee ? '—' : (G.odT > 0 ? '∞' : a.mag) + '|' + a.res) + P.loadout.join();
  if (ammoStr + w.id !== lastAmmoStr) {
    hud.ammo.innerHTML = w.melee ? '<span class="melee">근접</span>' : (G.odT > 0 ? '∞' : a.mag) + '<small> / ' + a.res + '</small>';
    hud.wName.textContent = w.name + ' · ' + w.cls;
    lastAmmoStr = ammoStr + w.id;
    hud.slots.innerHTML = [P.loadout[0], P.loadout[1], 'knife'].map((id, i) => '<span class="' + (i === P.slot ? 'on' : '') + '"><b>' + (i + 1) + '</b>' + escapeHtml(WEAPONS[id].name) + '</span>').join('');
  }
  hud.reloadTip.textContent = P.reloadT > 0 ? '재장전 중…' : !w.melee && a.mag === 0 && a.res === 0 && G.odT <= 0 ? '탄약 없음 · 무기 교체' : !w.melee && a.mag <= Math.round(magSize(w) * 0.25) && G.odT <= 0 ? 'R 재장전' : '';
  hud.nadeBox.innerHTML = ['frag', 'flash', 'smoke'].map((t) => '<span class="' + (P.nades[t] ? '' : 'empty') + (isTouch && P.nadeType === t ? ' sel' : '') + '"><kbd>' + NADES[t].key + '</kbd>' + NADES[t].short + ' ' + P.nades[t] + '</span>').join('');
  hud.odFill.style.width = (G.odT > 0 ? G.odT / 7 : G.od) * 100 + '%';
  hud.odBox.classList.toggle('ready', G.od >= 1 && G.odT <= 0);
  hud.odLbl.textContent = G.odT > 0 ? '오버드라이브 가동' : G.od >= 1 ? (isTouch ? 'OD 버튼' : 'Q 오버드라이브') : '오버드라이브';
  hud.odVig.style.opacity = G.odT > 0 ? 0.8 : 0;
  hud.vig.style.boxShadow = 'inset 0 0 160px 40px rgba(255,40,30,' + (P.hp < 50 ? (1 - P.hp / 50) * 0.7 : 0) + ')';
  hud.comboBox.style.opacity = G.combo > 1 ? 1 : 0;
  hud.comboTxt.textContent = '콤보 x' + Math.max(1, G.combo - 1);
  hud.comboFill.style.width = (G.comboT / 4) * 100 + '%';
  hud.flashbang.style.opacity = P.blindT > 0 ? Math.min(1, P.blindT / Math.max(0.6, P.blindMax * 0.55)) : 0;
  hud.smokeOv.style.opacity = Math.min(0.92, inSmoke(camera.position) * 1.4);
  hud.protect.hidden = !(P.protectT > 0 && P.alive);
  // top bar
  if (mode.wave) {
    topRefs.tWave.textContent = G.wave; topRefs.tScore.textContent = G.score.toLocaleString();
    topRefs.tLeft.textContent = G.toSpawn + aliveFoes() + (G.bossPending ? 1 : 0); topRefs.tCoins.textContent = G.coins;
    hud.bossBox.hidden = !(G.boss && G.boss.alive);
    if (G.boss && G.boss.alive) hud.bossFill.style.width = (G.boss.hp / G.boss.maxHp) * 100 + '%';
  } else if (mode.ffa) {
    topRefs.tMine.textContent = P.kills; topRefs.tTime.textContent = fmtTime(G.matchT);
    const lead = everyone().filter((c) => c !== P).sort((a, b) => b.kills - a.kills)[0];
    topRefs.tLead.textContent = lead ? lead.kills : 0; topRefs.tLeadName.textContent = lead ? '1위 ' + lead.name : '1위';
  } else {
    topRefs.tA.textContent = G.teamScore.A; topRefs.tB.textContent = G.teamScore.B; topRefs.tTime.textContent = fmtTime(G.matchT);
    topRefs.tBarA.style.width = (G.teamScore.A / mode.limit) * 50 + '%'; topRefs.tBarB.style.width = (G.teamScore.B / mode.limit) * 50 + '%';
  }
  // crosshair
  const gap = 4 + currentSpread(w) * innerHeight * 0.9;
  xh[0].style.top = -gap - 9 + 'px'; xh[1].style.top = gap + 'px'; xh[2].style.left = -gap - 9 + 'px'; xh[3].style.left = gap + 'px';
  const hideX = (P.adsK > 0.6 && (w.scope || w.vis.optic === 'dot' || w.vis.optic === 'holo')) || !P.alive;
  for (const e of xh) e.style.opacity = hideX ? 0 : 1;
  if (hudFrame % 4 === 0 && P.alive) {
    camera.getWorldDirection(camDir);
    raycaster.set(camera.position, camDir); raycaster.far = 90;
    const h = raycaster.intersectObjects([...solids, ...botMeshes], false)[0];
    const b = h && h.object.userData.bot;
    if (b && b.alive && !inSmoke(h.point)) {
      const foe = isEnemy(P, b);
      hud.tgtName.textContent = b.name + (b.kind === 'boss' ? ' (보스)' : b.kind === 'elite' ? ' (엘리트)' : '');
      hud.tgtName.className = foe ? 'foe' : 'ally';
      document.getElementById('xh').className = foe ? 'foe' : 'ally';
      if (foe) b.spottedT = Math.max(b.spottedT, 1);
    } else { hud.tgtName.textContent = ''; document.getElementById('xh').className = ''; }
  }
  if (hmT > 0) { hmT -= dt; if (hmT <= 0) $('hm').style.opacity = 0; }
  if (dirIndT > 0) { dirIndT -= dt * 1.2; $('dirInd').style.opacity = Math.max(dirIndT, 0); }
  drawRadar();
}

/* radar */
const radar = $('radar'), rctx = radar.getContext('2d');
function drawRadar() {
  const S = 148, dpr = Math.min(devicePixelRatio, 2);
  if (radar.width !== S * dpr) { radar.width = radar.height = S * dpr; }
  const g = rctx; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
  const c = S / 2, R = S / 2 - 3, range = 38, sc = R / range;
  g.fillStyle = 'rgba(10,12,16,.62)'; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,236,210,.16)'; g.lineWidth = 1;
  g.beginPath(); g.arc(c, c, R * 0.5, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(c, 4); g.lineTo(c, S - 4); g.moveTo(4, c); g.lineTo(S - 4, c); g.stroke();
  g.fillStyle = 'rgba(255,180,59,.12)'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
  const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
  const plot = (x, z, col, r, tri, yaw) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    const lx = dx * cy - dz * sy, lf = -dx * sy - dz * cy;
    let px = lx * sc, py = -lf * sc; const d = Math.hypot(px, py);
    if (d > R - 4) { px *= (R - 4) / d; py *= (R - 4) / d; }
    g.fillStyle = col; g.beginPath();
    if (tri) {
      const a = -(yaw - P.yaw) - Math.PI;
      g.save(); g.translate(c + px, c + py); g.rotate(-a); g.moveTo(0, -r - 1); g.lineTo(r, r); g.lineTo(-r, r); g.closePath(); g.fill(); g.restore();
    } else { g.arc(c + px, c + py, r, 0, 7); g.fill(); }
  };
  for (const s of smokes) plot(s.pos.x, s.pos.z, 'rgba(200,196,188,.35)', s.r * sc, false);
  for (const d of drops) plot(d.g.position.x, d.g.position.z, 'rgba(255,180,59,.7)', 2, false);
  for (const b of bots) {
    if (!b.alive) continue;
    if (!mode.ffa && b.team === P.team) plot(b.pos.x, b.pos.z, '#5aa2ff', 3.6, true, b.yaw);
    else if (b.spottedT > 0 || mode.wave) plot(b.pos.x, b.pos.z, b.kind === 'boss' ? '#ff9a3a' : '#ff5148', b.kind === 'boss' ? 5 : 3.4, false);
  }
  for (const n of nades) if (n.type === 'frag') plot(n.pos.x, n.pos.z, '#ffd14a', 2.6, false);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(c, c - 6); g.lineTo(c + 4.5, c + 4.5); g.lineTo(c - 4.5, c + 4.5); g.closePath(); g.fill();
}

/* ================= menus ================= */
function renderModes() {
  const el = $('modes'); el.innerHTML = '';
  for (const k in MODES) {
    const m = MODES[k];
    const b = document.createElement('button');
    b.className = 'mode' + (m === mode ? ' on' : ''); b.id = 'mode_' + k; b.type = 'button';
    b.innerHTML = '<b>' + m.name + '</b><span>' + m.desc + '</span>';
    b.addEventListener('click', () => { mode = m; store.set('msf_mode', k); renderModes(); });
    el.appendChild(b);
  }
  document.querySelectorAll('#diff button').forEach((b) => b.classList.toggle('on', b.dataset.d === diffKey));
}
document.querySelectorAll('#diff button').forEach((b) => b.addEventListener('click', () => { diffKey = b.dataset.d; diff = DIFF[diffKey]; store.set('msf_diff', diffKey); renderModes(); }));

function renderArsenal() {
  const card = (id, slot) => {
    const w = WEAPONS[id], on = P.loadout[slot] === id;
    return '<button type="button" class="wcard' + (on ? ' on' : '') + '" data-slot="' + slot + '" data-id="' + id + '" id="w_' + id + '">' +
      '<span class="wc-cls">' + w.cls + (on ? ' · 장착 중' : '') + '</span><b>' + w.name + '</b>' +
      '<span class="wc-meta num">' + (w.pellets > 1 ? w.dmg + '×' + w.pellets : w.dmg) + ' 피해 · ' + w.mag + '발' + (w.auto ? ' · 자동' : ' · 단발') + '</span>' +
      '<span class="bars">' + weaponStats(w).map(([l, v]) => '<i><em style="width:' + Math.round(v * 100) + '%"></em><small>' + l + '</small></i>').join('') + '</span></button>';
  };
  $('arsPrimary').innerHTML = PRIMARIES.map((id) => card(id, 0)).join('');
  $('arsSecondary').innerHTML = SECONDARIES.map((id) => card(id, 1)).join('');
  document.querySelectorAll('.wcard').forEach((b) => b.addEventListener('click', () => {
    equipWeapon(+b.dataset.slot, b.dataset.id);
    if (G.arsenalFrom === 'game') toast(WEAPONS[b.dataset.id].name + ' 장착');
  }));
}
function openArsenal(from) {
  G.arsenal = true; G.arsenalFrom = from; renderArsenal();
  $('arsHint').textContent = from === 'game' ? '경기는 계속 진행됩니다. 카드를 누르면 즉시 장착됩니다.' : '카드를 누르면 다음 출격 무기로 저장됩니다.';
  $('arsenal').hidden = false; P.firing = false; P.ads = false;
  if (from === 'game') { exitLock(); document.body.classList.remove('playing'); }
}
function closeArsenal() {
  G.arsenal = false; $('arsenal').hidden = true;
  if (G.arsenalFrom === 'game' && G.state === 'playing') { document.body.classList.add('playing'); lockPointer(); }
  if (G.arsenalFrom === 'pause') $('pause').hidden = false;
}
function openSettings(from) {
  G.settingsFrom = from;
  $('sSens').value = settings.sens; $('sFov').value = settings.fov; $('sVol').value = settings.vol; $('sGfx').value = settings.gfx; $('sFps').checked = settings.fps;
  syncSettingLabels();
  $('settings').hidden = false; if (from === 'pause') $('pause').hidden = true;
}
function syncSettingLabels() {
  $('vSens').textContent = (+settings.sens).toFixed(2); $('vFov').textContent = settings.fov + '°'; $('vVol').textContent = settings.vol + '%';
}
$('sSens').addEventListener('input', (e) => { settings.sens = +e.target.value; syncSettingLabels(); saveSettings(); });
$('sFov').addEventListener('input', (e) => { settings.fov = +e.target.value; syncSettingLabels(); saveSettings(); });
$('sVol').addEventListener('input', (e) => { settings.vol = +e.target.value; syncSettingLabels(); saveSettings(); audio.setVol(); });
$('sGfx').addEventListener('change', (e) => { settings.gfx = e.target.value; saveSettings(); applyGfx(); toast('그래픽 품질: ' + e.target.selectedOptions[0].textContent); });
$('sFps').addEventListener('change', (e) => { settings.fps = e.target.checked; saveSettings(); });
$('settingsClose').addEventListener('click', () => { $('settings').hidden = true; if (G.settingsFrom === 'pause') $('pause').hidden = false; });

function renderRecords() {
  const rec = store.json('msf_records', { waves: [], matches: [] });
  $('recWaves').innerHTML = rec.waves.length
    ? rec.waves.map((r, i) => '<tr><td class="num">' + (i + 1) + '</td><td>' + escapeHtml(r.name) + '</td><td class="num">' + r.score.toLocaleString() + '</td><td class="num">' + r.wave + '</td><td>' + (DIFF[r.diff] ? DIFF[r.diff].name : '') + '</td></tr>').join('')
    : '<tr><td colspan="5" class="empty">아직 기록이 없습니다. 웨이브 서바이벌을 플레이하면 여기에 쌓입니다.</td></tr>';
  $('recMatches').innerHTML = rec.matches.length
    ? rec.matches.map((r) => '<tr><td>' + escapeHtml(r.mode) + '</td><td class="' + (r.result === '승리' || r.result === '1위 달성' ? 'win' : '') + '">' + escapeHtml(r.result) + '</td><td class="num">' + r.k + ' / ' + r.d + '</td><td class="num">' + r.date.slice(5) + '</td></tr>').join('')
    : '<tr><td colspan="4" class="empty">팀 데스매치나 개인전을 끝내면 전적이 기록됩니다.</td></tr>';
  const best = rec.waves[0]; $('bestTxt').textContent = best ? best.score.toLocaleString() : '0';
}

$('startBtn').addEventListener('click', newGame);
$('retryBtn').addEventListener('click', newGame);
$('rRetry').addEventListener('click', newGame);
$('rMenu').addEventListener('click', toMenu);
$('oMenu').addEventListener('click', toMenu);
$('rShare').addEventListener('click', share);
$('oShare').addEventListener('click', share);
$('resumeBtn').addEventListener('click', () => resumePlay());
$('pArsenal').addEventListener('click', () => { $('pause').hidden = true; openArsenal('pause'); });
$('pSettings').addEventListener('click', () => openSettings('pause'));
$('pQuit').addEventListener('click', toMenu);
$('mArsenal').addEventListener('click', () => openArsenal('menu'));
$('mSettings').addEventListener('click', () => openSettings('menu'));
$('mRecords').addEventListener('click', () => { renderRecords(); $('records').hidden = false; });
$('mHelp').addEventListener('click', () => { $('help').hidden = false; });
$('recClose').addEventListener('click', () => { $('records').hidden = true; });
$('helpClose').addEventListener('click', () => { $('help').hidden = true; });
$('arsClose').addEventListener('click', closeArsenal);
$('nick').value = settings.nick || '';

/* menu showcase: two operators per team with different weapons */
function setupMenu() {
  clearWorld();
  const spots = [[3.0, 21.5, 'A', 'urban', 'longbow'], [4.3, 20.7, 'A', 'navy', 'k9'], [5.6, 21.6, 'B', 'desert', 'hammer'], [6.8, 22.5, 'B', 'olive', 't12']];
  const saveMode = mode;
  mode = MODES.tdm5;
  spots.forEach(([x, z, team, look, wid], i) => {
    const b = makeBot({ team, wid, name: '', x, z, demo: true });
    const L = LOOKS[look]; const M = b.s.M;
    M.cloth.map = L.camo; M.vest.color.setHex(L.vest); M.helmet.color.setHex(L.helmet); M.skin.color.setHex(SKINS[i % SKINS.length]);
    b.yaw = Math.atan2(1.2 - x, 27.6 - z) + [-0.2, 0, 0.2, 0.35][i];
    b.walk = i * 2;
  });
  mode = saveMode;
  for (const k in vmCache) vmCache[k].g.visible = false;
  renderModes();
}
let menuT = 0;
function updateMenuCam(dt) {
  menuT += dt;
  const narrow = innerWidth < 700;
  camera.position.set(narrow ? 4.9 : 1.2 + Math.sin(menuT * 0.15) * 0.25, 1.5 + Math.sin(menuT * 0.2) * 0.04, narrow ? 29.6 : 27.6);
  camera.lookAt(narrow ? 4.9 : 2.75, 1.1, 21.6);
  if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); }
}

/* ================= main loop ================= */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0;
function step(dt) {
  const live = G.state === 'playing';
  if (live) {
    G.time += dt;
    if (!mode.wave && !G.ended) { G.matchT -= dt; if (G.matchT <= 0) endMatchByTime(); }
    if (P.alive) updatePlayer(dt); else updateDeathCam(dt);
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 1; }
    if (G.streakT > 0) G.streakT -= dt;
    if (G.odT > 0) G.odT -= dt;
    if (mode.wave && !G.ended) spawnTick(dt);
    updatePickups(dt); updateDrops(dt); updateNades(dt); updateSmokes(dt);
  } else if (G.state === 'menu') {
    updateMenuCam(dt);
    for (const b of menuBots) updateDemo(b, dt);
  }
  if (live || G.state === 'result' || G.state === 'over') {
    for (let i = bots.length - 1; i >= 0; i--) updateBot(bots[i], dt);
    for (const b of bots) b.s.root.updateMatrixWorld();
  }
  FX.update(dt);
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { hud.fps.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; }
  hud.fps.hidden = !settings.fps;
  step(dt);
  if (G.state === 'playing') updateHud(dt);
  for (const pd of pads) { pd.ring.material.opacity = 0.6 + Math.sin(G.time * 5 + pd.x) * 0.3; pd.beam.material.opacity = 0.08 + Math.sin(G.time * 3 + pd.z) * 0.05; }
  sky.position.copy(camera.position);
  sun.position.set(camera.position.x + 30, 48, camera.position.z + 22);
  sun.target.position.set(camera.position.x, 0, camera.position.z);
  renderer.clear();
  renderer.render(scene, camera);
  if ((G.state === 'playing' || G.state === 'paused' || G.state === 'perk') && P.alive) { renderer.clearDepth(); renderer.render(vmScene, vmCam); }
}
setupMenu(); renderRecords(); buildTop();
frame();
/* debug hooks (used by automated tests): window.__msf.sim(seconds) fast-forwards the game logic without rendering */
window.__msf = {
  G, P, get bots() { return bots; }, newGame, setMode: (k) => { mode = MODES[k]; renderModes(); },
  sim(sec, god) { const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { if (god) P.hp = P.maxHp; step(1 / 30); } },
};
