/* =========================================================
   もちプー 3D  —  Three.js によるプロシージャルモデル
   2DのSVG（viewBox 200×200）の座標をそのまま3Dの体表に投影して、
   顔パーツ・耳・足の位置をSVGと一致させている。
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- 色（SVG版と同じパレット） ---------- */
const C = {
  body: 0xFBF1EA, bodyShade: 0xF0E0D5, line: 0xD9C2B6,
  curl: 0xE9BFA0, curlLine: 0xC8947A,
  ink: 0x4A3540, blush: 0xE8A9B0, toe: 0xD9A98A, sweat: 0xB5D8E8,
};

/* ---------- SVG座標 → 3D座標 ---------- */
// SVGで体の幅152px ≒ 3Dで2.32。足の底(y=186)を3Dの y=0 にする
const K = 2.32 / 152;
const sx2 = x => (x - 100) * K;
const sy2 = y => (186 - y) * K;

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
// 画面の縦横比に合わせて、モデル全体（幅3.2・高さ2.6）が入る距離を計算
function fitDistance() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const byH = 1.6 / Math.tan(vfov / 2);
  const byW = 1.62 / Math.tan(hfov / 2);
  return Math.max(byH, byW) * 1.02;
}
function placeCamera() {
  const d = fitDistance();
  camera.position.set(0.12 * d, 0.95 + 0.14 * d, d);
  controls.maxDistance = d * 1.8;
  controls.minDistance = d * 0.55;
}
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.78, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 0.53;
controls.autoRotateSpeed = 1.6;
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

// ミントの丘（台座）と、やわらかい影
const hill = new THREE.Mesh(
  new THREE.CylinderGeometry(2.6, 2.75, 0.24, 96),
  new THREE.MeshStandardMaterial({ color: 0xCDEFDF, roughness: 0.9 })
);
hill.position.y = -0.12;
hill.receiveShadow = true;
scene.add(hill);

/* ---------- マテリアル ---------- */
const M = {
  body: new THREE.MeshPhysicalMaterial({
    color: C.body, roughness: 0.62, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xFFE3EA),
    clearcoat: 0.08, clearcoatRoughness: 0.6,
  }),
  feet: new THREE.MeshPhysicalMaterial({ color: C.bodyShade, roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color(0xFFE3EA) }),
  curl: new THREE.MeshPhysicalMaterial({
    color: C.curl, roughness: 0.85, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xFFE6D2),
  }),
  curlLine: new THREE.MeshStandardMaterial({ color: C.curlLine, roughness: 0.8 }),
  ink: new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
  inkMatte: new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.5 }),
  white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  blush: new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.55, depthWrite: false }),
  tongue: new THREE.MeshStandardMaterial({ color: 0xF29BAA, roughness: 0.5 }),
  toe: new THREE.MeshStandardMaterial({ color: C.toe, roughness: 0.6 }),
  sweat: new THREE.MeshPhysicalMaterial({ color: C.sweat, roughness: 0.05, transmission: 0.35, thickness: 0.2, clearcoat: 1 }),
};

/* ---------- 体（大福のかたち） ---------- */
function bodyGeometry() {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = (v.y + 1) / 2;                       // 0=底 1=てっぺん
    // 下から3割くらいがいちばん広い、ぽってりした大福
    const w = 1 + 0.16 * Math.exp(-(((t - 0.32) / 0.28) ** 2)) - 0.04 * t;
    let y = v.y;
    if (y < -0.55) y = -0.55 + (y + 0.55) * 0.35;  // 底はぺたっと平ら
    p.setXYZ(i, v.x * w, y, v.z * w);
  }
  g.computeBoundingBox();
  const b = g.boundingBox;
  const s = new THREE.Vector3(2.32 / (b.max.x - b.min.x), 1.74 / (b.max.y - b.min.y), 1.95 / (b.max.z - b.min.z));
  g.scale(s.x, s.y, s.z);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y + 0.04, 0);
  g.computeVertexNormals();
  return g;
}

/* ---------- 巻き毛のボール（でこぼこ + くるんとしたカール線） ---------- */
function curlBallGeometry(r, seed) {
  // 頂点を結合してからでこぼこさせる（つながっていないとカクカクの陰影になる）
  let g = new THREE.IcosahedronGeometry(1, 5);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(7 * v.x + seed) * Math.sin(7 * v.y + seed * 1.7) * Math.sin(7 * v.z + seed * 0.6);
    const n2 = Math.sin(13 * v.x - seed) * Math.sin(13 * v.y + seed) * Math.sin(13 * v.z);
    v.multiplyScalar(r * (1 + 0.07 * n + 0.03 * n2));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
let seedCounter = 1;
function curlBall(center, r, outward) {
  const grp = new THREE.Group();
  const ball = new THREE.Mesh(curlBallGeometry(r, seedCounter++ * 1.37), M.curl);
  ball.castShadow = true;
  grp.add(ball);
  // SVGの「e」字のカール線を、外側を向いた面に小さなトーラスで再現
  const arc = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.075, 8, 28, Math.PI * 1.45), M.curlLine);
  const dir = outward.clone().normalize();
  arc.position.copy(dir.clone().multiplyScalar(r * 0.93));
  arc.lookAt(dir.clone().multiplyScalar(r * 3));
  arc.rotateZ(seedCounter * 2.1);
  grp.add(arc);
  grp.position.copy(center);
  return grp;
}

/* ---------- 体の表面にパーツを貼るための投影 ---------- */
const body = new THREE.Mesh(bodyGeometry(), M.body);
body.castShadow = true;
body.receiveShadow = true;
const ray = new THREE.Raycaster();
function hit(origin, dir) {
  ray.set(origin, dir.normalize());
  const h = ray.intersectObject(body, false)[0];
  return h ? { p: h.point.clone(), n: h.face.normal.clone() } : null;
}
// SVG座標(x,y)を正面から体に投影
function front(x, y) {
  const X = sx2(x), Y = sy2(y);
  return hit(new THREE.Vector3(X, Y, 5), new THREE.Vector3(0, 0, -1))
    || { p: new THREE.Vector3(X, Y, 0), n: new THREE.Vector3(Math.sign(X) || 1, 0, 0) };
}
// 上から投影（頭のおだんご用）
function top(X, Z) {
  return hit(new THREE.Vector3(X, 5, Z), new THREE.Vector3(0, -1, 0));
}
// 体表にそった細い線（口・うれしい目）
function surfaceTube(pts2d, radius, mat, lift = 0.012) {
  const pts = pts2d.map(([x, y]) => { const s = front(x, y); return s.p.add(s.n.multiplyScalar(lift)); });
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 10, false), mat);
  // 線の端を丸くする
  const cap = new THREE.SphereGeometry(radius, 12, 8);
  [pts[0], pts[pts.length - 1]].forEach(p => { const c = new THREE.Mesh(cap, mat); c.position.copy(p); m.add(c); });
  return m;
}
// SVGの2次ベジェ曲線をサンプリング
function quad([x0, y0], [cx, cy], [x1, y1], n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
    out.push([a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1]);
  }
  return out;
}
// 体表にぴったり沿う平らなパーツ（チーク・開いた口）
function decal(x, y, w, h, mat, lift = 0.006) {
  const s = front(x, y);
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
  m.scale.set(w * K, h * K, 1);
  m.position.copy(s.p.add(s.n.clone().multiplyScalar(lift)));
  m.lookAt(m.position.clone().add(s.n));
  return m;
}

/* ---------- 組み立て ---------- */
const root = new THREE.Group();     // 体型（横の伸び縮み）
const bounce = new THREE.Group();   // ジャンプ・呼吸
root.add(bounce);
scene.add(root);
bounce.add(body);

// 足と肉球
const feet = new THREE.Group();
[-1, 1].forEach(sgn => {
  const s = front(100 + sgn * 30, 172);
  const f = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), M.feet);
  f.scale.set(13 * K * 1.25, 9 * K * 1.1, 13 * K * 1.4);
  f.position.set(sx2(100 + sgn * 30), 0.13, s.p.z * 0.92);
  f.castShadow = true;
  feet.add(f);
  [-1, 1].forEach(t => {
    const toe = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.toe);
    toe.position.set(f.position.x + t * 0.06, 0.12, f.position.z + 0.22);
    toe.scale.set(1, 0.8, 0.6);
    feet.add(toe);
  });
});
bounce.add(feet);

// 垂れ耳（SVGの房の円をそのまま投影）
const EAR = [[38, 104, 12], [33, 116, 12], [34, 130, 12], [38, 143, 11], [48, 149, 10], [49, 114, 10]];
const ears = [-1, 1].map(sgn => {
  const g = new THREE.Group();
  EAR.forEach(([x, y, r]) => {
    const xx = sgn < 0 ? x : 200 - x;
    const s = front(xx, y);
    const R = r * K * 1.15;
    const out = s.n.clone().add(new THREE.Vector3(sgn * 0.6, 0, 0.25));
    g.add(curlBall(s.p.clone().add(s.n.clone().multiplyScalar(R * 0.45)), R, out));
  });
  bounce.add(g);
  return g;
});

// 頭のおだんご（上から投影して、ドーム状に盛る）
const TOP = [
  [0, 0.04, 0.24, 0.1], [-0.27, 0.14, 0.2, 0], [0.27, 0.12, 0.2, 0], [-0.12, 0.34, 0.19, 0],
  [0.15, 0.33, 0.19, 0], [-0.22, -0.2, 0.19, 0], [0.22, -0.18, 0.19, 0], [0, -0.3, 0.19, 0],
  [-0.4, -0.04, 0.17, 0], [0.41, -0.02, 0.17, 0], [-0.1, 0.12, 0.18, 0.06], [0.12, -0.06, 0.18, 0.06],
];
const topknot = new THREE.Group();
TOP.forEach(([X, Z, r, up]) => {
  const s = top(X, Z);
  if (!s) return;
  const c = s.p.add(s.n.clone().multiplyScalar(r * 0.35)).add(new THREE.Vector3(0, up, 0));
  topknot.add(curlBall(c, r, s.n.clone().add(new THREE.Vector3(0, 0.4 + up * 3, 0.5))));
});
bounce.add(topknot);

// しっぽ（後ろ姿用の、小さな巻き毛のポンポン）
const tail = new THREE.Group();
{
  const s = hit(new THREE.Vector3(0, 0.62, -5), new THREE.Vector3(0, 0, 1));
  if (s) {
    const out = s.n.clone().add(new THREE.Vector3(0, 0.5, 0));
    tail.add(curlBall(s.p.clone().add(s.n.clone().multiplyScalar(0.12)), 0.2, out));
    tail.add(curlBall(s.p.clone().add(s.n.clone().multiplyScalar(0.2)).add(new THREE.Vector3(0.05, 0.16, 0)), 0.15, out));
  }
}
bounce.add(tail);

/* ---------- 顔（表情ごとに作って切り替え） ---------- */
function eyeDot(x, y) {
  const g = new THREE.Group();
  const s = front(x, y);
  const e = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), M.ink);
  e.scale.set(5.3 * K, 7 * K, 3.2 * K);
  g.position.copy(s.p.add(s.n.clone().multiplyScalar(0.01)));
  g.lookAt(g.position.clone().add(s.n));
  g.add(e);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(2 * K, 12, 8), M.white);
  hl.position.set(-1.5 * K, 2.5 * K, 2.9 * K);
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(1 * K, 10, 8), M.white);
  hl2.position.set(2.5 * K, -2.5 * K, 2.9 * K);
  g.add(hl, hl2);
  g.userData.blink = true;
  return g;
}
function nose(y) {
  const g = new THREE.Group();
  const s = front(100, y);
  const n = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.ink);
  n.scale.set(4.6 * K, 4 * K, 3.4 * K);
  g.position.copy(s.p.add(s.n.clone().multiplyScalar(0.015)));
  g.lookAt(g.position.clone().add(s.n));
  const hl = new THREE.Mesh(new THREE.SphereGeometry(1.2 * K, 10, 8), M.white);
  hl.position.set(-1.5 * K, 1.5 * K, 3.2 * K);
  g.add(n, hl);
  return g;
}
function blushes() {
  return [decal(62, 143, 10, 6, M.blush), decal(138, 143, 10, 6, M.blush)];
}
const faces = {
  normal() {
    const g = new THREE.Group();
    g.add(eyeDot(78, 131), eyeDot(122, 131), nose(140), ...blushes());
    // ω の口
    g.add(surfaceTube([...quad([91, 148], [95, 156], [100, 148]), ...quad([100, 148], [105, 156], [109, 148]).slice(1)], 2.1 * K * 0.5, M.inkMatte));
    return g;
  },
  happy() {
    const g = new THREE.Group();
    g.add(surfaceTube(quad([70, 134], [78, 121], [86, 134]), 1.6 * K, M.inkMatte));
    g.add(surfaceTube(quad([114, 134], [122, 121], [130, 134]), 1.6 * K, M.inkMatte));
    g.add(nose(140), ...blushes());
    // 開いた口（こげ茶）＋ ベロ
    const tongue = decal(100, 158, 4.5, 2.6, M.tongue, 0.012);
    g.add(openMouth(), tongue);
    return g;
  },
  worried() {
    const g = new THREE.Group();
    g.add(eyeDot(78, 134), eyeDot(122, 134), nose(143), ...blushes());
    g.add(surfaceTube(quad([96, 154], [100, 150], [104, 154]), 1.0 * K, M.inkMatte));
    // 汗
    const s = front(143, 120);
    const drop = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), M.sweat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.12, 24), M.sweat);
    tip.position.y = 0.075;
    drop.add(ball, tip);
    drop.position.copy(s.p.add(s.n.clone().multiplyScalar(0.09)));
    g.add(drop);
    g.userData.sweat = drop;
    return g;
  },
};
// うれしい顔の口：SVGの口の形をそのまま押し出して、体表に貼る
function openMouth() {
  const shape = new THREE.Shape();
  const P = (x, y) => [(x - 100) * K, -(y - 155) * K];
  shape.moveTo(...P(89, 148));
  shape.quadraticCurveTo(...P(100, 163), ...P(111, 148));
  shape.quadraticCurveTo(...P(111, 161), ...P(100, 163));
  shape.quadraticCurveTo(...P(89, 161), ...P(89, 148));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 24 });
  const m = new THREE.Mesh(geo, M.inkMatte);
  const s = front(100, 155);
  m.position.copy(s.p.add(s.n.clone().multiplyScalar(0.004)));
  m.lookAt(m.position.clone().add(s.n));
  return m;
}

const faceGroups = {};
Object.keys(faces).forEach(k => { faceGroups[k] = faces[k](); faceGroups[k].visible = false; bounce.add(faceGroups[k]); });
const EAR_DY = { normal: 0, happy: 10 * K, worried: -8 * K };

let mood = 'normal';
function setMood(m) {
  mood = m;
  Object.entries(faceGroups).forEach(([k, g]) => { g.visible = k === m; });
  document.querySelectorAll('#mood button').forEach(b => b.classList.toggle('on', b.dataset.v === m));
}
setMood('normal');

/* ---------- アニメーション ---------- */
let plump = 0, jumpT = -1, spinning = false;
const clock = new THREE.Clock();
let nextBlink = 2.5, blinkT = -1;

function animate() {
  const t = clock.getElapsedTime();
  // 体型：横と奥行きだけ伸び縮み（SVG版と同じ 0.86〜1.14）
  const sx = 1 + plump * 0.14;
  root.scale.set(sx, 1, 1 + plump * 0.1);

  // 呼吸
  const br = Math.sin(t * 2) * 0.018;
  let sy = 1 - br, sxz = 1 + br, y = 0;
  // ジャンプ（つぶれて→跳ねて→着地でむにっ）
  if (jumpT >= 0) {
    const j = (t - jumpT) / 0.75;
    if (j >= 1) jumpT = -1;
    else if (j < 0.18) { const k = j / 0.18; sy *= 1 - 0.14 * k; sxz *= 1 + 0.1 * k; }
    else if (j < 0.7) { const k = (j - 0.18) / 0.52; y = Math.sin(k * Math.PI) * 0.75; sy *= 1.08; sxz *= 0.95; }
    else { const k = (j - 0.7) / 0.3; const w = Math.sin(k * Math.PI); sy *= 1 - 0.12 * w; sxz *= 1 + 0.09 * w; }
  }
  bounce.scale.set(sxz, sy, sxz);
  bounce.position.y = y;

  // 耳：表情に合わせてふわっと上下 + ゆらゆら
  const targetDy = EAR_DY[mood];
  ears.forEach((e, i) => {
    e.position.y += (targetDy - e.position.y) * 0.12;
    e.rotation.z = Math.sin(t * 1.6 + i) * 0.025 * (i ? 1 : -1);
  });
  topknot.rotation.z = Math.sin(t * 1.3) * 0.02;
  tail.rotation.y = Math.sin(t * 5) * 0.08;

  // まばたき
  if (t > nextBlink && blinkT < 0) blinkT = t;
  let eyeS = 1;
  if (blinkT >= 0) {
    const b = (t - blinkT) / 0.16;
    eyeS = b < 0.5 ? 1 - b * 1.8 : 0.1 + (b - 0.5) * 1.8;
    if (b >= 1) { blinkT = -1; eyeS = 1; nextBlink = t + 2.5 + Math.random() * 3; }
  }
  faceGroups[mood].children.forEach(c => { if (c.userData.blink) c.scale.y = eyeS; });
  if (faceGroups.worried.userData.sweat) faceGroups.worried.userData.sweat.position.y += Math.sin(t * 3) * 0.0006;

  controls.autoRotate = spinning;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

/* ---------- UI ---------- */
document.querySelectorAll('#mood button').forEach(b => b.addEventListener('click', () => setMood(b.dataset.v)));
document.getElementById('plump').addEventListener('input', e => { plump = +e.target.value; });
const spinBtn = document.getElementById('spin');
spinBtn.addEventListener('click', () => { spinning = !spinning; spinBtn.textContent = spinning ? 'とめる' : 'くるくる回転'; });

// タップでジャンプ（ドラッグとは区別する）
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const ndc = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (ray.intersectObject(bounce, true).length && jumpT < 0) jumpT = clock.getElapsedTime();
});

// GLB書き出し（埋め込み表示ではダウンロードできないので隠す）
const exportBtn = document.getElementById('export');
const embedded = (() => { try { return window.top !== window.self; } catch (e) { return true; } })();
if (embedded) {
  exportBtn.remove();
  document.getElementById('hint').textContent = 'GLBでの保存は、リポジトリの pet3d.html をブラウザで開くと使えるよ';
} else {
  exportBtn.addEventListener('click', () => {
    const prev = { s: root.scale.clone(), bs: bounce.scale.clone(), by: bounce.position.y };
    root.scale.set(1, 1, 1); bounce.scale.set(1, 1, 1); bounce.position.y = 0;
    new GLTFExporter().parse(root, buf => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
      a.download = `mochipoo_${mood}.glb`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, err => console.error(err), { binary: true, onlyVisible: true });
    root.scale.copy(prev.s); bounce.scale.copy(prev.bs); bounce.position.y = prev.by;
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  placeCamera();
});

document.getElementById('loading').remove();
window.__pet3d = { setMood, setPlump: v => { plump = v; }, camera, controls };
animate();
