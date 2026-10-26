# AI Driving School

Can we teach a car to drive from examples?

A small browser simulator for an introductory machine-learning lesson. **HTML,
CSS, and JavaScript run the entire game locally in your browser. Python is used
only to train a scikit-learn decision tree.** No Python server, Pygame, API,
frontend build system, or model upload service is needed.

## Start in Codespaces

1. Open your copy of this repository in a Codespace. Wait for the environment setup
   to finish; it installs Python 3.12.14 and the pinned training dependencies.
2. Open `web/index.html`, right-click, and choose **Open with Live Server**.
3. Open forwarded port **5500** in the Ports panel. If it opens the repository
   listing, choose `web/`. Keep the port **Private**.

Live Server serves the files; driving does not make network requests. Each tab has
its own car and examples. The host and port are configured in `.vscode/settings.json`.
Codespaces availability and cost depend on your account and organization policies.
Check access and available usage before class. Stop your Codespace after class
using the Codespaces menu or GitHub's Codespaces page.

## Drive, train, and watch

1. Choose **Round**, **Rounded rectangle**, or **Irregular**. Changing tracks pauses
   and resets the car while keeping recorded examples. **Start** practices without recording. Click the track if the keys do not work.
2. **Drive · record** starts moving and collects examples. Left/right arrows or
   A/D steer. No steering key means straight; both directions together also mean
   straight. Forward speed is constant. Space or **Pause** stops the car.
3. **Download CSV** pauses and downloads all examples in this tab. In the VS Code
   Explorer, create `runtime/recordings/`, then upload/drag the downloaded CSV there.
   In Codespaces, downloads go to your own computer, not automatically into the
   remote repository. Upload each recording once to avoid duplicate examples.
4. Run this in the repository-root terminal:

   ```sh
   .venv/bin/python train.py
   ```

5. Right-click `runtime/model.json` in VS Code and **Download** it. On the simulator
   page choose **Load model.json**, select that file, then click **AI Drive**.
   Locally, you can select `runtime/model.json` directly without downloading it.
6. Collect more examples or change `MAX_DEPTH` in `train.py`, retrain, then load
   the new model file. The browser keeps the last model you explicitly loaded.

**Reset** begins a new episode and keeps examples. **Clear examples** removes only
this tab's examples after confirmation. To discard a downloaded recording from
training, delete that specific CSV from `runtime/recordings/`. Downloading does
not clear the tab: clear it before recording another separate dataset to avoid
re-exporting the same rows. Closing or refreshing the tab loses its examples and
loaded model. Download before closing. Uploaded CSVs and exported models survive
Codespace restarts, but download your work before deleting a Codespace.

## Included recording and model

This snapshot includes a 336-example recording from Irregular in
`runtime/recordings/` and its trained `runtime/model.json`. For a quick Codespaces
check, open the simulator, download that JSON from VS Code, load it in the page,
select Irregular, and click AI Drive. You can also rerun `train.py` using the
included CSV. The model completed Irregular and Rounded rectangle in local
headless checks; it collided at about 21% progress on Round.

These files are intentionally committed for classroom testing. New recordings and
other generated runtime files remain ignored by Git. Retraining changes the tracked
model file; download your work before deleting a Codespace. The obsolete joblib
artifact is not included and is not used by the browser.

## Files to study

- `train.py`: the short ML program; select features and labels, create the tree,
  call `fit`, and export it. Change depth here.
- `training.py`: supplied CSV validation and JSON export helpers.
- `web/index.html`, `style.css`, `app.js`: page, appearance, controls and animation.
- `web/simulation.js`: physics, sensors, waypoints and decision-tree prediction.
- `WORKSHEET.md`: activity and reflection questions.

`max_depth` limits how many successive questions the tree can ask.
`min_samples_leaf` sets the minimum examples supporting a final decision.
A deeper tree or more examples does not always improve driving. Observe and explain.

## What is recorded?

CSV columns are in this exact order:

| Columns | Meaning |
| --- | --- |
| left, front_left, front, front_right, right | Five features: wall distances at −70°, −35°, 0°, 35°, 70° relative to the car |
| steering | Label: left, straight, or right |
| track_id, split | `round`, `rounded_rect`, or `irregular_smooth`; split is `train` |
| episode_id, step, time | Episode identifier, control step, simulated seconds |
| x, y, heading | Position and direction for auditing only |
| next_waypoint, waypoint_x, waypoint_y | Next ordered checkpoint for auditing only |
| waypoints_passed, progress | Ordered gates reached and percentage of lap |
| schema_version | `browser-1` |

Sensor range is 180 units: 0 means at a wall, 1 means no wall within range. Only
these five normalized distances enter the model. Every 0.1 simulated seconds the
game reads sensors, records the human action, then moves the car. AI, practice,
paused and post-collision frames are never recorded. Footprint collision uses an
18 × 10 rectangle with six movement substeps. Checkpoints require forward, ordered
crossings; the finish counts only after all gates. Drawing interpolates between
control steps at the browser's refresh rate. Hidden tabs, lost focus, or stalls
longer than 250 ms pause the game instead of accumulating a backlog.

Training validates rows and warns about missing actions and heavy imbalance.
JSON contains the learned nodes, feature order, parameters, seed, dependency
version, sample count, and input file hashes. The browser follows those exact
learned decisions, including sklearn's float32 input comparisons. No hand-coded
driver substitutes for the model. JSON is data, not executable code or pickle.
Old `pygame-1` recordings are preserved and skipped by the default loader because
the new analytical circular geometry differs slightly; collect new examples.
Old joblib models are never loaded. Training replaces `runtime/model.json` only
when you explicitly run it.

## Local setup

Install Python **3.12.14**, VS Code, and its **Live Server** extension. From this
repository root:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows use `py -3.12 -m venv .venv`, then
`.venv\Scripts\python -m pip install -r requirements.txt` and
`.venv\Scripts\python train.py`. Open `web/index.html` with Live Server. Use the URL it opens; locally prefer
`http://localhost:5500/web/index.html` when serving the repository root. A server
serving `web/` directly instead uses `/index.html`. Do not run two servers on 5500.

## Checks and troubleshooting

```sh
.venv/bin/python -m pytest -q
node --test tests/simulation.test.js
node --check web/app.js
```

Node is needed for development tests, not for students to drive or train. CI
installs Node 22.14.0. Tests check geometry, collision, ordered laps, deterministic
steps, recording alignment, CSV rejection, and Python-to-JavaScript prediction
agreement on 200 deterministic inputs. Python 3.12.14 was tested locally.
Local verification (2026-10-26): **16 Python tests and 11 JavaScript tests passed**.
Geometry checks cover boundary intersections, legal centerlines, sensor ranges,
start/finish alignment, and collision-free laps from three deterministic starts
per track. The waypoint follower used for geometry tests is test-only, not the
learned driver. Browser checks covered all three track selections, rendering,
recording, switching with retained samples, model loading, and AI playback.

A separate training smoke check generated 2,844 synthetic examples using a
waypoint follower on these three tracks (center start and ±8-unit offsets).
The unchanged `train.py` settings (depth 6, leaf minimum 3, seed 1101) exported a
model that completed all three nominal-start laps in the actual JavaScript engine:

| Track | Progress | Collision | Simulated time |
| --- | --- | --- | --- |
| Round | 100% | No | 27.5 s |
| Rounded rectangle | 100% | No | 38.3 s |
| Irregular | 100% | No | 28.4 s |

These are training-track smoke checks, not held-out generalization results or a
promise about student-trained models. The synthetic files were temporary and did
not replace student recordings or models. Hosted Codespaces still needs preflight.

- **No port:** start Live Server and look for port 5500; check the extension is installed.
- **Car stopped:** click Start/Drive and keep the canvas focused. Switching windows pauses.
- **Empty training data:** download a Drive recording and upload the CSV to `runtime/recordings/`.
- **Wrong format / unsupported track:** old `rect`, `oval`, `curvy`, and `irregular`
  track IDs are retired. Move those CSVs out of `runtime/recordings/` if you want to
  retain them, then collect new examples. Existing files are never automatically deleted.
- **AI unavailable:** train, download the JSON, load it using the file picker, then click AI Drive.
- **AI crashes:** inspect label counts; record controlled turns as well as straight driving.
- **Python missing imports:** run the setup command and use the `.venv` interpreter.

This is an educational toy, not a real-world autonomous-driving safety model.
All three tracks allow training. To explore generalization, reserve one track
from your demonstrations and model selection, then test on it after freezing your
settings. A track already used for demonstrations is not held out. Multiple tracks
provide different situations; they do not guarantee that overfitting disappears. Steering-label accuracy also does not guarantee a successful
lap: small mistakes can lead to states absent from demonstrations.
