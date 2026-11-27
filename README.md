# Form Coach — camera posture checker (prototype v0.1)

Mobile web app that checks squat, push-up and plank form in real time with the phone camera.
Pose estimation runs fully on the device (MediaPipe Pose Landmarker "lite", WebAssembly + GPU). No video is uploaded or stored.

## Files
| File | Purpose |
|---|---|
| `index.html` | UI: exercise picker, live camera view with skeleton overlay, cues, voice, set summary |
| `engine.js` | Form rules, rep counting, scoring (pure logic, no DOM) |
| `vendor/` | MediaPipe library, WASM runtime and pose model (bundled, ~15 MB, no CDN at runtime) |
| `tests/engine.test.mjs` | 8 logic tests with synthetic skeletons (`node --test tests/engine.test.mjs`) |

## Run
Camera access needs **https** (or `localhost`). Locally: `python3 -m http.server 8000` in this folder, open `http://localhost:8000` on the same computer.
Live (GitHub Pages): https://abdallahelgazzaar-hue.github.io/form-coach/ . Camera access needs the page opened directly over https, not inside an embedded viewer.

## What is checked (side view)
| Exercise | Measured | Rule (assumed thresholds, need tuning with real users) |
|---|---|---|
| Squat | Knee angle hip-knee-ankle; torso angle from vertical | Valid rep: knee ≤ 115° at bottom (≤ 100° = full score); lean ≤ 55° |
| Push-up | Elbow angle; shoulder-hip-ankle line | Valid rep: elbow ≤ 110° (≤ 95° = full score); body line ≥ 155°; sag vs pike detected |
| Plank | Shoulder-hip-ankle line | ≥ 165° good, 155–165° warn, < 155° pauses the hold timer |

Reps use a two-state machine (up/down) with hysteresis and angle smoothing, so jitter does not double-count.

## Known limits
- Side view only, one person in frame. Front-view faults (knee valgus, uneven hips) are not checked yet.
- Spine rounding, heel lift and neck position cannot be measured reliably from 33 landmarks; not checked.
- Thresholds are from general coaching guidance, not validated against a coach's ratings.
- Tested in headless Chromium with a synthetic camera (pipeline + UI) and with synthetic skeletons (logic). **Not yet tested on a real person or a real phone.**

