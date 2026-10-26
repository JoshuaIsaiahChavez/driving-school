# AI Driving School

A small browser simulator for an introductory machine-learning lesson where you train a car to drive.

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

1. Open your copy of this repository in a Codespace. Wait for the environment setup
   to finish; it installs Python 3.12.14 and the pinned training dependencies.
2. Open `web/index.html`, right-click, and choose **Open with Live Server**.
3. Open forwarded port **5500** in the Ports panel. If it opens the repository
   listing, choose `web/`. Keep the port **Private**.

Live Server serves the files; driving does not make network requests. Each tab has
its own car and examples. The host and port are configured in `.vscode/settings.json`.


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


## Files to study

- `train.py`: the short ML program; select features and labels, create the tree,
  call `fit`, and export it. Change depth here.
- `training.py`: supplied CSV validation and JSON export helpers.
- `web/index.html`, `style.css`, `app.js`: page, appearance, controls and animation.
- `web/simulation.js`: physics, sensors, waypoints and decision-tree prediction.

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


