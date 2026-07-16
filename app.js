import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

const KEYS = ['ESC', ...Array.from({ length: 15 }, (_, i) => `F${i + 1}`)];
const ICONS = [
  ['blank', 'Blank'], ['mission_control', 'Mission Control'], ['app_expose', 'App Exposé'],
  ['desktop', 'Desktop'], ['notification', 'Notifications'], ['spotlight', 'Spotlight'],
  ['dictation', 'Dictation'], ['focus', 'Focus'], ['brightness', 'Brightness'],
  ['previous', 'Previous'], ['play_pause', 'Play/Pause'], ['fast_forward', 'Forward'],
  ['volume_up', 'Volume']
];
const ICON_BY_NAME = Object.fromEntries(ICONS);
const DEFAULT = {
  version: 1,
  geometry: { width: 17.4, height: 10.2, thickness: 1.7, radius: 1, chamfer: 0.25, relief: 0.4, symbolScale: 1 },
  top: {
    ESC: 'blank', F1: 'blank', F2: 'blank', F3: 'blank', F4: 'blank', F5: 'blank', F6: 'blank', F7: 'blank', F8: 'blank',
    F9: 'mission_control', F10: 'app_expose', F11: 'desktop', F12: 'notification', F13: 'blank', F14: 'brightness', F15: 'brightness'
  },
  bottom: {
    ESC: 'blank', F1: 'blank', F2: 'blank', F3: 'app_expose', F4: 'spotlight', F5: 'dictation', F6: 'focus', F7: 'previous',
    F8: 'play_pause', F9: 'fast_forward', F10: 'volume_up', F11: 'volume_up', F12: 'volume_up', F13: 'blank', F14: 'brightness', F15: 'brightness'
  }
};

let config = structuredClone(DEFAULT);
let selected = { layer: 'bottom', key: 'F5' };
let customSvgs = {};
let previewGroup;

const layoutEl = document.querySelector('#keyboard-layout');
const pickerEl = document.querySelector('#icon-picker');
const previewEl = document.querySelector('#preview');
const statusEl = document.querySelector('#render-status');
const relief = document.querySelector('#relief');
const symbolScale = document.querySelector('#symbol-scale');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
camera.position.set(20, -24, 19);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
previewEl.append(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0.8);
controls.minDistance = 18;
controls.maxDistance = 60;
scene.add(new THREE.HemisphereLight(0xffffff, 0x696657, 2.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(-10, -10, 20);
keyLight.castShadow = true;
scene.add(keyLight);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.14 }));
ground.position.z = -0.03;
ground.receiveShadow = true;
scene.add(ground);

function iconUrl(name) {
  return name === 'blank' ? 'assets/icons/blank.svg' : (customSvgs[name]?.url || `assets/icons/${name}.svg`);
}

function renderLayout() {
  layoutEl.replaceChildren();
  for (const layer of ['top', 'bottom']) {
    const row = document.createElement('div');
    row.className = 'key-row';
    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = `${layer} layer`;
    row.append(label);
    for (const key of KEYS) {
      const name = config[layer][key] || 'blank';
      const button = document.createElement('button');
      button.className = `key-slot ${name === 'blank' ? 'blank' : ''} ${selected.layer === layer && selected.key === key ? 'selected' : ''}`;
      button.innerHTML = `<img src="${iconUrl(name)}" alt=""><span>${key}</span>`;
      button.title = `${layer} ${key}: ${ICON_BY_NAME[name] || name}`;
      button.addEventListener('click', () => selectPosition(layer, key));
      row.append(button);
    }
    layoutEl.append(row);
  }
  document.querySelector('#selected-position').textContent = `${capitalize(selected.layer)} ${selected.key}`;
}

function renderPicker() {
  pickerEl.replaceChildren();
  const names = [...ICONS];
  for (const [name, label] of names) {
    const button = document.createElement('button');
    button.className = `icon-choice ${config[selected.layer][selected.key] === name ? 'selected' : ''}`;
    button.innerHTML = `<img src="${iconUrl(name)}" alt=""><span>${label}</span>`;
    button.addEventListener('click', () => setIcon(name));
    pickerEl.append(button);
  }
  for (const [name, item] of Object.entries(customSvgs)) {
    const button = document.createElement('button');
    button.className = `icon-choice ${config[selected.layer][selected.key] === name ? 'selected' : ''}`;
    button.innerHTML = `<img src="${item.url}" alt=""><span>${item.label}</span>`;
    button.addEventListener('click', () => setIcon(name));
    pickerEl.append(button);
  }
}

async function selectPosition(layer, key) {
  selected = { layer, key };
  renderLayout();
  renderPicker();
  await updatePreview();
}

async function setIcon(name) {
  config[selected.layer][selected.key] = name;
  renderLayout();
  renderPicker();
  await updatePreview();
}

function roundedRectPoints(width, height, radius, segments = 7) {
  const points = [];
  const corners = [
    [width / 2 - radius, height / 2 - radius, 0],
    [-width / 2 + radius, height / 2 - radius, Math.PI / 2],
    [-width / 2 + radius, -height / 2 + radius, Math.PI],
    [width / 2 - radius, -height / 2 + radius, Math.PI * 1.5]
  ];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= segments; i++) {
      const angle = start + (i / segments) * Math.PI / 2;
      points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    }
  }
  return points;
}

function tileGeometry() {
  const g = config.geometry;
  const rings = [
    { z: 0, w: g.width, h: g.height, r: g.radius },
    { z: g.thickness - g.chamfer, w: g.width, h: g.height, r: g.radius },
    { z: g.thickness, w: g.width - 2 * g.chamfer, h: g.height - 2 * g.chamfer, r: Math.max(.2, g.radius - g.chamfer) }
  ].map(ring => ({ ...ring, points: roundedRectPoints(ring.w, ring.h, ring.r) }));
  const vertices = [];
  for (const ring of rings) for (const [x, y] of ring.points) vertices.push(x, y, ring.z);
  const count = rings[0].points.length;
  const indices = [];
  for (let ring = 0; ring < rings.length - 1; ring++) {
    const a = ring * count;
    const b = (ring + 1) * count;
    for (let i = 0; i < count; i++) {
      const n = (i + 1) % count;
      indices.push(a + i, b + i, b + n, a + i, b + n, a + n);
    }
  }
  const bottomCenter = vertices.length / 3;
  vertices.push(0, 0, 0);
  const topCenter = vertices.length / 3;
  vertices.push(0, 0, g.thickness);
  const topOffset = (rings.length - 1) * count;
  for (let i = 0; i < count; i++) {
    const n = (i + 1) % count;
    indices.push(bottomCenter, n, i);
    indices.push(topCenter, topOffset + i, topOffset + n);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

async function getSvgText(name) {
  if (name === 'blank') return null;
  if (customSvgs[name]) return customSvgs[name].text;
  const response = await fetch(iconUrl(name));
  if (!response.ok) throw new Error(`Could not load ${name}`);
  return response.text();
}

async function buildTile(name, preview = false) {
  const group = new THREE.Group();
  const tileMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e7dd, roughness: .72, metalness: 0 });
  const iconMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2b27, roughness: .65, metalness: 0 });
  const tile = new THREE.Mesh(tileGeometry(), tileMaterial);
  tile.castShadow = preview;
  tile.receiveShadow = preview;
  group.add(tile);
  const svgText = await getSvgText(name);
  if (!svgText) return group;
  const data = new SVGLoader().parse(svgText);
  const glyph = new THREE.Group();
  for (const path of data.paths) {
    if (path.userData?.style?.fill && path.userData.style.fill !== 'none') {
      for (const shape of SVGLoader.createShapes(path)) {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: config.geometry.relief + .02, bevelEnabled: false, curveSegments: 16 });
        glyph.add(new THREE.Mesh(geometry, iconMaterial));
      }
    }
  }
  if (!glyph.children.length) return group;
  const box = new THREE.Box3().setFromObject(glyph);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(14 / size.x, 7 / size.y) * config.geometry.symbolScale;
  glyph.scale.set(scale, -scale, 1);
  glyph.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(glyph);
  const center = scaledBox.getCenter(new THREE.Vector3());
  glyph.position.set(-center.x, -center.y, config.geometry.thickness - .01);
  glyph.traverse(obj => { if (obj.isMesh) obj.castShadow = preview; });
  group.add(glyph);
  return group;
}

async function updatePreview() {
  statusEl.textContent = 'Rendering…';
  if (previewGroup) scene.remove(previewGroup);
  try {
    previewGroup = await buildTile(config[selected.layer][selected.key], true);
    scene.add(previewGroup);
    statusEl.textContent = 'Ready';
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'SVG error';
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportStl(object, filename) {
  object.updateMatrixWorld(true);
  const bytes = new STLExporter().parse(object, { binary: true });
  downloadBlob(new Blob([bytes], { type: 'model/stl' }), filename);
}

async function downloadTile() {
  statusEl.textContent = 'Building STL…';
  const name = config[selected.layer][selected.key];
  exportStl(await buildTile(name), `AEK_${selected.layer}_${selected.key}_${name}.stl`);
  statusEl.textContent = 'Downloaded';
}

async function downloadPlate() {
  statusEl.textContent = 'Building 32 tiles…';
  const plate = new THREE.Group();
  const entries = [...KEYS.map(key => ['top', key]), ...KEYS.map(key => ['bottom', key])];
  for (let i = 0; i < entries.length; i++) {
    const [layer, key] = entries[i];
    const tile = await buildTile(config[layer][key]);
    const col = i % 8;
    const row = Math.floor(i / 8);
    tile.position.set((col - 3.5) * 20, (1.5 - row) * 12.8, 0);
    plate.add(tile);
  }
  exportStl(plate, 'AEK_custom_32tile_plate.stl');
  statusEl.textContent = 'Downloaded';
}

function saveConfig() {
  const safe = structuredClone(config);
  for (const layer of ['top', 'bottom']) {
    for (const key of KEYS) if (customSvgs[safe[layer][key]]) safe[layer][key] = 'blank';
  }
  downloadBlob(new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' }), 'AEK_tile_layout.json');
}

function resize() {
  const width = previewEl.clientWidth;
  const height = previewEl.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateClock() {
  document.querySelector('#menu-clock').textContent = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

function capitalize(value) { return value[0].toUpperCase() + value.slice(1); }

relief.addEventListener('input', async () => {
  config.geometry.relief = Number(relief.value);
  document.querySelector('#relief-value').textContent = `${Number(relief.value).toFixed(2)} mm`;
  await updatePreview();
});
symbolScale.addEventListener('input', async () => {
  config.geometry.symbolScale = Number(symbolScale.value) / 100;
  document.querySelector('#scale-value').textContent = `${symbolScale.value}%`;
  await updatePreview();
});
document.querySelector('#download-tile').addEventListener('click', downloadTile);
document.querySelector('#download-plate').addEventListener('click', downloadPlate);
document.querySelector('#download-config').addEventListener('click', saveConfig);
document.querySelector('#reset-layout').addEventListener('click', async () => {
  config = structuredClone(DEFAULT);
  relief.value = config.geometry.relief;
  symbolScale.value = config.geometry.symbolScale * 100;
  renderLayout(); renderPicker(); await updatePreview();
});
document.querySelector('#svg-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const name = `custom_${Date.now()}`;
  customSvgs[name] = { text, url: URL.createObjectURL(file), label: file.name.replace(/\.svg$/i, '') };
  config[selected.layer][selected.key] = name;
  renderLayout(); renderPicker(); await updatePreview();
});
document.querySelector('#config-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const incoming = JSON.parse(await file.text());
    if (!incoming.top || !incoming.bottom || !incoming.geometry) throw new Error('Missing layout fields');
    config = incoming;
    relief.value = config.geometry.relief;
    symbolScale.value = Math.round(config.geometry.symbolScale * 100);
    renderLayout(); renderPicker(); await updatePreview();
  } catch (error) {
    alert(`Could not load configuration: ${error.message}`);
  }
});

new ResizeObserver(resize).observe(previewEl);
updateClock();
setInterval(updateClock, 30000);
renderLayout();
renderPicker();
await updatePreview();
resize();
animate();
