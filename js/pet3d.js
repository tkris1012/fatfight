/* =========================================================
   もちプー 3Dビューア（pet3d.html）
   モデル本体は mochipoo3d.js（アプリのホーム画面と共通）
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMochiPoo } from './mochipoo3d.js';

/* ---------- レンダラーとシーン ---------- */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.78, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.53;
controls.autoRotateSpeed = 1.6;
// 画面の縦横比に合わせて、モデル全体（幅3.2・高さ2.6）が入る距離を計算
function placeCamera() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const d = Math.max(1.6 / Math.tan(vfov / 2), 1.62 / Math.tan(hfov / 2)) * 1.02;
  camera.position.set(0.12 * d, 0.95 + 0.14 * d, d);
  controls.maxDistance = d * 1.8;
  controls.minDistance = d * 0.55;
}
placeCamera();

scene.add(new THREE.HemisphereLight(0xffffff, 0xF6DCE6, 1.1));
const key = new THREE.DirectionalLight(0xFFF3EA, 2.1);
key.position.set(2.5, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -3; key.shadow.camera.right = 3;
key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
key.shadow.radius = 6;
key.shadow.bias = -0.0005;
scene.add(key);
const rim = new THREE.DirectionalLight(0xD9CCFF, 1.3);
rim.position.set(-3, 2.5, -4);
scene.add(rim);

// ミントの丘（台座）
const hill = new THREE.Mesh(
  new THREE.CylinderGeometry(2.6, 2.75, 0.24, 96),
  new THREE.MeshStandardMaterial({ color: 0xCDEFDF, roughness: 0.9 })
);
hill.position.y = -0.12;
hill.receiveShadow = true;
scene.add(hill);

/* ---------- もちプー ---------- */
const pet = createMochiPoo({ detail: 'high' });
scene.add(pet.object);

/* ---------- アニメーション ---------- */
let spinning = false;
const clock = new THREE.Clock();
function animate() {
  pet.update(clock.getElapsedTime());
  controls.autoRotate = spinning;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

/* ---------- UI ---------- */
function setMood(m) {
  pet.setMood(m);
  document.querySelectorAll('#mood button').forEach(b => b.classList.toggle('on', b.dataset.v === m));
}
document.querySelectorAll('#mood button').forEach(b => b.addEventListener('click', () => setMood(b.dataset.v)));
document.getElementById('plump').addEventListener('input', e => pet.setPlump(+e.target.value));
document.getElementById('item').addEventListener('change', e => pet.setItem(e.target.value || null));
const spinBtn = document.getElementById('spin');
spinBtn.addEventListener('click', () => { spinning = !spinning; spinBtn.textContent = spinning ? 'とめる' : 'くるくる回転'; });

// タップでジャンプ（ドラッグとは区別する）
const ray = new THREE.Raycaster();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (ray.intersectObject(pet.hitTarget, true).length) pet.jump();
});

// GLB書き出し（埋め込み表示ではダウンロードできないので隠す）
const exportBtn = document.getElementById('export');
const embedded = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
if (embedded) {
  exportBtn.remove();
  document.getElementById('hint').textContent = 'GLBでの保存は、リポジトリの pet3d.html をブラウザで開くと使えるよ';
} else {
  exportBtn.addEventListener('click', () => {
    pet.withRestPose(obj => new GLTFExporter().parse(obj, buf => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
      a.download = `mochipoo_${pet.mood}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, err => console.error(err), { binary: true, onlyVisible: true }));
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  placeCamera();
});

document.getElementById('loading').remove();
window.__pet3d = { setMood, setPlump: v => pet.setPlump(v), setItem: id => pet.setItem(id), camera, controls };
animate();
