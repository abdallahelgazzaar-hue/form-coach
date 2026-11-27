import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, validate, accuracy, questionsFor } from '../feedback.js';

const meta = { date: '2026-11-27 15:00 UTC', device: 'Android Chrome/131' };
const full = { tester: 'AG', realReps: '10', badDone: '3', badCaught: '2', goodFlagged: 'None', tracking: 'Mostly',
  cues: '4', phone: 'Floor', distance: '2–3 m', light: 'Normal', notes: '' };
const pushSummary = { exercise: 'pushup', reps: 9, validReps: 7, avgScore: 81, faults: [['Hips sagged during the rep.', 2]], holdMs: 0, totalMs: 0 };

test('questions differ per exercise', () => {
  assert.ok(questionsFor('plank').some((q) => q.id === 'realHold'));
  assert.ok(!questionsFor('plank').some((q) => q.id === 'realReps'));
  assert.ok(questionsFor('squat').some((q) => q.id === 'badCaught'));
});

test('validation catches missing and impossible answers', () => {
  assert.deepEqual(validate('pushup', full), []);
  assert.ok(validate('pushup', { ...full, realReps: '' }).length === 1);
  assert.ok(validate('pushup', { ...full, badCaught: '5' }).some((e) => /more than/.test(e)));
});

test('report has fixed fields and computed accuracy', () => {
  const r = buildReport('pushup', pushSummary, full, meta);
  assert.match(r, /^FORM COACH FEEDBACK v1/);
  assert.match(r, /Counted reps: 9/);
  assert.match(r, /Count accuracy: 90%/);
  assert.match(r, /Bad-rep detection: 67%/);
  assert.match(r, /Notes: -/);
});

test('plank report and no-set report', () => {
  const r = buildReport('plank', { exercise: 'plank', reps: 0, validReps: 0, holdMs: 40000, totalMs: 45000, faults: [] },
    { ...full, realHold: '45', pauseWorked: 'Sometimes' }, meta);
  assert.match(r, /Timer accuracy: 100%/);
  assert.match(buildReport('squat', null, full, meta), /No set recorded/);
  assert.equal(accuracy(9, 0), null);
});
