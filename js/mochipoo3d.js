/* =========================================================
   もちプー 3Dモデル（共通モジュール）
   3Dビューア（pet3d.html）とアプリのホーム画面の両方で使う。
   2DのSVG（viewBox 200×200）の座標を3Dの体表に投影して、
   顔パーツ・耳・足・着せ替えアイテムの位置をSVG版と一致させている。
   ========================================================= */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- 色（SVG版と同じパレット） ---------- */
const C = {
  body: 0xFBF1EA, bodyShade: 0xF0E0D5,
  curl: 0xE9BFA0, curlLine: 0xC8947A,
  ink: 0x4A3540, blush: 0xE8A9B0, toe: 0xD9A98A, sweat: 0xB5D8E8,
};

/* ---------- SVG座標 → 3D座標 ---------- */
// SVGで体の幅152px ≒ 3Dで2.32。足の底(y=186)を3Dの y=0 にする
export const K = 2.32 / 152;
const sx2 = x => (x - 100) * K;
const sy2 = y => (186 - y) * K;

export const ITEM_IDS = ['ribbon', 'flower', 'beret', 'crown', 'star', 'sprout', 'glasses', 'cherry', 'heart'];

/**
 * もちプーを作る。
 * @param {{detail?: 'high'|'low'}} opt  low はスマホのホーム画面向け（ポリゴン数を減らす）
 * @returns {{object: THREE.Group, setMood: Function, setPlump: Function, setItem: Function, jump: Function, update: Function, mood: string}}
 */
export function createMochiPoo({ detail = 'high' } = {}) {
  const HI = detail === 'high';

  /* ---------- マテリアル ---------- */
  const std = (color, roughness = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const M = {
    body: new THREE.MeshPhysicalMaterial({
      color: C.body, roughness: 0.62, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xFFE3EA),
      clearcoat: 0.08, clearcoatRoughness: 0.6,
    }),
    feet: new THREE.MeshPhysicalMaterial({ color: C.bodyShade, roughness: 0.65, sheen: 0.6, sheenColor: new THREE.Color(0xFFE3EA) }),
    curl: new THREE.MeshPhysicalMaterial({ color: C.curl, roughness: 0.85, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xFFE6D2) }),
    curlLine: std(C.curlLine, 0.8),
    ink: new THREE.MeshPhysicalMaterial({ color: C.ink, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    inkMatte: std(C.ink, 0.5),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.55, depthWrite: false }),
    tongue: std(0xF29BAA, 0.5),
    toe: std(C.toe, 0.6),
    sweat: new THREE.MeshPhysicalMaterial({ color: C.sweat, roughness: 0.05, transmission: 0.35, thickness: 0.2, clearcoat: 1 }),
  };

  /* ---------- 体（大福のかたち） ---------- */
  function bodyGeometry() {
    const g = HI ? new THREE.SphereGeometry(1, 128, 96) : new THREE.SphereGeometry(1, 72, 48);
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
    g.scale(2.32 / (b.max.x - b.min.x), 1.74 / (b.max.y - b.min.y), 1.95 / (b.max.z - b.min.z));
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y + 0.04, 0);
    g.computeVertexNormals();
    return g;
  }

  /* ---------- 巻き毛のボール（でこぼこ + くるんとしたカール線） ---------- */
  function curlBallGeometry(r, seed) {
    // 頂点を結合してからでこぼこさせる（つながっていないとカクカクの陰影になる）
    let g = new THREE.IcosahedronGeometry(1, HI ? 5 : 3);
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
    const arc = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.075, 8, HI ? 28 : 18, Math.PI * 1.45), M.curlLine);
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
  function hitOn(targets, origin, dir) {
    ray.set(origin, dir.normalize());
    const h = ray.intersectObjects(targets, true)[0];
    if (!h) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    return { p: h.point.clone(), n };
  }
  const hit = (origin, dir) => hitOn([body], origin, dir);
  // SVG座標(x,y)を正面から体に投影
  function front(x, y) {
    const X = sx2(x), Y = sy2(y);
    return hit(new THREE.Vector3(X, Y, 5), new THREE.Vector3(0, 0, -1))
      || { p: new THREE.Vector3(X, Y, 0), n: new THREE.Vector3(Math.sign(X) || 1, 0, 0) };
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
  // 体表にぴったり沿う平らなパーツ（チーク・ベロ）
  function decal(x, y, w, h, mat, lift = 0.006) {
    const s = front(x, y);
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40), mat);
    m.scale.set(w * K, h * K, 1);
    m.position.copy(s.p.add(s.n.clone().multiplyScalar(lift)));
    m.lookAt(m.position.clone().add(s.n));
    return m;
  }
  // 体表に置く立体パーツ（体表の向きにあわせる）
  function onSurface(obj, s, lift) {
    obj.position.copy(s.p.clone().add(s.n.clone().multiplyScalar(lift)));
    obj.lookAt(obj.position.clone().add(s.n));
    return obj;
  }

  /* ---------- 組み立て ---------- */
  const root = new THREE.Group();     // 体型（横の伸び縮み）
  const bounce = new THREE.Group();   // ジャンプ・呼吸
  root.add(bounce);
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
      const s = front(sgn < 0 ? x : 200 - x, y);
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
    const s = hit(new THREE.Vector3(X, 5, Z), new THREE.Vector3(0, -1, 0));
    if (!s) return;
    const c = s.p.add(s.n.clone().multiplyScalar(r * 0.35)).add(new THREE.Vector3(0, up, 0));
    topknot.add(curlBall(c, r, s.n.clone().add(new THREE.Vector3(0, 0.4 + up * 3, 0.5))));
  });
  bounce.add(topknot);
  root.updateMatrixWorld(true);
  // おだんごの表面に投影（アイテム用）
  const onTop = (X, Z) => hitOn([topknot, body], new THREE.Vector3(X, 5, Z), new THREE.Vector3(0, -1, 0));

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
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), M.ink);
    e.scale.set(5.3 * K, 7 * K, 3.2 * K);
    onSurface(g, front(x, y), 0.01);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(2 * K, 12, 8), M.white);
    hl.position.set(-1.5 * K, 2.5 * K, 2.9 * K);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(1 * K, 10, 8), M.white);
    hl2.position.set(2.5 * K, -2.5 * K, 2.9 * K);
    g.add(e, hl, hl2);
    g.userData.blink = true;
    return g;
  }
  function nose(y) {
    const g = new THREE.Group();
    const n = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), M.ink);
    n.scale.set(4.6 * K, 4 * K, 3.4 * K);
    onSurface(g, front(100, y), 0.015);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(1.2 * K, 10, 8), M.white);
    hl.position.set(-1.5 * K, 1.5 * K, 3.2 * K);
    g.add(n, hl);
    return g;
  }
  const blushes = () => [decal(62, 143, 10, 6, M.blush), decal(138, 143, 10, 6, M.blush)];
  // うれしい顔の口：SVGの口の形をそのまま押し出して、体表に貼る
  function openMouth() {
    const shape = new THREE.Shape();
    const P = (x, y) => [(x - 100) * K, -(y - 155) * K];
    shape.moveTo(...P(89, 148));
    shape.quadraticCurveTo(...P(100, 163), ...P(111, 148));
    shape.quadraticCurveTo(...P(111, 161), ...P(100, 163));
    shape.quadraticCurveTo(...P(89, 161), ...P(89, 148));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 24 });
    return onSurface(new THREE.Mesh(geo, M.inkMatte), front(100, 155), 0.004);
  }
  const faces = {
    normal() {
      const g = new THREE.Group();
      g.add(eyeDot(78, 131), eyeDot(122, 131), nose(140), ...blushes());
      // ω の口
      g.add(surfaceTube([...quad([91, 148], [95, 156], [100, 148]), ...quad([100, 148], [105, 156], [109, 148]).slice(1)], 1.05 * K, M.inkMatte));
      return g;
    },
    happy() {
      const g = new THREE.Group();
      g.add(surfaceTube(quad([70, 134], [78, 121], [86, 134]), 1.6 * K, M.inkMatte));
      g.add(surfaceTube(quad([114, 134], [122, 121], [130, 134]), 1.6 * K, M.inkMatte));
      g.add(nose(140), ...blushes(), openMouth(), decal(100, 158, 4.5, 2.6, M.tongue, 0.012));
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
      drop.userData.baseY = drop.position.y;
      g.add(drop);
      g.userData.sweat = drop;
      return g;
    },
  };
  const faceGroups = {};
  Object.keys(faces).forEach(k => { faceGroups[k] = faces[k](); faceGroups[k].visible = false; bounce.add(faceGroups[k]); });
  const EAR_DY = { normal: 0, happy: 10 * K, worried: -8 * K };

  /* ---------- 着せ替えアイテム（SVG版と同じ位置に） ---------- */
  const IM = {
    pink: std(0xFF9EB8, 0.45), pinkD: std(0xF27C9E, 0.45), white: std(0xFFFFFF, 0.5),
    butter: std(0xFFE59E, 0.4), star: std(0xFFD45E, 0.35), gold: std(0xFFDC7A, 0.3, { metalness: 0.35 }),
    lav: std(0xCDBDFF, 0.75), lavL: std(0xDCD0FF, 0.75), lavD: std(0xA996F2, 0.6),
    mint: std(0xA9E8D2, 0.5), mintD: std(0x78CFB2, 0.5), frame: std(0xA48C98, 0.35, { metalness: 0.2 }),
    cherry: new THREE.MeshPhysicalMaterial({ color: 0xFF7E9E, roughness: 0.15, clearcoat: 1 }),
  };
  const sph = (r, mat, seg = 20) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)), mat);
  // 頭のおだんごの上に、正面やや上向きで置く
  function onHead(obj, X, Z, lift, tiltX = -0.35, tiltZ = 0, scale = 1) {
    const s = onTop(X, Z) || { p: new THREE.Vector3(X, 2.2, Z) };
    obj.position.copy(s.p).add(new THREE.Vector3(0, lift, 0));
    obj.rotation.set(tiltX, 0, tiltZ);
    obj.scale.setScalar(scale);
    return obj;
  }
  function extruded(points, depth, mat) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 3 });
    geo.center();
    return new THREE.Mesh(geo, mat);
  }
  const ITEM_BUILD = {
    ribbon() {
      const g = new THREE.Group();
      [-1, 1].forEach(s => {
        const lobe = sph(1, IM.pink, 24);
        lobe.scale.set(0.13, 0.085, 0.06);
        lobe.position.x = s * 0.11;
        lobe.rotation.z = -s * 0.25;
        const tl = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.1, 4, 8), IM.pinkD);
        tl.position.set(s * 0.045, -0.08, 0);
        tl.rotation.z = s * 0.5;
        g.add(lobe, tl);
      });
      g.add(sph(0.05, IM.pinkD));
      return onHead(g, 0.36, 0.26, 0.0, -0.45, -0.35, 1.7);
    },
    flower() {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = sph(1, IM.white);
        p.scale.set(0.055, 0.08, 0.025);
        p.position.set(Math.sin(a) * 0.075, Math.cos(a) * 0.075, 0);
        p.rotation.z = -a;
        g.add(p);
      }
      const c = sph(0.042, IM.butter);
      c.position.z = 0.015;
      g.add(c);
      return onHead(g, -0.38, 0.28, 0.0, -0.5, 0.25, 1.75);
    },
    beret() {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), IM.lav);
      cap.scale.set(0.7, 0.3, 0.64);
      const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 12, 48), IM.lavL);
      band.rotation.x = Math.PI / 2;
      band.scale.set(0.64, 0.58, 0.64);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.09, 12), IM.lavD);
      stem.position.y = 0.32;
      g.add(cap, band, stem);
      return onHead(g, 0, 0, -0.3, -0.16, -0.14);
    },
    crown() {
      const g = new THREE.Group();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.11, 40, 1, true), IM.gold);
      band.material.side = THREE.DoubleSide;
      g.add(band);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.13, 16), IM.gold);
        spike.position.set(Math.sin(a) * 0.24, 0.115, Math.cos(a) * 0.24);
        const ball = sph(0.024, IM.gold, 12);
        ball.position.set(Math.sin(a) * 0.24, 0.19, Math.cos(a) * 0.24);
        g.add(spike, ball);
      }
      const gem = sph(0.035, IM.pink, 16);
      gem.position.set(0, 0, 0.255);
      g.add(gem);
      return onHead(g, 0, 0.02, -0.1, -0.14, 0, 1.35);
    },
    star() {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.05 : 0.115;
        pts.push([Math.sin(a) * r, Math.cos(a) * r]);
      }
      return onHead(extruded(pts, 0.03, IM.star), 0.4, 0.3, 0.02, -0.4, -0.2, 1.8);
    },
    sprout() {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.17, 10), IM.mintD);
      stem.position.y = 0.085;
      g.add(stem);
      [-1, 1].forEach(s => {
        const leaf = sph(1, IM.mint);
        leaf.scale.set(0.09, 0.032, 0.05);
        leaf.position.set(s * 0.075, 0.18, 0);
        leaf.rotation.z = s * 0.45;
        g.add(leaf);
      });
      return onHead(g, 0.03, 0.02, -0.04, -0.1, 0, 1.7);
    },
    glasses() {
      const g = new THREE.Group();
      [78, 122].forEach(x => {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(13 * K, 0.012, 10, 40), IM.frame);
        g.add(onSurface(rim, front(x, 131), 0.07));
      });
      const bridge = quad([91, 131], [100, 125], [109, 131]).map(([x, y]) => { const s = front(x, y); return s.p.add(s.n.multiplyScalar(0.07)); });
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bridge), 16, 0.011, 8), IM.frame));
      return g;
    },
    cherry() {
      const g = new THREE.Group();
      const tip = new THREE.Vector3(0.005, 0.15, 0);
      [[-0.05, 0], [0.055, -0.012]].forEach(([x, y]) => {
        const c = sph(0.055, IM.cherry);
        c.position.set(x, y, 0);
        const hl = sph(0.013, IM.white, 8);
        hl.position.set(x - 0.02, y + 0.02, 0.048);
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, y + 0.05, 0), new THREE.Vector3(x * 0.6, y + 0.12, 0), tip);
        g.add(c, hl, new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.008, 6), IM.mintD));
      });
      return onHead(g, -0.36, 0.3, 0.0, -0.35, 0.15, 1.7);
    },
    heart() {
      const pts = [];
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 2;
        pts.push([16 * Math.sin(t) ** 3 * 0.0045, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 0.0045]);
      }
      const h = onSurface(extruded(pts, 0.012, IM.pink), front(138, 152), 0.015);
      h.scale.setScalar(2);
      return h;
    },
  };
  const itemCache = {};
  let currentItem = null;
  function setItem(id) {
    if (currentItem === (id || null)) return;
    if (currentItem && itemCache[currentItem]) bounce.remove(itemCache[currentItem]);
    currentItem = id && ITEM_BUILD[id] ? id : null;
    if (!currentItem) return;
    if (!itemCache[currentItem]) {
      const obj = ITEM_BUILD[currentItem]();
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      itemCache[currentItem] = obj;
    }
    bounce.add(itemCache[currentItem]);
  }

  /* ---------- 状態とアニメーション ---------- */
  let mood = 'normal', plump = 0, jumpT = -1, lastT = 0, nextBlink = 2.5, blinkT = -1;
  function setMood(m) {
    if (!faceGroups[m]) m = 'normal';
    mood = m;
    Object.entries(faceGroups).forEach(([k, g]) => { g.visible = k === m; });
  }
  setMood('normal');

  function update(t) {
    lastT = t;
    // 体型：横と奥行きだけ伸び縮み（SVG版と同じ 0.86〜1.14）
    root.scale.set(1 + plump * 0.14, 1, 1 + plump * 0.1);

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
    ears.forEach((e, i) => {
      e.position.y += (EAR_DY[mood] - e.position.y) * 0.12;
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
    const sw = faceGroups.worried.userData.sweat;
    if (sw) sw.position.y = sw.userData.baseY + Math.sin(t * 3) * 0.015;
  }

  return {
    object: root,
    hitTarget: bounce,
    setMood,
    setPlump(v) { plump = Math.max(-1, Math.min(1, +v || 0)); },
    setItem,
    jump() { if (jumpT < 0) jumpT = lastT; },
    update,
    get mood() { return mood; },
    // GLB書き出し用：アニメーションの変形を一時的に戻して実行する
    withRestPose(fn) {
      const prev = { s: root.scale.clone(), bs: bounce.scale.clone(), by: bounce.position.y };
      root.scale.set(1, 1, 1); bounce.scale.set(1, 1, 1); bounce.position.y = 0;
      try { return fn(root); } finally { root.scale.copy(prev.s); bounce.scale.copy(prev.bs); bounce.position.y = prev.by; }
    },
  };
}
