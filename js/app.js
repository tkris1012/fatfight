/* =========================================================
   ぷにっとファイト  —  app.js
   食べた分が「モフラ」になって攻めてくる。
   消費した分が攻撃になる。残った分は「脂肪のお城」に住みつく。
   お城のHP = 実際の体脂肪量(kg) × 7,200kcal
   ========================================================= */
'use strict';
(() => {

/* ---------- 定数 ---------- */
const KEY = 'punifight.v1';
const KCAL_PER_KG = 7200;      // 体脂肪1kg ≒ 7,200kcal
const DAILY_CAP = 1000;        // 1日にお城へ与えられるダメージの上限（極端な食事制限で得をさせない）
const MONSTER_HP = 150;        // モフラ1匹あたりのHP
const HUNGRY_RATIO = 0.9;      // 摂取が基礎代謝×0.9未満なら「はらぺこ」

const FOODS = [
  ['🍚', 'ごはん（茶碗1杯）', 234], ['🍙', 'おにぎり', 180], ['🍞', '食パン（1枚）', 158],
  ['🥐', 'クロワッサン', 180], ['🥗', 'サラダ', 80], ['🍳', '目玉焼き', 90],
  ['🥣', 'みそ汁', 40], ['🍜', 'ラーメン', 500], ['🍝', 'パスタ', 600],
  ['🍛', 'カレーライス', 700], ['🥢', 'うどん・そば', 380], ['🍱', 'お弁当', 700],
  ['🍣', 'お寿司（8貫）', 400], ['🍗', 'からあげ定食', 850], ['🐟', '焼き魚定食', 600],
  ['🥪', 'サンドイッチ', 350], ['🍔', 'ハンバーガー', 500], ['🥞', 'パンケーキ', 500],
  ['🍌', 'バナナ', 86], ['🥛', 'ヨーグルト', 90], ['☕', 'カフェラテ', 130],
  ['🧋', 'タピオカミルクティー', 350], ['🍰', 'ケーキ', 350], ['🍫', 'チョコ（1/2枚）', 140],
  ['🍪', 'クッキー（3枚）', 150], ['🍦', 'アイス', 200], ['🥔', 'ポテチ（1/2袋）', 170],
  ['🍺', 'ビール（350ml）', 140], ['🍷', 'ワイン（1杯）', 90], ['🍹', 'チューハイ（350ml）', 180],
];
const SIZES = [['すくなめ', 0.7], ['ふつう', 1], ['おおめ', 1.4]];

// [絵文字, 名前, METs]
const EXERCISES = [
  ['🚶‍♀️', 'おさんぽ', 3.5], ['👟', '早歩き', 4.3], ['🏃‍♀️', 'ジョギング', 7.0],
  ['🧘‍♀️', 'ヨガ', 2.5], ['🤸‍♀️', 'ピラティス', 3.0], ['💪', '筋トレ', 3.5],
  ['🙆‍♀️', 'ストレッチ', 2.3], ['💃', 'ダンス', 5.0], ['🚲', '自転車', 4.0],
  ['🏊‍♀️', '水泳', 6.0], ['🧹', 'おそうじ・家事', 3.3], ['🪜', '階段のぼり', 4.0],
];
const MINUTES = [10, 15, 20, 30, 45, 60];

const AREAS = ['わたあめ平原', 'いちごの森', 'ミルクの湖', 'マカロン谷', 'はちみつの丘',
  'ラベンダー畑', 'こんぺいとう山', 'ゆめいろ雲の上', 'おほしさま神殿', 'しあわせの塔'];

const ACTIVITY = [
  [1.2, 'ほぼ座りがち', 'デスクワーク中心・あまり歩かない'],
  [1.375, 'ふつう', '通勤や家事でそこそこ歩く'],
  [1.55, 'よく動く', '立ち仕事・毎日よく歩く'],
];

/* ---------- 着せ替えアイテム（ペットの200×200座標系で描画） ---------- */
const ITEMS = [
  { id: 'ribbon', vb: '108 28 56 56', name: 'ももいろリボン', svg: `<g transform="translate(136 56) rotate(18)"><ellipse cx="-11" cy="0" rx="12" ry="8" fill="#FF9EB8"/><ellipse cx="11" cy="0" rx="12" ry="8" fill="#FF9EB8"/><circle r="5" fill="#F27C9E"/><path d="M-3 4 l-6 12 M3 4 l6 12" stroke="#F27C9E" stroke-width="4" stroke-linecap="round"/></g>` },
  { id: 'flower', vb: '48 40 40 40', name: 'おはなピン', svg: `<g transform="translate(68 60)">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-8" rx="6" ry="8" fill="#FFFFFF" stroke="#FFD1DC" stroke-width="1.5" transform="rotate(${a})"/>`).join('')}<circle r="5" fill="#FFE59E"/></g>` },
  { id: 'beret', vb: '50 -5 100 100', name: 'ラベンダーベレー', svg: `<g><ellipse cx="100" cy="50" rx="48" ry="16" fill="#CDBDFF"/><ellipse cx="100" cy="45" rx="43" ry="12" fill="#DCD0FF"/><rect x="97" y="27" width="6" height="9" rx="3" fill="#A996F2"/></g>` },
  { id: 'crown', vb: '72 14 56 56', name: 'ちいさな王冠', svg: `<g transform="translate(100 40)"><path d="M-20 6 L-22 -12 L-10 -2 L0 -16 L10 -2 L22 -12 L20 6 Z" fill="#FFE59E" stroke="#F5C866" stroke-width="2" stroke-linejoin="round"/><circle cx="0" cy="-2" r="3" fill="#FF9EB8"/></g>` },
  { id: 'star', vb: '114 42 40 40', name: 'おほしさまピン', svg: `<g transform="translate(134 62) rotate(12)"><path d="M0 -12 L3.5 -4 L12 -3.5 L5.5 2 L7.5 10.5 L0 6 L-7.5 10.5 L-5.5 2 L-12 -3.5 L-3.5 -4 Z" fill="#FFE59E" stroke="#F5C866" stroke-width="1.5" stroke-linejoin="round"/></g>` },
  { id: 'sprout', vb: '83 16 40 40', name: 'ふたばちゃん', svg: `<g transform="translate(103 40)"><path d="M0 2 V-12" stroke="#78CFB2" stroke-width="3" stroke-linecap="round"/><ellipse cx="-8" cy="-14" rx="9" ry="5" fill="#A9E8D2" transform="rotate(-25 -8 -14)"/><ellipse cx="8" cy="-14" rx="9" ry="5" fill="#A9E8D2" transform="rotate(25 8 -14)"/></g>` },
  { id: 'glasses', vb: '60 91 80 80', name: 'まんまるメガネ', svg: `<g fill="none" stroke="#A48C98" stroke-width="3"><circle cx="78" cy="131" r="13"/><circle cx="122" cy="131" r="13"/><path d="M91 131 Q100 125 109 131"/></g>` },
  { id: 'cherry', vb: '54 42 34 34', name: 'さくらんぼピン', svg: `<g transform="translate(70 58)"><path d="M0 -14 Q-2 -4 -6 4 M0 -14 Q4 -4 7 5" stroke="#78CFB2" stroke-width="2" fill="none"/><circle cx="-6" cy="7" r="6" fill="#FF7E9E"/><circle cx="7" cy="8" r="6" fill="#FF7E9E"/><circle cx="-8" cy="5" r="1.6" fill="#fff"/><circle cx="5" cy="6" r="1.6" fill="#fff"/></g>` },
  { id: 'heart', vb: '122 142 28 28', name: 'ほっぺハート', svg: `<g transform="translate(136 156)"><path d="M0 4 C-8 -2 -6 -9 0 -5 C6 -9 8 -2 0 4 Z" fill="#FF9EB8"/></g>` },
];

/* ---------- 小さなユーティリティ ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => Math.random().toString(36).slice(2, 10);
const sum = (arr, f) => arr.reduce((a, x) => a + (+x[f] || 0), 0);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---------- 日付 ---------- */
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const today = () => dkey();
const md = k => { const d = parseKey(k); return `${d.getMonth() + 1}/${d.getDate()}`; };
const WD = ['日', '月', '火', '水', '木', '金', '土'];

/* ---------- 保存 ---------- */
function defaults() {
  return {
    version: 1, profile: null, days: {}, castle: { initial: 0, damage: 0 }, calib: 1,
    items: [], equipped: null, lastJudged: null, lastMirror: null, recentFoods: [],
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.profile) return Object.assign(defaults(), s);
  } catch (e) { /* localStorageが使えない環境でも動くように */ }
  return defaults();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
let S = load();

const getDay = k => S.days[k] || { meals: [], ex: [], weight: null, result: null };
function ensureDay(k) {
  if (!S.days[k]) S.days[k] = { meals: [], ex: [], weight: null, result: null };
  return S.days[k];
}

/* =========================================================
   からだの計算（現実との整合性はここに集約）
   ========================================================= */
function weightOn(k) {
  let best = null;
  for (const kk in S.days) if (kk <= k && S.days[kk].weight && (!best || kk > best)) best = kk;
  return best ? S.days[best].weight : S.profile.startWeight;
}
// Mifflin-St Jeor式
function bmr(w) {
  const p = S.profile;
  return 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
}
// 運動なしでも1日に使うカロリー（基礎代謝 × 生活の活動量 × 真実の鏡の補正）
const baseBurn = k => bmr(weightOn(k)) * S.profile.activity * S.calib;
// 運動の消費カロリー（安静時の1METぶんは基礎代謝と重複するので引く）
const exKcal = (mets, min, w) => Math.max(0, mets - 1) * w * (min / 60) * 1.05;

function totals(k) {
  const d = getDay(k);
  const intake = sum(d.meals, 'kcal');
  const ex = sum(d.ex, 'kcal');
  const base = baseBurn(k);
  return { intake, ex, base, burn: base + ex };
}
function live() {
  const t = totals(today());
  const now = new Date();
  const frac = (now.getHours() * 60 + now.getMinutes()) / 1440;
  const burnSoFar = t.base * frac + t.ex;            // バリアは1日かけてじわじわ削る
  const remaining = Math.max(0, t.intake - burnSoFar);
  const projected = t.burn - t.intake;               // 今夜の判定予想（＋なら勝ち）
  return { ...t, frac, burnSoFar, remaining, projected };
}
function walkMinutesFor(kcal) {
  const per = exKcal(4.3, 1, weightOn(today()));
  return Math.max(5, Math.ceil(kcal / per / 5) * 5);
}
// 体脂肪率が不明なときの推定（Deurenberg式）
function estimateBF(p) {
  const bmi = p.startWeight / ((p.height / 100) ** 2);
  return clamp(1.2 * bmi + 0.23 * p.age - 10.8 * (p.sex === 'm' ? 1 : 0) - 5.4, 8, 50);
}

/* ---------- お城 ---------- */
const castleHP = () => Math.max(0, S.castle.initial - S.castle.damage);
function areaInfo() {
  const dmg = Math.max(0, S.castle.damage);
  const idx = Math.floor(dmg / KCAL_PER_KG);
  const into = dmg - idx * KCAL_PER_KG;
  const total = Math.max(1, Math.ceil(S.profile.startWeight - S.profile.goalWeight));
  const lap = Math.floor(idx / AREAS.length);
  const name = AREAS[idx % AREAS.length] + (lap ? ` ${lap + 1}` : '');
  return { idx, into, left: KCAL_PER_KG - into, pct: into / KCAL_PER_KG, total, name, cleared: idx >= total };
}

/* ---------- 連続きろく ---------- */
function streak() {
  let n = 0, k = today();
  if (getDay(k).meals.length) n++;
  k = addDays(k, -1);
  while (S.days[k] && S.days[k].meals.length) { n++; k = addDays(k, -1); }
  return n;
}

/* ---------- ペットの体型（体重の傾向で変わる） ---------- */
function trendKg() {
  const t = today();
  const avg = (from, to) => {
    const ws = [];
    for (let k = from; k <= to; k = addDays(k, 1)) if (S.days[k] && S.days[k].weight) ws.push(S.days[k].weight);
    return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null;
  };
  const a = avg(addDays(t, -6), t), b = avg(addDays(t, -13), addDays(t, -7));
  if (a != null && b != null) return a - b;
  // 体重データが足りないときは、直近7日のバトル結果から推定
  let s = 0;
  for (let i = 1; i <= 7; i++) { const r = getDay(addDays(t, -i)).result; if (r && r.applied) s -= r.applied; }
  return s / KCAL_PER_KG;
}
function petShape() {
  const d = clamp(trendKg(), -0.8, 0.8);
  const sx = 1 + d * 0.18;
  const label = d > 0.2 ? 'ちょっぴり まんまる' : d < -0.2 ? 'すっきり' : 'いいかんじ';
  return { sx, label, d };
}

/* =========================================================
   バトル判定（日付が変わったら前日を判定）
   ========================================================= */
function judgePending() {
  const t = today();
  const out = [];
  let k = S.lastJudged ? addDays(S.lastJudged, 1) : S.profile.startDate;
  let guard = 0;
  while (k < t && guard++ < 400) {
    const r = judgeDay(k);
    if (r) out.push(r);
    S.lastJudged = k;
    k = addDays(k, 1);
  }
  save();
  return out;
}
function judgeDay(k) {
  const d = S.days[k];
  // 記録がない日は「霧の日」。勝ちにも負けにもしない（記録しないほうが得、を作らない）
  if (!d || !d.meals.length) { if (d) d.result = { type: 'fog' }; return { k, type: 'fog' }; }
  const t = totals(k);
  const diff = t.burn - t.intake;
  const hungry = t.intake < bmr(weightOn(k)) * HUNGRY_RATIO;
  const applied = diff > 0 ? Math.min(diff, DAILY_CAP) : diff;
  S.castle.damage += applied;
  const type = diff >= 0 ? 'win' : 'lose';
  let drop = null;
  if (type === 'win' && !hungry) {
    const rate = 0.2 + Math.min(0.2, streak() * 0.02) + (diff > 300 ? 0.05 : 0);
    const unowned = ITEMS.filter(i => !S.items.includes(i.id));
    if (unowned.length && Math.random() < rate) { drop = pick(unowned).id; S.items.push(drop); }
  }
  d.result = { type, intake: Math.round(t.intake), burn: Math.round(t.burn), diff: Math.round(diff), applied: Math.round(applied), hungry, drop };
  return { k, ...d.result };
}

/* =========================================================
   真実の鏡：体重の実測から消費カロリーの推定を補正
   ========================================================= */
function mirror() {
  const t = today();
  const keys = [];
  const from = S.profile.startDate > addDays(t, -28) ? S.profile.startDate : addDays(t, -28);
  for (let k = from; k < t; k = addDays(k, 1)) keys.push(k);
  const logged = keys.filter(k => S.days[k] && S.days[k].result && ['win', 'lose'].includes(S.days[k].result.type));
  if (logged.length < 14) return { ready: false, need: 14 - logged.length };
  const wOf = ks => ks.map(k => S.days[k] && S.days[k].weight).filter(Boolean);
  const first = wOf(keys.slice(0, 7)), last = wOf(keys.slice(-7));
  if (first.length < 2 || last.length < 2) return { ready: false, needWeight: true };
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const wA = avg(first), wB = avg(last), span = keys.length - 7;
  const avgIntake = avg(logged.map(k => S.days[k].result.intake));
  const predBurn = avg(logged.map(k => S.days[k].result.burn));
  const obsBurn = avgIntake + (wA - wB) * KCAL_PER_KG / span;
  const factor = clamp(obsBurn / predBurn, 0.85, 1.15);
  const coverage = logged.length / keys.length;
  return { ready: true, wA, wB, avgIntake, predBurn, obsBurn, factor, coverage };
}

/* =========================================================
   SVG：ペット「もちプー」とモンスター「モフラ」
   ========================================================= */
// もちプー：つるんとしたお餅の体 × トイプードルの巻き毛（耳・頭のおだんご）
// 共通パーツ（#mp-body, #mp-ear）は index.html の <defs> に1つだけ置いている
const PET_FACE = {
  normal: {
    earDy: 0,
    eyes: `<g class="blink"><ellipse cx="78" cy="131" rx="5.3" ry="7" fill="#5B4350"/><circle cx="76.5" cy="128.5" r="2" fill="#fff"/><circle cx="80.5" cy="133.5" r="1" fill="#fff"/></g>
           <g class="blink"><ellipse cx="122" cy="131" rx="5.3" ry="7" fill="#5B4350"/><circle cx="120.5" cy="128.5" r="2" fill="#fff"/><circle cx="124.5" cy="133.5" r="1" fill="#fff"/></g>`,
    nose: `<circle cx="100" cy="140" r="4.2" fill="#5B4350"/><circle cx="98.5" cy="138.5" r="1.2" fill="#fff"/>`,
    mouth: `<path d="M91 148Q95 155 100 148Q105 155 109 148" fill="none" stroke="#5B4350" stroke-width="2.2"/>`,
  },
  happy: {
    earDy: -10,
    eyes: `<path d="M70 134Q78 123 86 134" fill="none" stroke="#5B4350" stroke-width="3"/><path d="M114 134Q122 123 130 134" fill="none" stroke="#5B4350" stroke-width="3"/>`,
    nose: `<circle cx="100" cy="140" r="4.2" fill="#5B4350"/><circle cx="98.5" cy="138.5" r="1.2" fill="#fff"/>`,
    mouth: `<path d="M89 148Q100 163 111 148Q111 161 100 163Q89 161 89 148Z" fill="#5B4350"/><path d="M96 158Q100 155 104 158" fill="none" stroke="#E8A9B0" stroke-width="3"/>`,
  },
  worried: {
    earDy: 8,
    eyes: `<g class="blink"><ellipse cx="78" cy="134" rx="5.3" ry="7" fill="#5B4350"/><circle cx="76.5" cy="134" r="2" fill="#fff"/><circle cx="80.5" cy="137" r="1" fill="#fff"/></g>
           <g class="blink"><ellipse cx="122" cy="134" rx="5.3" ry="7" fill="#5B4350"/><circle cx="120.5" cy="134" r="2" fill="#fff"/><circle cx="124.5" cy="137" r="1" fill="#fff"/></g>`,
    nose: `<circle cx="100" cy="143" r="4.2" fill="#5B4350"/><circle cx="98.5" cy="141.5" r="1.2" fill="#fff"/>`,
    mouth: `<path d="M96 154Q100 151 104 154" fill="none" stroke="#5B4350" stroke-width="2"/><path d="M143 114Q138 123 143 127Q148 123 143 114Z" fill="#B5D8E8" stroke="#8EBACD" stroke-width="1"/>`,
  },
};
function petSVG({ sx = 1, mood = 'normal', item = S.equipped } = {}) {
  const f = PET_FACE[mood] || PET_FACE.normal;
  const acc = item ? (ITEMS.find(i => i.id === item) || {}).svg || '' : '';
  return `<svg viewBox="0 0 200 200" aria-label="もちプー">
    <g class="body-g" style="--sx:${sx.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round">
      <ellipse cx="70" cy="177" rx="13" ry="9" fill="#F0E0D5" stroke="#D9C2B6" stroke-width="2.5"/>
      <ellipse cx="130" cy="177" rx="13" ry="9" fill="#F0E0D5" stroke="#D9C2B6" stroke-width="2.5"/>
      <path d="M100 71C65 70 42 88 32 119C22 151 35 178 68 181Q100 187 132 181C165 178 178 151 168 119C158 88 135 70 100 71Z" fill="url(#mp-body)" stroke="#D9C2B6" stroke-width="2.5"/>
      <use href="#mp-ear" transform="translate(0 ${f.earDy})"/>
      <use href="#mp-ear" transform="translate(200 ${f.earDy}) scale(-1 1)"/>
      <use href="#mp-top"/>
      <g fill="#D9A98A"><circle cx="65" cy="178" r="3"/><circle cx="135" cy="178" r="3"/></g>
      <ellipse cx="62" cy="143" rx="10" ry="6" fill="#E8A9B0" opacity=".6"/>
      <ellipse cx="138" cy="143" rx="10" ry="6" fill="#E8A9B0" opacity=".6"/>
      ${f.eyes}${f.nose}${f.mouth}${acc}
    </g>
  </svg>`;
}
function mofuSVG() {
  const puffs = [[50, 56, 28], [28, 52, 17], [72, 52, 17], [37, 36, 15], [63, 36, 15], [50, 29, 15], [29, 70, 14], [71, 70, 14], [50, 76, 17]];
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="94" rx="26" ry="5" fill="rgba(150,110,130,.16)"/>
    <g stroke="#F3D58F" stroke-width="2.5">${puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
    <g fill="url(#g-mofu)">${puffs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
    <ellipse cx="38" cy="34" rx="7" ry="4" fill="#fff" opacity=".85" transform="rotate(-25 38 34)"/>
    <path d="M36 54 q5 5 10 0" stroke="#6E5462" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <path d="M54 54 q5 5 10 0" stroke="#6E5462" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    <circle cx="33" cy="62" r="5" fill="#FFB3A6" opacity=".55"/><circle cx="67" cy="62" r="5" fill="#FFB3A6" opacity=".55"/>
    <ellipse cx="50" cy="63" rx="3.5" ry="3" fill="#C98A7D"/>
    <path d="M48.5 61 h3 v2.2 h-3z" fill="#fff"/>
  </svg>`;
}
function castleSVG(pct) {
  // pctが小さくなるほどお城が縮んでいく
  const s = 0.55 + 0.45 * clamp(pct, 0, 1);
  return `<svg class="castle-ill" viewBox="0 0 60 60"><g transform="translate(30 56) scale(${s.toFixed(3)}) translate(-30 -56)">
    <rect x="12" y="26" width="36" height="30" rx="5" fill="url(#g-castle)" stroke="#EEA0BA" stroke-width="1.5"/>
    <rect x="6" y="18" width="12" height="38" rx="4" fill="#FFE0EA" stroke="#EEA0BA" stroke-width="1.5"/>
    <rect x="42" y="18" width="12" height="38" rx="4" fill="#FFE0EA" stroke="#EEA0BA" stroke-width="1.5"/>
    <path d="M4 19 L12 7 L20 19 Z M40 19 L48 7 L56 19 Z" fill="#CDBDFF" stroke="#A996F2" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M24 56 v-10 a6 6 0 0 1 12 0 v10" fill="#FFF4D9" stroke="#EEA0BA" stroke-width="1.5"/>
    <circle cx="30" cy="34" r="3.5" fill="#FFE59E"/>
  </g></svg>`;
}

/* =========================================================
   ホーム画面
   ========================================================= */
const SLOTS = [[52, 58], [24, 40], [78, 40], [30, 78], [74, 76], [52, 24], [10, 62], [92, 60], [52, 90]];
let lastMood = 'normal';

function moodAndLine(L) {
  const name = esc(S.profile.petName);
  const late = new Date().getHours() >= 20;
  if (!L.intake) return ['normal', 'きょうも いっしょに がんばろ〜'];
  if (late && L.intake < bmr(weightOn(today())) * HUNGRY_RATIO)
    return ['worried', 'おなか ぺこぺこ…。ちゃんと食べるのも だいじだよ'];
  if (L.projected >= 0) {
    if (L.remaining > 0) return ['normal', 'モフラが来てるけど、バリアで じわじわ倒してるよ。このままいけば勝てそう！'];
    return ['happy', pick(['ぜんぶ撃退！ えらいね〜', 'きょうは勝てそう！ その調子♪', `${name}、ごきげんだよ`])];
  }
  const need = -L.projected;
  if (need <= 400) return ['worried', `あと ${fmt(need)}kcal！ ${walkMinutesFor(need)}分 歩いたら勝てるよ`];
  return ['normal', 'きょうは休戦でもだいじょうぶ。あしたまた取り返そ'];
}

function renderHeader() {
  $('#hdr-name').textContent = S.profile.petName;
  const a = areaInfo();
  $('#hdr-area').textContent = `エリア${a.idx + 1}・${a.name}`;
  $('#hdr-streak').textContent = `🌸 ${streak()}日`;
}

function renderCastle() {
  const a = areaInfo();
  const hp = castleHP();
  const goalHP = Math.max(0, S.castle.initial - (S.profile.startWeight - S.profile.goalWeight) * KCAL_PER_KG);
  const pct = S.castle.initial ? hp / S.castle.initial : 1;
  const toGoal = Math.max(0, hp - goalHP);
  $('#castle-card').innerHTML = `
    ${castleSVG(pct)}
    <div class="castle-body">
      <div class="castle-top">
        <span class="castle-title">脂肪のお城 HP</span>
        <span class="castle-hp num">${fmt(hp)}</span>
      </div>
      <div class="bar"><i style="width:${(a.pct * 100).toFixed(1)}%"></i></div>
      <div class="muted">${a.cleared ? '🎉 目標達成！ キープしていこうね' : `つぎのエリア（約1kg）まで あと <b class="num">${fmt(a.left)}</b> ・ 目標まで あと ${fmt1(toGoal / KCAL_PER_KG)}kg`}</div>
    </div>`;
}

const pet3d = () => (window.Pet3D && window.Pet3D.ready ? window.Pet3D : null);
function renderPet(L) {
  const [mood, line] = moodAndLine(L);
  lastMood = mood;
  const shape = petShape();
  const p3 = pet3d();
  if (p3) {
    // 3Dペット：表情・体型（SVG版の横幅0.86〜1.14倍 → -1〜1）・着せ替えを反映
    p3.setMood(mood);
    p3.setPlump(clamp((shape.sx - 1) / 0.14, -1, 1));
    p3.setItem(S.equipped);
  } else {
    $('#pet').innerHTML = petSVG({ sx: shape.sx, mood });
  }
  $('#bubble').textContent = line;
}
function petJump() {
  const p3 = pet3d();
  if (p3) { p3.jump(); return; }
  const pet = $('#pet');
  pet.classList.remove('jump'); void pet.offsetWidth; pet.classList.add('jump');
}

function syncMonsters(remaining, animate = true) {
  const box = $('#monsters');
  const want = remaining > 0 ? clamp(Math.ceil(remaining / MONSTER_HP), 1, SLOTS.length) : 0;
  const alive = $$('.mofu:not(.poof)', box);
  for (let i = alive.length; i < want; i++) {
    const el = document.createElement('div');
    el.className = 'mofu';
    const [x, y] = SLOTS[i];
    el.style.left = x + '%'; el.style.top = y + '%';
    el.style.setProperty('--s', (0.78 + Math.random() * 0.3).toFixed(2));
    el.style.setProperty('--d', (-Math.random() * 2).toFixed(2) + 's');
    if (!animate) el.style.animation = 'none';
    el.innerHTML = mofuSVG();
    box.appendChild(el);
  }
  for (let i = alive.length - 1; i >= want; i--) {
    const el = alive[i];
    el.classList.add('poof');
    sparkAt(el);
    setTimeout(() => el.remove(), 600);
  }
  $('#army-label').textContent = remaining > 0 ? `モフラ ${want}匹 ・ のこりHP ${fmt(remaining)}` : '';
  let msg = $('.clear-msg', $('#stage'));
  if (remaining <= 0 && live().intake > 0) {
    if (!msg) { msg = document.createElement('div'); msg.className = 'clear-msg'; msg.textContent = 'ぜんぶ撃退！✨'; $('#stage').appendChild(msg); }
  } else if (msg) msg.remove();
}

function renderToday(L) {
  const fc = L.projected >= 0 ? 'win' : (-L.projected <= 400 ? 'close' : 'lose');
  const fText = !L.intake
    ? `<span class="big">🌤️</span><span>ごはんを記録すると、モフラがやってくるよ</span>`
    : fc === 'win'
      ? `<span class="big">🌸</span><span>今夜の判定予想：<b>勝ち</b>（＋${fmt(L.projected)}kcal）<br><span class="muted">お城に ${fmt(Math.min(L.projected, DAILY_CAP))} ダメージの見込み</span></span>`
      : fc === 'close'
        ? `<span class="big">🔥</span><span>あと <b>${fmt(-L.projected)}kcal</b> で勝てる！<br><span class="muted">早歩き${walkMinutesFor(-L.projected)}分くらいで逆転できるよ</span></span>`
        : `<span class="big">🌙</span><span>今夜の判定予想：<b>${fmt(-L.projected)}kcal</b> がお城へ…<br><span class="muted">ちょっと動くだけでも、ちゃんと減らせるよ</span></span>`;
  $('#today-card').innerHTML = `
    <h3>きょうのバトル</h3>
    <div class="stats">
      <div class="stat"><div class="label">たべた（モフラのHP）</div><div class="value num">${fmt(L.intake)}<small>kcal</small></div></div>
      <div class="stat"><div class="label">燃やした（いまの時点）</div><div class="value num">${fmt(L.burnSoFar)}<small>kcal</small></div></div>
    </div>
    <div class="bar mint" title="1日の消費見込みのうち、いま燃やしたぶん"><i style="width:${(clamp(L.burnSoFar / Math.max(1, L.burn), 0, 1) * 100).toFixed(1)}%"></i></div>
    <div class="muted">1日の消費見込み ${fmt(L.burn)}kcal（バリア ${fmt(L.base)} ＋ 運動 ${fmt(L.ex)}）</div>
    <div class="forecast ${L.intake ? fc : 'win'}">${fText}</div>`;
}

function renderHome(animate = true) {
  if (!S.profile) return;
  const L = live();
  renderHeader();
  renderCastle();
  renderPet(L);
  syncMonsters(L.remaining, animate);
  renderToday(L);
}

/* ---------- エフェクト ---------- */
function sparkAt(el, chars = ['✨', '💫', '⭐']) {
  const stage = $('#stage');
  const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.textContent = pick(chars);
    s.style.left = (r.left - sr.left + r.width / 2) + 'px';
    s.style.top = (r.top - sr.top + r.height / 2) + 'px';
    s.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
    s.style.setProperty('--dy', (Math.random() * -70 - 10) + 'px');
    stage.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
}
function attackAnimation(done) {
  const stage = $('#stage');
  petJump();
  const sr = stage.getBoundingClientRect(), pr = $('#pet-wrap').getBoundingClientRect();
  const targets = $$('.mofu:not(.poof)');
  const n = Math.max(3, Math.min(6, targets.length));
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const s = document.createElement('span');
      s.className = 'shot';
      s.textContent = pick(['💖', '💗', '✨', '🌟']);
      const x0 = pr.left - sr.left + pr.width * 0.6, y0 = pr.top - sr.top + pr.height * 0.45;
      s.style.left = x0 + 'px'; s.style.top = y0 + 'px';
      stage.appendChild(s);
      const t = targets[i % Math.max(1, targets.length)];
      let x1 = sr.width * 0.75, y1 = sr.height * 0.5;
      if (t) { const tr = t.getBoundingClientRect(); x1 = tr.left - sr.left + tr.width / 2; y1 = tr.top - sr.top + tr.height / 2; }
      requestAnimationFrame(() => {
        s.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) scale(1.3)`;
        s.style.opacity = '0.2';
      });
      setTimeout(() => { s.remove(); if (t) { t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit'); } }, 560);
    }, i * 110);
  }
  setTimeout(done, 560 + n * 110);
}

/* =========================================================
   トースト・シート・モーダル
   ========================================================= */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function openSheet(html, mount) {
  const sh = $('#sheet');
  sh.innerHTML = `<div class="grip"></div>${html}`;
  sh.scrollTop = 0;
  sh.classList.add('open');
  $('#sheet-backdrop').classList.add('open');
  if (mount) mount(sh);
}
function closeSheet() {
  $('#sheet').classList.remove('open');
  $('#sheet-backdrop').classList.remove('open');
}
const modalQueue = [];
function showModal(html, mount) {
  modalQueue.push([html, mount]);
  if (modalQueue.length === 1) nextModal();
}
function nextModal() {
  const m = $('#modal');
  if (!modalQueue.length) { m.classList.remove('open'); m.innerHTML = ''; return; }
  const [html, mount] = modalQueue[0];
  m.innerHTML = `<div class="modal">${html}</div>`;
  m.classList.add('open');
  if (mount) mount(m);
  $$('[data-close]', m).forEach(b => b.addEventListener('click', () => { modalQueue.shift(); nextModal(); }));
}
function confetti(container) {
  const chars = ['🌸', '💖', '✨', '⭐', '🎀'];
  for (let i = 0; i < 18; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.textContent = pick(chars);
    c.style.left = '50%'; c.style.top = '40%';
    c.style.setProperty('--dx', (Math.random() * 280 - 140) + 'px');
    c.style.setProperty('--dy', (Math.random() * 240 - 160) + 'px');
    c.style.setProperty('--r', (Math.random() * 360) + 'deg');
    container.appendChild(c);
    setTimeout(() => c.remove(), 1700);
  }
}

/* =========================================================
   記録シート
   ========================================================= */
function openMealSheet() {
  let size = 1;
  const recent = S.recentFoods.slice(0, 6);
  openSheet(`
    <h2>なに食べた？</h2>
    <div class="seg" id="size-seg">${SIZES.map(([l, v]) => `<button data-v="${v}" class="${v === 1 ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${recent.length ? `<div class="section-title">よく食べるもの</div><div class="chips">${recent.map((f, i) => `<button data-recent="${i}">${esc(f.emoji)} ${esc(f.name)}</button>`).join('')}</div>` : ''}
    <div class="section-title">タップで記録</div>
    <div class="grid">${FOODS.map(([e, n, k], i) => `<button class="tile" data-food="${i}"><span class="em">${e}</span>${n}<span class="kc">${k}kcal</span></button>`).join('')}</div>
    <div class="section-title">じぶんで入力</div>
    <div class="row">
      <input class="input" id="c-name" placeholder="なまえ（例：おやつ）" maxlength="20">
      <input class="input" id="c-kcal" type="number" inputmode="numeric" placeholder="kcal" min="1" max="5000" style="flex:.6">
    </div>
    <div style="height:10px"></div>
    <button class="clay-btn peach wide" id="c-add">記録する</button>
    <p class="note">※カロリーはだいたいの目安です。パッケージに書いてあれば、そちらを入力するとより正確になります。</p>
  `, sh => {
    $$('#size-seg button', sh).forEach(b => b.addEventListener('click', () => {
      size = +b.dataset.v;
      $$('#size-seg button', sh).forEach(x => x.classList.toggle('on', x === b));
    }));
    $$('[data-food]', sh).forEach(b => b.addEventListener('click', () => {
      const [e, n, k] = FOODS[+b.dataset.food];
      addMeal(e, n, k, size);
    }));
    $$('[data-recent]', sh).forEach(b => b.addEventListener('click', () => {
      const f = recent[+b.dataset.recent];
      addMeal(f.emoji, f.name, f.kcal, size);
    }));
    $('#c-add', sh).addEventListener('click', () => {
      const name = $('#c-name', sh).value.trim() || 'ごはん';
      const k = +$('#c-kcal', sh).value;
      if (!(k > 0 && k <= 5000)) { toast('カロリーを入れてね'); return; }
      addMeal('🍽️', name, k, 1);
    });
  });
}
function addMeal(emoji, name, baseKcal, size) {
  const kcal = Math.round(baseKcal * size);
  const label = size === 1 ? name : `${name}（${SIZES.find(s => s[1] === size)[0]}）`;
  ensureDay(today()).meals.push({ id: uid(), emoji, name: label, kcal, t: Date.now() });
  S.recentFoods = [{ emoji, name, kcal: baseKcal }, ...S.recentFoods.filter(f => !(f.name === name && f.kcal === baseKcal))].slice(0, 8);
  save();
  closeSheet();
  goTab('home');
  toast(`${emoji} ${esc(label)} ${fmt(kcal)}kcal<br>モフラが やってきた！`);
  setTimeout(() => renderHome(true), 250);
}

function openExSheet() {
  let ex = 0, min = 30;
  const w = weightOn(today());
  const preview = sh => {
    const k = exKcal(EXERCISES[ex][2], min, w);
    $('#ex-preview', sh).innerHTML = `${EXERCISES[ex][0]} ${EXERCISES[ex][1]} ${min}分で<br><span class="num">${fmt(k)}</span> kcal ぶんの攻撃！`;
  };
  openSheet(`
    <h2>なにして動いた？</h2>
    <div class="grid" id="ex-grid">${EXERCISES.map(([e, n, m], i) => `<button class="tile ${i === 0 ? 'on' : ''}" data-ex="${i}"><span class="em">${e}</span>${n}</button>`).join('')}</div>
    <div class="section-title">どれくらい？</div>
    <div class="chips" id="min-chips">${MINUTES.map(m => `<button data-min="${m}" class="${m === 30 ? 'on' : ''}">${m}分</button>`).join('')}</div>
    <div style="height:8px"></div>
    <input class="input" id="min-input" type="number" inputmode="numeric" placeholder="ほかの時間（分）" min="1" max="600">
    <div class="preview" id="ex-preview"></div>
    <button class="clay-btn mint wide" id="ex-add">✨ こうげき！</button>
    <p class="note">※消費カロリーは「METs × 体重 × 時間」で計算し、安静にしていても使うぶん（基礎代謝と重なるぶん）は差し引いています。</p>
  `, sh => {
    $$('[data-ex]', sh).forEach(b => b.addEventListener('click', () => {
      ex = +b.dataset.ex;
      $$('[data-ex]', sh).forEach(x => x.classList.toggle('on', x === b));
      preview(sh);
    }));
    $$('[data-min]', sh).forEach(b => b.addEventListener('click', () => {
      min = +b.dataset.min; $('#min-input', sh).value = '';
      $$('[data-min]', sh).forEach(x => x.classList.toggle('on', x === b));
      preview(sh);
    }));
    $('#min-input', sh).addEventListener('input', e => {
      const v = +e.target.value;
      if (v > 0 && v <= 600) { min = v; $$('[data-min]', sh).forEach(x => x.classList.remove('on')); preview(sh); }
    });
    $('#ex-add', sh).addEventListener('click', () => addExercise(ex, min));
    preview(sh);
  });
}
function addExercise(i, min) {
  const [e, n, m] = EXERCISES[i];
  const w = weightOn(today());
  const kcal = Math.round(exKcal(m, min, w));
  ensureDay(today()).ex.push({ id: uid(), emoji: e, name: n, min, kcal, mets: m, t: Date.now() });
  save();
  closeSheet();
  goTab('home');
  setTimeout(() => attackAnimation(() => {
    renderHome(true);
    toast(`${e} ${n} ${min}分　${fmt(kcal)}kcal の攻撃！`);
  }), 300);
}

function openWeightSheet() {
  const cur = getDay(today()).weight || weightOn(today());
  openSheet(`
    <h2>きょうの体重</h2>
    <div class="field"><label>体重（kg）</label>
      <input class="input" id="w-input" type="number" inputmode="decimal" step="0.1" min="25" max="250" value="${fmt1(cur)}">
    </div>
    <button class="clay-btn lav wide" id="w-save">記録する</button>
    <p class="note">朝起きてトイレのあと、同じタイミングで測るのがおすすめ。体重は水分で毎日1kgくらい上下するので、アプリは「7日間の平均」で判断します。1日の増減は気にしなくて大丈夫。</p>
  `, sh => {
    $('#w-save', sh).addEventListener('click', () => {
      const v = +$('#w-input', sh).value;
      if (!(v >= 25 && v <= 250)) { toast('体重を入れてね'); return; }
      ensureDay(today()).weight = Math.round(v * 10) / 10;
      save(); closeSheet(); renderAll();
      toast('⚖️ 記録したよ。えらい！');
    });
  });
}

/* =========================================================
   きろくタブ
   ========================================================= */
function renderLog() {
  const k = today(), d = getDay(k), L = live();
  const meals = d.meals.slice().sort((a, b) => a.t - b.t);
  const ex = d.ex.slice().sort((a, b) => a.t - b.t);
  const time = t => { const x = new Date(t); return `${x.getHours()}:${String(x.getMinutes()).padStart(2, '0')}`; };
  const m = mirror();
  const canApply = m.ready && (!S.lastMirror || S.lastMirror <= addDays(k, -7));
  $('#tab-log').innerHTML = `
    <div class="card">
      <h3>🍙 きょう食べたもの <span class="muted">合計 ${fmt(L.intake)}kcal</span></h3>
      ${meals.length ? `<ul class="list">${meals.map(x => `<li><span class="em">${esc(x.emoji)}</span><span class="name">${esc(x.name)}<br><span class="muted">${time(x.t)}</span></span><span class="kc num">${fmt(x.kcal)}</span><button class="del" data-del-meal="${x.id}" aria-label="けす">✕</button></li>`).join('')}</ul>` : `<div class="empty">まだ記録がないよ</div>`}
    </div>
    <div class="card">
      <h3>✨ きょう動いたこと <span class="muted">合計 ${fmt(L.ex)}kcal</span></h3>
      ${ex.length ? `<ul class="list">${ex.map(x => `<li><span class="em">${esc(x.emoji)}</span><span class="name">${esc(x.name)} ${x.min}分<br><span class="muted">${time(x.t)}</span></span><span class="kc num">${fmt(x.kcal)}</span><button class="del" data-del-ex="${x.id}" aria-label="けす">✕</button></li>`).join('')}</ul>` : `<div class="empty">ちょっとのおさんぽでも、立派な攻撃だよ</div>`}
    </div>
    <div class="card">
      <h3>⚖️ 体重</h3>
      <div class="mirror-row"><span>きょう</span><b class="num">${d.weight ? fmt1(d.weight) + 'kg' : '—'}</b></div>
      <div class="mirror-row"><span>スタート / 目標</span><b class="num">${fmt1(S.profile.startWeight)} → ${fmt1(S.profile.goalWeight)}kg</b></div>
      <div style="height:8px"></div>
      <button class="ghost-btn" id="log-weight">体重を記録する</button>
    </div>
    <div class="card">
      <h3>🪞 真実の鏡</h3>
      ${m.ready ? `
        <p class="small" style="line-height:1.7;margin:0 0 6px">体重の実際の変化から、あなたの本当の消費カロリーを逆算しました。</p>
        <div class="mirror-row"><span>アプリの推定</span><b class="num">${fmt(m.predBurn)}kcal/日</b></div>
        <div class="mirror-row"><span>体重から逆算</span><b class="num">${fmt(m.obsBurn)}kcal/日</b></div>
        <div class="mirror-row"><span>体重（はじめの7日 → 最近7日）</span><b class="num">${fmt1(m.wA)} → ${fmt1(m.wB)}kg</b></div>
        ${m.coverage < 0.8 ? `<p class="note">記録していない日が多めなので、結果は参考程度にしてね。</p>` : ''}
        <div style="height:8px"></div>
        <button class="clay-btn lav wide" id="mirror-apply" ${canApply ? '' : 'disabled'}>${canApply ? `補正する（×${m.factor.toFixed(2)}）` : '次の補正は1週間後'}</button>
      ` : `<p class="small" style="line-height:1.7;margin:0">ごはんの記録が14日、体重の記録が週2回以上たまると、鏡が「アプリの計算」と「実際の体」のずれを教えてくれるよ。${m.need ? `<br><b>あと${m.need}日</b>` : '<br>体重の記録をもう少し増やしてね'}</p>`}
      <p class="note">いまの補正：×${S.calib.toFixed(2)}</p>
    </div>`;
  $$('[data-del-meal]').forEach(b => b.addEventListener('click', () => {
    const dd = ensureDay(k); dd.meals = dd.meals.filter(x => x.id !== b.dataset.delMeal); save(); renderAll();
  }));
  $$('[data-del-ex]').forEach(b => b.addEventListener('click', () => {
    const dd = ensureDay(k); dd.ex = dd.ex.filter(x => x.id !== b.dataset.delEx); save(); renderAll();
  }));
  $('#log-weight').addEventListener('click', openWeightSheet);
  const ma = $('#mirror-apply');
  if (ma && canApply) ma.addEventListener('click', () => {
    S.calib = clamp(S.calib * m.factor, 0.8, 1.2);
    S.lastMirror = k;
    save(); renderAll();
    toast('🪞 鏡の補正を反映したよ');
  });
}

/* =========================================================
   あしあとタブ
   ========================================================= */
function renderHistory() {
  const t = today();
  // 今週（月曜はじまり）
  const dow = (parseKey(t).getDay() + 6) % 7;
  const mon = addDays(t, -dow);
  let wins = 0, loses = 0, dmg = 0;
  for (let i = 0; i < 7; i++) {
    const r = getDay(addDays(mon, i)).result;
    if (!r) continue;
    if (r.type === 'win') wins++;
    if (r.type === 'lose') loses++;
    if (r.applied) dmg += r.applied;
  }
  // 21日カレンダー
  const start = addDays(t, -20);
  const pad = (parseKey(start).getDay() + 6) % 7;
  let cal = WD.slice(1).concat(WD[0]).map(w => `<div class="muted">${w}</div>`).join('');
  for (let i = 0; i < pad; i++) cal += '<div></div>';
  for (let i = 0; i < 21; i++) {
    const k = addDays(start, i), r = getDay(k).result;
    const mk = k === t ? (getDay(k).meals.length ? '⚔️' : '・') : !r ? '・' : r.type === 'win' ? '🌸' : r.type === 'lose' ? '🌙' : '☁️';
    cal += `<div class="d ${k === t ? 'today' : ''}"><span class="mk">${mk}</span>${md(k)}</div>`;
  }
  // 結果リスト
  const rows = [];
  for (let i = 1; i <= 10; i++) {
    const k = addDays(t, -i), r = getDay(k).result;
    if (r && r.type !== 'fog') rows.push([k, r]);
  }
  $('#tab-history').innerHTML = `
    <div class="card">
      <h3>📅 今週の戦績</h3>
      <div class="week-stats">
        <div class="stat"><div class="label">勝ち</div><div class="value num">${wins}</div></div>
        <div class="stat"><div class="label">負け</div><div class="value num">${loses}</div></div>
        <div class="stat"><div class="label">お城への合計</div><div class="value num" style="color:${dmg >= 0 ? 'var(--pink-d)' : 'var(--lav-d)'}">${dmg >= 0 ? '−' : '+'}${fmt(Math.abs(dmg))}</div></div>
      </div>
      <p class="note">1日負けても、1週間のトータルで勝てていれば大丈夫。体脂肪はちゃんと減っていきます。</p>
    </div>
    <div class="card">
      <h3>🐾 あしあと</h3>
      <div class="cal">${cal}</div>
      <div class="legend"><span>🌸 勝ち</span><span>🌙 負け</span><span>☁️ 記録なし</span></div>
    </div>
    <div class="card chart">
      <h3>⚖️ 体重のながれ</h3>
      ${weightChart()}
    </div>
    <div class="card">
      <h3>📜 最近のバトル</h3>
      ${rows.length ? `<ul class="list">${rows.map(([k, r]) => `<li><span class="em">${r.type === 'win' ? '🌸' : '🌙'}</span><span class="name">${md(k)}（${WD[parseKey(k).getDay()]}）<br><span class="muted">食べた ${fmt(r.intake)} / 燃やした ${fmt(r.burn)}</span></span><span class="kc num" style="color:${r.type === 'win' ? 'var(--pink-d)' : 'var(--lav-d)'}">${r.diff >= 0 ? '+' : ''}${fmt(r.diff)}</span></li>`).join('')}</ul>` : `<div class="empty">日付が変わると、ここにバトル結果がたまっていくよ</div>`}
    </div>`;
}
function weightChart() {
  const t = today();
  const pts = [];
  for (let i = 29; i >= 0; i--) {
    const k = addDays(t, -i), w = getDay(k).weight;
    if (w) pts.push({ i: 29 - i, w, k });
  }
  if (pts.length < 2) return `<div class="empty">体重を2回以上記録するとグラフになるよ</div>`;
  // 7日移動平均
  const avg = pts.map(p => {
    const near = pts.filter(q => q.i <= p.i && q.i > p.i - 7);
    return { i: p.i, w: near.reduce((a, q) => a + q.w, 0) / near.length };
  });
  const ws = pts.map(p => p.w);
  let lo = Math.min(...ws) - 0.5, hi = Math.max(...ws) + 0.5;
  const W = 320, H = 150, P = 26;
  const x = i => P + (i / 29) * (W - P - 8);
  const y = w => 10 + (1 - (w - lo) / (hi - lo)) * (H - 30);
  const line = arr => arr.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.w).toFixed(1)}`).join(' ');
  const goalY = S.profile.goalWeight >= lo && S.profile.goalWeight <= hi ? `<line x1="${P}" x2="${W - 8}" y1="${y(S.profile.goalWeight)}" y2="${y(S.profile.goalWeight)}" stroke="#A9E8D2" stroke-width="2" stroke-dasharray="5 5"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}">
    <text x="2" y="${y(hi) + 4}" font-size="10" fill="#A48C98">${fmt1(hi)}</text>
    <text x="2" y="${y(lo) + 4}" font-size="10" fill="#A48C98">${fmt1(lo)}</text>
    <line x1="${P}" x2="${W - 8}" y1="${H - 20}" y2="${H - 20}" stroke="#F3E2DC" stroke-width="1.5"/>
    ${goalY}
    <path d="${line(pts)}" fill="none" stroke="#FFC9D6" stroke-width="2" stroke-linejoin="round"/>
    ${pts.map(p => `<circle cx="${x(p.i)}" cy="${y(p.w)}" r="2.6" fill="#FFB3C6"/>`).join('')}
    <path d="${line(avg)}" fill="none" stroke="#A996F2" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${P}" y="${H - 6}" font-size="10" fill="#A48C98">30日前</text>
    <text x="${W - 30}" y="${H - 6}" font-size="10" fill="#A48C98">きょう</text>
  </svg>
  <div class="legend"><span><i style="background:#FFC9D6"></i>毎日の体重</span><span><i style="background:#A996F2"></i>7日平均</span><span><i style="background:#A9E8D2"></i>目標</span></div>`;
}

/* =========================================================
   おしゃれタブ
   ========================================================= */
function itemIcon(it) {
  // ペット座標の該当部分だけを切り抜いて表示
  return `<svg viewBox="${it.vb}">${it.svg}</svg>`;
}
function renderCloset() {
  const shape = petShape();
  $('#tab-closet').innerHTML = `
    <div class="card" style="text-align:center">
      <div class="closet-pet">${petSVG({ sx: shape.sx, mood: 'happy' })}</div>
      <b>${esc(S.profile.petName)}</b><div class="muted">いまの体型：${shape.label}</div>
      <a class="ghost-btn" href="pet3d.html" style="display:block;margin-top:12px;text-decoration:none;color:inherit">🧸 3Dで見る</a>
    </div>
    <div class="card">
      <h3>🎀 おしゃれアイテム <span class="muted">${S.items.length} / ${ITEMS.length}</span></h3>
      <div class="items">
        ${ITEMS.map(it => {
          const owned = S.items.includes(it.id);
          return `<button class="item ${owned ? '' : 'locked'} ${S.equipped === it.id ? 'on' : ''}" data-item="${it.id}" ${owned ? '' : 'disabled'}>${itemIcon(it)}${owned ? it.name : '？？？'}</button>`;
        }).join('')}
      </div>
      <p class="note">バトルに勝った日の夜、モフラがときどき落としていくよ。連続で記録していると、出やすくなるかも。</p>
    </div>`;
  $$('[data-item]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.item;
    S.equipped = S.equipped === id ? null : id;
    save(); renderCloset(); renderHome(false);
  }));
}

/* =========================================================
   バトル結果モーダル
   ========================================================= */
function showResults(results) {
  const real = results.filter(r => r.type !== 'fog');
  const fogs = results.length - real.length;
  if (!real.length) {
    if (fogs) showModal(`
      <div class="ill">${petSVG({ mood: 'normal' })}</div>
      <h2>おかえり〜！</h2>
      <p>${fogs}日ぶんは記録がなかったから、<br>「霧の日」としてお休みにしたよ。<br>きょうからまた いっしょにがんばろ！</p>
      <div class="btns"><button class="clay-btn pink wide" data-close>うん！</button></div>`);
    return;
  }
  const r = real[real.length - 1];
  const others = real.slice(0, -1).slice(-5);
  const hidden = real.length - 1 - others.length;
  const it = r.drop && ITEMS.find(i => i.id === r.drop);
  const win = r.type === 'win';
  const body = win
    ? `<h2>${r.diff > 300 ? 'かんぺき撃退！' : '撃退せいこう！'}</h2>
       <div class="result-num win num">−${fmt(r.applied)}</div>
       <p>${md(r.k)} の脂肪のお城に <b>${fmt(r.applied)}</b> ダメージ！<br>食べた ${fmt(r.intake)} / 燃やした ${fmt(r.burn)}kcal</p>
       ${r.hungry ? `<p class="small">でも、ちょっと食べなさすぎかも…。<br>しっかり食べたほうが、長く続けられるよ🍙</p>` : ''}
       ${r.diff > DAILY_CAP ? `<p class="note">1日にお城を削れるのは${fmt(DAILY_CAP)}までだよ。無理しすぎないでね。</p>` : ''}`
    : `<h2>モフラが お城に住みついた…</h2>
       <div class="result-num lose num">＋${fmt(-r.applied)}</div>
       <p>${md(r.k)} は ${fmt(-r.diff)}kcal ぶん、<br>モフラが残っちゃった。<br>でもだいじょうぶ、1週間のトータルが大事だよ。</p>`;
  showModal(`
    <div class="ill">${petSVG({ mood: win ? 'happy' : 'normal' })}</div>
    ${body}
    ${it ? `<div class="drop">${itemIcon(it)}<span>モフラが <b>${it.name}</b> を<br>落としていったよ！</span></div>` : ''}
    ${others.length || fogs ? `<div class="mini-list">${others.map(o => `<div><span>${md(o.k)}</span><span class="num">${o.type === 'win' ? '🌸 −' + fmt(o.applied) : '🌙 +' + fmt(-o.applied)}</span></div>`).join('')}${hidden ? `<div><span>ほか ${hidden}日ぶん</span><span>あしあとで見られるよ</span></div>` : ''}${fogs ? `<div><span>霧の日</span><span>${fogs}日</span></div>` : ''}</div>` : ''}
    <div class="btns">
      ${it ? `<button class="clay-btn lav wide" id="equip-now">つけてみる</button>` : ''}
      <button class="clay-btn pink wide" data-close>${win ? 'やったー！' : 'きょう取り返す！'}</button>
    </div>`, m => {
    if (win) confetti($('.modal', m));
    const eq = $('#equip-now', m);
    if (eq) eq.addEventListener('click', () => { S.equipped = it.id; save(); renderAll(); modalQueue.shift(); nextModal(); });
  });
}

/* =========================================================
   はじめての設定
   ========================================================= */
function renderOnboard(editing = false) {
  const p = S.profile || { petName: 'もちこ', sex: 'f', age: '', height: '', startWeight: '', goalWeight: '', bodyFat: '', activity: 1.2 };
  const ob = $('#onboard');
  ob.innerHTML = `<div class="onboard-inner">
    <div class="hero">${petSVG({ mood: 'happy', item: null })}</div>
    <h1>${editing ? 'せってい' : 'はじめまして！'}</h1>
    <p class="lead">${editing ? 'プロフィールを変えると、消費カロリーの計算に反映されるよ。' : 'わたしは あなたの分身「もちプー」。<br>食べたぶんは もこもこの「モフラ」になって攻めてくるよ。<br>いっしょに動いて、やっつけよう！'}</p>
    <div class="card">
      <div class="field"><label>この子の名前</label><input class="input" id="o-name" maxlength="10" value="${esc(p.petName)}"></div>
      <div class="field"><label>あなたの性別（基礎代謝の計算に使うよ）</label>
        <div class="seg" id="o-sex"><button data-v="f" class="${p.sex !== 'm' ? 'on' : ''}">女性</button><button data-v="m" class="${p.sex === 'm' ? 'on' : ''}">男性</button></div></div>
      <div class="row">
        <div class="field"><label>年齢</label><input class="input" id="o-age" type="number" inputmode="numeric" min="15" max="90" value="${p.age}"></div>
        <div class="field"><label>身長（cm）</label><input class="input" id="o-height" type="number" inputmode="decimal" min="120" max="220" value="${p.height}"></div>
      </div>
      <div class="row">
        <div class="field"><label>${editing ? 'スタート体重' : 'いまの体重'}（kg）</label><input class="input" id="o-weight" type="number" inputmode="decimal" step="0.1" min="30" max="200" value="${p.startWeight}" ${editing ? 'disabled' : ''}></div>
        <div class="field"><label>目標体重（kg）</label><input class="input" id="o-goal" type="number" inputmode="decimal" step="0.1" min="30" max="200" value="${p.goalWeight}"></div>
      </div>
      <div class="field"><label>体脂肪率（%・わかれば）</label><input class="input" id="o-bf" type="number" inputmode="decimal" step="0.1" min="5" max="60" placeholder="わからなければ空欄でOK" value="${p.bodyFat || ''}" ${editing ? 'disabled' : ''}></div>
      <div class="field"><label>ふだんの活動量</label>
        <div class="chips" id="o-act">${ACTIVITY.map(([v, l, d]) => `<button data-v="${v}" class="${p.activity === v ? 'on' : ''}" title="${d}">${l}</button>`).join('')}</div>
        <div class="muted" id="o-act-desc" style="margin-top:4px"></div>
      </div>
      <div class="err" id="o-err"></div>
      <button class="clay-btn pink wide" id="o-start">${editing ? '保存する' : 'はじめる'}</button>
      ${editing ? `<div style="height:10px"></div><button class="ghost-btn" id="o-cancel">もどる</button>
        <div style="height:18px"></div>
        <button class="ghost-btn" id="o-demo">🧪 デモデータを入れる（3週間ぶん）</button>
        <div style="height:8px"></div>
        <button class="ghost-btn" id="o-reset" style="color:var(--pink-d)">データをぜんぶ消す</button>` : ''}
    </div>
    <p class="note" style="text-align:center">データはこの端末のブラウザの中だけに保存されます。</p>
  </div>`;
  ob.classList.add('open');
  let sex = p.sex || 'f', act = p.activity || 1.2;
  const actDesc = () => { $('#o-act-desc').textContent = (ACTIVITY.find(a => a[0] === act) || [])[2] || ''; };
  actDesc();
  $$('#o-sex button').forEach(b => b.addEventListener('click', () => { sex = b.dataset.v; $$('#o-sex button').forEach(x => x.classList.toggle('on', x === b)); }));
  $$('#o-act button').forEach(b => b.addEventListener('click', () => { act = +b.dataset.v; $$('#o-act button').forEach(x => x.classList.toggle('on', x === b)); actDesc(); }));
  $('#o-start').addEventListener('click', () => {
    const v = id => $(id).value.trim();
    const np = {
      petName: v('#o-name') || 'もちこ', sex, age: +v('#o-age'), height: +v('#o-height'),
      startWeight: editing ? p.startWeight : +v('#o-weight'), goalWeight: +v('#o-goal'),
      bodyFat: editing ? p.bodyFat : (v('#o-bf') ? +v('#o-bf') : null), activity: act,
      startDate: editing ? p.startDate : today(),
    };
    const err = $('#o-err');
    if (!(np.age >= 15 && np.age <= 90)) return err.textContent = '年齢を入れてね（15〜90）';
    if (!(np.height >= 120 && np.height <= 220)) return err.textContent = '身長を入れてね';
    if (!(np.startWeight >= 30 && np.startWeight <= 200)) return err.textContent = '体重を入れてね';
    if (!(np.goalWeight >= 30 && np.goalWeight < np.startWeight)) return err.textContent = '目標体重は いまの体重より少なくしてね';
    const bmiGoal = np.goalWeight / ((np.height / 100) ** 2);
    if (bmiGoal < 17.5) return err.textContent = 'その目標は 体に負担が大きいかも。もう少しゆるめにしてみてね';
    if (np.bodyFat != null && !(np.bodyFat >= 5 && np.bodyFat <= 60)) return err.textContent = '体脂肪率は5〜60%で入れてね';
    if (editing) {
      S.profile = np;
    } else {
      S = defaults();
      S.profile = np;
      const bf = np.bodyFat || estimateBF(np);
      S.castle.initial = Math.round(np.startWeight * bf / 100 * KCAL_PER_KG);
      S.lastJudged = addDays(today(), -1);
      ensureDay(today()).weight = np.startWeight;
    }
    save();
    ob.classList.remove('open');
    renderAll();
    if (!editing) introModal();
  });
  if (editing) {
    $('#o-cancel').addEventListener('click', () => ob.classList.remove('open'));
    $('#o-demo').addEventListener('click', () => { seedDemo(); ob.classList.remove('open'); });
    let armed = false;
    $('#o-reset').addEventListener('click', e => {
      if (!armed) { armed = true; e.target.textContent = 'もう一度押すと消えます'; return; }
      try { localStorage.removeItem(KEY); } catch (_) { }
      S = defaults(); ob.classList.remove('open'); renderOnboard(false);
    });
  }
}
function introModal() {
  const bfKg = S.castle.initial / KCAL_PER_KG;
  showModal(`
    <div class="ill" style="width:110px;height:110px">${castleSVG(1).replace('class="castle-ill"', '')}</div>
    <h2>これが「脂肪のお城」</h2>
    <p>あなたの体にいま約 <b>${fmt1(bfKg)}kg</b> の体脂肪があって、<br>お城のHPは <b class="num">${fmt(S.castle.initial)}</b>（1kg＝7,200）。</p>
    <p class="small">食べたぶんは <b>モフラ</b> になって攻めてくる。<br>基礎代謝の <b>バリア</b> と 運動の <b>攻撃</b> で倒そう。<br>夜をこえて倒しきれたら お城にダメージ、<br>残ったモフラは お城に住みついちゃう。</p>
    <div class="btns"><button class="clay-btn pink wide" data-close>わかった！</button></div>`);
}

/* =========================================================
   デモデータ（見た目の確認用）
   ========================================================= */
function seedDemo() {
  const p = S.profile;
  const keep = { profile: { ...p }, items: [], equipped: null };
  S = Object.assign(defaults(), keep);
  const start = addDays(today(), -21);
  S.profile.startDate = start;
  const bf = p.bodyFat || estimateBF(p);
  S.castle.initial = Math.round(p.startWeight * bf / 100 * KCAL_PER_KG);
  let w = p.startWeight;
  for (let i = 0; i < 21; i++) {
    const k = addDays(start, i);
    if (i === 9 || i === 15) continue; // 霧の日
    const d = ensureDay(k);
    const base = bmr(w) * p.activity;
    const target = base - 200 + (Math.random() * 500 - 250);
    const picks = [FOODS[1], FOODS[0], FOODS[15], FOODS[10], FOODS[20], FOODS[22], FOODS[6], FOODS[4], FOODS[18]];
    let acc = 0, t0 = parseKey(k).getTime() + 8 * 3600e3, tries = 0;
    while (acc < target - 120 && tries++ < 40) {
      const f = pick(picks);
      if (acc + f[2] > target + 60) continue;
      d.meals.push({ id: uid(), emoji: f[0], name: f[1], kcal: f[2], t: t0 }); acc += f[2]; t0 += 2 * 3600e3;
    }
    if (Math.random() < 0.6) {
      const e = pick(EXERCISES.slice(0, 8)), min = pick([15, 20, 30, 45]);
      d.ex.push({ id: uid(), emoji: e[0], name: e[1], min, mets: e[2], kcal: Math.round(exKcal(e[2], min, w)), t: t0 });
    }
    w -= 0.04 + (Math.random() * 0.1 - 0.05);
    if (i % 2 === 0) d.weight = Math.round((w + Math.random() * 0.6 - 0.3) * 10) / 10;
  }
  ensureDay(today()).weight = Math.round(w * 10) / 10;
  S.lastJudged = addDays(start, -1);
  save();
  boot();
}

/* =========================================================
   全体
   ========================================================= */
let currentTab = 'home';
function goTab(name) {
  currentTab = name;
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  if (name === 'log') renderLog();
  if (name === 'history') renderHistory();
  if (name === 'closet') renderCloset();
  window.scrollTo({ top: 0 });
}
function renderAll() {
  renderHome(false);
  if (currentTab === 'log') renderLog();
  if (currentTab === 'history') renderHistory();
  if (currentTab === 'closet') renderCloset();
}

let lastDay = today();
function tick() {
  if (!S.profile) return;
  if (today() !== lastDay) {
    lastDay = today();
    const res = judgePending();
    if (res.length) showResults(res);
    $('#monsters').innerHTML = '';
    renderAll();
    return;
  }
  renderHome(false);
}

const CHEERS = ['なでなで うれしい〜', 'いっしょなら だいじょうぶ！', 'きょうの あなたも えらい！', 'ぷにぷに〜♪', 'おみず飲んだ？💧', 'ゆっくりでいいよ'];
function bindOnce() {
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));
  $('#btn-meal').addEventListener('click', openMealSheet);
  $('#btn-ex').addEventListener('click', openExSheet);
  $('#btn-weight').addEventListener('click', openWeightSheet);
  $('#btn-settings').addEventListener('click', () => renderOnboard(true));
  $('#sheet-backdrop').addEventListener('click', closeSheet);
  const onPetTap = () => {
    petJump();
    $('#bubble').textContent = pick(CHEERS);
    sparkAt($('#pet-wrap'), ['💗', '✨', '🌸']);
  };
  $('#pet').addEventListener('click', onPetTap);
  $('#pet3d').addEventListener('click', onPetTap);
  // 3Dペットの準備ができたら、いまの表情・体型・着せ替えを反映
  window.addEventListener('pet3d-ready', () => renderHome(false));
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

function boot() {
  if (!S.profile) { renderOnboard(false); return; }
  lastDay = today();
  const res = judgePending();
  $('#monsters').innerHTML = '';
  goTab('home');
  renderHome(true);
  if (res.length) showResults(res);
}

bindOnce();
boot();
})();
