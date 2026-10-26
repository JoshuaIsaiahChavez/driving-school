# AI Driving School

**Drive a car. Record examples. Train a decision tree. Watch it drive.**

One plain HTML/CSS/JavaScript page with a circular track. Python handles physics,
recordings and machine learning. No Pygame, dashboard or frontend build system.

## Open in Codespaces

1. Open your class repository in a Codespace. Wait for its automatic dependency setup.
2. In the terminal, run:

   ```bash
   .venv/bin/python driving_school.py
   ```

3. Open **AI Driving School · 8000** in the **Ports** panel if it does not open
   automatically. Keep port visibility **Private**.

This feels like opening a site with Live Server, but **use the Python server for
this project**. Live Server only serves static files; it cannot run the Python
recording/model API. Both the page and API come from port 8000, using relative URLs
that work through Codespaces HTTPS forwarding. No Live Server extension is needed.

Codespaces availability and included usage depend on your account/organization.
Ask about pairing or local setup if you cannot create one. The container setup is
provided; hosted Codespaces operation still needs an instructor preflight check.

## The three steps

### 1. Drive

- **Start:** practice without saving data.
- **Drive · record:** start moving and save your steering examples.
- **Left / right arrows** or A/D: steer. No key or both directions = straight.
- **Pause** or Space: stop time and recording steps.
- **Reset:** return to the start; keep previously saved files.

Click a driving button to focus the track. Clicking outside the track or leaving
the tab pauses and clears steering. A collision or completed lap stops the car;
Start or Drive begins a new episode. Each browser tab has its own run.

### 2. Train

Click **Pause**. Keep the server running and open a **second terminal**:

```bash
.venv/bin/python train.py
```

`train.py` is the short student learning example: select the five sensor features,
select the steering label, construct a `DecisionTreeClassifier`, call `fit`, and
save the model. Change `MAX_DEPTH` to experiment. Stop recording in all open tabs
before training so the dataset stays fixed.

### 3. Watch the AI

Back in the page, click **AI Drive**. It loads the latest saved tree and starts a
new run. No server restart or browser refresh is needed after retraining. AI
predictions never become human training examples. Start/Drive returns to manual
control. If no model exists, the page explains how to train one.

## Local setup

Use Python 3.12 (tested: 3.12.14). From this repository folder:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python driving_school.py
```

Open [localhost:8000](http://localhost:8000). On Windows use `py -3.12 -m venv .venv`
and `.venv\Scripts\python.exe` instead of `.venv/bin/python`. Native Windows setup
has not been verified here. Keep one server process; do not use multiple workers.

Edit files in `web/` to change the HTML/CSS/JS, then refresh the page to see changes.
Changes to Python server files need a server restart; changes to `train.py` only
need rerunning that script. Stop the server with Ctrl+C. After class, save your
work and stop the Codespace; closing the browser is not the same as stopping it.

## Files students use

```text
driving_school.py   Start the server
train.py            The ML code students study/edit
web/                index.html, style.css, app.js
simulator/          Supplied physics and recording helpers
WORKSHEET.md        Short activity and experiment table
tests/             Automated checks
runtime/           Generated CSVs and saved model (Git-ignored)
```

Recordings are unique CSV files under `runtime/recordings/`. Training reads all
of them and replaces `runtime/model.joblib`, with readable details in
`runtime/model.json`. Move unwanted CSVs out of recordings/ to exclude them.
Your previous desktop-version data and model remain compatible. Only load your
own trusted joblib artifacts; these files can execute code.

Files survive server restarts. Download or back up your code/data before deleting
a Codespace. The [worksheet](WORKSHEET.md) guides the lesson. A lap on this one
track does not demonstrate generalization. This is an educational simulation,
not a model of real-world autonomous-driving safety.

## Tests and troubleshooting

```bash
.venv/bin/python -m pytest -q
```

- Page says it cannot connect: start the Python server and open its port 8000,
  not a Live Server port or the HTML file directly.
- Keys do nothing: click Start or Drive to focus the track.
- No examples: click Drive and actually move before pausing.
- Missing model: pause, run train.py, then click AI Drive.
- Connection paused: the server stops after 0.8 seconds without input. Click a
  driving button to resume. A server stall also pauses instead of replaying inputs.
- Server restarted: refresh the page; saved files are safe.

**Verification:** 19 automated tests passed. Local browser checks verified recording,
Pause, training in a separate process, loading the new model with AI Drive, and
Reset. The smoke test used temporary data; existing recordings/model were preserved.
A real Codespace/container build and hosted GitHub Actions run have not been
performed for this edition. Check private HTTPS forwarding before class.

## What Drive records

At each 0.1-second control step Python reads sensors, records them with the human
action and current waypoint metadata, then moves the car. Paused frames and
post-collision states are not recorded. A collision-causing action is saved with
its pre-collision observation. Each new recording has a unique filename.

| Columns | Meaning |
|---|---|
| `left`, `front_left`, `front`, `front_right`, `right` | Model features: wall distances divided by 180, capped at 1 |
| `steering` | Label: left, straight, right |
| `track_id`, `split`, `episode_id` | Where the example came from |
| `step`, `time` | Control step and simulation seconds before the action |
| `x`, `y`, `heading` | Position and heading, for inspection only |
| `next_waypoint`, `waypoint_x`, `waypoint_y` | Next ordered waypoint |
| `waypoints_passed`, `progress` | Ordered count and percentage |
| `schema_version` | Legacy label `pygame-1`, retained for existing data compatibility |

Five rays are ordered left-to-right at -70°, -35°, 0°, +35°, +70° relative to heading.
The car travels 48 units/second, with an 18×10 physical footprint and four collision
substeps. The single circle lives in simulator/core.py. Completing a lap requires
all waypoints in order, then a forward finish crossing. Metadata never enters the
feature matrix. A clockwise circle naturally favors right/straight labels; the
training script warns about missing action classes and heavy imbalance.
