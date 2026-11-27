// Form-analysis engine. Pure logic, no DOM: takes pose landmarks, returns feedback.
// Landmark indices follow the MediaPipe Pose (BlazePose) 33-point model.

export const LM = {
  nose: 0, lEar: 7, rEar: 8,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};

const SIDE = {
  left:  { ear: LM.lEar, shoulder: LM.lShoulder, elbow: LM.lElbow, wrist: LM.lWrist, hip: LM.lHip, knee: LM.lKnee, ankle: LM.lAnkle, foot: LM.lFoot },
  right: { ear: LM.rEar, shoulder: LM.rShoulder, elbow: LM.rElbow, wrist: LM.rWrist, hip: LM.rHip, knee: LM.rKnee, ankle: LM.rAnkle, foot: LM.rFoot },
};

const DEG = 180 / Math.PI;

/** Angle ABC in degrees (at vertex B), 0..180. Points are {x,y} in pixels. */
export function angle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (m === 0) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * DEG;
}

/** Angle of segment a->b from vertical, 0 = upright, 90 = horizontal. */
export function fromVertical(a, b) {
  return Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * DEG;
}

/** Signed distance of p from line a->c; sign tells which side (image y grows downward). */
function sideOfLine(a, c, p) {
  const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  return ((c.x - a.x) * (p.y - a.y) - (c.y - a.y) * (p.x - a.x)) / len;
}

/** Exercise thresholds. Assumed values based on common coaching guidance; tune with real users. */
export const RULES = {
  squat: {
    standKnee: 160,        // knee angle above this = standing
    descendKnee: 140,      // below this = rep in progress
    depthGood: 100,        // knee angle at or below = good depth (about thighs parallel)
    depthOk: 115,          // partial squat band
    leanWarn: 45,          // torso angle from vertical
    leanBad: 55,
  },
  pushup: {
    topElbow: 155,
    descendElbow: 135,
    depthGood: 95,
    depthOk: 110,
    lineWarn: 165,         // shoulder-hip-ankle angle; 180 = perfectly straight
    lineBad: 155,
    maxBodyTilt: 40,       // body must be within this many degrees of horizontal
  },
  plank: {
    lineGood: 165,
    lineBad: 155,
    maxBodyTilt: 35,
  },
};

const VIS_MIN = 0.5;

function pick(landmarks, w, h) {
  // Choose the side facing the camera (higher visibility), and convert to pixels
  // so angles are not distorted by the frame's aspect ratio.
  const score = (s) => ['shoulder', 'hip', 'knee', 'ankle', 'elbow', 'wrist']
    .reduce((t, k) => t + (landmarks[SIDE[s][k]]?.visibility ?? 0), 0);
  const side = score('left') >= score('right') ? 'left' : 'right';
  const p = {};
  for (const [k, idx] of Object.entries(SIDE[side])) {
    const l = landmarks[idx];
    p[k] = { x: l.x * w, y: l.y * h, v: l.visibility ?? 1 };
  }
  return { side, p };
}

function visible(p, keys) {
  return keys.every((k) => p[k].v >= VIS_MIN);
}

class Smoother {
  constructor(alpha = 0.5) { this.alpha = alpha; this.v = {}; }
  push(key, x) {
    const prev = this.v[key];
    this.v[key] = prev === undefined ? x : prev + this.alpha * (x - prev);
    return this.v[key];
  }
  reset() { this.v = {}; }
}

/**
 * Status per check: 'good' | 'warn' | 'bad'. Each analyzer returns:
 * { ready, phase, metrics, checks:[{id,label,status,cue}], frameScore, joints:{name:status},
 *   repEvent?: {valid, score, faults[]} , hold?: {...} }
 */
export class Analyzer {
  constructor(exercise, rules = RULES[exercise]) {
    this.exercise = exercise;
    this.r = rules;
    this.sm = new Smoother(0.5);
    this.reset();
  }

  reset() {
    this.phase = 'up';
    this.reps = 0;
    this.validReps = 0;
    this.repLog = [];
    this.cur = null;          // stats for the rep in progress
    this.holdMs = 0;          // plank: time with good form
    this.totalMs = 0;         // plank: time in position
    this.lastT = null;
    this.faultCounts = {};
    this.sm.reset();
  }

  update(landmarks, w, h, tMs) {
    const dt = this.lastT == null ? 0 : Math.min(250, Math.max(0, tMs - this.lastT));
    this.lastT = tMs;
    if (!landmarks) return { ready: false, cue: 'Step into the frame so your whole body is visible.' };
    const { side, p } = pick(landmarks, w, h);
    const fn = { squat: this.squat, pushup: this.pushup, plank: this.plank }[this.exercise];
    const out = fn.call(this, p, dt);
    out.side = side;
    out.points = p;
    return out;
  }

  // ---------- Squat (side view) ----------
  squat(p) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'hip', 'knee', 'ankle'])) {
      return { ready: false, cue: 'Turn side-on and step back until shoulders, hips, knees and ankles are visible.' };
    }
    const knee = this.sm.push('knee', angle(p.hip, p.knee, p.ankle));
    const lean = this.sm.push('lean', fromVertical(p.hip, p.shoulder));

    const checks = [];
    const inRep = this.phase === 'down';
    const leanStatus = lean > r.leanBad ? 'bad' : lean > r.leanWarn ? 'warn' : 'good';
    checks.push({ id: 'lean', label: 'Chest up', status: leanStatus, value: lean,
      cue: leanStatus === 'good' ? null : 'Keep your chest up and brace your core.' });

    let depthStatus = 'good';
    if (inRep && this.cur) {
      const best = Math.min(this.cur.minKnee, knee);
      depthStatus = best <= r.depthGood ? 'good' : best <= r.depthOk ? 'warn' : 'bad';
    }
    checks.push({ id: 'depth', label: 'Depth', status: inRep ? depthStatus : 'good', value: knee, cue: null });

    let repEvent = null;
    if (this.phase === 'up' && knee < r.descendKnee) {
      this.phase = 'down';
      this.cur = { minKnee: knee, maxLean: lean };
    } else if (this.phase === 'down') {
      this.cur.minKnee = Math.min(this.cur.minKnee, knee);
      this.cur.maxLean = Math.max(this.cur.maxLean, lean);
      if (knee > r.standKnee) {
        const faults = [];
        if (this.cur.minKnee > r.depthOk) faults.push('Too shallow: aim for thighs parallel to the floor.');
        else if (this.cur.minKnee > r.depthGood) faults.push('Almost there: sit a little deeper.');
        if (this.cur.maxLean > r.leanBad) faults.push('Too much forward lean: keep your chest up.');
        const depthScore = scoreBand(this.cur.minKnee, r.depthGood, r.depthOk + 15, true);
        const leanScore = scoreBand(this.cur.maxLean, r.leanWarn, r.leanBad + 10, true);
        repEvent = this.finishRep(Math.round(0.6 * depthScore + 0.4 * leanScore),
          this.cur.minKnee <= r.depthOk && this.cur.maxLean <= r.leanBad, faults,
          { minKnee: this.cur.minKnee, maxLean: this.cur.maxLean });
        this.phase = 'up';
        this.cur = null;
      }
    }

    const joints = { knee: inRep ? depthStatus : 'good', hip: leanStatus, shoulder: leanStatus, ankle: 'good' };
    let cue = checks.find((c) => c.cue)?.cue ?? null;
    if (!cue && inRep && knee > r.depthGood && knee < r.depthOk + 20) cue = 'Lower… hips back and down.';
    return this.result({ phase: this.phase, metrics: { knee, lean }, checks, joints, cue, repEvent });
  }

  // ---------- Push-up (side view) ----------
  pushup(p) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'])) {
      return { ready: false, cue: 'Place the phone side-on at floor level so your whole body is visible.' };
    }
    const tilt = 90 - fromVertical(p.shoulder, p.ankle); // 0 = horizontal
    if (tilt > r.maxBodyTilt) {
      return { ready: false, cue: 'Get into push-up position: hands under shoulders, body straight.' };
    }
    const elbow = this.sm.push('elbow', angle(p.shoulder, p.elbow, p.wrist));
    const line = this.sm.push('line', angle(p.shoulder, p.hip, p.ankle));
    const sag = sideOfLine(p.shoulder, p.ankle, p.hip); // hips below line => sag (in image coords)
    const lineFault = lineFaultName(sag, p.shoulder, p.ankle);

    const lineStatus = line < r.lineBad ? 'bad' : line < r.lineWarn ? 'warn' : 'good';
    const lineCue = lineStatus === 'good' ? null
      : lineFault === 'sag' ? 'Hips are sagging: squeeze glutes and brace your core.'
      : 'Hips too high: lower them into a straight line.';
    const checks = [{ id: 'line', label: 'Body line', status: lineStatus, value: line, cue: lineCue }];

    const inRep = this.phase === 'down';
    let depthStatus = 'good';
    if (inRep && this.cur) {
      const best = Math.min(this.cur.minElbow, elbow);
      depthStatus = best <= r.depthGood ? 'good' : best <= r.depthOk ? 'warn' : 'bad';
    }
    checks.push({ id: 'depth', label: 'Depth', status: inRep ? depthStatus : 'good', value: elbow, cue: null });

    let repEvent = null;
    if (this.phase === 'up' && elbow < r.descendElbow) {
      this.phase = 'down';
      this.cur = { minElbow: elbow, minLine: line, lineFault };
    } else if (this.phase === 'down') {
      this.cur.minElbow = Math.min(this.cur.minElbow, elbow);
      if (line < this.cur.minLine) { this.cur.minLine = line; this.cur.lineFault = lineFault; }
      if (elbow > r.topElbow) {
        const faults = [];
        if (this.cur.minElbow > r.depthOk) faults.push('Too shallow: lower until elbows reach about 90°.');
        else if (this.cur.minElbow > r.depthGood) faults.push('Almost there: go a little lower.');
        if (this.cur.minLine < r.lineBad) faults.push(this.cur.lineFault === 'sag' ? 'Hips sagged during the rep.' : 'Hips piked up during the rep.');
        const depthScore = scoreBand(this.cur.minElbow, r.depthGood, r.depthOk + 15, true);
        const lineScore = scoreBand(this.cur.minLine, r.lineWarn, r.lineBad - 10, false);
        repEvent = this.finishRep(Math.round(0.5 * depthScore + 0.5 * lineScore),
          this.cur.minElbow <= r.depthOk && this.cur.minLine >= r.lineBad, faults,
          { minElbow: this.cur.minElbow, minLine: this.cur.minLine });
        this.phase = 'up';
        this.cur = null;
      }
    }

    const joints = { elbow: inRep ? depthStatus : 'good', hip: lineStatus, shoulder: 'good', knee: lineStatus, ankle: 'good' };
    return this.result({ phase: this.phase, metrics: { elbow, line, tilt }, checks, joints, cue: lineCue, repEvent });
  }

  // ---------- Plank (side view, forearm or straight-arm) ----------
  plank(p, dt) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'hip', 'ankle'])) {
      return { ready: false, cue: 'Place the phone side-on at floor level so shoulders, hips and ankles are visible.' };
    }
    const tilt = 90 - fromVertical(p.shoulder, p.ankle);
    if (tilt > r.maxBodyTilt) {
      this.lastHoldState = null;
      return { ready: false, cue: 'Get into plank position: elbows under shoulders, body straight.' };
    }
    const line = this.sm.push('line', angle(p.shoulder, p.hip, p.ankle));
    const fault = lineFaultName(sideOfLine(p.shoulder, p.ankle, p.hip), p.shoulder, p.ankle);
    const status = line < r.lineBad ? 'bad' : line < r.lineGood ? 'warn' : 'good';
    const cue = status === 'good' ? null
      : fault === 'sag' ? 'Hips dropping: tuck pelvis, squeeze glutes.'
      : 'Hips too high: lower them in line with shoulders and ankles.';

    this.totalMs += dt;
    if (status !== 'bad') this.holdMs += dt;   // warn still counts; bad pauses the clock
    if (status === 'bad') this.faultCounts[fault === 'sag' ? 'Hips sagging' : 'Hips too high'] =
      (this.faultCounts[fault === 'sag' ? 'Hips sagging' : 'Hips too high'] ?? 0) + dt;

    const checks = [{ id: 'line', label: 'Body line', status, value: line, cue }];
    const joints = { hip: status, shoulder: 'good', knee: status, ankle: 'good', elbow: 'good' };
    return this.result({ phase: status === 'bad' ? 'paused' : 'holding', metrics: { line, tilt }, checks, joints, cue,
      hold: { holdMs: this.holdMs, totalMs: this.totalMs } });
  }

  finishRep(score, valid, faults, stats) {
    this.reps += 1;
    if (valid) this.validReps += 1;
    for (const f of faults) this.faultCounts[f] = (this.faultCounts[f] ?? 0) + 1;
    const ev = { n: this.reps, score, valid, faults, stats };
    this.repLog.push(ev);
    return ev;
  }

  result(o) {
    const pen = { good: 0, warn: 15, bad: 40 };
    const frameScore = Math.max(0, 100 - o.checks.reduce((t, c) => t + pen[c.status], 0));
    return { ready: true, reps: this.reps, validReps: this.validReps, frameScore, ...o };
  }

  summary() {
    const scores = this.repLog.map((r) => r.score);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const faults = Object.entries(this.faultCounts).sort((a, b) => b[1] - a[1]);
    return { exercise: this.exercise, reps: this.reps, validReps: this.validReps, avgScore: avg,
      holdMs: this.holdMs, totalMs: this.totalMs, faults, repLog: this.repLog };
  }
}

/** 100 at or better than `good`, 0 at `bad`, linear between. lowerIsBetter flips direction. */
export function scoreBand(x, good, bad, lowerIsBetter) {
  const t = lowerIsBetter ? (x - good) / (bad - good) : (good - x) / (good - bad);
  return Math.round(100 * (1 - Math.max(0, Math.min(1, t))));
}

/** In image coords y grows down; hip below the shoulder-ankle line = sag. */
function lineFaultName(signedDist, shoulder, ankle) {
  // sideOfLine sign depends on which way the person faces; normalise so + means "below".
  const facingRight = ankle.x < shoulder.x; // head to the right of feet
  const below = facingRight ? signedDist < 0 : signedDist > 0;
  return below ? 'sag' : 'pike';
}
