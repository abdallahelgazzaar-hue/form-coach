// Common foods with approximate values per 100 g (as eaten: cooked weights for meat, rice, pasta, legumes).
// Values are rounded from USDA FoodData Central and the Australian Food Composition Database.
// Real products vary by brand and recipe, so users can enter label values for anything not listed.
// [name, kcal, protein g, carbs g, fat g, group, aliases]

const RAW = [
  // Meat, fish, eggs
  ['Chicken breast, cooked', 165, 31, 0, 3.6, 'protein', 'chicken,grilled chicken'],
  ['Chicken thigh, cooked, skinless', 209, 26, 0, 10.9, 'protein', 'chicken thigh'],
  ['Turkey breast, cooked', 147, 30, 0, 2, 'protein', 'turkey'],
  ['Beef mince, lean, cooked', 170, 26, 0, 7, 'protein', 'mince,ground beef,kofta'],
  ['Beef steak, lean, cooked', 190, 29, 0, 8, 'protein', 'steak,beef'],
  ['Lamb, lean, cooked', 200, 28, 0, 9, 'protein', 'lamb'],
  ['Salmon, cooked', 206, 22, 0, 12, 'protein', 'salmon'],
  ['Tuna, canned in water, drained', 116, 26, 0, 1, 'protein', 'tuna'],
  ['White fish, cooked', 105, 23, 0, 1, 'protein', 'fish,barramundi,cod,tilapia'],
  ['Prawns, cooked', 99, 24, 0, 0.3, 'protein', 'shrimp,prawn'],
  ['Egg, whole (1 large = 50 g)', 143, 12.6, 0.7, 9.5, 'protein', 'egg,eggs,boiled egg,omelette'],
  ['Egg white', 52, 11, 0.7, 0.2, 'protein', 'egg whites'],
  // Plant protein
  ['Tofu, firm', 144, 17, 3, 9, 'protein', 'tofu'],
  ['Tempeh', 192, 20, 7.6, 10.8, 'protein', ''],
  ['Lentils, cooked', 116, 9, 20, 0.4, 'protein', 'lentil,dal,daal,lentil soup'],
  ['Chickpeas, cooked', 164, 8.9, 27.4, 2.6, 'protein', 'chickpea,garbanzo'],
  ['Kidney beans, cooked', 127, 8.7, 22.8, 0.5, 'protein', 'beans,red beans'],
  ['Fava beans (ful medames), cooked', 110, 7.6, 19.6, 0.4, 'protein', 'ful,foul,fava'],
  ['Hummus', 166, 7.9, 14.3, 9.6, 'protein', 'houmous'],
  ['Falafel', 333, 13.3, 31.8, 17.8, 'protein', 'taameya,tameya'],
  // Dairy
  ['Greek yoghurt, plain, low-fat', 59, 10.2, 3.6, 0.4, 'dairy', 'greek yogurt,yoghurt,yogurt'],
  ['Greek yoghurt, plain, full-fat', 97, 9, 4, 5, 'dairy', ''],
  ['Skyr', 63, 11, 4, 0.2, 'dairy', ''],
  ['Cottage cheese', 84, 11, 4.3, 2.3, 'dairy', ''],
  ['Milk, full cream (100 ml)', 61, 3.2, 4.8, 3.3, 'dairy', 'milk,whole milk'],
  ['Milk, skim (100 ml)', 34, 3.4, 5, 0.1, 'dairy', 'skim milk,low fat milk'],
  ['Cheddar cheese', 403, 25, 1.3, 33, 'dairy', 'cheese'],
  ['Feta cheese', 264, 14, 4, 21, 'dairy', 'feta'],
  ['Halloumi', 321, 21, 2, 25, 'dairy', ''],
  ['Whey protein powder (1 scoop = 30 g)', 400, 80, 8, 6, 'dairy', 'protein powder,whey,protein shake'],
  // Grains and starches
  ['Rice, white, cooked', 130, 2.7, 28, 0.3, 'carb', 'rice'],
  ['Rice, brown, cooked', 123, 2.7, 25.6, 1, 'carb', 'brown rice'],
  ['Pasta, cooked', 158, 5.8, 31, 0.9, 'carb', 'spaghetti,macaroni,penne'],
  ['Noodles, cooked', 138, 4.5, 25, 2.1, 'carb', 'noodle'],
  ['Couscous, cooked', 112, 3.8, 23.2, 0.2, 'carb', ''],
  ['Quinoa, cooked', 120, 4.4, 21.3, 1.9, 'carb', ''],
  ['Bread, wholemeal (1 slice = 35 g)', 250, 12.5, 42, 3.5, 'carb', 'brown bread,toast,wholegrain bread'],
  ['Bread, white (1 slice = 35 g)', 265, 9, 49, 3.2, 'carb', 'white bread'],
  ['Pita bread (1 large = 60 g)', 275, 9.1, 55.7, 1.2, 'carb', 'pita,baladi bread,flatbread,khubz'],
  ['Wrap / tortilla (1 wrap = 60 g)', 304, 8, 50, 8, 'carb', 'tortilla,wrap'],
  ['Oats, dry', 379, 13.2, 67.7, 6.5, 'carb', 'oatmeal,porridge,rolled oats'],
  ['Wheat biscuit cereal (1 biscuit = 15 g)', 355, 12, 67, 1.4, 'carb', 'weet-bix,weetbix'],
  ['Cornflakes', 357, 7.5, 84, 0.4, 'carb', 'cereal'],
  ['Potato, boiled', 87, 1.9, 20, 0.1, 'carb', 'potato,potatoes'],
  ['Sweet potato, baked', 90, 2, 20.7, 0.2, 'carb', 'sweet potato'],
  ['Hot chips / fries', 312, 3.4, 41, 15, 'treat', 'chips,fries,french fries'],
  // Fruit and vegetables
  ['Banana', 89, 1.1, 22.8, 0.3, 'fruitveg', ''],
  ['Apple', 52, 0.3, 13.8, 0.2, 'fruitveg', ''],
  ['Orange', 47, 0.9, 11.8, 0.1, 'fruitveg', ''],
  ['Berries, mixed', 50, 0.8, 12, 0.3, 'fruitveg', 'strawberries,blueberries'],
  ['Dates', 277, 1.8, 75, 0.2, 'fruitveg', 'date'],
  ['Avocado', 160, 2, 8.5, 14.7, 'fruitveg', ''],
  ['Salad leaves, mixed', 20, 1.5, 3.5, 0.2, 'fruitveg', 'salad,lettuce,spinach'],
  ['Tomato', 18, 0.9, 3.9, 0.2, 'fruitveg', ''],
  ['Cucumber', 15, 0.7, 3.6, 0.1, 'fruitveg', ''],
  ['Broccoli, cooked', 35, 2.4, 7.2, 0.4, 'fruitveg', ''],
  ['Mixed vegetables, cooked', 65, 2.9, 13, 0.2, 'fruitveg', 'vegetables,veggies'],
  // Fats, nuts, extras
  ['Almonds', 579, 21, 21.6, 49.9, 'fat', 'nuts'],
  ['Mixed nuts', 607, 20, 21, 54, 'fat', ''],
  ['Peanut butter', 588, 25, 20, 50, 'fat', ''],
  ['Tahini', 595, 17, 21, 54, 'fat', 'tahina'],
  ['Olive oil (1 tbsp = 14 g)', 884, 0, 0, 100, 'fat', 'oil'],
  ['Butter', 717, 0.9, 0.1, 81, 'fat', ''],
  ['Honey', 304, 0.3, 82, 0, 'treat', ''],
  ['Sugar', 387, 0, 100, 0, 'treat', ''],
  ['Milk chocolate', 535, 7.7, 59, 30, 'treat', 'chocolate'],
  ['Sweet biscuits / cookies', 480, 6, 65, 22, 'treat', 'biscuits,cookies'],
  ['Pizza', 266, 11, 33, 10, 'treat', ''],
  ['Protein bar (1 bar = 60 g)', 350, 30, 35, 10, 'treat', ''],
  ['Orange juice (100 ml)', 45, 0.7, 10.4, 0.2, 'drink', 'juice'],
  ['Soft drink (100 ml)', 42, 0, 10.6, 0, 'drink', 'cola,soda,soft drink'],
];

export const FOODS = RAW.map(([name, kcal, protein, carbs, fat, group, aliases]) => ({
  name, kcal, protein, carbs, fat, group, aliases: aliases ? aliases.split(',') : [],
}));

const norm = (s) => String(s || '').trim().toLowerCase();

/** Exact name or alias match first; then a unique partial match. Returns null when unsure. */
export function findFood(query) {
  const q = norm(query);
  if (!q) return null;
  const exact = FOODS.find((f) => norm(f.name) === q || f.aliases.includes(q));
  if (exact) return exact;
  const partial = FOODS.filter((f) => norm(f.name).includes(q) || f.aliases.some((a) => a.includes(q)));
  return partial.length === 1 ? partial[0] : null;
}

// Typical portions to help people who do not weigh food.
export const PORTION_TIPS = '1 egg ≈ 50 g · 1 slice of bread ≈ 35 g · 1 cup cooked rice ≈ 160 g · palm-sized piece of meat ≈ 100 g · 1 tablespoon oil ≈ 14 g · 1 cup milk ≈ 250 ml';
