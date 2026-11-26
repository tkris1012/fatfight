/* =========================================================
   ホーム画面の3Dペット
   - 背景は透明にして、2Dの空・丘のステージの上にもちプーだけを重ねる
   - WebGLやThree.jsが使えないときは何もしない（2DのSVGペットのまま動く）
   - app.js とは window.Pet3D を通してやりとりする
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMochiPoo } from './mochipoo3d.js';

const host = document.getElementById('pet3d');

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

if (host && webglOK()) {
  try { init(); } catch (e) { console.warn('3Dペットを表示できないので2Dで表示します', e); }
}

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xF6DCE6, 1.1));
  const key = new THREE.DirectionalLight(0xFFF3EA, 2.0);
  key.position.set(1.4, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 3.2; key.shadow.camera.bottom = -1;
  key.shadow.radius = 5;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xD9CCFF, 1.2);
  rim.position.set(-3, 2.5, -4);
  scene.add(rim);

  // 影だけを落とす透明な床（2Dの丘の上に影が乗って見える）
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.11 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const pet = createMochiPoo({ detail: 'low' });
  scene.add(pet.object);

  // カメラ：アクセサリーが頭にのっても切れないよう、上に少し余白をとる
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const target = new THREE.Vector3(0, 1.18, 0);
  function fit() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const d = Math.max(1.4 / Math.tan(vfov / 2), 1.68 / Math.tan(hfov / 2));
    camera.position.set(0.1 * d, target.y + 0.1 * d, d);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  host.appendChild(renderer.domElement);
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(host);
  else addEventListener('resize', fit);

  // ホームが見えているときだけ描画する（電池の節約）
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden || host.offsetParent === null) return;
    pet.update(clock.getElapsedTime());
    renderer.render(scene, camera);
  }
  loop();

  window.Pet3D = {
    ready: true,
    setMood: m => pet.setMood(m),
    setPlump: v => pet.setPlump(v),
    setItem: id => pet.setItem(id),
    jump: () => pet.jump(),
  };
  document.body.classList.add('pet3d-on');
  window.dispatchEvent(new Event('pet3d-ready'));
}
