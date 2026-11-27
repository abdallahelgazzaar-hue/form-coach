// Run: node --test tests/  (Node 18+). Synthetic side-view skeletons drive the analyzer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Analyzer, angle } from '../engine.js';

const W = 1000, H = 1000;
const blank = () => Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
const deg = (d) => d * Math.PI / 180;
// Build left-side landmarks (indices 11,13,15,23,25,27,31) from pixel points.
function pose(pts) {
  const l = blank(); const map = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, foot: 31, ear: 7 };
  for (const [k, [x, y]] of Object.entries(pts)) l[map[k]] = { x: x / W, y: y / H, visibility: 0.95 };
  return l;
}
// Squat: ankle fixed, shin and thigh 200px, knee angle k, torso lean from vertical `lean`.
function squat(k, lean) {
  const ankle = [500, 900]; const shin = deg(15);
  const knee = [ankle[0] + 200 * Math.sin(shin), ankle[1] - 200 * Math.cos(shin)];
  const thighDir = Math.PI - shin + deg(180 - k);     // rotate around knee
  const hip = [knee[0] - 200 * Math.sin(deg(k) - shin), knee[1] - 200 * Math.cos(deg(k) - shin) * -1 * -1];
  // Simpler: place hip by rotating vector knee->ankle by k degrees.
  const vx = ankle[0] - knee[0], vy = ankle[1] - knee[1];
  const c = Math.cos(deg(k)), s = Math.sin(deg(k));
  const h = [knee[0] + vx * c - vy * s, knee[1] + vx * s + vy * c];
  const sh = [h[0] + 250 * Math.sin(deg(lean)), h[1] - 250 * Math.cos(deg(lean))];
  return pose({ ankle, knee, hip: h, shoulder: sh, elbow: sh, wrist: sh, foot: [560, 900] });
}
function run(a, frames) { let t = 0, last = []; for (const f of frames) { const o = a.update(f, W, H, t += 33); if (o.repEvent) last.push(o.repEvent); } return last; }
const sweep = (from, to, n = 10) => Array.from({ length: n + 1 }, (_, i) => from + (to - from) * i / n);

test('angle helper', () => {
  assert.equal(Math.round(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })), 90);
  const p = squat(95, 20); const k = angle(
    { x: p[23].x * W, y: p[23].y * H }, { x: p[25].x * W, y: p[25].y * H }, { x: p[27].x * W, y: p[27].y * H });
  assert.ok(Math.abs(k - 95) < 1, `knee ${k}`);
});

test('squat: full-depth rep counts as valid', () => {
  const a = new Analyzer('squat');
  const frames = [...sweep(175, 85, 15), ...sweep(85, 175, 15), 175, 175].map((k) => squat(k, 25));
  const reps = run(a, frames);
  assert.equal(reps.length, 1); assert.equal(reps[0].valid, true); assert.ok(reps[0].score >= 85, reps[0].score);
});

test('squat: shallow rep counted but flagged invalid', () => {
  const a = new Analyzer('squat');
  const reps = run(a, [...sweep(175, 130, 10), ...sweep(130, 175, 10), 175, 175].map((k) => squat(k, 25)));
  assert.equal(reps.length, 1); assert.equal(reps[0].valid, false); assert.match(reps[0].faults[0], /shallow/);
});

test('squat: excessive forward lean is flagged', () => {
  const a = new Analyzer('squat');
  const reps = run(a, [...sweep(175, 90, 12), ...sweep(90, 175, 12), 175, 175].map((k) => squat(k, k < 120 ? 65 : 30)));
  assert.equal(reps[0].valid, false); assert.ok(reps[0].faults.some((f) => /lean/.test(f)));
});

test('squat: three reps counted, no double counting from jitter', () => {
  const a = new Analyzer('squat'); const seq = [];
  for (let r = 0; r < 3; r++) seq.push(...sweep(175, 88, 10), 92, 87, 91, ...sweep(88, 175, 10), 172, 176);
  const reps = run(a, seq.map((k) => squat(k, 25)));
  assert.equal(reps.length, 3); assert.equal(a.validReps, 3);
});

// Push-up / plank: body roughly horizontal, head on the left. hipDy > 0 moves hips down (sag).
function plankPose(elbowAngle, hipDy, headRight = false) {
  const sx = headRight ? 800 : 200, ax = headRight ? 200 : 800;
  const shoulder = [sx, 600], ankle = [ax, 650];
  const hip = [(sx + ax) / 2, 625 + hipDy];
  // elbow placed so shoulder-elbow-wrist angle = elbowAngle (upper arm and forearm 100px each)
  // isosceles arm (100px segments): wrist straight below shoulder, elbow offset sideways
  const half = deg(elbowAngle / 2);
  const wrist = [sx, 600 + 200 * Math.sin(half)];
  const elbow = [sx + 100 * Math.cos(half), 600 + 100 * Math.sin(half)];
  return pose({ shoulder, hip, ankle, wrist, elbow, knee: [(hip[0] + ax) / 2, (hip[1] + 650) / 2], foot: [ax, 660] });
}

test('push-up: good rep valid, sagging rep flagged as sag', () => {
  const a = new Analyzer('pushup');
  const good = run(a, [...sweep(175, 80, 10), ...sweep(80, 175, 10), 175].map((e) => plankPose(e, 0)));
  assert.equal(good.length, 1, 'one rep'); assert.equal(good[0].valid, true);
  const b = new Analyzer('pushup');
  const bad = run(b, [...sweep(175, 80, 10), ...sweep(80, 175, 10), 175].map((e) => plankPose(e, 70)));
  assert.equal(bad[0].valid, false); assert.ok(bad[0].faults.some((f) => /sag/.test(f)), bad[0].faults.join());
});

test('plank: sag vs pike detected on both facing directions, timer pauses on bad form', () => {
  for (const headRight of [false, true]) {
    const a = new Analyzer('plank');
    let o; for (let i = 0; i < 30; i++) o = a.update(plankPose(170, 0, headRight), W, H, i * 100);
    assert.equal(o.checks[0].status, 'good'); const held = a.holdMs; assert.ok(held > 2500);
    for (let i = 30; i < 45; i++) o = a.update(plankPose(170, 80, headRight), W, H, i * 100);
    assert.equal(o.checks[0].status, 'bad'); assert.match(o.cue, /dropping/);
    assert.ok(a.holdMs < held + 600, 'clock paused (allowing smoothing lag)');
    for (let i = 45; i < 60; i++) o = a.update(plankPose(170, -80, headRight), W, H, i * 100);
    assert.match(o.cue, /too high/);
  }
});

test('not ready when body not visible or standing upright for floor exercises', () => {
  const a = new Analyzer('plank');
  assert.equal(a.update(null, W, H, 0).ready, false);
  assert.equal(a.update(squat(175, 0), W, H, 33).ready, false);
});
