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
const L = { torso: 52, neck: 9, head: 10, uarm: 30, farm: 28, thigh: 42, shin: 42, foot: 13 };

export const FIGURES = {
  male: { shoulderW: 17, hipW: 12, limbW: 8.5, color: '#4ea1ff', far: '#2c5a8c', hair: 'short' },
  female: { shoulderW: 12, hipW: 17, limbW: 7.5, color: '#b58cff', far: '#5f4a8a', hair: 'ponytail' },
};

/**
 * Each demo: scene (equipment), anchor (the point that stays fixed), loop of keyframes with hold times (s),
 * and the coaching points shown under the animation.
 */
export const DEMOS = {
  squat: {
    anchor: ['ankle', [92, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 176, thigh: 2, shin: -2, foot: 90, uarm: 92, farm: 92 }, hold: 0.5, move: 1.2 },
      { pose: { torso: 142, thigh: 82, shin: -28, foot: 90, uarm: 96, farm: 96 }, hold: 0.35, move: 1.0 },
    ],
    points: ['Hips back and down, chest up', 'Thighs parallel to the floor', 'Knees track over toes, heels down'],
  },
  pushup: {
    anchor: ['wrist', [148, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 101, thigh: -79, shin: -79, foot: -10, uarm: 0, farm: 0 }, hold: 0.4, move: 1.1 },
      { pose: { torso: 93, thigh: -87, shin: -87, foot: -10, uarm: -88, farm: 0 }, hold: 0.3, move: 0.9 },
    ],
    points: ['Hands under shoulders', 'Body in one straight line', 'Lower until elbows reach about 90°'],
  },
  plank: {
    anchor: ['elbow', [150, 172]], scene: 'floor',
    frames: [
      { pose: { torso: 98, thigh: -82, shin: -82, foot: -10, uarm: 0, farm: 90 }, hold: 1.4, move: 1.2 },
      { pose: { torso: 98.6, thigh: -81.4, shin: -81.4, foot: -10, uarm: 0, farm: 90 }, hold: 1.4, move: 1.2 },
    ],
    points: ['Elbows under shoulders', 'Straight line from head to heels', 'Squeeze glutes, don’t let hips sag'],
  },
  curl: {
    anchor: ['ankle', [100, 172]], scene: 'floor', prop: 'dumbbell',
    frames: [
      { pose: { torso: 179, thigh: 1, shin: -1, foot: 90, uarm: 3, farm: 4 }, hold: 0.35, move: 1.0 },
      { pose: { torso: 179, thigh: 1, shin: -1, foot: 90, uarm: 8, farm: 150 }, hold: 0.3, move: 1.4 },
    ],
    points: ['Elbow stays pinned at your side', 'Curl all the way up, lower slowly', 'No swinging the body'],
  },
  bench: {
    anchor: ['hip', [78, 128]], scene: 'bench', prop: 'barbell', supine: true,
    frames: [
      { pose: { torso: 90, thigh: -100, shin: -8, foot: -90, uarm: 178, farm: 178 }, hold: 0.4, move: 1.3 },
      { pose: { torso: 90, thigh: -100, shin: -8, foot: -90, uarm: -40, farm: 172 }, hold: 0.25, move: 1.0 },
    ],
    points: ['Feet flat, hips stay on the bench', 'Lower the bar to mid-chest', 'Wrists stacked over elbows, press to lockout'],
  },
  pushdown: {
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

const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.append(n);
  return n;
};
const line = (a, b) => ({ x1: a[0].toFixed(1), y1: a[1].toFixed(1), x2: b[0].toFixed(1), y2: b[1].toFixed(1) });

/** Tapered torso polygon from hip to shoulder. */
function torsoPath(hip, sh, hipW, shW) {
  const vx = sh[0] - hip[0], vy = sh[1] - hip[1], len = Math.hypot(vx, vy) || 1;
  const nx = -vy / len, ny = vx / len;
  const p = [
    [hip[0] + nx * hipW / 2, hip[1] + ny * hipW / 2], [sh[0] + nx * shW / 2, sh[1] + ny * shW / 2],
    [sh[0] - nx * shW / 2, sh[1] - ny * shW / 2], [hip[0] - nx * hipW / 2, hip[1] - ny * hipW / 2],
  ];
  return 'M' + p.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z';
}

/**
 * Mount an animated demo into `container`. Returns { set(exercise, sex), stop() }.
 * Respects prefers-reduced-motion by showing a slow loop.
 */
export function mountDemo(container) {
  const svg = el('svg', { viewBox: '0 -14 220 204', role: 'img', class: 'demo-svg' });
  container.replaceChildren(svg);
  const title = el('title', {}, svg);
  const sceneG = el('g', {}, svg);
  const farG = el('g', { 'stroke-linecap': 'round', fill: 'none' }, svg);
  const bodyG = el('g', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
  const propG = el('g', {}, svg);

  const far = { uarm: el('line', {}, farG), farm: el('line', {}, farG), thigh: el('line', {}, farG), shin: el('line', {}, farG), foot: el('line', {}, farG) };
  const hairBack = el('path', {}, bodyG);
  const torso = el('path', {}, bodyG);
  const neck = el('line', {}, bodyG);
  const near = { thigh: el('line', {}, bodyG), shin: el('line', {}, bodyG), foot: el('line', {}, bodyG) };
  const hairTop = el('path', {}, bodyG);
  const head = el('circle', { r: L.head }, bodyG);
  const nearArm = { uarm: el('line', {}, bodyG), farm: el('line', {}, bodyG) };

  let demo = DEMOS.squat, fig = FIGURES.male, exercise = 'squat', raf = 0, t0 = performance.now();
  const slow = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
  const cableTop = [205, 40];

  function drawScene() {
    sceneG.replaceChildren();
    el('line', { x1: 4, y1: 175, x2: 216, y2: 175, stroke: '#2a3746', 'stroke-width': 3, 'stroke-linecap': 'round' }, sceneG);
    if (demo.scene === 'bench') {
      el('rect', { x: 52, y: 133, width: 146, height: 9, rx: 3, fill: '#3a4a5c' }, sceneG);
      el('line', { x1: 66, y1: 142, x2: 66, y2: 175, stroke: '#3a4a5c', 'stroke-width': 5 }, sceneG);
      el('line', { x1: 184, y1: 142, x2: 184, y2: 175, stroke: '#3a4a5c', 'stroke-width': 5 }, sceneG);
    }
    if (demo.scene === 'cable') {
      el('rect', { x: 200, y: 30, width: 10, height: 145, rx: 2, fill: '#3a4a5c' }, sceneG);
      el('circle', { cx: cableTop[0], cy: cableTop[1], r: 5, fill: '#5b6f86' }, sceneG);
    }
  }

  function frame(now, fixedT) {
    const t = fixedT ?? ((now - t0) / 1000) * slow;
    const j = anchored(demo, poseAt(demo, t));
    const w = fig.limbW;
    const set = (n, a, b, color, width) => {
      const c = line(a, b);
      for (const k in c) n.setAttribute(k, c[k]);
      n.setAttribute('stroke', color); n.setAttribute('stroke-width', width);
    };
    // Far-side limbs, slightly offset and darker, for depth.
    const off = (p) => [p[0] - 3, p[1] - 2];
    set(far.uarm, off(j.shoulder), off(j.elbow), fig.far, w * 0.9);
    set(far.farm, off(j.elbow), off(j.wrist), fig.far, w * 0.85);
    set(far.thigh, off(j.hip), off(j.knee), fig.far, w * 1.1);
    set(far.shin, off(j.knee), off(j.ankle), fig.far, w);
    set(far.foot, off(j.ankle), off(j.toe), fig.far, w * 0.7);

    torso.setAttribute('d', torsoPath(j.hip, j.shoulder, fig.hipW, fig.shoulderW));
    torso.setAttribute('fill', fig.color);
    set(neck, j.shoulder, j.neck, fig.color, 6);
    set(near.thigh, j.hip, j.knee, fig.color, w * 1.25);
    set(near.shin, j.knee, j.ankle, fig.color, w * 1.05);
    set(near.foot, j.ankle, j.toe, fig.color, w * 0.75);
    head.setAttribute('fill', '#e9c9a8');

    // Hair: a dark circle behind the face, shifted toward the back and top of the head, so it shows
    // as a cap. The female figure adds a ponytail.
    const [hx, hy] = j.head;
    const up = [j.head[0] - j.shoulder[0], j.head[1] - j.shoulder[1]];
    const ul = Math.hypot(up[0], up[1]) || 1, ux = up[0] / ul, uy = up[1] / ul;
    const bx = -uy, by = ux; // facing direction for a standing or face-down figure
    const back = demo.supine ? [bx, by] : [-bx, -by]; // lying face-up (bench) flips it
    const hr = L.head + (fig.hair === 'ponytail' ? 1.8 : 1.2);
    const hc = [hx + back[0] * 2.2 + ux * 1.8, hy + back[1] * 2.2 + uy * 1.8];
    hairTop.setAttribute('d', `M${(hc[0] - hr).toFixed(1)} ${hc[1].toFixed(1)}a${hr} ${hr} 0 1 0 ${(2 * hr).toFixed(1)} 0a${hr} ${hr} 0 1 0 ${(-2 * hr).toFixed(1)} 0`);
    hairTop.setAttribute('fill', '#3b2a20');
    if (fig.hair === 'ponytail') {
      const base = [hx + back[0] * (L.head + 1) + ux * 2, hy + back[1] * (L.head + 1) + uy * 2];
      const tip = [base[0] + back[0] * 7 - ux * 15, base[1] + back[1] * 7 - uy * 15];
      const ctrl = [base[0] + back[0] * 12 - ux * 2, base[1] + back[1] * 12 - uy * 2];
      hairBack.setAttribute('d', `M${base[0].toFixed(1)} ${base[1].toFixed(1)}Q${ctrl[0].toFixed(1)} ${ctrl[1].toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`);
      hairBack.setAttribute('stroke', '#3b2a20'); hairBack.setAttribute('stroke-width', 6); hairBack.setAttribute('fill', 'none');
      hairBack.setAttribute('stroke-linecap', 'round');
    } else hairBack.setAttribute('d', '');
    // Face sits on top of the hair, nudged toward the front.
    head.setAttribute('cx', (hx - back[0] * 1.2).toFixed(1)); head.setAttribute('cy', (hy - back[1] * 1.2).toFixed(1));

    set(nearArm.uarm, j.shoulder, j.elbow, fig.color, w);
    set(nearArm.farm, j.elbow, j.wrist, fig.color, w * 0.9);

    propG.replaceChildren();
    const [wx, wy] = j.wrist;
    if (demo.prop === 'dumbbell') {
      el('rect', { x: (wx - 9).toFixed(1), y: (wy - 3).toFixed(1), width: 18, height: 6, rx: 2, fill: '#9aa8b8' }, propG);
      el('rect', { x: (wx - 12).toFixed(1), y: (wy - 6).toFixed(1), width: 5, height: 12, rx: 1.5, fill: '#6b7a8c' }, propG);
      el('rect', { x: (wx + 7).toFixed(1), y: (wy - 6).toFixed(1), width: 5, height: 12, rx: 1.5, fill: '#6b7a8c' }, propG);
    } else if (demo.prop === 'barbell') {
      el('circle', { cx: wx.toFixed(1), cy: wy.toFixed(1), r: 15, fill: '#6b7a8c', opacity: 0.9 }, propG);
      el('circle', { cx: wx.toFixed(1), cy: wy.toFixed(1), r: 3, fill: '#c9d3de' }, propG);
    } else if (demo.prop === 'handle') {
      el('line', { x1: cableTop[0], y1: cableTop[1], x2: wx.toFixed(1), y2: wy.toFixed(1), stroke: '#c9d3de', 'stroke-width': 1.5 }, propG);
      el('rect', { x: (wx - 3).toFixed(1), y: (wy - 6).toFixed(1), width: 6, height: 12, rx: 2, fill: '#9aa8b8' }, propG);
    }
    if (fixedT == null) raf = requestAnimationFrame(frame);
  }

  return {
    /** Draw a single still frame at time t (seconds); used for previews and checks. */
    freeze(t) { cancelAnimationFrame(raf); raf = 0; frame(0, t); },
    set(ex, sex) {
      exercise = ex; demo = DEMOS[ex] ?? DEMOS.squat; fig = FIGURES[sex] ?? FIGURES.male;
      title.textContent = `Animated ${sex === 'female' ? 'female' : 'male'} figure demonstrating correct ${ex} form`;
      t0 = performance.now();
      drawScene();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      return DEMOS[exercise].points;
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
