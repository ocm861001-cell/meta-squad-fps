import { settings } from './core.js';
import { store } from './util.js';

let ctx = null, master = null, noise = null;
let muted = store.get('msf_mute', '0') === '1';

const SHOT = {
  ar: { f: 4200, d: 0.16, b: 150, v: 1 },
  ar2: { f: 3500, d: 0.21, b: 115, v: 1.1 },
  smg: { f: 5200, d: 0.11, b: 190, v: 0.8 },
  sg: { f: 2600, d: 0.4, b: 105, v: 1.25 },
  dmr: { f: 3800, d: 0.27, b: 110, v: 1.15 },
  sn: { f: 2900, d: 0.6, b: 75, v: 1.4 },
  lmg: { f: 3800, d: 0.19, b: 125, v: 1.05 },
  pi: { f: 4800, d: 0.12, b: 210, v: 0.8 },
  rv: { f: 3000, d: 0.32, b: 95, v: 1.2 },
};

function noiseHit(t, freq, to, dur, vol, type = 'lowpass') {
  const n = ctx.createBufferSource(); n.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = type;
  f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f); f.connect(g); g.connect(master);
  n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
}
function osc(t, freq, to, dur, vol, type = 'sine') {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}

export const audio = {
  init() {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.setVol();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  },
  get muted() { return muted; },
  setVol() { if (master) master.gain.value = muted ? 0 : (settings.vol / 100) * 0.8; },
  toggleMute() { muted = !muted; store.set('msf_mute', muted ? '1' : '0'); this.setVol(); return muted; },
  shot(kind, vol = 1) {
    if (!ctx || vol < 0.01) return;
    const p = SHOT[kind] || SHOT.ar, t = ctx.currentTime, v = vol * p.v;
    noiseHit(t, p.f, 280, p.d, 0.85 * v);
    osc(t, p.b, 38, 0.14, 0.7 * v);
    if (kind === 'sn' || kind === 'rv') noiseHit(t + 0.05, 900, 120, 0.7, 0.25 * v);
  },
  boom(vol = 1) {
    if (!ctx) return; const t = ctx.currentTime;
    noiseHit(t, 1800, 60, 1.3, 1.1 * vol);
    osc(t, 70, 25, 0.9, 1.0 * vol);
  },
  bang(vol = 1) {
    if (!ctx) return; const t = ctx.currentTime;
    noiseHit(t, 7000, 800, 0.35, 1.0 * vol, 'highpass');
    osc(t, 180, 60, 0.3, 0.5 * vol);
  },
  ring(intensity) {
    if (!ctx) return; const t = ctx.currentTime;
    osc(t, 3200, 3000, 1 + intensity * 2.5, 0.12 * intensity);
  },
  hiss() { if (ctx) noiseHit(ctx.currentTime, 3000, 1200, 1.8, 0.25, 'bandpass'); },
  clink(vol = 0.5) { if (ctx) { const t = ctx.currentTime; osc(t, 1900 + Math.random() * 600, 0, 0.08, 0.1 * vol, 'triangle'); } },
  pin() { if (ctx) { const t = ctx.currentTime; osc(t, 2400, 0, 0.04, 0.1, 'square'); osc(t + 0.08, 1500, 0, 0.05, 0.08, 'square'); } },
  whoosh() { if (ctx) noiseHit(ctx.currentTime, 1500, 400, 0.18, 0.35, 'bandpass'); },
  stab() { if (ctx) { const t = ctx.currentTime; noiseHit(t, 900, 200, 0.12, 0.5); osc(t, 140, 60, 0.1, 0.4); } },
  hit() { if (ctx) osc(ctx.currentTime, 1800, 0, 0.05, 0.08, 'square'); },
  head() { if (ctx) { const t = ctx.currentTime; osc(t, 2400, 0, 0.06, 0.12, 'square'); osc(t, 3200, 0, 0.08, 0.1); } },
  kill() { if (ctx) { const t = ctx.currentTime; osc(t, 660, 0, 0.09, 0.2, 'triangle'); osc(t + 0.07, 990, 0, 0.14, 0.2, 'triangle'); } },
  coin() { if (ctx) { const t = ctx.currentTime; osc(t, 1320, 0, 0.08, 0.18); osc(t + 0.06, 1760, 0, 0.12, 0.18); } },
  heal() { if (ctx) osc(ctx.currentTime, 520, 880, 0.25, 0.2); },
  jump() { if (ctx) osc(ctx.currentTime, 180, 720, 0.35, 0.3, 'triangle'); },
  hurt() { if (ctx) osc(ctx.currentTime, 160, 80, 0.15, 0.15, 'sawtooth'); },
  click() { if (ctx) osc(ctx.currentTime, 900, 0, 0.03, 0.08, 'square'); },
  reload() { if (ctx) { const t = ctx.currentTime; osc(t, 400, 0, 0.05, 0.08, 'square'); osc(t + 0.26, 300, 0, 0.06, 0.08, 'square'); } },
  wave() { if (ctx) { const t = ctx.currentTime; [440, 554, 659, 880].forEach((f, i) => osc(t + i * 0.09, f, 0, 0.2, 0.18, 'triangle')); } },
  win() { if (ctx) { const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => osc(t + i * 0.12, f, 0, 0.35, 0.2, 'triangle')); } },
  lose() { if (ctx) { const t = ctx.currentTime; [392, 330, 262].forEach((f, i) => osc(t + i * 0.18, f, 0, 0.4, 0.18, 'triangle')); } },
  od() { if (ctx) osc(ctx.currentTime, 120, 900, 0.6, 0.25, 'sawtooth'); },
};
