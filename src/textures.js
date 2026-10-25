import * as THREE from 'three';
import { rand, pick } from './util.js';

export function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  t.anisotropy = 8;
  return t;
}
function speckle(g, w, h, n, cols, smin, smax) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = pick(cols);
    const s = rand(smin, smax);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

export const texConcrete = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8c857b'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.07)', 'rgba(60,50,40,.1)'], 1, 3);
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(40,30,20,.06)'; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(10, 40), 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(30,25,20,.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
}, [24, 24]);

export function wallTex(rep) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#9a9286'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 3000, ['rgba(0,0,0,.07)', 'rgba(255,255,255,.06)'], 1, 3);
    g.fillStyle = 'rgba(60,40,25,.18)';
    for (let x = 0; x < w; x += 64) { g.fillRect(x, 0, 2, h); g.fillRect(x + 28, h * 0.6, 6, h * 0.4); }
    g.fillStyle = 'rgba(255,180,59,.85)'; g.fillRect(0, h - 16, w, 6);
  }, rep);
}

export function containerTex(base) {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 9, 0, 4, h); }
    for (let i = 0; i < 22; i++) { g.fillStyle = 'rgba(95,50,20,' + rand(0.05, 0.2) + ')'; g.fillRect(Math.random() * w, rand(0, h * 0.4), rand(2, 6), rand(20, 90)); }
    speckle(g, w, h, 800, ['rgba(0,0,0,.12)'], 1, 2);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  }, [1, 1]);
}

export const texCrate = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#8a6a43'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 21) {
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, w, 2);
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(60,35,15,.25)'; g.fillRect(Math.random() * w, y + rand(3, 18), rand(8, 30), 1); }
  }
  g.strokeStyle = '#5b4228'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
  g.lineWidth = 10; g.beginPath(); g.moveTo(10, 10); g.lineTo(w - 10, h - 10); g.stroke();
  g.fillStyle = 'rgba(20,15,10,.6)'; g.font = 'bold 14px monospace'; g.fillText('MS-07', 40, 70);
});

export const texSand = canvasTex(128, 64, (g, w, h) => {
  g.fillStyle = '#6f6347'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = -1; c < 4; c++) {
    const x = c * 36 + (r % 2 ? 18 : 0), y = r * 16;
    g.fillStyle = r % 2 ? '#a2926b' : '#988862'; g.fillRect(x + 2, y + 2, 32, 13);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 4, y + 11, 28, 3);
  }
  speckle(g, w, h, 600, ['rgba(0,0,0,.15)', 'rgba(255,255,255,.08)'], 1, 2);
}, [2, 1]);

export function camoTex(cols) {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = cols[0]; g.fillRect(0, 0, w, h);
    for (let k = 1; k < cols.length; k++) for (let i = 0; i < 18; i++) {
      g.fillStyle = cols[k]; g.beginPath();
      const x = Math.random() * w, y = Math.random() * h;
      for (let a = 0; a < 7; a++) { const r = rand(5, 14), t = (a / 7) * 6.283; g.lineTo(x + Math.cos(t) * r * 1.6, y + Math.sin(t) * r); }
      g.closePath(); g.fill();
    }
    speckle(g, w, h, 900, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.05)'], 1, 2);
  }, [2, 2]);
}

export const glowTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

export const flashTex = canvasTex(64, 64, (g) => {
  g.translate(32, 32);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    const gr = g.createLinearGradient(0, 0, 0, 30);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-5, 0); g.lineTo(0, 31); g.lineTo(5, 0); g.fill();
  }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 14);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = gr; g.fillRect(-14, -14, 28, 28);
});

export const smokeTex = canvasTex(128, 128, (g, w, h) => {
  for (let i = 0; i < 46; i++) {
    const x = 64 + rand(-32, 32), y = 64 + rand(-32, 32), r = rand(14, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, w, h);
});

export function labelTex(text, color) {
  const t = canvasTex(256, 64, (g, w, h) => {
    g.font = '700 30px "Noto Sans KR", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, w / 2, h / 2 - 4);
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 - 4);
    g.beginPath(); g.moveTo(w / 2 - 9, h - 12); g.lineTo(w / 2 + 9, h - 12); g.lineTo(w / 2, h - 2); g.closePath(); g.fill();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
