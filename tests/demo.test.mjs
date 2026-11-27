// The demo animations must show form that our own analyzer accepts: feed each demo's poses
// through the Analyzer and expect valid reps with no faults (plank: the timer keeps running).
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMOS, poseAt, solve } from '../demo.js';
import { Analyzer } from '../engine.js';

const W = 220, H = 204;
function landmarks(demoKey, t) {
  const j = solve(poseAt(DEMOS[demoKey], t));
  const l = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0.1 }));
  const map = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27, toe: 31 };
  for (const [k, i] of Object.entries(map)) l[i] = { x: (j[k][0] + 110) / W, y: (j[k][1] + 120) / H, visibility: 0.95 };
  return l;
}
function cycle(d) { return d.frames.reduce((s, f) => s + f.hold + f.move, 0); }

for (const ex of ['squat', 'pushup', 'curl', 'bench', 'pushdown']) {
  test(`${ex} demo shows valid, fault-free reps`, () => {
    const a = new Analyzer(ex); const reps = [];
    const end = cycle(DEMOS[ex]) * 3;
    for (let t = 0; t <= end; t += 1 / 30) { const o = a.update(landmarks(ex, t), W, H, t * 1000); if (o.repEvent) reps.push(o.repEvent); }
    assert.ok(reps.length >= 2, `${ex}: only ${reps.length} reps counted`);
    for (const r of reps) assert.ok(r.valid && r.faults.length === 0, `${ex}: ${r.faults.join(' | ')} (score ${r.score})`);
  });
}

test('plank demo holds good form the whole time', () => {
  const a = new Analyzer('plank'); let o;
  for (let t = 0; t <= cycle(DEMOS.plank) * 2; t += 1 / 30) o = a.update(landmarks('plank', t), W, H, t * 1000);
  assert.ok(o.ready); assert.ok(a.holdMs >= a.totalMs - 100, `hold ${a.holdMs} of ${a.totalMs}`);
});
