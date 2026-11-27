// Tester feedback survey: questions + a fixed-format report so every tester sends the same fields.

export const SURVEY_VERSION = 1;

// Questions shown after a set. `show` limits a question to some exercises.
export const QUESTIONS = [
  { id: 'tester', label: 'Your name or initials', type: 'text', required: true, remember: true },
  { id: 'realReps', label: 'Real rep count (counted by a person or from video)', type: 'number', required: true, show: ['squat', 'pushup'] },
  { id: 'badDone', label: 'Bad reps you did on purpose', type: 'number', required: true, show: ['squat', 'pushup'] },
  { id: 'badCaught', label: 'How many of those did the app flag?', type: 'number', required: true, show: ['squat', 'pushup'] },
  { id: 'goodFlagged', label: 'Did it flag any good reps as bad?', type: 'choice', options: ['None', '1–2', '3 or more'], required: true, show: ['squat', 'pushup'] },
  { id: 'realHold', label: 'Real hold time in seconds (from a stopwatch)', type: 'number', required: true, show: ['plank'] },
  { id: 'pauseWorked', label: 'When you dropped or raised your hips on purpose, did the timer pause?', type: 'choice', options: ['Yes, every time', 'Sometimes', 'No', 'Did not test'], required: true, show: ['plank'] },
  { id: 'tracking', label: 'Did the skeleton stay on your body?', type: 'choice', options: ['Always', 'Mostly', 'Often lost me'], required: true },
  { id: 'cues', label: 'Were the voice and screen cues correct and clear?', type: 'choice', options: ['1 – wrong', '2', '3', '4', '5 – spot on'], required: true },
  { id: 'phone', label: 'Phone position', type: 'choice', options: ['Floor', 'Hip height', 'Higher'], required: true, remember: true },
  { id: 'distance', label: 'Distance from phone', type: 'choice', options: ['Under 2 m', '2–3 m', 'Over 3 m'], required: true, remember: true },
  { id: 'light', label: 'Lighting', type: 'choice', options: ['Bright', 'Normal', 'Dim'], required: true },
  { id: 'notes', label: 'Anything wrong, confusing or missing? (optional)', type: 'textarea', required: false },
];

export function questionsFor(exercise) {
  return QUESTIONS.filter((q) => !q.show || q.show.includes(exercise));
}

const NAMES = { squat: 'Squat', pushup: 'Push-up', plank: 'Plank' };
const secs = (ms) => Math.round(ms / 1000);

/** Count accuracy as a percentage (100 = exact). */
export function accuracy(appValue, realValue) {
  const a = Number(appValue), r = Number(realValue);
  if (!Number.isFinite(a) || !Number.isFinite(r) || r <= 0) return null;
  return Math.max(0, Math.round(100 * (1 - Math.abs(a - r) / r)));
}

/**
 * Build the report text. `summary` is the analyzer summary (may be null if no set was run),
 * `answers` is {questionId: value}, `meta` is {date, device}.
 */
export function buildReport(exercise, summary, answers, meta) {
  const L = [];
  L.push(`FORM COACH FEEDBACK v${SURVEY_VERSION}`);
  L.push(`Date: ${meta.date}`);
  L.push(`Tester: ${answers.tester || '-'}`);
  L.push(`Exercise: ${NAMES[exercise] || exercise}`);
  L.push(`Device: ${meta.device || '-'}`);
  L.push('');
  L.push('APP RESULT');
  if (!summary) L.push('No set recorded');
  else if (exercise === 'plank') {
    L.push(`Good-form hold: ${secs(summary.holdMs)} s`);
    L.push(`Time in position: ${secs(summary.totalMs)} s`);
  } else {
    L.push(`Counted reps: ${summary.reps}`);
    L.push(`Valid reps: ${summary.validReps}`);
    L.push(`Avg score: ${summary.avgScore ?? '-'}`);
  }
  if (summary?.faults?.length) {
    L.push(`Faults flagged: ${summary.faults.map(([n, c]) => exercise === 'plank' ? `${n} ${secs(c)} s` : `${n} x${c}`).join('; ')}`);
  }
  L.push('');
  L.push('TESTER CHECK');
  for (const q of questionsFor(exercise)) {
    if (q.id === 'tester' || q.id === 'notes') continue;
    L.push(`${q.label}: ${answers[q.id] ?? '-'}`);
  }
  if (summary) {
    const acc = exercise === 'plank'
      ? accuracy(secs(summary.totalMs), answers.realHold)
      : accuracy(summary.reps, answers.realReps);
    if (acc != null) L.push(`${exercise === 'plank' ? 'Timer' : 'Count'} accuracy: ${acc}%`);
    if (exercise !== 'plank' && Number(answers.badDone) > 0) {
      L.push(`Bad-rep detection: ${Math.round(100 * Math.min(Number(answers.badCaught) || 0, Number(answers.badDone)) / Number(answers.badDone))}%`);
    }
  }
  L.push('');
  L.push(`Notes: ${answers.notes?.trim() || '-'}`);
  return L.join('\n');
}

/** Returns a list of error messages for missing or invalid answers. */
export function validate(exercise, answers) {
  const errs = [];
  for (const q of questionsFor(exercise)) {
    const v = answers[q.id];
    if (q.required && (v == null || String(v).trim() === '')) errs.push(q.label);
    else if (q.type === 'number' && v !== '' && v != null && !(Number(v) >= 0)) errs.push(q.label + ' (must be 0 or more)');
  }
  if (exercise !== 'plank' && Number(answers.badCaught) > Number(answers.badDone)) {
    errs.push('Flagged bad reps cannot be more than bad reps done');
  }
  return errs;
}
