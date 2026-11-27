// Body assessment and nutrition targets. Pure logic, no DOM, so the routine guide (Phase 3) and
// gym packages (Phase 6) can call assess() with the same profile object.
//
// Sources for every number are listed in README.md ("Nutrition module: formulas and sources").
// These are general population targets for healthy adults, not medical or dietetic advice.

export const PROFILE_VERSION = 1;

export const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', hint: 'Desk job, little or no exercise' },
  light: { factor: 1.375, label: 'Lightly active', hint: 'Exercise 1 to 3 days a week' },
  moderate: { factor: 1.55, label: 'Moderately active', hint: 'Exercise 3 to 5 days a week' },
  high: { factor: 1.725, label: 'Very active', hint: 'Hard exercise 6 to 7 days a week' },
  athlete: { factor: 1.9, label: 'Extremely active', hint: 'Physical job plus daily training' },
};

export const GOALS = {
  lose: { label: 'Lose fat', protein: [1.6, 2.2] },
  maintain: { label: 'Maintain', protein: [1.2, 1.6] },
  gain: { label: 'Build muscle', protein: [1.6, 2.2] },
};

// Screening: any "yes" routes the user to a professional instead of showing numbers.
export const SCREENING = [
  { id: 'pregnant', label: 'Are you pregnant or breastfeeding?', only: 'female' },
  { id: 'eating', label: 'Have you ever had an eating disorder (for example anorexia, bulimia or binge eating)?' },
  { id: 'medical', label: 'Do you have a medical condition that affects what you can eat? (for example diabetes, kidney, heart or liver disease, or a food-related illness)' },
  { id: 'meds', label: 'Do you take medicine that affects your weight, appetite or blood sugar?' },
];

export const LIMITS = {
  age: [18, 100],
  height: [130, 230], // cm
  weight: [35, 250], // kg
  waist: [50, 200], // cm
};

const round = (x, step = 1) => Math.round(x / step) * step;
const r1 = (x) => Math.round(x * 10) / 10;

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

// WHO adult categories.
export function bmiCategory(b) {
  if (b < 18.5) return { key: 'under', label: 'Underweight', level: 'warn' };
  if (b < 25) return { key: 'healthy', label: 'Healthy range', level: 'good' };
  if (b < 30) return { key: 'over', label: 'Overweight', level: 'warn' };
  if (b < 35) return { key: 'obese1', label: 'Obese (class 1)', level: 'bad' };
  if (b < 40) return { key: 'obese2', label: 'Obese (class 2)', level: 'bad' };
  return { key: 'obese3', label: 'Obese (class 3)', level: 'bad' };
}

export function waistToHeight(waistCm, heightCm) {
  return waistCm / heightCm;
}

// NICE guideline NG246 (2022 update) bands for central fat.
export function whtrCategory(w) {
  if (w < 0.4) return { key: 'low', label: 'Below typical range', level: 'warn' };
  if (w < 0.5) return { key: 'healthy', label: 'Healthy', level: 'good' };
  if (w < 0.6) return { key: 'increased', label: 'Increased health risk', level: 'warn' };
  return { key: 'high', label: 'High health risk', level: 'bad' };
}

// Mifflin-St Jeor resting energy (kcal/day).
export function bmrMifflin({ sex, age, heightCm, weightKg }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** Validate raw form input. Returns a list of {field, message}. */
export function validateProfile(p) {
  const errs = [];
  const num = (field, label, unit, required = true) => {
    const v = p[field];
    if (v === '' || v == null) { if (required) errs.push({ field, message: `Enter your ${label}` }); return; }
    const n = Number(v);
    const [lo, hi] = LIMITS[field];
    if (!Number.isFinite(n) || n < lo || n > hi) errs.push({ field, message: `${label[0].toUpperCase() + label.slice(1)} must be between ${lo} and ${hi}${unit}` });
  };
  if (p.sex !== 'male' && p.sex !== 'female') errs.push({ field: 'sex', message: 'Choose the sex used in the calorie formula' });
  // Under-18s are routed in assess(), so only reject impossible ages here.
  if (p.age === '' || p.age == null) errs.push({ field: 'age', message: 'Enter your age' });
  else if (!Number.isFinite(Number(p.age)) || Number(p.age) < 10 || Number(p.age) > LIMITS.age[1]) errs.push({ field: 'age', message: 'Enter an age between 10 and 100' });
  num('height', 'height', ' cm');
  num('weight', 'weight', ' kg');
  num('waist', 'waist', ' cm', false);
  if (!ACTIVITY[p.activity]) errs.push({ field: 'activity', message: 'Choose your activity level' });
  if (!GOALS[p.goal]) errs.push({ field: 'goal', message: 'Choose a goal' });
  for (const q of screeningFor(p.sex)) {
    if (p.screen?.[q.id] !== true && p.screen?.[q.id] !== false) errs.push({ field: 'screen.' + q.id, message: 'Answer every health question' });
  }
  return errs;
}

export function screeningFor(sex) {
  return SCREENING.filter((q) => !q.only || q.only === sex);
}

/**
 * Full assessment. Input: {sex, age, height (cm), weight (kg), waist? (cm), activity, goal, screen: {id: bool}}.
 * Output: {status: 'refer', reasons} when targets must not be shown, otherwise
 * {status: 'ok', body, energy, macros, notes, goalUsed}.
 */
export function assess(input) {
  const p = {
    sex: input.sex, age: Number(input.age), heightCm: Number(input.height), weightKg: Number(input.weight),
    waistCm: input.waist === '' || input.waist == null ? null : Number(input.waist),
    activity: input.activity, goal: input.goal, screen: input.screen || {},
  };

  const reasons = [];
  if (p.age < 18) reasons.push('You are under 18. Growing bodies need advice from a doctor, dietitian or school sports professional, not adult formulas.');
  if (p.screen.pregnant) reasons.push('Pregnancy and breastfeeding change energy and nutrient needs. Ask your doctor, midwife or an accredited dietitian.');
  if (p.screen.eating) reasons.push('Calorie targets can be harmful after an eating disorder. A doctor or dietitian who knows your history can set safe guidance.');
  if (p.screen.medical) reasons.push('Your condition may change what is safe to eat. Ask your doctor or an accredited dietitian before changing your diet.');
  if (p.screen.meds) reasons.push('Some medicines change appetite, weight or blood sugar. Ask your doctor or pharmacist before changing your diet.');

  const b = bmi(p.weightKg, p.heightCm);
  // Very low BMI is a referral, not a target to "maintain".
  if (b < 17) reasons.push('Your BMI is well below the healthy range. Please see a doctor before following any calorie target.');
  if (reasons.length) return { status: 'refer', reasons };

  const notes = [];
  const bmiCat = bmiCategory(b);
  const w = p.waistCm ? waistToHeight(p.waistCm, p.heightCm) : null;
  const wCat = w != null ? whtrCategory(w) : null;

  // Combined reading: BMI alone misreads muscular people and misses central fat.
  let reading;
  if (w == null) reading = 'Add your waist measurement for a more accurate reading. BMI alone cannot tell muscle from fat.';
  else if (b >= 25 && w < 0.5) reading = 'Your BMI is above 25 but your waist is in the healthy range. This often means extra muscle rather than extra fat, so BMI may overstate your risk.';
  else if (b < 25 && w >= 0.5) reading = 'Your BMI is in the healthy range but your waist is above half your height. Fat stored around the middle raises health risk even at a normal weight.';
  else if (b >= 25 && w >= 0.5) reading = 'Both BMI and waist are above the healthy range, which points to extra body fat.';
  else if (b < 18.5) reading = 'Your BMI is below the healthy range.';
  else reading = 'Both BMI and waist are in the healthy range.';

  // Goal guard rails.
  let goal = p.goal;
  if (goal === 'lose' && (b < 18.5 || (w != null && w < 0.4))) {
    goal = 'maintain';
    notes.push('Fat loss is not suggested at your current size, so these are maintenance targets. If you want to change your weight, talk to a doctor or dietitian.');
  }
  if (goal === 'gain' && (b >= 30 || (w != null && w >= 0.6))) {
    goal = 'maintain';
    notes.push('With your current measurements, building muscle at maintenance calories with high protein (body recomposition) is the safer route, so these are maintenance targets.');
  }
  if (b >= 40) notes.push('At a BMI of 40 or more, please see your doctor before starting a new diet or training plan.');
  if (p.age >= 65) notes.push('Over 65, protein needs are higher and muscle loss is faster. A dietitian can tailor these targets.');

  const bmr = bmrMifflin(p);
  const tdee = bmr * ACTIVITY[p.activity].factor;
  const floor = Math.max(bmr, p.sex === 'male' ? 1500 : 1200);
  let target = tdee, change = 0;
  if (goal === 'lose') {
    const deficit = Math.min(500, 0.2 * tdee);
    // Never go under the floor, and never above maintenance (very small, sedentary people).
    target = Math.min(tdee, Math.max(floor, tdee - deficit));
    if (tdee - deficit < floor) notes.push('Your target is held at a safe minimum, so expect slower fat loss. More daily activity will help more than eating less.');
  } else if (goal === 'gain') {
    target = tdee + Math.min(400, 0.1 * tdee);
  }
  change = target - tdee;
  const kcal = round(target, 10);
  // 7,700 kcal per kg is a first-weeks estimate; real change slows over time.
  const weeklyKg = r1((change * 7) / 7700);

  // Protein: for BMI 30+, base it on the weight at BMI 25 for this height, otherwise targets get inflated by fat mass.
  const refWeight = b >= 30 ? 25 * (p.heightCm / 100) ** 2 : p.weightKg;
  const [pLo, pHi] = GOALS[goal].protein;
  const proteinLo = round(pLo * refWeight, 5), proteinHi = round(pHi * refWeight, 5);
  const protein = round(((pLo + pHi) / 2) * refWeight, 5);
  const fat = round((kcal * 0.3) / 9, 5);
  const carbs = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5));

  return {
    status: 'ok',
    version: PROFILE_VERSION,
    goalUsed: goal,
    goalAsked: p.goal,
    body: {
      bmi: r1(b), bmiCategory: bmiCat,
      whtr: w != null ? Math.round(w * 100) / 100 : null, whtrCategory: wCat,
      healthyWeightKg: [r1(18.5 * (p.heightCm / 100) ** 2), r1(24.9 * (p.heightCm / 100) ** 2)],
      reading,
    },
    energy: { bmr: round(bmr, 10), maintenance: round(tdee, 10), target: kcal, dailyChange: round(change, 10), weeklyKg },
    macros: {
      protein, proteinRange: [proteinLo, proteinHi], proteinBasis: b >= 30 ? 'reference' : 'actual', refWeightKg: r1(refWeight),
      fat, carbs,
      fibre: p.sex === 'male' ? 30 : 25,
      waterL: p.sex === 'male' ? 2.6 : 2.1,
    },
    notes,
  };
}

// ----- Sample meal ideas (guidance only, not a prescribed diet) -----

export const MEAL_SPLIT = [
  { id: 'breakfast', label: 'Breakfast', share: 0.25 },
  { id: 'lunch', label: 'Lunch', share: 0.3 },
  { id: 'dinner', label: 'Dinner', share: 0.3 },
  { id: 'snack', label: 'Snacks', share: 0.15 },
];

// protein = rough grams for the portion described. veg = suitable for vegetarians.
export const MEAL_IDEAS = {
  breakfast: [
    { text: 'Greek yoghurt (200 g) with berries, oats and a few nuts', protein: 25, veg: true },
    { text: '3 eggs scrambled on wholegrain toast with spinach and tomato', protein: 25, veg: true },
    { text: 'Overnight oats made with milk and a scoop of protein powder', protein: 30, veg: true },
    { text: 'Ful medames (fava beans) with an egg, wholemeal pita and salad', protein: 22, veg: true },
  ],
  lunch: [
    { text: 'Grilled chicken breast (150 g), brown rice and a large salad', protein: 45, veg: false },
    { text: 'Tuna or salmon wholegrain wrap with mixed vegetables', protein: 35, veg: false },
    { text: 'Lentil and vegetable soup with wholegrain bread and cottage cheese', protein: 30, veg: true },
    { text: 'Chickpea, quinoa and feta bowl with roasted vegetables', protein: 25, veg: true },
  ],
  dinner: [
    { text: 'Baked salmon (150 g), potatoes and steamed greens', protein: 35, veg: false },
    { text: 'Lean beef or lamb stir-fry with vegetables and noodles', protein: 40, veg: false },
    { text: 'Tofu or tempeh curry with vegetables and rice', protein: 25, veg: true },
    { text: 'Turkey or chicken mince chilli with beans and rice', protein: 40, veg: false },
  ],
  snack: [
    { text: 'Fruit and a handful of nuts', protein: 6, veg: true },
    { text: 'Cottage cheese or skyr with fruit', protein: 20, veg: true },
    { text: 'Hummus with vegetable sticks', protein: 8, veg: true },
    { text: 'Milk or a protein shake', protein: 25, veg: true },
  ],
};

/** Per-meal calorie and protein guides plus idea lists, filtered for vegetarians when asked. */
export function mealPlan(result, { vegetarian = false } = {}) {
  if (result?.status !== 'ok') return [];
  return MEAL_SPLIT.map((m) => ({
    ...m,
    kcal: round(result.energy.target * m.share, 10),
    protein: round(result.macros.protein * m.share, 5),
    ideas: MEAL_IDEAS[m.id].filter((i) => !vegetarian || i.veg),
  }));
}

export const DISCLAIMER = 'General guidance for healthy adults, not medical or dietetic advice. Formulas give estimates, and real needs vary by person. Check with your doctor or an accredited dietitian before making big changes to your diet, especially if you have a health condition.';

/** Plain-text summary for sharing. */
export function buildNutritionReport(result, input, meta = {}) {
  const L = ['FORM COACH BODY & NUTRITION v' + PROFILE_VERSION];
  if (meta.date) L.push('Date: ' + meta.date);
  if (result.status !== 'ok') {
    L.push('', 'No targets shown. Please speak to a professional:');
    for (const r of result.reasons) L.push('- ' + r);
    L.push('', DISCLAIMER);
    return L.join('\n');
  }
  const { body, energy, macros } = result;
  L.push(`Profile: ${input.sex}, ${input.age} y, ${input.height} cm, ${input.weight} kg${input.waist ? `, waist ${input.waist} cm` : ''}`);
  L.push(`Activity: ${ACTIVITY[input.activity].label} · Goal: ${GOALS[result.goalUsed].label}${result.goalUsed !== result.goalAsked ? ` (asked: ${GOALS[result.goalAsked].label})` : ''}`);
  L.push('', 'BODY');
  L.push(`BMI: ${body.bmi} (${body.bmiCategory.label})`);
  L.push(`Waist-to-height: ${body.whtr ?? '-'}${body.whtrCategory ? ` (${body.whtrCategory.label})` : ''}`);
  L.push(body.reading);
  L.push('', 'DAILY TARGETS');
  L.push(`Calories: ${energy.target} kcal (maintenance ${energy.maintenance})`);
  L.push(`Protein: ${macros.protein} g (range ${macros.proteinRange[0]}–${macros.proteinRange[1]} g)`);
  L.push(`Fat: ${macros.fat} g · Carbs: ${macros.carbs} g · Fibre: ${macros.fibre} g · Water: ${macros.waterL} L`);
  for (const n of result.notes) L.push('Note: ' + n);
  L.push('', DISCLAIMER);
  return L.join('\n');
}
