import test from 'node:test';
import assert from 'node:assert/strict';
import { bmi, bmiCategory, whtrCategory, bmrMifflin, assess, validateProfile, mealPlan, buildNutritionReport, screeningFor } from '../nutrition.js';

const no = { pregnant: false, eating: false, medical: false, meds: false };
const man = { sex: 'male', age: 30, height: 180, weight: 80, waist: 85, activity: 'moderate', goal: 'maintain', screen: { eating: false, medical: false, meds: false } };
const woman = { sex: 'female', age: 25, height: 165, weight: 60, waist: 72, activity: 'light', goal: 'lose', screen: { ...no } };

test('BMI and categories (WHO, NICE)', () => {
  assert.equal(Math.round(bmi(80, 180) * 10) / 10, 24.7);
  assert.equal(bmiCategory(18.4).key, 'under');
  assert.equal(bmiCategory(24.9).key, 'healthy');
  assert.equal(bmiCategory(25).key, 'over');
  assert.equal(bmiCategory(41).key, 'obese3');
  assert.equal(whtrCategory(0.49).key, 'healthy');
  assert.equal(whtrCategory(0.5).key, 'increased');
  assert.equal(whtrCategory(0.6).key, 'high');
});

test('Mifflin-St Jeor matches hand calculation', () => {
  assert.equal(bmrMifflin({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 }), 1780);
  assert.equal(bmrMifflin({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 }), 1345.25);
});

test('maintenance targets for a healthy man', () => {
  const r = assess(man);
  assert.equal(r.status, 'ok');
  assert.equal(r.energy.maintenance, 2760); // 1780 x 1.55 = 2759
  assert.equal(r.energy.target, 2760);
  assert.equal(r.energy.weeklyKg, 0);
  assert.equal(r.macros.protein, 110); // 1.4 g/kg x 80
  assert.deepEqual(r.macros.proteinRange, [95, 130]);
  // Macros add back up to the calorie target within rounding.
  const kcal = r.macros.protein * 4 + r.macros.fat * 9 + r.macros.carbs * 4;
  assert.ok(Math.abs(kcal - r.energy.target) <= 30, `macros give ${kcal}`);
});

test('fat loss uses a capped deficit', () => {
  const r = assess(woman);
  // 1345.25 x 1.375 = 1849.7; deficit min(500, 370) = 370 -> 1480
  assert.equal(r.energy.target, 1480);
  assert.ok(r.energy.weeklyKg < 0 && r.energy.weeklyKg > -0.5);
});

test('calorie floor holds and never exceeds maintenance', () => {
  const small = { sex: 'female', age: 60, height: 150, weight: 50, activity: 'sedentary', goal: 'lose', screen: { ...no } };
  const r = assess(small);
  assert.equal(r.status, 'ok');
  assert.ok(r.energy.target <= r.energy.maintenance);
  assert.ok(r.energy.target >= Math.round(bmrMifflin({ sex: 'female', age: 60, heightCm: 150, weightKg: 50 }) / 10) * 10 - 10);
  assert.ok(r.notes.some((n) => /safe minimum/.test(n)));
});

test('muscular user: high BMI with healthy waist is explained, not flagged as fat', () => {
  const r = assess({ ...man, weight: 92, waist: 84, goal: 'gain' });
  assert.equal(r.body.bmiCategory.key, 'over');
  assert.equal(r.body.whtrCategory.key, 'healthy');
  assert.match(r.body.reading, /muscle/);
  assert.equal(r.goalUsed, 'gain');
  assert.ok(r.energy.target > r.energy.maintenance);
});

test('normal BMI with large waist warns about central fat', () => {
  const r = assess({ ...man, waist: 96 });
  assert.match(r.body.reading, /around the middle/);
});

test('goal guard rails', () => {
  const under = assess({ ...woman, weight: 48 }); // BMI 17.6
  assert.equal(under.goalUsed, 'maintain');
  assert.ok(under.notes.length);
  const obese = assess({ ...man, weight: 115, waist: 115, goal: 'gain' });
  assert.equal(obese.goalUsed, 'maintain');
  // Protein for BMI 30+ uses the weight at BMI 25, not total weight.
  assert.equal(obese.macros.proteinBasis, 'reference');
  assert.ok(obese.macros.protein < 1.4 * 115);
});

test('screening routes to a professional and shows no numbers', () => {
  assert.equal(assess({ ...man, age: 16 }).status, 'refer');
  assert.equal(assess({ ...woman, screen: { ...no, pregnant: true } }).status, 'refer');
  assert.equal(assess({ ...woman, screen: { ...no, eating: true } }).status, 'refer');
  assert.equal(assess({ ...man, screen: { ...man.screen, medical: true } }).status, 'refer');
  assert.equal(assess({ ...man, screen: { ...man.screen, meds: true } }).status, 'refer');
  assert.equal(assess({ ...woman, weight: 44 }).status, 'refer'); // BMI 16.2
  const r = assess({ ...man, age: 16 });
  assert.equal(r.energy, undefined);
});

test('pregnancy question only asked of female users', () => {
  assert.ok(screeningFor('female').some((q) => q.id === 'pregnant'));
  assert.ok(!screeningFor('male').some((q) => q.id === 'pregnant'));
});

test('validation', () => {
  assert.deepEqual(validateProfile(man), []);
  assert.deepEqual(validateProfile({ ...man, waist: '' }), []); // waist optional
  assert.ok(validateProfile({ ...man, height: 300 }).some((e) => e.field === 'height'));
  assert.ok(validateProfile({ ...man, sex: '' }).some((e) => e.field === 'sex'));
  assert.ok(validateProfile({ ...man, screen: {} }).some((e) => e.field.startsWith('screen.')));
  assert.ok(validateProfile({ ...woman, screen: { eating: false, medical: false, meds: false } }).some((e) => e.field === 'screen.pregnant'));
});

test('meal plan splits targets and filters vegetarian ideas', () => {
  const r = assess(man);
  const plan = mealPlan(r, { vegetarian: true });
  assert.equal(plan.length, 4);
  const total = plan.reduce((a, m) => a + m.kcal, 0);
  assert.ok(Math.abs(total - r.energy.target) <= 20);
  assert.ok(plan.every((m) => m.ideas.length && m.ideas.every((i) => i.veg)));
  assert.deepEqual(mealPlan({ status: 'refer' }), []);
});

test('share report includes targets and disclaimer', () => {
  const t = buildNutritionReport(assess(man), man, { date: '2026-11-27' });
  assert.match(t, /Calories: 2760 kcal/);
  assert.match(t, /not medical or dietetic advice/);
  const t2 = buildNutritionReport(assess({ ...man, age: 16 }), { ...man, age: 16 });
  assert.match(t2, /No targets shown/);
  assert.doesNotMatch(t2, /kcal/);
});

import { checkMeal, dayTotals, resolveItem, MEAL_IDEAS } from '../nutrition.js';
import { FOODS, findFood } from '../foods.js';

test('every meal slot offers at least 8 ideas, at least 5 vegetarian', () => {
  for (const [slot, ideas] of Object.entries(MEAL_IDEAS)) {
    assert.ok(ideas.length >= 8, slot);
    assert.ok(ideas.filter((i) => i.veg).length >= 5, slot);
  }
});

test('food list values are internally consistent', () => {
  for (const f of FOODS) {
    // Energy from macros (4/4/9) should be close to stated kcal; fibre and rounding explain small gaps.
    const est = f.protein * 4 + f.carbs * 4 + f.fat * 9;
    assert.ok(Math.abs(est - f.kcal) < Math.max(0.2 * f.kcal, 10), `${f.name}: ${f.kcal} vs ${Math.round(est)}`);
  }
  assert.equal(new Set(FOODS.map((f) => f.name)).size, FOODS.length);
});

test('food lookup: names, aliases, unique partials; unsure returns null', () => {
  assert.equal(findFood('rice').name, 'Rice, white, cooked');
  assert.equal(findFood('Chicken breast, cooked').protein, 31);
  assert.equal(findFood('ful').name, 'Fava beans (ful medames), cooked');
  assert.equal(findFood('halloum').name, 'Halloumi');
  assert.equal(findFood('bread'), null); // several breads: user must pick
  assert.equal(findFood('mango lassi'), null);
});

test('resolveItem handles weights and label values for unknown foods', () => {
  const r = resolveItem({ name: 'chicken', grams: 150 });
  assert.equal(Math.round(r.protein), 47);
  assert.equal(resolveItem({ name: 'chicken', grams: '' }).reason, 'grams');
  assert.equal(resolveItem({ name: 'mum\'s stew', grams: 200 }).reason, 'unknown');
  const c = resolveItem({ name: 'mum\'s stew', grams: 200, kcal100: '120', protein100: '8' });
  assert.ok(c.ok && c.custom && c.kcal === 240 && c.protein === 16);
});

test('checkMeal flags low protein and suggests fixes that fit the calories', () => {
  const target = { kcal: 700, protein: 40 };
  const c = checkMeal([{ name: 'rice', grams: 250 }, { name: 'mixed vegetables', grams: 150 }], target);
  assert.equal(c.proteinStatus, 'low');
  assert.equal(c.suggestions.length, 3);
  assert.ok(c.suggestions.every((s) => s.protein >= 40 - c.protein));
  const veg = checkMeal([{ name: 'rice', grams: 250 }], target, { vegetarian: true });
  assert.ok(veg.suggestions.every((s) => !/chicken|tuna|fish/i.test(s.name)));
  const ok = checkMeal([{ name: 'rice', grams: 200 }, { name: 'chicken', grams: 130 }, { name: 'salad', grams: 100 }, { name: 'olive oil', grams: 10 }], target);
  assert.ok(ok.good, JSON.stringify(ok));
  const over = checkMeal([{ name: 'pizza', grams: 400 }], target);
  assert.equal(over.kcalStatus, 'high');
  assert.ok(checkMeal([], target).empty);
});

test('dayTotals adds only meals with valid items', () => {
  const t = dayTotals({ breakfast: [{ name: 'egg', grams: 100 }], lunch: [{ name: '', grams: '' }], dinner: [] });
  assert.deepEqual(t, { kcal: 143, protein: 13, mealsEntered: 1 });
});
