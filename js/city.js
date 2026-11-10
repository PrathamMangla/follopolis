import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const CFG = window.CITY_CONFIG;
const DATA = window.CITY_DATA;
const citizens = DATA.citizens;
const $ = s => document.querySelector(s);

// ---------- helpers ----------
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFrom = (arr, r) => arr[Math.floor(r() * arr.length)];
// only plain web links reach the page
const safeLink = url => (typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : '');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const LEVELS = ['', 'Hut', 'House', 'Villa', 'Mansion'];
const levelOf = c => { const n = c.comments || 0; return n >= 10 ? 4 : n >= 5 ? 3 : n >= 2 ? 2 : 1; };
const WALLS = ['#f4e9d8', '#fbf6ee', '#f6d7b8', '#cfe3ea', '#d9e6c8', '#f3cfd3', '#e9dcc0', '#d8d0ea'];
const ROOFS = ['#c4553a', '#8a4b3a', '#4d6a8f', '#3f6b4f', '#a8373c', '#6b4a7a', '#b8763c', '#5b5f6b'];
const PEOPLE = ['#ff6f91', '#ffb547', '#4fc1e9', '#8cd17d', '#b48ef0', '#f2f2f2', '#ff8a5b', '#5bd1b5'];

// ---------- renderer, scene, camera ----------
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const DAY_SKY = new THREE.Color('#9fd6f2'), NIGHT_SKY = new THREE.Color('#0d1430');
scene.background = DAY_SKY.clone();
scene.fog = new THREE.Fog(scene.background, 120, 420);

const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = 1.3;
controls.minDistance = 7;
controls.screenSpacePanning = false;
controls.autoRotateSpeed = 0.5;

const hemi = new THREE.HemisphereLight(0xdcefff, 0x5f7f3c, 1.5);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(hemi, sun, sun.target);

// ---------- shared geometry and materials ----------
const prismR = 1 / 1.5;
const G = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 12).translate(0, 0.5, 0),
  pyramid: new THREE.ConeGeometry(0.75, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  // triangular prism: ridge runs along x, 1 tall, ~1.15 wide
  prism: new THREE.CylinderGeometry(prismR, prismR, 1, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, prismR * 0.5, 0),
  ball: new THREE.IcosahedronGeometry(0.5, 1),
};
const matCache = {};
function mat(color, extra) {
  const key = color + (extra ? JSON.stringify(extra) : '');
  return matCache[key] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
}
// glowing things (windows, lamps) brighten at night
const glowMats = [];
function glow(color, nightColor = '#ffcf70') {
  const m = new THREE.MeshStandardMaterial({ color, emissive: nightColor, emissiveIntensity: 0, roughness: 0.6 });
  glowMats.push(m);
  return m;
}
function part(group, geo, color, x, y, z, sx, sy, sz, opt = {}) {
  const m = new THREE.Mesh(geo, opt.mat || mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (opt.ry) m.rotation.y = opt.ry;
  if (opt.rz) m.rotation.z = opt.rz;
  if (opt.rx) m.rotation.x = opt.rx;
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
const animations = [];   // functions called every frame with (time, dt, night)

// ---------- layout ----------
const CELL = 4, ROAD_EVERY = 3, PLAZA_R = 30, JOB_R = 19;
const ROAD_GAP = CELL * ROAD_EVERY;

function makeLots(n) {
  const R = Math.ceil((Math.sqrt(36 * Math.max(n, 1) / Math.PI) + PLAZA_R) / CELL) + 4;
  const lots = [];
  for (let gx = -R; gx <= R; gx++) for (let gz = -R; gz <= R; gz++) {
    if (gx % ROAD_EVERY === 0 || gz % ROAD_EVERY === 0) continue;
    const x = gx * CELL, z = gz * CELL, d = Math.hypot(x, z);
    if (d < PLAZA_R) continue;
    lots.push({ x, z, d, a: Math.atan2(z, x) });
  }
  lots.sort((a, b) => a.d - b.d || a.a - b.a);
  return lots;
}
const N = citizens.length;
const lots = makeLots(N);
const cityR = Math.max(PLAZA_R + 8, (N ? lots[N - 1].d : PLAZA_R) + CELL);

// ---------- ground, roads, plaza ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(1400, 64).rotateX(-Math.PI / 2), mat('#7fae4f'));
ground.receiveShadow = true;
scene.add(ground);
// a slightly brighter meadow under the city
const meadow = new THREE.Mesh(new THREE.CircleGeometry(cityR + 10, 64).rotateX(-Math.PI / 2), mat('#8bbb58'));
meadow.position.y = 0.01;
meadow.receiveShadow = true;
scene.add(meadow);

{
  const roadMat = mat('#d9c596');
  const roads = new THREE.Group();
  const lim = cityR + 2;
  for (let k = -Math.floor(lim / ROAD_GAP); k <= Math.floor(lim / ROAD_GAP); k++) {
    const p = k * ROAD_GAP, half = Math.sqrt(Math.max(0, lim * lim - p * p));
    if (half < 1) continue;
    const a = new THREE.Mesh(G.box, roadMat); a.scale.set(1.8, 0.04, half * 2); a.position.set(p, 0.01, 0);
    const b = new THREE.Mesh(G.box, roadMat); b.scale.set(half * 2, 0.04, 1.8); b.position.set(0, 0.012, p);
    a.receiveShadow = b.receiveShadow = true;
    roads.add(a, b);
  }
  scene.add(roads);

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA_R - 3, PLAZA_R - 3, 0.12, 64), mat('#e2d6bd'));
  plaza.position.y = 0.06;
  plaza.receiveShadow = true;
  scene.add(plaza);
  const ring = new THREE.Mesh(new THREE.RingGeometry(9, 10.2, 48).rotateX(-Math.PI / 2), mat('#cbbd9f'));
  ring.position.y = 0.13;
  scene.add(ring);
}

// fountain at the centre
{
  const f = new THREE.Group();
  part(f, G.cyl, '#bfb6a6', 0, 0, 0, 7, 0.8, 7);
  const water = part(f, G.cyl, '#5fb8e6', 0, 0.8, 0, 6.2, 0.05, 6.2, { mat: mat('#5fb8e6', { roughness: 0.2, metalness: 0.1 }) });
  part(f, G.cyl, '#bfb6a6', 0, 0, 0, 1, 2.6, 1);
  part(f, G.cyl, '#bfb6a6', 0, 2.6, 0, 3, 0.35, 3);
  const jet = part(f, G.ball, '#bfe7fb', 0, 3.3, 0, 1, 1.2, 1, { mat: mat('#bfe7fb', { transparent: true, opacity: 0.8 }) });
  animations.push(t => { jet.scale.y = 1.1 + Math.sin(t * 4) * 0.25; water.position.y = 0.8 + Math.sin(t * 2) * 0.02; });
  scene.add(f);

  // lamps around the plaza
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, lamp = new THREE.Group();
    part(lamp, G.cyl, '#3b3b46', 0, 0, 0, 0.18, 2.6, 0.18);
    part(lamp, G.ball, '#fff', 0, 2.75, 0, 0.55, 0.55, 0.55, { mat: glow('#fff6dc', '#ffd27a') });
    lamp.position.set(Math.cos(a) * (PLAZA_R - 4.5), 0, Math.sin(a) * (PLAZA_R - 4.5));
    scene.add(lamp);
  }
  // round trees inside the plaza
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * Math.PI * 2, t = new THREE.Group();
    part(t, G.cyl, '#7a5638', 0, 0, 0, 0.35, 1.4, 0.35);
    part(t, G.ball, '#4f9a45', 0, 2.2, 0, 2.4, 2.2, 2.4);
    t.position.set(Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5);
    scene.add(t);
  }
}

// ---------- job buildings ----------
const jobCount = {};
for (const c of citizens) { const t = jobType(c.job); if (t) jobCount[t.id] = (jobCount[t.id] || 0) + 1; }

function roofHouse(g, wall, roof, w, h, d, x = 0, z = 0) {
  part(g, G.box, wall, x, 0, z, w, h, d);
  part(g, G.prism, roof, x, h, z, w * 1.08, h * 0.55, d / 1.15 * 1.1);
}
const BUILDERS = {
  bakery(g) {
    roofHouse(g, '#f6d7b8', '#a8373c', 5, 3, 4);
    part(g, G.box, '#7a5a48', 1.4, 3, -0.6, 0.6, 2.4, 0.6);
    for (let i = 0; i < 5; i++) part(g, G.box, i % 2 ? '#fff' : '#e85d5d', -2 + i, 2.1, 2.2, 1, 0.12, 0.9, { rx: 0.35 });
    part(g, G.box, '#fff', 0, 0, 2.05, 1.2, 1.9, 0.1, { mat: glow('#ffe8b0') });
  },
  fire(g, t) {
    part(g, G.box, '#d9483b', 0, 0, 0, 6, 3.4, 4.5);
    part(g, G.box, '#f2efe8', 0, 3.4, 0, 6.3, 0.3, 4.8);
    part(g, G.box, '#4a4a55', -1.4, 0, 2.27, 2.2, 2.4, 0.05);
    part(g, G.box, '#4a4a55', 1.4, 0, 2.27, 2.2, 2.4, 0.05);
    part(g, G.box, '#d9483b', 2.3, 3.4, -1.3, 1.4, 3, 1.4);
    const siren = part(g, G.ball, '#f00', 2.3, 6.6, -1.3, 0.6, 0.6, 0.6, { mat: glow('#ff3b3b', '#ff2020') });
    animations.push(tt => { siren.material.emissiveIntensity = Math.max(siren.material.emissiveIntensity, (Math.sin(tt * 6) > 0) * 1.5); });
  },
  tower(g) {
    part(g, G.cyl, '#7a68c9', 0, 0, 0, 3.2, 9, 3.2);
    part(g, G.cone, '#3b2b78', 0, 9, 0, 4.2, 4.5, 4.2);
    part(g, G.box, '#000', 0, 5, 1.55, 0.7, 1.2, 0.2, { mat: glow('#c9b8ff', '#a98bff') });
    const star = part(g, G.ball, '#ffe066', 0, 14.2, 0, 0.9, 0.9, 0.9, { mat: glow('#ffe066', '#ffd000') });
    animations.push(t => { star.position.y = 14.2 + Math.sin(t * 2) * 0.3; star.rotation.y = t; });
  },
  harbour(g) {
    part(g, G.cyl, '#4c9fd6', 0, 0, 1, 11, 0.06, 7, { mat: mat('#4c9fd6', { roughness: 0.25 }) });
    part(g, G.box, '#9a7048', 0, 0, -1.5, 3, 0.5, 7);
    const boat = new THREE.Group();
    part(boat, G.box, '#8a4b3a', 0, 0, 0, 1.6, 0.8, 3.6);
    part(boat, G.cyl, '#5a3a2a', 0, 0.8, 0, 0.15, 3.6, 0.15);
    part(boat, G.box, '#fbf6ee', 0, 1.6, 0.25, 0.08, 2.2, 1.5);
    boat.position.set(-3.2, 0, 2.4);
    g.add(boat);
    animations.push(t => { boat.rotation.z = Math.sin(t * 1.4) * 0.06; boat.position.y = Math.sin(t * 1.8) * 0.08; });
    part(g, G.cyl, '#f2efe8', 3.5, 0, -2.5, 1.6, 5.5, 1.6);
    part(g, G.cyl, '#d9483b', 3.5, 1.5, -2.5, 1.65, 1, 1.65);
    part(g, G.cyl, '#d9483b', 3.5, 3.6, -2.5, 1.65, 1, 1.65);
    part(g, G.ball, '#fff', 3.5, 6, -2.5, 1.1, 1.1, 1.1, { mat: glow('#fff6c8', '#ffe27a') });
  },
  farm(g) {
    roofHouse(g, '#b5372f', '#4d3a32', 4, 3, 3.2, -2, -1.2);
    part(g, G.cyl, '#c9c3b6', 1.6, 0, -1.6, 1.8, 5, 1.8);
    part(g, G.cone, '#5b5f6b', 1.6, 5, -1.6, 2, 1.2, 2);
    for (let i = 0; i < 5; i++) part(g, G.box, i % 2 ? '#d9c04a' : '#b99a35', -3.5 + i * 1.6, 0, 3, 1.4, 0.4, 3);
    const mill = new THREE.Group();
    for (let i = 0; i < 4; i++) part(mill, G.box, '#efe6d2', 0, 0, 0, 0.3, 2.6, 0.06, { rz: i * Math.PI / 2 });
    mill.position.set(-2, 4.2, 0.45);
    g.add(mill);
    animations.push((t, dt) => { mill.rotation.z += dt * 1.2; });
  },
  hospital(g) {
    part(g, G.box, '#f4f4f2', 0, 0, 0, 5.5, 5, 4);
    part(g, G.box, '#d8dde3', 0, 5, 0, 5.8, 0.3, 4.3);
    part(g, G.box, '#e03a3a', 0, 3.2, 2.02, 0.5, 1.6, 0.06);
    part(g, G.box, '#e03a3a', 0, 3.75, 2.02, 1.6, 0.5, 0.06);
    for (const x of [-1.8, 1.8]) for (const y of [1.2, 3]) part(g, G.box, '#000', x, y, 2.02, 1, 0.8, 0.05, { mat: glow('#8fb6d3') });
  },
  rocket(g) {
    part(g, G.cyl, '#8a8f99', 0, 0, 0, 6, 0.5, 6);
    const r = new THREE.Group();
    part(r, G.cyl, '#f2f2f2', 0, 0, 0, 1.6, 6, 1.6);
    part(r, G.cone, '#e03a3a', 0, 6, 0, 1.6, 2.2, 1.6);
    part(r, G.ball, '#4fc1e9', 0, 4.3, 0.75, 0.6, 0.6, 0.3);
    for (let i = 0; i < 3; i++) part(r, G.box, '#e03a3a', Math.cos(i * 2.09) * 0.9, 0, Math.sin(i * 2.09) * 0.9, 0.12, 1.6, 0.9, { ry: -i * 2.09 });
    const flame = part(r, G.cone, '#ffb547', 0, -1.2, 0, 1.1, 1.4, 1.1, { mat: glow('#ffb547', '#ff7a00'), rx: Math.PI });
    flame.position.y = 0;
    r.position.y = 0.5;
    g.add(r);
    // the rocket lifts off for a few seconds every minute
    animations.push(t => {
      const p = (t % 60) / 60;
      const lift = p > 0.85 ? Math.pow((p - 0.85) / 0.15, 2) * 60 : 0;
      r.position.y = 0.5 + lift;
      flame.visible = p > 0.82;
      flame.scale.y = 1.4 + Math.sin(t * 30) * 0.3;
      flame.material.emissiveIntensity = 2;
    });
  },
  haunted(g) {
    const h = new THREE.Group();
    part(h, G.box, '#4a3b5c', 0, 0, 0, 4, 4.2, 3.4);
    part(h, G.pyramid, '#241c30', 0, 4.2, 0, 4.4, 3.2, 3.8);
    part(h, G.box, '#4a3b5c', 1.3, 4, 0.6, 1.2, 2.6, 1.2);
    part(h, G.pyramid, '#241c30', 1.3, 6.6, 0.6, 1.6, 1.8, 1.6);
    for (const x of [-1, 1]) part(h, G.box, '#000', x, 2.4, 1.72, 0.7, 0.9, 0.05, { mat: glow('#3a2a50', '#9d5cff') });
    h.rotation.z = 0.05;
    g.add(h);
    const ghost = part(g, G.ball, '#fff', -2.6, 3, 1.5, 1, 1.3, 1, { mat: mat('#ffffff', { transparent: true, opacity: 0.75 }) });
    animations.push(t => { ghost.position.y = 3 + Math.sin(t * 1.5) * 0.6; ghost.position.x = -2.6 + Math.sin(t * 0.7) * 0.8; });
  },
  castle(g) {
    part(g, G.box, '#b9b3a8', 0, 0, 0, 7, 3.4, 5.5);
    part(g, G.box, '#a8a196', 0, 0, 0, 3.4, 6, 3);
    part(g, G.pyramid, '#3f4a8a', 0, 6, 0, 3.8, 3, 3.4);
    for (const [x, z] of [[-3.5, -2.75], [3.5, -2.75], [-3.5, 2.75], [3.5, 2.75]]) {
      part(g, G.cyl, '#c4bfb4', x, 0, z, 1.8, 5, 1.8);
      part(g, G.cone, '#3f4a8a', x, 5, z, 2.2, 2.4, 2.2);
    }
    part(g, G.box, '#5a3a2a', 0, 0, 2.77, 1.4, 2.2, 0.05);
    part(g, G.cyl, '#5a3a2a', 0, 9, 0, 0.1, 2.4, 0.1);
    const flag = part(g, G.box, '#ffb547', 0.6, 10.6, 0, 1.2, 0.7, 0.05);
    animations.push(t => { flag.rotation.y = Math.sin(t * 3) * 0.25; });
  },
  restaurant(g) {
    roofHouse(g, '#f3cfd3', '#c4553a', 4.5, 2.8, 3.2, 0, -1);
    for (const x of [-2, 0, 2]) {
      part(g, G.cyl, '#fff', x, 0, 2.4, 0.9, 0.8, 0.9);
      part(g, G.cyl, '#555', x, 0.8, 2.4, 0.08, 1.4, 0.08);
      part(g, G.cone, x === 0 ? '#ffb547' : '#e85d5d', x, 2.1, 2.4, 1.9, 0.6, 1.9);
    }
    part(g, G.box, '#000', 0, 0.9, 0.62, 2.4, 1.2, 0.05, { mat: glow('#ffd9a0') });
  },
  school(g) {
    roofHouse(g, '#e6a35a', '#7a3b2a', 7, 3, 3.6);
    part(g, G.box, '#e6a35a', 0, 3, 0, 1.6, 3, 1.6);
    part(g, G.pyramid, '#7a3b2a', 0, 6, 0, 2, 1.8, 2);
    part(g, G.ball, '#ffd36b', 0, 4.4, 0.8, 0.7, 0.7, 0.3);
    for (const x of [-2.6, -1.2, 1.2, 2.6]) part(g, G.box, '#000', x, 1.2, 1.82, 0.8, 0.9, 0.05, { mat: glow('#9cc3dd') });
  },
  police(g) {
    part(g, G.box, '#2f4f8f', 0, 0, 0, 5.2, 3.4, 4);
    part(g, G.box, '#e7ebf3', 0, 3.4, 0, 5.5, 0.3, 4.3);
    part(g, G.box, '#e7ebf3', 0, 2.2, 2.02, 3.2, 0.6, 0.05);
    const red = part(g, G.box, '#f00', -0.5, 3.7, 0, 0.8, 0.4, 0.5, { mat: glow('#ff4040', '#ff0000') });
    const blue = part(g, G.box, '#00f', 0.5, 3.7, 0, 0.8, 0.4, 0.5, { mat: glow('#4060ff', '#2050ff') });
    animations.push(t => { const on = Math.sin(t * 8) > 0; red.material.emissiveIntensity = on ? 2 : 0.1; blue.material.emissiveIntensity = on ? 0.1 : 2; });
  },
  dragon(g) {
    part(g, G.ball, '#6b6259', 0, -1, 0, 9, 5, 7.5);
    part(g, G.ball, '#2a2420', 0, 0.4, 3, 2.6, 2.2, 1);
    const d = new THREE.Group();
    part(d, G.ball, '#3a8f4f', 0, 0, 0, 1.8, 1.4, 3.2);
    part(d, G.box, '#3a8f4f', 0, 0.3, 1.6, 0.6, 0.6, 1.6, { rx: -0.6 });
    part(d, G.ball, '#3a8f4f', 0, 1.3, 2.6, 1, 0.8, 1.3);
    part(d, G.ball, '#ffdd33', 0.3, 1.55, 2.95, 0.2, 0.2, 0.2);
    part(d, G.ball, '#ffdd33', -0.3, 1.55, 2.95, 0.2, 0.2, 0.2);
    part(d, G.cone, '#3a8f4f', 0, -0.1, -2.6, 0.6, 2, 0.6, { rx: -Math.PI / 2 });
    const wl = new THREE.Group(), wr = new THREE.Group();
    part(wl, G.box, '#2c6e3c', 1.7, 0, 0, 3.4, 0.08, 2.2);
    part(wr, G.box, '#2c6e3c', -1.7, 0, 0, 3.4, 0.08, 2.2);
    wl.position.set(0.6, 0.4, 0); wr.position.set(-0.6, 0.4, 0);
    d.add(wl, wr);
    g.add(d);
    animations.push(t => {
      const f = Math.sin(t * 5) * 0.6;
      wl.rotation.z = f; wr.rotation.z = -f;
      const a = t * 0.35;
      d.position.set(Math.cos(a) * 7, 11 + Math.sin(t * 1.3) * 1.2, Math.sin(a) * 7);
      d.rotation.y = -a;
    });
  },
  stage(g) {
    part(g, G.box, '#3b3346', 0, 0, 0, 7, 1, 4);
    part(g, G.box, '#251f2e', 0, 1, -1.8, 7, 4, 0.4);
    part(g, G.box, '#251f2e', 0, 5, -0.4, 7.4, 0.3, 3.4);
    for (const x of [-3, 3]) part(g, G.box, '#111', x, 1, 0.6, 1, 1.6, 1);
    const lights = [];
    for (let i = 0; i < 5; i++) lights.push(part(g, G.ball, '#fff', -2.4 + i * 1.2, 4.7, 1, 0.5, 0.5, 0.5, { mat: glow('#ffffff', '#ffffff') }));
    const cols = ['#ff4fa3', '#4fd1ff', '#ffd34f', '#7cff6b', '#b46bff'];
    animations.push(t => lights.forEach((l, i) => {
      l.material.emissive.set(cols[(i + Math.floor(t * 2)) % cols.length]);
      l.material.emissiveIntensity = 1.6;
    }));
  },
  workshop(g) {
    roofHouse(g, '#a07a55', '#5b4636', 4.6, 3, 3.6);
    part(g, G.box, '#5b4636', 0, 0, 1.82, 1.6, 2, 0.05);
    part(g, G.box, '#7a5a48', 1.5, 3, -0.8, 0.6, 2.6, 0.6);
    part(g, G.box, '#c9a67a', -3, 0, 1, 1.2, 1, 1.2);
    part(g, G.box, '#c9a67a', -3, 1, 1, 1, 0.8, 1, { ry: 0.4 });
  },
};

const buildings = {};   // type id -> { pos, label }
JOB_TYPES.forEach((type, i) => {
  if (!jobCount[type.id]) return;
  const a = i / JOB_TYPES.length * Math.PI * 2 + 0.2;
  const g = new THREE.Group();
  BUILDERS[type.id](g, type);
  g.position.set(Math.cos(a) * JOB_R, 0, Math.sin(a) * JOB_R);
  g.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));   // face the fountain
  const s = 0.9 + Math.min(jobCount[type.id], 30) / 60;     // busier buildings grow a little
  g.scale.setScalar(s);
  scene.add(g);
  const door = new THREE.Vector3(Math.cos(a) * (JOB_R - 4.5), 0, Math.sin(a) * (JOB_R - 4.5));
  buildings[type.id] = { pos: g.position.clone(), door, type, top: (type.id === 'tower' ? 15 : type.id === 'dragon' ? 9 : 8) * s };
});

// ---------- citizen houses (instanced so thousands stay fast) ----------
const SIZES = [null,
  { w: 1.7, h: 1.2, d: 1.5, rh: 0.8 },
  { w: 2.2, h: 1.5, d: 1.8, rh: 1.0 },
  { w: 2.4, h: 2.0, d: 2.0, rh: 1.1, wing: true },
  { w: 2.8, h: 2.7, d: 2.3, rh: 1.3, wing: true },
];
const cap = Math.max(N, 1);
const white = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.85, flatShading: true });
const inst = geo => { const m = new THREE.InstancedMesh(geo, white, cap); m.castShadow = m.receiveShadow = true; m.count = N; scene.add(m); return m; };
const H = {
  body: inst(G.box), roof: inst(G.prism), wing: inst(G.box), wingRoof: inst(G.prism), chimney: inst(G.box),
  door: new THREE.InstancedMesh(G.box, mat('#6b4a35'), cap),
  win: new THREE.InstancedMesh(G.box, glow('#3d4a5c'), cap),
};
H.door.count = H.win.count = N;
scene.add(H.door, H.win);
// shop signs for citizens who added a business
H.signPost = inst(G.box);
H.signBoard = new THREE.InstancedMesh(G.box, glow('#ffffff', '#ffe2a8'), cap);
H.signBoard.count = N;
H.signBoard.castShadow = true;
scene.add(H.signBoard);
const SIGN_COLORS = ['#ff6f91', '#4fc1e9', '#8cd17d', '#b48ef0', '#ff8a5b', '#5bd1b5'];

const M = new THREE.Matrix4(), L = new THREE.Matrix4(), OUT = new THREE.Matrix4(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const col = new THREE.Color();
function setPart(mesh, i, ox, oy, oz, sx, sy, sz, color) {
  L.compose(v.set(ox, oy, oz), q.identity(), sc.set(sx, sy, sz));
  OUT.multiplyMatrices(M, L);
  mesh.setMatrixAt(i, OUT);
  if (color) mesh.setColorAt(i, col.set(color));
}

citizens.forEach((c, i) => {
  const lot = lots[i], r = rng(hash(c.name));
  const lv = levelOf(c), S = SIZES[lv];
  const x = lot.x + (r() - 0.5) * 0.5, z = lot.z + (r() - 0.5) * 0.5;
  const rot = Math.floor(r() * 4) * Math.PI / 2;
  c._i = i; c._lv = lv;
  c._pos = new THREE.Vector3(x, 0, z);
  c._top = S.h + S.rh + 0.6;
  c._wall = pickFrom(WALLS, r);
  c._roof = pickFrom(ROOFS, r);
  M.compose(c._pos, q.setFromAxisAngle(up, rot), sc.set(1, 1, 1));
  setPart(H.body, i, 0, 0, 0, S.w, S.h, S.d, c._wall);
  setPart(H.roof, i, 0, S.h, 0, S.w * 1.1, S.rh, S.d / 1.15 * 1.12, c._roof);
  setPart(H.chimney, i, -S.w * 0.28, S.h, -S.d * 0.18, 0.28, S.rh * 0.95, 0.28, '#7a5a48');
  setPart(H.door, i, S.w * 0.22, 0, S.d / 2, 0.38, Math.min(0.85, S.h * 0.65), 0.06);
  setPart(H.win, i, -S.w * 0.18, S.h * 0.4, S.d / 2, S.w * 0.28, S.h * 0.28, 0.06);
  if (c.business) {
    const sx = -S.w * 0.5 - 0.15, sz = S.d / 2 + 0.55;
    setPart(H.signPost, i, sx, 0, sz, 0.1, 1.5, 0.1, '#5a3a2a');
    setPart(H.signBoard, i, sx, 1.15, sz, 1.1, 0.55, 0.1, c.featured ? '#ffb547' : SIGN_COLORS[hash(c.business) % SIGN_COLORS.length]);
  } else {
    H.signPost.setMatrixAt(i, ZERO); H.signBoard.setMatrixAt(i, ZERO);
    H.signPost.setColorAt(i, col.set('#fff')); H.signBoard.setColorAt(i, col.set('#fff'));
  }
  if (S.wing) {
    const wh = S.h * 0.62;
    setPart(H.wing, i, S.w / 2 + 0.5, 0, 0.15, 1.1, wh, S.d * 0.8, c._wall);
    setPart(H.wingRoof, i, S.w / 2 + 0.5, wh, 0.15, 1.2, S.rh * 0.7, S.d * 0.8 / 1.15 * 1.12, c._roof);
  } else {
    H.wing.setMatrixAt(i, ZERO); H.wingRoof.setMatrixAt(i, ZERO);
    H.wing.setColorAt(i, col.set('#fff')); H.wingRoof.setColorAt(i, col.set('#fff'));
  }
});
const pickable = [H.body, H.roof, H.wing, H.wingRoof, H.signBoard];

// ---------- forest around the edge ----------
{
  const count = 900, r = rng(7);
  const trunk = new THREE.InstancedMesh(G.cyl, mat('#6e4c32'), count);
  const leaves = new THREE.InstancedMesh(G.cone, white, count);
  trunk.castShadow = leaves.castShadow = true;
  const greens = ['#3f7d3a', '#4c8c3f', '#2f6b38', '#5c9a45'];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = cityR + 4 + Math.pow(r(), 0.7) * 70, s = 0.8 + r() * 0.9;
    M.compose(v.set(Math.cos(a) * d, 0, Math.sin(a) * d), q.identity(), sc.set(0.5 * s, 1.2 * s, 0.5 * s));
    trunk.setMatrixAt(i, M);
    M.compose(v.set(Math.cos(a) * d, 1.0 * s, Math.sin(a) * d), q.identity(), sc.set(2.6 * s, 3.8 * s, 2.6 * s));
    leaves.setMatrixAt(i, M);
    leaves.setColorAt(i, col.set(greens[i % greens.length]));
  }
  scene.add(trunk, leaves);
}

// clouds
const clouds = [];
{
  const r = rng(11), cm = mat('#ffffff', { transparent: true, opacity: 0.92 });
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) part(c, G.ball, '#fff', k * 2.4 - 3.6, r() * 0.8, r() * 1.6 - 0.8, 4 + r() * 2, 2.6 + r(), 3.4, { mat: cm });
    c.position.set((r() - 0.5) * 400, 45 + r() * 15, (r() - 0.5) * 400);
    c.children.forEach(m => m.castShadow = false);
    scene.add(c);
    clouds.push(c);
  }
}

// stars for the night sky
const stars = (() => {
  const r = rng(3), p = [];
  for (let i = 0; i < 1500; i++) {
    const a = r() * Math.PI * 2, e = 0.15 + r() * 1.3, R = 900;
    p.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(s);
  return s;
})();

// ---------- walking citizens ----------
const walkers = [];
{
  const working = citizens.filter(c => jobType(c.job) && buildings[jobType(c.job).id]);
  const chosen = working.slice(-350);
  for (const c of chosen) {
    const b = buildings[jobType(c.job).id];
    const r = rng(hash(c.name) ^ 99);
    const hx = c._pos.x, hz = c._pos.z;
    const roadX = Math.round(hx / ROAD_GAP) * ROAD_GAP;
    const roadZ = Math.round(b.door.z / ROAD_GAP) * ROAD_GAP;
    const pts = [new THREE.Vector3(hx, 0, hz), new THREE.Vector3(roadX, 0, hz), new THREE.Vector3(roadX, 0, roadZ), b.door.clone()];
    const lens = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); lens.push(l); total += l; }
    walkers.push({ c, pts, lens, total, speed: 2.2 + r() * 1.4, t: r() * 1000, color: pickFrom(PEOPLE, r) });
  }
}
const pBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.4, 2, 6).translate(0, 0.42, 0), white, Math.max(walkers.length, 1));
const pHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6).translate(0, 0.98, 0), mat('#f0c9a5'), Math.max(walkers.length, 1));
pBody.count = pHead.count = walkers.length;
pBody.castShadow = true;
walkers.forEach((w, i) => pBody.setColorAt(i, col.set(w.color)));
scene.add(pBody, pHead);
const wp = new THREE.Vector3();
function walkerPos(w, dist) {
  for (let i = 0; i < w.lens.length; i++) {
    if (dist <= w.lens[i]) return wp.lerpVectors(w.pts[i], w.pts[i + 1], dist / (w.lens[i] || 1));
    dist -= w.lens[i];
  }
  return wp.copy(w.pts[w.pts.length - 1]);
}
const prev = new THREE.Vector3();
function updateWalkers(time, dt) {
  walkers.forEach((w, i) => {
    w.t += dt * w.speed;
    const dwell = 6, cycle = w.total * 2 + dwell * 2;
    const p = w.t % cycle;
    let d = p < w.total ? p : p < w.total + dwell ? w.total : p < w.total * 2 + dwell ? w.total * 2 + dwell - p : 0;
    const moving = p < w.total || (p > w.total + dwell && p < w.total * 2 + dwell);
    prev.copy(walkerPos(w, Math.max(0, d - 0.05)));
    const pos = walkerPos(w, d);
    const dir = Math.atan2(pos.x - prev.x, pos.z - prev.z) + (p > w.total ? Math.PI : 0);
    const bob = moving ? Math.abs(Math.sin(w.t * 5)) * 0.12 : 0;
    M.compose(v.set(pos.x, bob, pos.z), q.setFromAxisAngle(up, dir), sc.set(1, 1, 1));
    pBody.setMatrixAt(i, M);
    pHead.setMatrixAt(i, M);
  });
  pBody.instanceMatrix.needsUpdate = pHead.instanceMatrix.needsUpdate = true;
}

// ---------- selection marker ----------
const marker = new THREE.Group();
part(marker, G.cone, '#ff6f91', 0, 0, 0, 1, 1.6, 1, { rx: Math.PI, mat: glow('#ff6f91', '#ff3d77') });
const ringM = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff6f91', transparent: true, opacity: 0.8 }));
scene.add(marker, ringM);
marker.visible = ringM.visible = false;

// ---------- camera framing ----------
const homeView = () => ({ target: new THREE.Vector3(0, 0, 0), pos: new THREE.Vector3(0, cityR * 1.15 + 30, cityR * 1.25 + 40) });
controls.maxDistance = cityR * 3 + 150;
{ const h = homeView(); camera.position.copy(h.pos); controls.target.copy(h.target); }
let fly = null;
function flyTo(target, distance = 32) {
  const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
  if (!isFinite(dir.x) || dir.lengthSq() < 0.1) dir.set(0, 0, 1);
  const pos = target.clone().addScaledVector(dir, distance * 0.8).setY(distance * 0.75);
  fly = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: target.clone(), toP: pos };
}

// ---------- labels ----------
const labelBox = $('#labels');
const labelPool = [];
for (let i = 0; i < 45; i++) { const el = document.createElement('div'); el.className = 'lbl'; el.style.display = 'none'; labelBox.appendChild(el); labelPool.push(el); }
const bldLabels = Object.values(buildings).map(b => {
  const el = document.createElement('div');
  el.className = 'lbl bld';
  labelBox.appendChild(el);
  return { el, pos: b.pos.clone().setY(b.top), long: `${b.type.emoji} ${b.type.label} · ${jobCount[b.type.id]}`, short: b.type.emoji };
});
const selLabel = document.createElement('div');
selLabel.className = 'lbl sel';
selLabel.style.display = 'none';
labelBox.appendChild(selLabel);

let showNames = true, nearby = [], frame = 0;
const proj = new THREE.Vector3();
function placeLabel(el, world, minScale = 0.7) {
  proj.copy(world).project(camera);
  if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) { el.style.display = 'none'; return; }
  const x = (proj.x + 1) / 2 * innerWidth, y = (1 - proj.y) / 2 * innerHeight;
  const dist = camera.position.distanceTo(world);
  const s = Math.max(minScale, Math.min(1.1, 40 / dist));
  el.style.display = '';
  el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${s})`;
}
function updateLabels() {
  if (frame++ % 8 === 0) {
    nearby = [];
    if (showNames) {
      const camDist = camera.position.distanceTo(controls.target);
      const maxD = Math.min(90, camDist * 1.3);
      for (const c of citizens) {
        const d = c._pos.distanceTo(controls.target);
        if (d < maxD && c !== selected) nearby.push([d, c]);
      }
      nearby.sort((a, b) => a[0] - b[0]);
      nearby = nearby.slice(0, camDist < 70 ? labelPool.length : 18).map(x => x[1]);
    }
  }
  labelPool.forEach((el, i) => {
    const c = nearby[i];
    if (!c) { el.style.display = 'none'; return; }
    if (el._c !== c) {
      el._c = c;
      el.innerHTML = esc(c.name) + (c.business ? ` <span class="lbl-biz">· 🏪 ${esc(c.business)}</span>` : '');
    }
    placeLabel(el, v.copy(c._pos).setY(c._top));
  });
  // zoomed out, building labels shrink to just their emoji so they don't pile up
  const far = camera.position.distanceTo(controls.target) > 110;
  bldLabels.forEach(b => {
    if (b.far !== far) { b.far = far; b.el.textContent = far ? b.short : b.long; }
    placeLabel(b.el, b.pos, 0.75);
  });
  if (selected) placeLabel(selLabel, v.copy(selected._pos).setY(selected._top + 2.4), 0.9);
}

// ---------- day / night ----------
let timeMode = 'auto';   // auto follows the viewer's clock
let night = 0;
const nightTarget = () => {
  if (timeMode === 'day') return 0;
  if (timeMode === 'night') return 1;
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h >= 19.5 || h < 6 ? 1 : h >= 18 ? (h - 18) / 1.5 : h < 7 ? 1 - (h - 6) : 0;
};
const dayFog = new THREE.Color(), tmp = new THREE.Color();
function updateSky(dt) {
  night += (nightTarget() - night) * Math.min(1, dt * 2);
  scene.background.copy(DAY_SKY).lerp(NIGHT_SKY, night);
  scene.fog.color.copy(scene.background);
  hemi.intensity = 1.5 - night * 1.15;
  sun.intensity = 2.6 - night * 2.25;
  sun.color.copy(tmp.set('#fff0d0')).lerp(dayFog.set('#8fa6ff'), night);
  // animated lights (sirens, stage) run after this and override their own glow
  glowMats.forEach(m => m.emissiveIntensity = night * 1.6);
  stars.material.opacity = night;
}

// ---------- shadow camera follows the view ----------
function updateSun() {
  const t = controls.target;
  sun.position.set(t.x + 60, 90, t.z + 40);
  sun.target.position.copy(t);
  const span = Math.min(cityR + 20, Math.max(40, camera.position.distanceTo(t) * 0.9));
  const sc2 = sun.shadow.camera;
  if (sc2.right !== span) { sc2.left = -span; sc2.right = span; sc2.top = span; sc2.bottom = -span; sc2.near = 1; sc2.far = 400; sc2.updateProjectionMatrix(); }
}

// ---------- UI ----------
let selected = null;
const working = citizens.filter(c => c.job).length;
document.title = `${CFG.name} · built by followers`;
$('#city-name').textContent = CFG.name;
$('#city-tagline').textContent = CFG.tagline;
$('#stat-day').textContent = DATA.day;
$('#stat-citizens').textContent = N.toLocaleString();
$('#stat-jobs').textContent = working.toLocaleString();
document.querySelectorAll('.handle').forEach(e => e.textContent = '@' + CFG.instagram);
$('#follow-btn').href = `https://www.instagram.com/${CFG.instagram}/`;
$('#reel-day').textContent = `Day ${DATA.day}`;
$('#reel-name').textContent = `${CFG.name} · ${N.toLocaleString()} citizens`;

// feed
$('#feed').innerHTML = (DATA.events || []).slice().sort((a, b) => b.day - a.day)
  .map(e => `<li><span class="chip">Day ${e.day}</span>${esc(e.text)}</li>`).join('') || '<li>Nothing yet. The city is waiting for its first citizens.</li>';

// jobs leaderboard
{
  const rows = Object.entries(jobCount).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  $('#jobs').innerHTML = rows.map(([id, n]) => {
    const t = JOB_TYPES.find(x => x.id === id);
    return `<li data-b="${id}"><div class="bar-row"><span>${t.emoji} ${t.label}</span><b>${n}</b></div><div class="bar"><i style="width:${n / max * 100}%"></i></div></li>`;
  }).join('') || '<li>No jobs yet. Comment a job to start one!</li>';
  $('#jobs').addEventListener('click', e => {
    const li = e.target.closest('li[data-b]');
    if (li) { flyTo(buildings[li.dataset.b].pos, 38); closePanelOnPhone(); }
  });
  $('#rare').innerHTML = RARE_JOBS.map(j => {
    const who = citizens.find(c => (c.job || '').toLowerCase().trim() === j);
    const title = j.replace(/\b\w/g, m => m.toUpperCase());
    return `<li><span>${jobType(j).emoji} ${title}</span>${who ? `<span class="who" data-n="${esc(who.name)}">@${esc(who.name)}</span>` : '<span class="free">Unclaimed!</span>'}</li>`;
  }).join('');
  $('#rare').addEventListener('click', e => { const n = e.target.dataset.n; if (n) select(byName.get(n)); });
}

// shops directory: featured first, then the most active
{
  const shops = citizens.filter(c => c.business)
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.comments || 0) - (a.comments || 0));
  $('#shops').innerHTML = shops.map(c => {
    const link = safeLink(c.link), t = jobType(c.job);
    return `<li data-n="${esc(c.name)}" class="${c.featured ? 'star' : ''}">
      <span class="shop-dot" style="background:${c.featured ? '#ffb547' : avatarColor(c)}">${c.featured ? '⭐' : t ? t.emoji : '🏪'}</span>
      <span class="shop-txt"><b>${esc(c.business)}</b><small>@${esc(c.name)}${c.job ? ' · ' + esc(c.job) : ''}</small></span>
      ${link ? `<a class="shop-go" href="${esc(link)}" target="_blank" rel="noopener nofollow ugc">Visit ↗</a>` : ''}
    </li>`;
  }).join('') || '<li>No shops yet. Add your business to your job comment!</li>';
  $('#shops').addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const li = e.target.closest('li[data-n]');
    if (li) select(byName.get(li.dataset.n));
  });
}

// highlight
if (DATA.highlight && DATA.highlight.name) {
  const h = DATA.highlight;
  $('#highlight').hidden = false;
  $('#highlight-text').innerHTML = `<b data-n="${esc(h.name)}">@${esc(h.name)}</b> became a <i>${esc(h.job)}</i>. ${esc(h.note || '')}`;
  $('#highlight-text').addEventListener('click', e => { const n = e.target.dataset.n; if (n && byName.get(n)) select(byName.get(n)); });
}

// tabs + phone panel
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button, .tab').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  $('#tab-' + b.dataset.tab).classList.add('on');
}));
$('#panel-toggle').addEventListener('click', () => { $('#panel').classList.toggle('open'); $('#card').hidden = true; });
function closePanelOnPhone() { $('#panel').classList.remove('open'); }

// search
const byName = new Map(citizens.map(c => [c.name, c]));
const searchEl = $('#search'), resultsEl = $('#results');
let results = [], resultIdx = 0;
function renderResults() {
  resultsEl.innerHTML = results.map((c, i) => {
    const t = jobType(c.job);
    return `<li data-i="${i}" class="${i === resultIdx ? 'on' : ''}"><span>@${esc(c.name)}</span><small>${c.business ? '🏪 ' + esc(c.business) : t ? t.emoji + ' ' + esc(c.job) : 'Looking for work'}</small></li>`;
  }).join('') || (searchEl.value.trim() ? '<li><small>No citizen with that name yet. Follow to move in!</small></li>' : '');
}
searchEl.addEventListener('input', () => {
  const s = searchEl.value.trim().toLowerCase().replace(/^@/, '');
  const score = c => { const i = c.name.toLowerCase().indexOf(s); return i >= 0 ? i : 100 + (c.business || '').toLowerCase().indexOf(s); };
  results = s ? citizens.filter(c => c.name.toLowerCase().includes(s) || (c.business || '').toLowerCase().includes(s))
    .sort((a, b) => score(a) - score(b)).slice(0, 8) : [];
  resultIdx = 0;
  renderResults();
});
searchEl.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { resultIdx = Math.min(results.length - 1, resultIdx + 1); renderResults(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { resultIdx = Math.max(0, resultIdx - 1); renderResults(); e.preventDefault(); }
  if (e.key === 'Enter' && results[resultIdx]) choose(results[resultIdx]);
  if (e.key === 'Escape') { searchEl.value = ''; results = []; renderResults(); searchEl.blur(); }
});
resultsEl.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) choose(results[+li.dataset.i]); });
function choose(c) { searchEl.value = ''; results = []; renderResults(); searchEl.blur(); select(c); }

// citizen card
function neighbours(c) {
  const out = [];
  for (let j = Math.max(0, c._i - 30); j < Math.min(N, c._i + 30); j++) {
    if (j !== c._i) out.push([citizens[j]._pos.distanceTo(c._pos), citizens[j]]);
  }
  return out.sort((a, b) => a[0] - b[0]).slice(0, 2).map(x => x[1]);
}
function avatarColor(c) { return PEOPLE[hash(c.name) % PEOPLE.length]; }
function select(c) {
  if (!c) return;
  selected = c;
  closePanelOnPhone();
  flyTo(c._pos.clone().setY(1));
  marker.visible = ringM.visible = true;
  ringM.position.set(c._pos.x, 0.08, c._pos.z);
  selLabel.textContent = '@' + c.name + (c.business ? ` · 🏪 ${c.business}` : '');
  selLabel.style.display = '';
  const t = jobType(c.job);
  const days = Math.max(0, DATA.day - (c.joined || DATA.day));
  $('#card-avatar').textContent = c.name.replace(/[^a-z0-9]/gi, '')[0]?.toUpperCase() || '?';
  $('#card-avatar').style.background = avatarColor(c);
  $('#card-name').textContent = '@' + c.name;
  $('#card-no').textContent = `Citizen #${(c._i + 1).toLocaleString()}`;
  $('#card-job').innerHTML = t ? `${t.emoji} ${esc(c.job)} <small style="color:var(--muted)">· ${t.label}</small>` : '<span class="want">Looking for work. Comment a job on any post!</span>';
  document.querySelectorAll('.biz-row').forEach(e => e.hidden = !c.business);
  if (c.business) {
    const link = safeLink(c.link);
    $('#card-biz').innerHTML = `${c.featured ? '⭐ ' : '🏪 '}<span class="biz">${esc(c.business)}</span>` +
      (link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener nofollow ugc">${link.includes('instagram.com') ? 'Instagram' : 'Visit'} ↗</a>` : '');
  }
  const next = [2, 5, 10][c._lv - 1];
  $('#card-home').innerHTML = `${LEVELS[c._lv]}${next ? ` <small style="color:var(--muted)">· ${next - (c.comments || 0)} more comment${next - (c.comments || 0) === 1 ? '' : 's'} to upgrade</small>` : ' 🏆'}`;
  $('#card-joined').textContent = `Day ${c.joined || 1} · ${days === 0 ? 'new today!' : `lived here ${days} day${days === 1 ? '' : 's'}`}`;
  $('#card-nbrs').innerHTML = neighbours(c).map(n => `<span class="nbr" data-n="${esc(n.name)}">@${esc(n.name)}</span>`).join(', ') || '—';
  $('#card').hidden = false;
  history.replaceState(null, '', '?c=' + encodeURIComponent(c.name));
}
$('#card-nbrs').addEventListener('click', e => { const n = e.target.dataset.n; if (n) select(byName.get(n)); });
$('#card-close').addEventListener('click', deselect);
function deselect() {
  selected = null;
  $('#card').hidden = true;
  marker.visible = ringM.visible = false;
  selLabel.style.display = 'none';
  history.replaceState(null, '', location.pathname);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.hidden = true, 2200);
}
$('#btn-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '?c=' + encodeURIComponent(selected.name);
  try { await navigator.clipboard.writeText(url); toast('Link copied. Share your home!'); } catch { prompt('Copy this link:', url); }
});

// story card (1080x1920 PNG for Instagram stories)
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
$('#btn-story').addEventListener('click', async () => {
  const c = selected; if (!c) return;
  await document.fonts.ready;
  renderer.render(scene, camera);
  const W = 1080, Hh = 1920, cv = document.createElement('canvas');
  cv.width = W; cv.height = Hh;
  const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, Hh);
  g.addColorStop(0, '#1f2a55'); g.addColorStop(1, '#3a1f45');
  x.fillStyle = g; x.fillRect(0, 0, W, Hh);
  // snapshot of the city around their house
  const src = renderer.domElement, side = Math.min(src.width, src.height) * 0.8;
  x.save(); roundRect(x, 130, 280, 820, 820, 48); x.clip();
  x.drawImage(src, (src.width - side) / 2, (src.height - side) / 2, side, side, 130, 280, 820, 820);
  x.restore();
  x.textAlign = 'center'; x.fillStyle = '#ffb547';
  x.font = '600 52px Fredoka'; x.fillText(`🏘️ ${CFG.name}`, W / 2, 170);
  x.fillStyle = '#b4b0c4'; x.font = '500 34px Inter'; x.fillText(`Day ${DATA.day}`, W / 2, 228);
  x.fillStyle = '#fff'; x.font = '700 76px Fredoka'; x.fillText('@' + c.name, W / 2, 1200, 960);
  x.fillStyle = '#b4b0c4'; x.font = '500 38px Inter'; x.fillText(`Citizen #${(c._i + 1).toLocaleString()}`, W / 2, 1258);
  const t = jobType(c.job);
  const rows = [
    ['Job', t ? `${t.emoji} ${c.job}` : '😴 Looking for work'],
    ...(c.business ? [['Business', `🏪 ${c.business}`]] : []),
    ['Home', `🏠 ${LEVELS[c._lv]}`],
    ['Moved in', `📅 Day ${c.joined || 1}`],
  ];
  rows.forEach(([k, val], i) => {
    const y = 1320 + i * 125;
    x.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(x, 120, y, 840, 105, 28); x.fill();
    x.textAlign = 'left'; x.fillStyle = '#b4b0c4'; x.font = '500 34px Inter'; x.fillText(k, 160, y + 64);
    x.textAlign = 'right'; x.fillStyle = '#fff'; x.font = '600 42px Fredoka'; x.fillText(val, 920, y + 66, 560);
  });
  x.textAlign = 'center'; x.fillStyle = '#ffb547'; x.font = '600 44px Fredoka';
  x.fillText(`Follow @${CFG.instagram} to get your home`, W / 2, 1760, 980);
  x.fillStyle = '#b4b0c4'; x.font = '500 32px Inter'; x.fillText(CFG.website, W / 2, 1830);
  const a = document.createElement('a');
  a.download = `${c.name}-${CFG.name}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
  toast('Story card saved. Post it and tag us!');
});

// controls
const timeLabels = { auto: '🌗', day: '☀️', night: '🌙' };
$('#btn-time').addEventListener('click', () => {
  timeMode = { auto: 'day', day: 'night', night: 'auto' }[timeMode];
  $('#btn-time').textContent = timeLabels[timeMode];
  toast({ auto: 'Time follows your clock', day: 'Daytime', night: 'Night time' }[timeMode]);
});
$('#btn-names').addEventListener('click', e => { showNames = !showNames; e.currentTarget.classList.toggle('on', showNames); frame = 0; });
$('#btn-home').addEventListener('click', () => { const h = homeView(); fly = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), toT: h.target, toP: h.pos }; });
function setReel(on) {
  document.body.classList.toggle('reel', on);
  $('#reel').hidden = !on;
  controls.autoRotate = on;
  if (on) { deselect(); toast('Reel mode. Press Esc to exit'); }
}
$('#btn-reel').addEventListener('click', () => setReel(true));
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('reel')) setReel(false);
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'r' || e.key === 'R') setReel(!document.body.classList.contains('reel'));
});

// click a house to see who lives there
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(pickable, false)[0];
  if (hit && hit.instanceId != null) select(citizens[hit.instanceId]);
});
canvas.addEventListener('pointermove', e => {
  if (e.buttons) return;
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  canvas.style.cursor = ray.intersectObjects(pickable, false).length ? 'pointer' : '';
});

// ---------- main loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  updateSky(dt);
  animations.forEach(f => f(t, dt, night));
  updateWalkers(t, dt);
  if (fly) {
    fly.t = Math.min(1, fly.t + dt / 1.3);
    const e = fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    camera.position.lerpVectors(fly.fromP, fly.toP, e);
    if (fly.t >= 1) fly = null;
  }
  if (selected) {
    marker.position.set(selected._pos.x, selected._top + 0.6 + Math.sin(t * 3) * 0.3, selected._pos.z);
    marker.rotation.y = t * 2;
    ringM.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
  }
  for (const c of clouds) { c.position.x += dt * 2; if (c.position.x > 220) c.position.x = -220; }
  controls.update();
  updateSun();
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(loop);
}

// ?time=day|night and ?view=plaza let brand.html take clean pictures of the city.
// This runs before the first frame, because hidden frames may only ever draw that one.
{
  const p = new URLSearchParams(location.search);
  if (p.get('time') === 'day' || p.get('time') === 'night') { timeMode = p.get('time'); night = timeMode === 'night' ? 1 : 0; }
  if (p.get('view') === 'plaza') { camera.position.set(0, 15, 27); controls.target.set(0, 4, -6); }
}

loop();

// open a shared link straight to that citizen
const shared = new URLSearchParams(location.search).get('c');
setTimeout(() => {
  $('#loader').classList.add('gone');
  if (shared && byName.get(shared)) select(byName.get(shared));
}, 400);
