# Form Coach — camera posture checker and body & diet targets (prototype v0.2)

Mobile web app that checks squat, push-up and plank form in real time with the phone camera, and gives general calorie and protein targets from body measurements (**Body & diet** tab, direct link: `…/form-coach/#nutrition`).
Pose estimation runs fully on the device (MediaPipe Pose Landmarker "lite", WebAssembly + GPU). No video is uploaded or stored.

## Files
| File | Purpose |
|---|---|
| `index.html` | UI: exercise picker, live camera view with skeleton overlay, cues, voice, set summary |
| `engine.js` | Form rules, rep counting, scoring (pure logic, no DOM) |
| `vendor/` | MediaPipe library, WASM runtime and pose model (bundled, ~15 MB, no CDN at runtime) |
| `feedback.js` | Tester survey: questions, validation, fixed-format report |
| `nutrition.js` | Body assessment, health screening, calorie/protein targets, meal ideas (pure logic, no DOM; `assess(profile)` is the entry point later phases call) |
| `foods.js` | 73 common foods with kcal, protein, carbs, fat per 100 g (USDA FoodData Central, Australian Food Composition Database, rounded), name/alias lookup |
| `tests/nutrition.test.mjs` | 19 tests: formulas against hand calculations, guard rails, screening, validation |
| `tests/engine.test.mjs` | 8 logic tests with synthetic skeletons |

Run all tests: `npm test`.

## Run
Camera access needs **https** (or `localhost`). Locally: `python3 -m http.server 8000` in this folder, open `http://localhost:8000` on the same computer.
Live (GitHub Pages): https://abdallahelgazzaar-hue.github.io/form-coach/ . Camera access needs the page opened directly over https, not inside an embedded viewer.

## What is checked (side view)
| Exercise | Measured | Rule (assumed thresholds, need tuning with real users) |
|---|---|---|
| Squat | Knee angle hip-knee-ankle; torso angle from vertical | Valid rep: knee ≤ 115° at bottom (≤ 100° = full score); lean ≤ 55° |
| Push-up | Elbow angle; shoulder-hip-ankle line | Valid rep: elbow ≤ 110° (≤ 95° = full score); body line ≥ 155°; sag vs pike detected |
| Plank | Shoulder-hip-ankle line | ≥ 165° good, 155–165° warn, < 155° pauses the hold timer |
| Dumbbell curl | Elbow angle; upper arm from vertical; torso angle change vs rest | Valid rep: elbow ≤ 70° at top (≤ 55° = full score); upper arm ≤ 30°; torso swing ≤ 16° |
| Bench press | Elbow angle; forearm from vertical at the bottom; hip height vs shoulder-knee line | Valid rep: elbow ≤ 105° at the bottom (≤ 90° = full score) and lockout ≥ 155°; hips stay on the bench; wrists over elbows scored |
| Cable triceps pushdown | Elbow angle; upper arm from vertical; torso angle change vs rest | Valid rep: lockout ≥ 148° (≥ 160° = full score); upper arm ≤ 30°; torso swing ≤ 16°; a hanging arm at setup is not counted |

Reps use a two-state machine (up/down) with hysteresis and angle smoothing, so jitter does not double-count.

## Tester feedback
After each set, testers tap **Send tester feedback** on the summary screen (or **Tester? Send feedback** on the start screen). The app fills in its own counts; the tester adds the real count, deliberate bad reps, setup and ratings. **Send** opens the phone's share sheet (WhatsApp, email) with a fixed-format report including count accuracy and bad-rep detection %. Name, phone position and distance are remembered on the device.

## Known limits
- Side view only, one person in frame. Front-view faults (knee valgus, uneven hips) are not checked yet.
- Spine rounding, heel lift and neck position cannot be measured reliably from 33 landmarks; not checked.
- Thresholds are from general coaching guidance, not validated against a coach's ratings.
- Tested in headless Chromium with a synthetic camera (pipeline + UI) and with synthetic skeletons (logic). **Not yet tested on a real person or a real phone.**


## Body & diet module: formulas and sources
| Item | Rule | Source |
|---|---|---|
| BMI bands | < 18.5 under, 18.5–24.9 healthy, 25–29.9 over, 30+ obese (classes 1–3) | WHO adult classification |
| Waist-to-height | < 0.5 healthy, 0.5–0.59 increased risk, ≥ 0.6 high risk | NICE NG246 (2022 update) |
| Combined reading | BMI ≥ 25 with healthy waist is explained as likely muscle; BMI < 25 with waist ≥ 0.5 warns about central fat | Design decision |
| Resting energy | Mifflin-St Jeor: 10·kg + 6.25·cm − 5·age + 5 (male) / − 161 (female) | Mifflin et al. 1990 |
| Activity factors | 1.2 / 1.375 / 1.55 / 1.725 / 1.9 | Standard multipliers |
| Fat loss | Deficit = min(500 kcal, 20% of maintenance); never below max(resting energy, 1,200 F / 1,500 M) and never above maintenance | Common clinical practice |
| Muscle gain | Surplus = min(400 kcal, 10% of maintenance) | Common sports-nutrition practice |
| Protein | Lose/gain 1.6–2.2 g/kg, maintain 1.2–1.6 g/kg (midpoint shown). BMI ≥ 30 uses the weight at BMI 25 for the person's height | ISSN position stand (2017) |
| Fat / carbs | Fat 30% of calories; carbs the remainder | AMDR 20–35% fat |
| Fibre / fluids | 25 g F / 30 g M; 2.1 L F / 2.6 L M | NHMRC Nutrient Reference Values (Australia) |
| Weekly change | Daily change × 7 / 7,700 kcal per kg, shown as a first-weeks estimate | Rule of thumb, overstates long-term change |

**Referral (no numbers shown):** under 18, pregnant or breastfeeding, eating-disorder history, a medical condition affecting diet, weight/appetite/blood-sugar medicine, or BMI < 17.
**Goal guard rails:** fat loss is switched to maintenance when BMI < 18.5 or waist-to-height < 0.4; muscle gain is switched to maintenance (recomposition) when BMI ≥ 30 or waist-to-height ≥ 0.6. BMI ≥ 40 and age 65+ add a "see your doctor/dietitian" note.
**Privacy:** answers are stored only in the phone's browser storage (`fc.profile`, versioned) if the user ticks "Remember", and can be deleted from the results screen. Nothing is sent to a server.

### Known limits (body & diet)
- Metric units only.
- BMI bands are the general WHO ones; Asian and South Asian populations have health risk at lower BMI (23+). Not adjusted yet.
- Sex options are male/female because the formula needs one of the two.
- Meal ideas (10 to 11 per meal) are alternatives with approximate protein, not a meal plan; the screen says to pick one or combine two.
- **Check what I eat** (per meal): users add foods with weights; built-in foods are matched by name or alias, anything else needs kcal and protein per 100 g from the pack label. Values for home recipes and restaurant food vary widely, so results are estimates. Status: under 80% of the meal target = low, over 120% calories = high. Protein gaps get one suggestion each from meat/fish, dairy/eggs and plant foods (vegetarian: dairy/eggs, plant, protein powder). Entries are saved on the phone only when "Remember" is ticked and are removed by the delete button.
- **The wording and thresholds have not yet been reviewed by an accredited dietitian.** This review is on the roadmap before testers see the module.
