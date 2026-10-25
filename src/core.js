import * as THREE from 'three';
import { store } from './util.js';

export const isTouch = matchMedia('(pointer: coarse)').matches;

export const settings = Object.assign(
  { sens: 1, fov: 78, vol: 70, gfx: isTouch ? 'low' : 'high', fps: false, nick: '' },
  store.json('msf_settings', {})
);
export function saveSettings() { store.setJson('msf_settings', settings); }

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.getElementById('game').appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcdb9a2, 45, 135);

export const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

export const vmScene = new THREE.Scene();
export const vmCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
vmScene.add(new THREE.HemisphereLight(0xfff1dc, 0x5a4a3a, 0.9));
const vmSun = new THREE.DirectionalLight(0xffe0b8, 1.3);
vmSun.position.set(1, 2, 1);
vmScene.add(vmSun);
vmScene.add(vmCam);

scene.add(new THREE.HemisphereLight(0xc4dcff, 0x8a6c52, 0.7));
export const sun = new THREE.DirectionalLight(0xffe2bd, 1.75);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -58, right: 58, top: 58, bottom: -58, near: 1, far: 150 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

export function applyGfx() {
  const pr = { low: 1, mid: 1.25, high: 1.75 }[settings.gfx] || 1.25;
  renderer.setPixelRatio(Math.min(devicePixelRatio, pr));
  const sz = { low: 1024, mid: 2048, high: 2048 }[settings.gfx] || 2048;
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.mapSize.set(sz, sz);
  renderer.setSize(innerWidth, innerHeight);
}
applyGfx();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = vmCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  vmCam.updateProjectionMatrix();
});
