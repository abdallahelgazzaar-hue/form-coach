// Synthetic side-view skeletons for the weight exercises.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Analyzer } from '../engine.js';

const W = 1000, H = 1000, rad = (d) => d * Math.PI / 180;
function pose(pts) {
  const l = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  const map = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, foot: 31 };
  for (const [k, [x, y]] of Object.entries(pts)) l[map[k]] = { x: x / W, y: y / H, visibility: 0.95 };
  return l;
}
const rot = ([x, y], d) => [x * Math.cos(rad(d)) - y * Math.sin(rad(d)), x * Math.sin(rad(d)) + y * Math.cos(rad(d))];
// Standing: hip fixed, torso leaned `lean` deg; upper arm `arm` deg forward of vertical; elbow angle `e`.
function standing(e, arm = 5, lean = 0) {
  const hip = [500, 600];
  const sh = [hip[0] + 250 * Math.sin(rad(lean)), hip[1] - 250 * Math.cos(rad(lean))];
  const elbow = [sh[0] + 150 * Math.sin(rad(arm)), sh[1] + 150 * Math.cos(rad(arm))];
  const v = rot([sh[0] - elbow[0], sh[1] - elbow[1]], -e);   // rotate elbow->shoulder by e (forward/up)
  const wrist = [elbow[0] + v[0], elbow[1] + v[1]];
  return pose({ shoulder: sh, elbow, wrist, hip, knee: [500, 780], ankle: [500, 950], foot: [550, 950] });
}
// Bench: lying, head left. Forearm tilted `fa` deg from vertical; hip raised by `lift` px.
function bench(e, fa = 0, lift = 0) {
  const sh = [300, 600];
  const elbow = [sh[0] - 120 * Math.sin(rad(e)), sh[1] - 120 * Math.cos(rad(e)) * -1 * -1];
  // elbow->shoulder makes angle e with the forearm (pointing up, tilted by fa)
  const up = [Math.sin(rad(fa)), -Math.cos(rad(fa))];
  const toSh = rot(up, e);
  const el = [sh[0] - 120 * toSh[0], sh[1] - 120 * toSh[1]];
  const wrist = [el[0] + 120 * up[0], el[1] + 120 * up[1]];
  return pose({ shoulder: sh, elbow: el, wrist, hip: [550, 600 - lift], knee: [750, 600], ankle: [900, 650], foot: [920, 650] });
}
const sweep = (a, b, n = 10) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
function run(ex, frames) { const a = new Analyzer(ex); const reps = []; let t = 0;
  for (const f of frames) { const o = a.update(f, W, H, t += 33); if (o.repEvent) reps.push(o.repEvent); } return { a, reps }; }

test('curl: clean reps counted and valid', () => {
  const seq = []; for (let i = 0; i < 3; i++) seq.push(...sweep(170, 40), ...sweep(40, 170), 170);
  const { reps } = run('curl', [170, 170, ...seq].map((e) => standing(e)));
  assert.equal(reps.length, 3); assert.ok(reps.every((r) => r.valid), JSON.stringify(reps.map((r) => r.faults)));
});

test('curl: partial range, elbow drift and swing are flagged', () => {
  let { reps } = run('curl', [170, 170, ...sweep(170, 90), ...sweep(90, 170), 170].map((e) => standing(e)));
  assert.equal(reps[0].valid, false); assert.match(reps[0].faults[0], /Partial/);
  ({ reps } = run('curl', [170, 170, ...sweep(170, 40), ...sweep(40, 170), 170].map((e) => standing(e, e < 100 ? 45 : 5))));
  assert.ok(reps[0].faults.some((f) => /drifted/.test(f)));
  ({ reps } = run('curl', [170, 170, ...sweep(170, 40), ...sweep(40, 170), 170].map((e) => standing(e, 5, e < 110 ? -22 : 0))));
  assert.ok(reps[0].faults.some((f) => /swing/i.test(f)), reps[0].faults.join());
});

test('pushdown: hanging arm at setup is not a rep; full lockout reps valid', () => {
  const seq = [175, 175, 175, ...sweep(175, 90), 90, 90]; // arrives with arm hanging, then takes the start position
  for (let i = 0; i < 2; i++) seq.push(...sweep(90, 170), ...sweep(170, 90));
  const { reps } = run('pushdown', [...seq, 90].map((e) => standing(e)));
  assert.equal(reps.length, 2); assert.ok(reps.every((r) => r.valid));
});

test('pushdown: partial lockout flagged', () => {
  const { reps } = run('pushdown', [90, 90, ...sweep(90, 140), ...sweep(140, 90), 90].map((e) => standing(e)));
  assert.equal(reps.length, 1); assert.equal(reps[0].valid, false); assert.match(reps[0].faults[0], /Partial/);
});

test('bench: full rep valid; shallow and hip lift flagged', () => {
  let { reps } = run('bench', [170, 170, ...sweep(170, 80), ...sweep(80, 170), 170].map((e) => bench(e)));
  assert.equal(reps.length, 1); assert.equal(reps[0].valid, true, reps[0].faults.join());
  ({ reps } = run('bench', [170, 170, ...sweep(170, 120), ...sweep(120, 170), 170].map((e) => bench(e))));
  assert.equal(reps[0].valid, false); assert.match(reps[0].faults[0], /shallow/);
  ({ reps } = run('bench', [170, 170, ...sweep(170, 80), ...sweep(80, 170), 170].map((e) => bench(e, 0, e < 120 ? 90 : 0))));
  assert.ok(reps[0].faults.some((f) => /Hips/.test(f)), reps[0].faults.join());
  ({ reps } = run('bench', [170, 170, ...sweep(170, 80), ...sweep(80, 170), 170].map((e) => bench(e, e < 110 ? 40 : 0))));
  assert.ok(reps[0].faults.some((f) => /Wrists/.test(f)), reps[0].faults.join());
});

test('bench: standing person is not ready', () => {
  const a = new Analyzer('bench');
  assert.equal(a.update(standing(170), W, H, 0).ready, false);
});
