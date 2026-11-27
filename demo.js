// Animated correct-form demos. A small side-view rig (forward kinematics) drawn as SVG,
// with keyframed joint angles per exercise and a male or female figure.
//
// Angles are absolute, in degrees: 0 points down, 90 points right (the way the figure faces),
// 180 points up, -90 points left. Screen y grows downward.

const SVGNS = 'http://www.w3.org/2000/svg';
const rad = (d) => (d * Math.PI) / 180;
const dir = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

// Segment lengths (viewBox units). The figure is about 170 units tall standing.
const L = { torso: 52, neck: 8, head: 12, uarm: 30, farm: 28, thigh: 42, shin: 42, foot: 13 };

export const FIGURES = {
  // Original characters in a soft-shaded cartoon style, fully clothed: long sleeves, long pants, shoes.
  male: {
    shoulderW: 21, hipW: 16, limb: 1.0, skin: '#e8b98f', skinShade: '#c99268',
    top: '#2f6fb0', topShade: '#1f4c7c', bottom: '#3a3f4f', bottomShade: '#262a36',
    shoe: '#f3f5f8', sole: '#9aa6b5', hair: '#3a2418', hairStyle: 'short',
  },
  female: {
    shoulderW: 17, hipW: 19, limb: 0.92, skin: '#efc4a0', skinShade: '#cf9c76',
    top: '#8a52b8', topShade: '#5e3585', bottom: '#2f2a3d', bottomShade: '#1d1a27',
    shoe: '#f3f5f8', sole: '#c7a0e0', hair: '#5a3423', hairStyle: 'ponytail',
  },
};

/**
 * Each demo: scene (equipment), anchor (the point that stays fixed), loop of keyframes with hold times (s),
 * and the coaching points shown under the animation.
 */
export const DEMOS = {
  squat: {
    focus: { joint: 'knee', from: 'hip', to: 'ankle', label: 'Knee', target: 'aim ≤ 100° at the bottom', ok: (a) => a <= 100 },
    anchor: ['ankle', [92, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 176, thigh: 2, shin: -2, foot: 90, uarm: 92, farm: 92 }, hold: 0.5, move: 1.2 },
      { pose: { torso: 142, thigh: 82, shin: -28, foot: 90, uarm: 96, farm: 96 }, hold: 0.35, move: 1.0 },
    ],
    points: ['Hips back and down, chest up', 'Thighs parallel to the floor', 'Knees track over toes, heels down'],
  },
  pushup: {
    focus: { joint: 'elbow', from: 'shoulder', to: 'wrist', label: 'Elbow', target: 'aim about 90° at the bottom', ok: (a) => a <= 95 },
    anchor: ['wrist', [148, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 101, thigh: -79, shin: -79, foot: -10, uarm: 0, farm: 0 }, hold: 0.4, move: 1.1 },
      { pose: { torso: 93, thigh: -87, shin: -87, foot: -10, uarm: -88, farm: 0 }, hold: 0.3, move: 0.9 },
    ],
    points: ['Hands under shoulders', 'Body in one straight line', 'Lower until elbows reach about 90°'],
  },
  plank: {
    focus: { joint: 'hip', from: 'shoulder', to: 'ankle', label: 'Body line', target: 'keep ≥ 165°', ok: (a) => a >= 165 },
    anchor: ['elbow', [150, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 98, thigh: -82, shin: -82, foot: -10, uarm: 0, farm: 90 }, hold: 1.4, move: 1.2 },
      { pose: { torso: 98.6, thigh: -81.4, shin: -81.4, foot: -10, uarm: 0, farm: 90 }, hold: 1.4, move: 1.2 },
    ],
    points: ['Elbows under shoulders', 'Straight line from head to heels', 'Squeeze glutes, don’t let hips sag'],
  },
  curl: {
    focus: { joint: 'elbow', from: 'shoulder', to: 'wrist', label: 'Elbow', target: 'aim ≤ 55° at the top', ok: (a) => a <= 55 },
    anchor: ['ankle', [100, 172]], scene: 'floor', prop: 'dumbbell',
    frames: [
      { pose: { torso: 179, thigh: 1, shin: -1, foot: 90, uarm: 3, farm: 4 }, hold: 0.35, move: 1.0 },
      { pose: { torso: 179, thigh: 1, shin: -1, foot: 90, uarm: 8, farm: 150 }, hold: 0.3, move: 1.4 },
    ],
    points: ['Elbow stays pinned at your side', 'Curl all the way up, lower slowly', 'No swinging the body'],
  },
  bench: {
    focus: { joint: 'elbow', from: 'shoulder', to: 'wrist', label: 'Elbow', target: 'aim ≤ 90° at the bottom', ok: (a) => a <= 90 },
    anchor: ['hip', [78, 128]], scene: 'bench', prop: 'barbell', supine: true,
    frames: [
      { pose: { torso: 90, thigh: -100, shin: -8, foot: -90, uarm: 178, farm: 178 }, hold: 0.4, move: 1.3 },
      { pose: { torso: 90, thigh: -100, shin: -8, foot: -90, uarm: -40, farm: 172 }, hold: 0.25, move: 1.0 },
    ],
    points: ['Feet flat, hips stay on the bench', 'Lower the bar to mid-chest', 'Wrists stacked over elbows, press to lockout'],
  },
  pushdown: {
    focus: { joint: 'elbow', from: 'shoulder', to: 'wrist', label: 'Elbow', target: 'aim ≥ 160° at the bottom', ok: (a) => a >= 160 },
    anchor: ['ankle', [92, 172]], scene: 'cable', prop: 'handle',
    frames: [
      { pose: { torso: 170, thigh: 3, shin: -3, foot: 90, uarm: 6, farm: 92 }, hold: 0.35, move: 1.0 },
      { pose: { torso: 170, thigh: 3, shin: -3, foot: 90, uarm: 6, farm: 2 }, hold: 0.3, move: 1.2 },
    ],
    points: ['Elbows pinned to your sides', 'Push down to full lockout', 'Torso still, only forearms move'],
  },
};

/** Forward kinematics from the hip. Returns joint positions before anchoring. */
export function solve(pose) {
  const add = (p, a, len) => { const d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
  const hip = [0, 0];
  const shoulder = add(hip, pose.torso, L.torso);
  const neck = add(shoulder, pose.torso, L.neck * 0.6);
  const head = add(shoulder, pose.torso + (pose.torso > 150 ? -6 : 4), L.neck + L.head);
  const elbow = add(shoulder, pose.uarm, L.uarm);
  const wrist = add(elbow, pose.farm, L.farm);
  const knee = add(hip, pose.thigh, L.thigh);
  const ankle = add(knee, pose.shin, L.shin);
  const toe = add(ankle, pose.foot, L.foot);
  return { hip, shoulder, neck, head, elbow, wrist, knee, ankle, toe };
}

function interp(a, b, t) {
  const o = {};
  for (const k of Object.keys(a)) o[k] = lerp(a[k], b[k], t);
  return o;
}

/** Pose at time t (seconds) for a demo. */
export function poseAt(demo, t) {
  const f = demo.frames;
  const total = f.reduce((s, k) => s + k.hold + k.move, 0);
  let x = t % total;
  for (let i = 0; i < f.length; i++) {
    const cur = f[i], next = f[(i + 1) % f.length];
    if (x < cur.hold) return { ...cur.pose };
    x -= cur.hold;
    if (x < cur.move) return interp(cur.pose, next.pose, ease(x / cur.move));
    x -= cur.move;
  }
  return { ...f[0].pose };
}

function anchored(demo, pose) {
  const j = solve(pose);
  const [name, target] = demo.anchor;
  const dx = target[0] - j[name][0], dy = target[1] - j[name][1];
  for (const k of Object.keys(j)) j[k] = [j[k][0] + dx, j[k][1] + dy];
  return j;
}

/** Interior angle at b (degrees). */
export function jointAngle(a, b, c) {
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const m = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / m))) * 180) / Math.PI;
}

const f1 = (n) => n.toFixed(1);
const P = (p) => `${f1(p[0])} ${f1(p[1])}`;

/** A rounded limb from a to b with radii ra and rb, filled, as an SVG path. */
function capsule(a, b, ra, rb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 0.001;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const a1 = [a[0] + nx * ra, a[1] + ny * ra], a2 = [a[0] - nx * ra, a[1] - ny * ra];
  const b1 = [b[0] + nx * rb, b[1] + ny * rb], b2 = [b[0] - nx * rb, b[1] - ny * rb];
  return `M${P(a1)}L${P(b1)}A${f1(rb)} ${f1(rb)} 0 0 0 ${P(b2)}L${P(a2)}A${f1(ra)} ${f1(ra)} 0 0 0 ${P(a1)}Z`;
}

/**
 * A soft-shaded limb: darker outline, base colour, and a light streak on the upper-left side
 * so it reads as rounded.
 */
function limb(a, b, ra, rb, color, shade) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 0.001;
  let nx = -dy / len, ny = dx / len;
  if (nx + ny > 0) { nx = -nx; ny = -ny; } // highlight toward the light (top-left)
  const k = 0.38;
  const ha = [a[0] + nx * ra * k, a[1] + ny * ra * k], hb = [b[0] + nx * rb * k, b[1] + ny * rb * k];
  return `<path d="${capsule(a, b, ra + 0.9, rb + 0.9)}" fill="${shade}"/>`
    + `<path d="${capsule(a, b, ra, rb)}" fill="${color}"/>`
    + `<path d="${capsule(ha, hb, ra * 0.32, rb * 0.32)}" fill="#fff" opacity=".16"/>`;
}

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Head, face and hair, drawn in the head's own frame: x = facing direction, y = up. */
function headSVG(c, up, face, fig) {
  const W = (x, y) => [c[0] + face[0] * x + up[0] * y, c[1] + face[1] * x + up[1] * y];
  const r = L.head;
  const q = (pts) => 'M' + P(W(...pts[0])) + pts.slice(1).map((s) => (s.length === 4
    ? `Q${P(W(s[0], s[1]))} ${P(W(s[2], s[3]))}` : `L${P(W(...s))}`)).join('') + 'Z';
  let out = '';
  if (fig.hairStyle === 'ponytail') {
    out += `<path d="${q([[-9, 6], [-20, 6, -21, -6], [-22, -16, -15, -19], [-16, -9, -12, -2], [-11, 2, -9, 2]])}" fill="${fig.hair}"/>`;
    out += `<circle cx="${f1(W(-11, 5)[0])}" cy="${f1(W(-11, 5)[1])}" r="2.4" fill="${fig.top}"/>`;
  }
  out += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r + 0.9}" fill="${fig.skinShade}"/>`;
  out += `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${r}" fill="${fig.skin}"/>`;
  // nose and chin
  out += `<circle cx="${f1(W(r - 0.6, -1)[0])}" cy="${f1(W(r - 0.6, -1)[1])}" r="2.3" fill="${fig.skin}"/>`;
  // ear
  out += `<ellipse cx="${f1(W(-1.5, -0.5)[0])}" cy="${f1(W(-1.5, -0.5)[1])}" rx="2.4" ry="3" fill="${fig.skinShade}"/>`;
  // hair cap
  if (fig.hairStyle === 'short') {
    out += `<path d="${q([[-12.6, -2], [-14, 10, -2, 13.5], [7, 15, 11.5, 6], [8, 9, 3, 8.5], [-4, 8, -6, 4], [-8, 0, -10, -3]])}" fill="${fig.hair}"/>`;
  } else {
    out += `<path d="${q([[-12.8, -4], [-14, 11, -2, 13.8], [8, 15, 12, 5], [9, 10, 5, 9.6], [6, 7, 1, 8.6], [-5, 8, -7, 3], [-9, -1, -10.5, -6]])}" fill="${fig.hair}"/>`;
  }
  // eye, brow, mouth
  const e = W(5.6, 1.6), hl = W(6.1, 2.2);
  out += `<ellipse cx="${f1(e[0])}" cy="${f1(e[1])}" rx="1.7" ry="2.1" fill="#2a1d17"/>`;
  out += `<circle cx="${f1(hl[0])}" cy="${f1(hl[1])}" r=".6" fill="#fff"/>`;
  out += `<path d="M${P(W(3.6, 5))}Q${P(W(5.8, 6.4))} ${P(W(8.2, 5.2))}" stroke="${fig.hair}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  out += `<path d="M${P(W(6.5, -5.2))}Q${P(W(8.5, -6.2))} ${P(W(10.2, -4.6))}" stroke="#a05a48" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
  out += `<circle cx="${f1(W(4.5, -2.8)[0])}" cy="${f1(W(4.5, -2.8)[1])}" r="2" fill="#f08a7a" opacity=".28"/>`;
  return out;
}

/** Sneaker from ankle toward toe. */
function shoeSVG(ankle, toe, fig, dim) {
  const col = dim ? darken(fig.shoe, 0.72) : fig.shoe;
  const sole = dim ? darken(fig.sole, 0.72) : fig.sole;
  const dx = toe[0] - ankle[0], dy = toe[1] - ankle[1], len = Math.hypot(dx, dy) || 1;
  const tip = [toe[0] + (dx / len) * 2, toe[1] + (dy / len) * 2];
  const heel = [ankle[0] - (dx / len) * 3, ankle[1] - (dy / len) * 3];
  return `<path d="${capsule(heel, tip, 4.4, 4.0)}" fill="${sole}"/><path d="${capsule(heel, tip, 3.6, 3.2)}" fill="${col}"/>`;
}

function torsoSVG(hip, sh, fig, demo) {
  const dx = sh[0] - hip[0], dy = sh[1] - hip[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const hw = fig.hipW / 2, sw = fig.shoulderW / 2;
  // slight taper at the waist for the female figure, straighter for the male
  const waist = fig.hairStyle === 'ponytail' ? 0.84 : 0.95;
  const m = [hip[0] + dx * 0.45, hip[1] + dy * 0.45], mw = ((hw + sw) / 2) * waist;
  const pts = (k) => [
    [hip[0] + nx * hw * k, hip[1] + ny * hw * k], [m[0] + nx * mw * k, m[1] + ny * mw * k], [sh[0] + nx * sw * k, sh[1] + ny * sw * k],
    [sh[0] - nx * sw * k, sh[1] - ny * sw * k], [m[0] - nx * mw * k, m[1] - ny * mw * k], [hip[0] - nx * hw * k, hip[1] - ny * hw * k]];
  const path = (pp, r1, r2) => `M${P(pp[0])}Q${P(pp[1])} ${P(pp[2])}A${f1(r2)} ${f1(r2)} 0 0 0 ${P(pp[3])}Q${P(pp[4])} ${P(pp[5])}A${f1(r1)} ${f1(r1)} 0 0 0 ${P(pp[0])}Z`;
  let out = `<path d="${path(pts(1.06), hw * 1.06, sw * 1.06)}" fill="${fig.topShade}"/>`;
  out += `<path d="${path(pts(1), hw, sw)}" fill="${fig.top}"/>`;
  // waistband where the top meets the pants
  const wb = [hip[0] + dx * 0.12, hip[1] + dy * 0.12];
  out += `<path d="${capsule([wb[0] + nx * hw * 0.98, wb[1] + ny * hw * 0.98], [wb[0] - nx * hw * 0.98, wb[1] - ny * hw * 0.98], 2.6, 2.6)}" fill="${fig.bottom}"/>`;
  // soft highlight on the side facing the light
  let lx = nx, ly = ny; if (lx + ly > 0) { lx = -lx; ly = -ly; }
  out += `<path d="${capsule([hip[0] + dx * 0.25 + lx * hw * 0.45, hip[1] + dy * 0.25 + ly * hw * 0.45], [sh[0] - dx * 0.12 + lx * sw * 0.45, sh[1] - dy * 0.12 + ly * sw * 0.45], 2.2, 2.6)}" fill="#fff" opacity=".13"/>`;
  return out;
}

/** Angle arc + label on the joint the app judges for this exercise. */
function focusSVG(j, focus) {
  const a = j[focus.from], b = j[focus.joint], c = j[focus.to];
  const ang = jointAngle(a, b, c);
  const a1 = Math.atan2(a[1] - b[1], a[0] - b[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const R = 15, sweep = d > 0 ? 1 : 0;
  const s = [b[0] + Math.cos(a1) * R, b[1] + Math.sin(a1) * R], e = [b[0] + Math.cos(a2) * R, b[1] + Math.sin(a2) * R];
  const ok = focus.ok(ang);
  // Green once the angle reaches the target; neutral otherwise (it is not an error mid-rep).
  const col = ok ? '#2fbf71' : '#d5dde7';
  const text = `${focus.label} ${Math.round(ang)}°`;
  const w = text.length * 6.1 + 14;
  // Fixed read-out in the top-left corner so it never covers the figure.
  return `<path d="M${P(b)}L${P(s)}A${R} ${R} 0 0 ${sweep} ${P(e)}Z" fill="${col}" opacity=".22"/>`
    + `<path d="M${P(s)}A${R} ${R} 0 0 ${sweep} ${P(e)}" stroke="${col}" stroke-width="2" fill="none"/>`
    + `<circle cx="${f1(b[0])}" cy="${f1(b[1])}" r="3.4" fill="#fff" stroke="${col}" stroke-width="2"/>`
    + `<rect x="6" y="-10" width="${f1(w)}" height="17" rx="8.5" fill="#0b121a" opacity=".9" stroke="${col}" stroke-width="1.2"/>`
    + `<text x="${f1(6 + w / 2)}" y="2.6" text-anchor="middle" font-size="10.5" font-weight="700" fill="${col}" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif">${text}</text>`;
}

function sceneSVG(demo) {
  let out = `<ellipse cx="110" cy="176" rx="104" ry="5" fill="#000" opacity=".25"/>`
    + `<rect x="4" y="174" width="212" height="4" rx="2" fill="#2a3746"/>`;
  if (demo.scene === 'bench') {
    out += `<rect x="64" y="142" width="6" height="33" rx="2" fill="#4a5a6c"/><rect x="180" y="142" width="6" height="33" rx="2" fill="#4a5a6c"/>`
      + `<rect x="52" y="132" width="146" height="11" rx="5" fill="#7a2f3a"/><rect x="54" y="133.5" width="142" height="3" rx="1.5" fill="#fff" opacity=".12"/>`;
  }
  if (demo.scene === 'cable') {
    out += `<rect x="199" y="22" width="12" height="153" rx="3" fill="#4a5a6c"/><rect x="200.5" y="24" width="3" height="149" rx="1.5" fill="#fff" opacity=".1"/>`
      + `<circle cx="205" cy="40" r="6" fill="#8796a8"/><circle cx="205" cy="40" r="2" fill="#2a3746"/>`;
  }
  return out;
}

function propSVG(demo, j, dim) {
  const [wx, wy] = j.wrist;
  if (demo.prop === 'dumbbell') {
    return `<rect x="${f1(wx - 9)}" y="${f1(wy - 2)}" width="18" height="4" rx="2" fill="#aab6c4"/>`
      + `<rect x="${f1(wx - 13)}" y="${f1(wy - 7)}" width="6" height="14" rx="2.5" fill="#4b5868"/>`
      + `<rect x="${f1(wx + 7)}" y="${f1(wy - 7)}" width="6" height="14" rx="2.5" fill="#4b5868"/>`
      + `<rect x="${f1(wx - 12)}" y="${f1(wy - 6)}" width="1.6" height="12" rx=".8" fill="#fff" opacity=".2"/>`;
  }
  if (demo.prop === 'barbell') {
    return `<circle cx="${f1(wx)}" cy="${f1(wy)}" r="17" fill="#2f3a48"/><circle cx="${f1(wx)}" cy="${f1(wy)}" r="15" fill="#3f4c5c"/>`
      + `<circle cx="${f1(wx)}" cy="${f1(wy)}" r="9" fill="none" stroke="#56657a" stroke-width="1.5"/>`
      + `<circle cx="${f1(wx)}" cy="${f1(wy)}" r="3.2" fill="#c9d3de"/>`;
  }
  if (demo.prop === 'handle') {
    return `<path d="M205 40L${f1(wx)} ${f1(wy)}" stroke="#c9d3de" stroke-width="1.4"/>`
      + `<rect x="${f1(wx - 3.2)}" y="${f1(wy - 7)}" width="6.4" height="14" rx="3" fill="#4b5868"/>`;
  }
  return '';
}

/** Full frame as an SVG string (the figure faces right). */
export function frameSVG(demo, fig, t) {
  const j = anchored(demo, poseAt(demo, t));
  const s = fig.limb;
  const dimFig = { ...fig, top: darken(fig.top, 0.72), topShade: darken(fig.topShade, 0.72), bottom: darken(fig.bottom, 0.75),
    bottomShade: darken(fig.bottomShade, 0.75), skin: darken(fig.skin, 0.8), skinShade: darken(fig.skinShade, 0.8) };
  const off = (p) => [p[0] - 3.5, p[1] - 2.5];
  const fj = Object.fromEntries(Object.entries(j).map(([k, v]) => [k, off(v)]));
  const leg = (q, f, dim) => limb(q.hip, q.knee, 7.4 * s, 6.2 * s, f.bottom, f.bottomShade) + limb(q.knee, q.ankle, 6.2 * s, 4.6 * s, f.bottom, f.bottomShade) + shoeSVG(q.ankle, q.toe, fig, dim);
  const arm = (q, f) => limb(q.shoulder, q.elbow, 5.4 * s, 4.6 * s, f.top, f.topShade) + limb(q.elbow, q.wrist, 4.6 * s, 3.7 * s, f.top, f.topShade)
    + `<circle cx="${f1(q.wrist[0])}" cy="${f1(q.wrist[1])}" r="${f1(3.9 * s)}" fill="${f.skinShade}"/><circle cx="${f1(q.wrist[0])}" cy="${f1(q.wrist[1])}" r="${f1(3.2 * s)}" fill="${f.skin}"/>`;
  // head frame
  const up = [j.head[0] - j.shoulder[0], j.head[1] - j.shoulder[1]];
  const ul = Math.hypot(...up) || 1; const u = [up[0] / ul, up[1] / ul];
  let face = [-u[1], u[0]];
  if (demo.supine) face = [-face[0], -face[1]];
  const neck = limb(j.shoulder, j.head, 3.6, 3.4, fig.skin, fig.skinShade);
  return sceneSVG(demo)
    + leg(fj, dimFig, true) + arm(fj, dimFig)
    + neck + torsoSVG(j.hip, j.shoulder, fig, demo) + leg(j, fig, false)
    + headSVG(j.head, u, face, fig)
    + (demo.prop === 'barbell' ? propSVG(demo, j) + arm(j, fig) : arm(j, fig) + propSVG(demo, j))
    + (demo.focus ? focusSVG(j, demo.focus) : '');
}

/**
 * Mount an animated demo into `container`. Returns { set(exercise, sex), freeze(t), stop() }.
 * Respects prefers-reduced-motion by playing a slower loop.
 */
export function mountDemo(container) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 -14 220 204');
  svg.setAttribute('role', 'img');
  svg.setAttribute('class', 'demo-svg');
  const title = document.createElementNS(SVGNS, 'title');
  const g = document.createElementNS(SVGNS, 'g');
  svg.append(title, g);
  container.replaceChildren(svg);
  let demo = DEMOS.squat, fig = FIGURES.male, exercise = 'squat', raf = 0, t0 = performance.now();
  const slow = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;

  function frame(now, fixedT) {
    const t = fixedT ?? ((now - t0) / 1000) * slow;
    g.innerHTML = frameSVG(demo, fig, t);
    if (fixedT == null) raf = requestAnimationFrame(frame);
  }

  return {
    set(ex, sex) {
      exercise = ex; demo = DEMOS[ex] ?? DEMOS.squat; fig = FIGURES[sex] ?? FIGURES.male;
      title.textContent = `Animated ${sex === 'female' ? 'female' : 'male'} character demonstrating correct ${ex} form`;
      t0 = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      return DEMOS[exercise].points;
    },
    /** Draw a single still frame at time t (seconds); used for previews and checks. */
    freeze(t) { cancelAnimationFrame(raf); raf = 0; frame(0, t); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
