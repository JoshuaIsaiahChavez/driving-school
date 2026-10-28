# AI Driving School

Teach a simulated car to drive from your examples. The simulator runs entirely in
HTML, CSS, and JavaScript; Python trains a scikit-learn decision tree. No game
window, API key, Python web server, or frontend build system is required.

| Activity | Page | Training script |
| --- | --- | --- |
| Part 1: learn steering on three loop tracks | `web/index.html` | `train.py` (live-coding starter) |
| Part 2: collect obstacle-course demonstrations and test one model | `web/drag.html` | `train_drag.py` |
| Part 2: race multiple student models | `web/race.html` | Load models exported by `train_drag.py` |

## Machine learning concepts

**Supervised learning** is a machine-learning approach that fits a model to paired inputs and target outputs to predict outputs for new inputs.

**Example:** Train on five sensor distances (features) paired with the human's steering action (label), then predict steering from new sensor readings.

**A decision tree** is a predictive model that partitions inputs through feature-based tests; branches represent test outcomes, and leaves provide predictions.

**Example:** This illustrative tree predicts steering from normalized sensor distances. The actual model learns its tests and thresholds from the recorded examples.

```text
Front distance <= 0.30?
├── No  → Predict STRAIGHT
└── Yes → Left distance <= 0.25?
          ├── Yes → Predict RIGHT
          └── No  → Predict LEFT
```

With `front = 0.20` and `left = 0.65`, the path is Yes → No → **LEFT**.

## Start in Codespaces

1. Open your repository copy in a Codespace and wait for setup. It installs
   Python 3.12.14 and the pinned dependencies into `.venv`.
2. Open the activity's HTML file, right-click, and choose **Open with Live Server**.
3. Open port **5500** in the Ports panel. Keep its visibility **Private**.
   If the browser shows a file listing, open `web/`, then the activity page.

Driving runs in your browser, so network latency does not control the car.
Each tab has its own car, loaded models, and examples. Use the links on the pages
to move between activities. Download examples before leaving or refreshing.
Codespaces access and usage depend on your account and organization; it is not
necessarily free. Stop your Codespace after class.

## Part 1: teach steering

1. Open `web/index.html`. Choose Round, Rounded rectangle, or Irregular.
2. **Start** practices; **Drive · record** records. The car moves forward at a
   constant speed. Left/right arrows or A/D steer. No key means straight; pressing
   both directions also means straight. Space or **Pause** stops the run.
3. Download CSV and upload it into `runtime/recordings/` in the VS Code Explorer.
   Create the folder if needed. Clear browser examples after saving to avoid
   exporting the same rows again.
4. Complete `train.py` during live coding: select the five sensor columns as X,
   steering as y, create a `DecisionTreeClassifier`, call `fit`, and use the supplied
   export helper. The starter intentionally prints a completion message until filled in.
5. Run from the repository root:

   ```bash
   .venv/bin/python train.py
   ```

6. Download `runtime/model.json` from VS Code, choose **Load model.json** in the
   browser, and click **AI Drive**. Locally, select the file directly.

`training.py` supplies validation and export. These recordings use `browser-1`,
five normalized wall distances, and one steering label. The sensor range is
180 units. Position, heading, and ordered-waypoint metadata are not features.
The physics runs at 10 control steps/second with interpolated drawing.

## Part 2: can your car finish the obstacle race?

Your challenge is to train a driver that can finish the course. Investigate what
fails, collect useful demonstrations, and compare the next model. A failed run
still provides evidence; finishing is not guaranteed by more data or a deeper tree.

### Drive and record

Open `web/drag.html`. Choose one of these training layouts:

| Layout | What to practice |
| --- | --- |
| Wide slalom | Clear left/right steering through generous gaps |
| Tighter slalom | Slowing before turns and accelerating after clearing barriers |
| Mixed spacing | Different approaches, speeds, stops, and restarts |
| Random practice (race layout) | Varied arrangements matching the race generator |

For random practice, enter a seed (1–999999) and click **Build from seed**, or click
**New random layout**. Random practice and racing use exactly the same geometry
for the same seed: 12 obstacles, widths 150–190 units, left/center/right placement,
340 units between obstacle starts, and a finish at 4600 units. Reset repeats the
selected course. Use another seed when you want a new arrangement.

- **Start run:** practice without recording.
- **Record drive:** start/resume collecting demonstrations.
- **Up/W:** accelerate. **Release Up/W:** brake automatically.
- **Down/S:** also brakes, taking priority over acceleration.
- **Left/right or A/D:** steer; both directions together mean straight.
- **Space / Pause:** stop the run and recording. Click the canvas if keys lose focus.

There is no coast or reverse. A collision ends the run. Higher speed produces
wider turns; the car cannot turn in place. Switching layouts or pressing Reset
starts a fresh episode while keeping examples. Switching layouts pauses recording:
click Record drive to collect again. Focus loss also pauses and clears held keys.

**Download CSV** pauses and exports all examples currently in the tab. Upload it
to `runtime/drag-recordings/` in VS Code (create the folder). Downloads in Codespaces
go to your computer, not automatically into the remote folder. **Clear examples**
after saving before collecting a separate dataset. Do not upload repeated exports
of the same examples. To exclude a drive, move its CSV out of the training folder.

### Train and test one model

From the repository root:

```bash
.venv/bin/python train_drag.py
```

This combines all CSVs in `runtime/drag-recordings/` and writes
`runtime/drag-model.json`. To choose specific demonstrations and name the output:

```bash
.venv/bin/python train_drag.py runtime/drag-recordings/my-drive.csv --output runtime/my-driver.json
```

`train_drag.py` contains the training steps and the `MAX_DEPTH` and
`MIN_SAMPLES_LEAF` settings. X has five sensor readings plus speed; y has two
labels: steering and throttle. A single decision tree predicts both labels.
`max_depth` limits the number of successive questions; `min_samples_leaf` is the
minimum examples supporting a final decision. Keep settings fixed while comparing
recording tactics. Retraining rebuilds the tree from the selected CSVs; it does
not remember an earlier model.

Download the exported JSON from VS Code, choose it under **Student model** on the
practice page, then click **AI Drive**. Only one model is needed. The loaded model
stays available when switching layouts; load the newly exported file after retraining.

Pause then AI Drive resumes. Reset then AI Drive starts fresh. After a collision,
finish, or timeout, AI Drive starts a new run. Start run or Record drive switches
back to manual driving at the start. AI driving never adds training examples.

### Investigate failures

1. Pick a seed and keep the same tree settings for your comparison.
2. Run the baseline model. Record its progress, speed, prediction, and failure.
3. Explain a possible cause and record examples addressing it. Try to approach
   the failure from a similar position and speed, then demonstrate a correction.
4. Keep useful earlier recordings, add the new examples, retrain, and reload.
5. Repeat the same test, then check another seed for regressions.

| Attempt | CSV files / sample count | Depth / leaf minimum | Seed | Assist on/off; restarts | Progress / finish time | Failure and next experiment |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | | | | | | |
| Targeted correction | | | | | | |
| Another improvement | | | | | | |

A tree has no timer or memory: each prediction uses only the current sensors and
speed. If it predicts brake at rest, the inputs may remain unchanged and it may
keep braking. Demonstrate safe restarts as well as slowing down. More consecutive
frames do not necessarily add different situations. Duplicate exports or conflicting
tactics can reduce the value of additional data. The model's limited inputs can
also cause failures; failure does not automatically mean your data was poor.

### Anti-stall assistance

AI practice and racing enable **Anti-stall assist** by default. After five simulated
seconds below 2 units/s, it applies one second of acceleration, keeping model
steering. It then returns throttle control to the tree. The readout shows the
original prediction, a countdown, active assistance, and the number of restarts.
Paused time does not count. Crashed/finished cars do not restart, and a boost can
still lead to a collision or another stop.

This is a programmed aid, not learned behavior. Disable it when testing whether
the model finishes entirely on its own. Record the setting in your experiment
and keep it consistent when comparing runs. Changing the setting resets an AI
practice run; reset before changing it on the race page.

### Race student models

Open `web/race.html`, select a seed, and click **Build course**. Load a compatible
JSON under Driver 1 and Driver 2; **Add driver** supports up to eight. Every slot
needs a model before **Start race** is enabled. Reset to replace models. You may
load the same model twice to check repeatability; cars then overlap.

Each car has independent model control, the same start, physics, course, and
120-second simulated time limit. They are ghost cars: they detect walls and
obstacles but do not collide with or sense one another. A collision ends only that
car's run. The main camera follows the leading active car; the overview shows all.

For an unseen-course test, choose the final seed after freezing your model.
Practicing a seed makes it a seen course. Multiple training layouts do not guarantee
that overfitting disappears. Matching human labels is different from finishing:
a small prediction error can move the car into situations absent from the data.

### Data and compatibility

Obstacle recordings use schema **`drag-2`** and exported models **`drag-model-2`**.
Older coast-based recordings/models and Part 1 steering-only files are incompatible.
Collect fresh automatic-braking demonstrations rather than relabeling old rows.

| Data | Meaning |
| --- | --- |
| left, front_left, front, front_right, right | Distances at −70°, −35°, 0°, 35°, 70°, divided by 300 |
| speed | Current speed divided by 180 |
| steering | left / straight / right |
| throttle | accelerate / brake |
| track_id, split | Practice layout/seed and `train`; metadata only |
| session_id, episode_id, step, time | Recording identity and simulation timing |
| x, y, heading, progress, schema_version | Audit information, never model features |

Only six normalized values enter X. Recording reads the current state and applied
human action before advancing physics, once per 1/60-second step. Paused, AI, and
post-collision frames are excluded. Stationary brake waits are excluded by training;
braking while moving is retained. Validation rejects invalid labels, non-finite or
out-of-range features, old schemas, and race-track training data. Missing classes
and heavy imbalance produce warnings.

Physics uses four collision substeps, a 22 × 38 car footprint, maximum speed 180,
acceleration 75, and braking 150 in simulation units. These are educational physics,
not a model of real-world autonomous-driving safety. Both pages share the same
engine and sensor normalization. JSON models contain tree nodes, feature order,
parameters, dependency version, sample count, and source hashes. Loading JSON does
not execute uploaded code. No placeholder driver substitutes for a missing model.

## Save your work

This repository starts without recordings or trained models. Generated files under
`runtime/` are ignored by Git. Browser examples and loaded models disappear on
refresh/close; download first. Uploaded Codespace files survive stopping/restarting,
but download your work before deleting the Codespace. Preserve your script, chosen
CSVs, model JSON, experiment table, and a brief reflection on what improved or failed.
Stop the Codespace after class to avoid unnecessary usage.

## Local setup and troubleshooting

Use Python **3.12.14**, VS Code, and the **Live Server** extension. From the root:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows, create the environment with `py -3.12 -m venv .venv` and use
`.venv\Scripts\python` instead of `.venv/bin/python` in commands.
Open the desired HTML with Live Server. When serving the repository root, a local
URL is `http://localhost:5500/web/drag.html`; when serving `web/` itself it is
`http://localhost:5500/drag.html`. A 404 usually means the path does not match the
served folder. Do not run two servers on port 5500.

- Missing port: start Live Server and open port 5500 in VS Code's Ports panel.
- Keys do nothing: click the canvas and start/resume; focus loss pauses driving.
- Empty training data: upload CSVs into the correct activity's recording folder.
- Incompatible model/data: Part 1 and Part 2 use different formats; Part 2 needs
  fresh `drag-2` recordings and a `drag-model-2` model.
- Model still behaves the same after training: explicitly reload the new JSON.
- Car stops: inspect Racing/Collision/Timed out/Paused and the prediction. A brake
  prediction at zero speed is a model decision, not necessarily a simulator bug.
- `train.py` asks for completion: finish the Part 1 live-coding starter. Part 2
  uses the supplied `train_drag.py` instead.

## Checks

From the repository root, with Node.js and the Python environment installed:

```bash
node --test tests/*.test.js
.venv/bin/python -m pytest -q
```

GitHub Actions runs these checks. Tests cover simulation geometry, fixed timing,
recording alignment, layout switching, AI controls, model validation, Python/JS
prediction agreement, race isolation, and anti-stall behavior. Generated-course
checks use a test-only controller; they establish traversability, not a learned
model's success rate. Local automated checks do not substitute for a fresh hosted
Codespace preflight before class.
