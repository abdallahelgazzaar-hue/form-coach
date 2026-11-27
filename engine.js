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
  // ---- Weights (side view). Thresholds are assumptions; tune with tester data. ----
  curl: {                  // standing dumbbell biceps curl
    restElbow: 145,        // arm extended at the bottom
    startElbow: 120,       // below this = rep in progress
    topGood: 55,           // elbow angle at the top of the curl
    topOk: 70,
    armWarn: 20,           // upper arm angle from vertical (elbow drifting forward)
    armBad: 30,
    swingWarn: 10,         // torso lean change during the rep (body swing)
    swingBad: 16,
  },
  bench: {                 // barbell bench press, lying side-on to the camera
    lockElbow: 155,        // arms locked out at the top
    startElbow: 135,
    depthGood: 90,         // elbow angle with the bar at the chest
    depthOk: 105,
    forearmWarn: 20,       // forearm angle from vertical at the bottom (wrist not stacked over elbow)
    forearmBad: 30,
    hipLiftBad: 0.18,      // hip raised above the shoulder-knee line, as a fraction of torso length
    maxBodyTilt: 35,
  },
  pushdown: {              // cable triceps pushdown, standing side-on
    topElbow: 110,         // elbows bent at the start position
    startElbow: 130,
    lockGood: 160,         // full extension at the bottom
    lockOk: 148,
    armWarn: 20,           // upper arm should stay pinned to the side
    armBad: 30,
    swingWarn: 10,
    swingBad: 16,
  },
};

/** Exercises scored by reps (everything except timed holds). */
export const REP_EXERCISES = ['squat', 'pushup', 'curl', 'bench', 'pushdown'];

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
    this.phase = this.exercise === 'pushdown' ? 'idle' : this.exercise === 'curl' ? 'rest' : 'up';
    this.reps = 0;
    this.validReps = 0;
    this.repLog = [];
    this.cur = null;          // stats for the rep in progress
    this.holdMs = 0;          // plank: time with good form
    this.totalMs = 0;         // plank: time in position
    this.lastT = null;
    this.faultCounts = {};
    this.restLean = null;
    this.sm.reset();
  }

  update(landmarks, w, h, tMs) {
    const dt = this.lastT == null ? 0 : Math.min(250, Math.max(0, tMs - this.lastT));
    this.lastT = tMs;
    if (!landmarks) return { ready: false, cue: 'Step into the frame so your whole body is visible.' };
    const { side, p } = pick(landmarks, w, h);
    const fn = { squat: this.squat, pushup: this.pushup, plank: this.plank,
      curl: this.curl, bench: this.bench, pushdown: this.pushdown }[this.exercise];
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

  // ---------- Dumbbell biceps curl (standing, side view) ----------
  curl(p) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'elbow', 'wrist', 'hip'])) {
      return { ready: false, cue: 'Stand side-on so your shoulder, elbow, wrist and hip are visible.' };
    }
    const elbow = this.sm.push('elbow', angle(p.shoulder, p.elbow, p.wrist));
    const arm = this.sm.push('arm', fromVertical(p.shoulder, p.elbow));
    const lean = this.sm.push('lean', fromVertical(p.hip, p.shoulder));

    const armStatus = arm > r.armBad ? 'bad' : arm > r.armWarn ? 'warn' : 'good';
    const swing = this.cur ? Math.abs(lean - this.cur.lean0) : 0;
    const swingStatus = swing > r.swingBad ? 'bad' : swing > r.swingWarn ? 'warn' : 'good';
    const checks = [
      { id: 'arm', label: 'Elbow pinned', status: armStatus, value: arm,
        cue: armStatus === 'good' ? null : 'Keep your elbow at your side; don\'t let it drift forward.' },
      { id: 'swing', label: 'No swing', status: swingStatus, value: swing,
        cue: swingStatus === 'good' ? null : 'Stop swinging: keep your torso still and lift with the arm.' },
    ];

    let repEvent = null;
    if (this.phase !== 'down' && this.phase !== 'lift' && elbow > r.restElbow) this.phase = 'down';
    if (this.phase === 'down' && elbow < r.startElbow) {
      this.phase = 'lift';
      // Swing is measured against the torso angle at rest, since a swing often starts with the rep itself.
      this.cur = { minElbow: elbow, maxArm: arm, lean0: this.restLean ?? lean, maxSwing: 0 };
    } else if (this.phase === 'lift') {
      this.cur.minElbow = Math.min(this.cur.minElbow, elbow);
      this.cur.maxArm = Math.max(this.cur.maxArm, arm);
      this.cur.maxSwing = Math.max(this.cur.maxSwing, swing);
      if (elbow > r.restElbow) {
        const c = this.cur, faults = [];
        if (c.minElbow > r.topOk) faults.push('Partial curl: bring the weight all the way up.');
        else if (c.minElbow > r.topGood) faults.push('Almost there: squeeze a little higher.');
        if (c.maxArm > r.armBad) faults.push('Elbow drifted forward during the rep.');
        if (c.maxSwing > r.swingBad) faults.push('Body swing: you used momentum.');
        const score = Math.round(0.4 * scoreBand(c.minElbow, r.topGood, r.topOk + 15, true)
          + 0.3 * scoreBand(c.maxArm, r.armWarn, r.armBad + 10, true)
          + 0.3 * scoreBand(c.maxSwing, r.swingWarn, r.swingBad + 8, true));
        repEvent = this.finishRep(score, c.minElbow <= r.topOk && c.maxArm <= r.armBad && c.maxSwing <= r.swingBad, faults,
          { minElbow: c.minElbow, maxArm: c.maxArm, maxSwing: c.maxSwing });
        this.phase = 'down';
        this.cur = null;
      }
    }
    const inRep = this.phase === 'lift';
    if (!inRep) this.restLean = lean;
    const top = inRep ? (Math.min(this.cur.minElbow, elbow) <= r.topGood ? 'good' : Math.min(this.cur.minElbow, elbow) <= r.topOk ? 'warn' : 'bad') : 'good';
    checks.push({ id: 'range', label: 'Range', status: inRep ? top : 'good', value: elbow, cue: null });
    const joints = { elbow: inRep ? top : 'good', shoulder: armStatus, hip: swingStatus, knee: 'good', ankle: 'good' };
    const cue = checks.find((c) => c.cue)?.cue ?? null;
    return this.result({ phase: this.phase, metrics: { elbow, arm, lean }, checks, joints, cue, repEvent,
      goodCue: inRep ? 'Good. Lower it slowly.' : 'Good form. Curl up.' });
  }

  // ---------- Barbell bench press (lying, side view) ----------
  bench(p) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'elbow', 'wrist', 'hip'])) {
      return { ready: false, cue: 'Place the phone side-on at bench height so your arm, shoulder and hip are visible.' };
    }
    const tilt = 90 - fromVertical(p.shoulder, p.hip);
    if (tilt > r.maxBodyTilt) return { ready: false, cue: 'Lie on the bench, side-on to the camera.' };
    const elbow = this.sm.push('elbow', angle(p.shoulder, p.elbow, p.wrist));
    const forearm = this.sm.push('forearm', fromVertical(p.elbow, p.wrist));
    // Hip lift: hip above the shoulder-knee line (needs the knee; otherwise skipped).
    let lift = 0;
    if (p.knee.v >= 0.5) {
      const torso = Math.hypot(p.hip.x - p.shoulder.x, p.hip.y - p.shoulder.y) || 1;
      const d = sideOfLine(p.shoulder, p.knee, p.hip);
      const above = lineFaultName(d, p.shoulder, p.knee) === 'pike';
      lift = this.sm.push('lift', above ? Math.abs(d) / torso : 0);
    }
    const liftStatus = lift > r.hipLiftBad ? 'bad' : 'good';
    const inRep = this.phase === 'down';
    const forearmStatus = !inRep ? 'good' : forearm > r.forearmBad ? 'bad' : forearm > r.forearmWarn ? 'warn' : 'good';
    const checks = [
      { id: 'hips', label: 'Hips on bench', status: liftStatus, value: lift * 100,
        cue: liftStatus === 'good' ? null : 'Keep your hips on the bench.' },
      { id: 'forearm', label: 'Wrists over elbows', status: forearmStatus, value: forearm,
        cue: forearmStatus === 'good' ? null : 'Stack your wrists over your elbows; adjust your grip width.' },
    ];
    let depthStatus = 'good';
    if (inRep && this.cur) {
      const best = Math.min(this.cur.minElbow, elbow);
      depthStatus = best <= r.depthGood ? 'good' : best <= r.depthOk ? 'warn' : 'bad';
    }
    checks.push({ id: 'depth', label: 'Depth', status: inRep ? depthStatus : 'good', value: elbow, cue: null });

    let repEvent = null;
    if (this.phase === 'up' && elbow < r.startElbow) {
      this.phase = 'down';
      this.cur = { minElbow: elbow, maxForearmBottom: forearm, maxLift: lift };
    } else if (this.phase === 'down') {
      const c = this.cur;
      if (elbow < c.minElbow) { c.minElbow = elbow; c.maxForearmBottom = forearm; }
      c.maxLift = Math.max(c.maxLift, lift);
      if (elbow > r.lockElbow) {
        const faults = [];
        if (c.minElbow > r.depthOk) faults.push('Too shallow: lower the bar to your chest.');
        else if (c.minElbow > r.depthGood) faults.push('Almost there: bring the bar a little lower.');
        if (c.maxForearmBottom > r.forearmBad) faults.push('Wrists not stacked over elbows at the bottom.');
        if (c.maxLift > r.hipLiftBad) faults.push('Hips came off the bench.');
        const score = Math.round(0.5 * scoreBand(c.minElbow, r.depthGood, r.depthOk + 15, true)
          + 0.25 * scoreBand(c.maxForearmBottom, r.forearmWarn, r.forearmBad + 10, true)
          + 0.25 * (c.maxLift > r.hipLiftBad ? 0 : 100));
        repEvent = this.finishRep(score, c.minElbow <= r.depthOk && c.maxLift <= r.hipLiftBad, faults,
          { minElbow: c.minElbow, forearm: c.maxForearmBottom, lift: c.maxLift });
        this.phase = 'up';
        this.cur = null;
      }
    }
    const joints = { elbow: inRep ? depthStatus : 'good', shoulder: forearmStatus, hip: liftStatus, knee: 'good', ankle: 'good' };
    const cue = checks.find((c) => c.cue)?.cue ?? null;
    return this.result({ phase: this.phase, metrics: { elbow, forearm, lift }, checks, joints, cue, repEvent,
      goodCue: inRep ? 'Good. Press up to lockout.' : 'Good form. Lower under control.' });
  }

  // ---------- Cable triceps pushdown (standing, side view) ----------
  pushdown(p) {
    const r = this.r;
    if (!visible(p, ['shoulder', 'elbow', 'wrist', 'hip'])) {
      return { ready: false, cue: 'Stand side-on so your shoulder, elbow, wrist and hip are visible.' };
    }
    const elbow = this.sm.push('elbow', angle(p.shoulder, p.elbow, p.wrist));
    const arm = this.sm.push('arm', fromVertical(p.shoulder, p.elbow));
    const lean = this.sm.push('lean', fromVertical(p.hip, p.shoulder));
    const armStatus = arm > r.armBad ? 'bad' : arm > r.armWarn ? 'warn' : 'good';
    const swing = this.cur ? Math.abs(lean - this.cur.lean0) : 0;
    const swingStatus = swing > r.swingBad ? 'bad' : swing > r.swingWarn ? 'warn' : 'good';
    const checks = [
      { id: 'arm', label: 'Elbows pinned', status: armStatus, value: arm,
        cue: armStatus === 'good' ? null : 'Pin your elbows to your sides; only the forearms move.' },
      { id: 'swing', label: 'Torso still', status: swingStatus, value: swing,
        cue: swingStatus === 'good' ? null : 'Don\'t lean into it: keep your torso still.' },
    ];

    let repEvent = null;
    // 'idle' until the first bent-arm start position, so a hanging arm at setup is not counted.
    if ((this.phase === 'up' || this.phase === 'idle') && elbow < r.topElbow) this.phase = 'ready';
    if (this.phase === 'ready' && elbow > r.startElbow) {
      this.phase = 'press';
      this.cur = { maxElbow: elbow, maxArm: arm, lean0: this.restLean ?? lean, maxSwing: 0 };
    } else if (this.phase === 'press') {
      const c = this.cur;
      c.maxElbow = Math.max(c.maxElbow, elbow);
      c.maxArm = Math.max(c.maxArm, arm);
      c.maxSwing = Math.max(c.maxSwing, swing);
      if (elbow < r.topElbow) {
        const faults = [];
        if (c.maxElbow < r.lockOk) faults.push('Partial rep: straighten your arms fully at the bottom.');
        else if (c.maxElbow < r.lockGood) faults.push('Almost there: lock out a little more.');
        if (c.maxArm > r.armBad) faults.push('Elbows moved away from your sides.');
        if (c.maxSwing > r.swingBad) faults.push('Torso swing: you used body weight.');
        const score = Math.round(0.4 * scoreBand(c.maxElbow, r.lockGood, r.lockOk - 15, false)
          + 0.3 * scoreBand(c.maxArm, r.armWarn, r.armBad + 10, true)
          + 0.3 * scoreBand(c.maxSwing, r.swingWarn, r.swingBad + 8, true));
        repEvent = this.finishRep(score, c.maxElbow >= r.lockOk && c.maxArm <= r.armBad && c.maxSwing <= r.swingBad, faults,
          { maxElbow: c.maxElbow, maxArm: c.maxArm, maxSwing: c.maxSwing });
        this.phase = 'ready';
        this.cur = null;
      }
    }
    const inRep = this.phase === 'press';
    if (!inRep) this.restLean = lean;
    let lockStatus = 'good';
    if (inRep) { const b = Math.max(this.cur.maxElbow, elbow); lockStatus = b >= r.lockGood ? 'good' : b >= r.lockOk ? 'warn' : 'bad'; }
    checks.push({ id: 'range', label: 'Lockout', status: inRep ? lockStatus : 'good', value: elbow, cue: null });
    const joints = { elbow: inRep ? lockStatus : 'good', shoulder: armStatus, hip: swingStatus, knee: 'good', ankle: 'good' };
    const cue = checks.find((c) => c.cue)?.cue ?? null;
    return this.result({ phase: this.phase, metrics: { elbow, arm, lean }, checks, joints, cue, repEvent,
      goodCue: this.phase === 'idle' || this.phase === 'up' ? 'Grip the bar with elbows bent at your sides.'
        : inRep ? 'Good. Return slowly.' : 'Good form. Push down.' });
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
