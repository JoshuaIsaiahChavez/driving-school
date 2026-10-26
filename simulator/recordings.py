"""Supplied CSV/model helpers. Waypoint metadata is deliberately not a feature."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import math
import os
import uuid
import joblib
import sklearn
from .core import ROOT, FEATURES, ACTIONS, DT, TRACK_ID

DATA_DIR = Path(os.environ.get('DRIVING_DATA_DIR', ROOT / 'runtime'))
SCHEMA = 'pygame-1'  # Keep the existing data/model format compatible.
COLUMNS = FEATURES + ['steering', 'track_id', 'split', 'episode_id', 'step',
    'time', 'x', 'y', 'heading', 'next_waypoint', 'waypoint_x', 'waypoint_y',
    'waypoints_passed', 'progress', 'schema_version']


class Recording:
    def __init__(self, track):
        if track.split != 'train':
            raise ValueError('Only training-track demonstrations may be recorded.')
        self.track = track
        directory = DATA_DIR / 'recordings'
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / f'drive-{uuid.uuid4().hex}.csv'
        with self.path.open('x', newline='') as file:
            csv.DictWriter(file, COLUMNS).writeheader()
        self.count = 0

    def append(self, sim, sensors, action, episode):
        state = sim.state
        waypoint = (state.gates_passed + 1) % len(sim.track.gates)
        position, _ = sim.track.gates[waypoint]
        row = dict(zip(FEATURES, sensors))
        row.update(steering=action, track_id=self.track.id, split=self.track.split,
            episode_id=episode, step=state.steps, time=state.steps*DT,
            x=state.x, y=state.y, heading=state.heading, next_waypoint=waypoint,
            waypoint_x=float(position[0]), waypoint_y=float(position[1]),
            waypoints_passed=state.gates_passed, progress=sim.progress, schema_version=SCHEMA)
        # Close after every row: closing the window does not lose buffered samples.
        with self.path.open('a', newline='') as file:
            csv.DictWriter(file, COLUMNS).writerow(row)
        self.count += 1


def recording_paths():
    return sorted((DATA_DIR / 'recordings').glob('*.csv'))


def load_examples(paths=None):
    paths = recording_paths() if paths is None else paths
    training_ids = {TRACK_ID}
    rows = []
    for path in paths:
        with Path(path).open(newline='') as file:
            reader = csv.DictReader(file)
            if reader.fieldnames != COLUMNS:
                raise ValueError(f'{path.name}: wrong CSV format; use a driving-school recording.')
            for number, row in enumerate(reader, 2):
                try:
                    if None in row or any(v is None for v in row.values()):
                        raise ValueError('incomplete CSV row')
                    if row['track_id'] not in training_ids or row['split'] != 'train':
                        raise ValueError('not training data')
                    if row['schema_version'] != SCHEMA or row['steering'] not in ACTIONS:
                        raise ValueError('invalid schema or steering label')
                    for key in FEATURES:
                        row[key] = float(row[key])
                        if not math.isfinite(row[key]) or not 0 <= row[key] <= 1:
                            raise ValueError('sensor distances must be finite numbers in [0,1]')
                    for key in ('step', 'next_waypoint', 'waypoints_passed'):
                        if int(row[key]) < 0:
                            raise ValueError('negative step or waypoint')
                    for key in ('time', 'x', 'y', 'heading', 'waypoint_x', 'waypoint_y', 'progress'):
                        if not math.isfinite(float(row[key])):
                            raise ValueError('non-finite metadata')
                    if not row['episode_id'] or not 0 <= float(row['progress']) <= 100:
                        raise ValueError('invalid episode or progress')
                except (ValueError, TypeError) as error:
                    raise ValueError(f'{path.name}, row {number}: {error}') from error
                rows.append(row)
    if not rows:
        raise ValueError('No driving examples yet. Run driving_school.py, click Drive, steer, and click Pause.')
    counts = Counter(row['steering'] for row in rows)
    print('Examples: ' + ', '.join(f'{action}={counts[action]}' for action in ACTIONS))
    missing = [action for action in ACTIONS if not counts[action]]
    if missing:
        print('Note: no examples of ' + ', '.join(missing) + '. The model cannot learn those actions yet.')
    if max(counts.values()) / len(rows) > .85:
        print('Note: more than 85% of your examples use one action. Try more varied steering.')
    return rows


def save_model(model, rows):
    if getattr(model, 'n_features_in_', None) != len(FEATURES):
        raise ValueError('Train with exactly the five sensor features.')
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    metadata = dict(features=FEATURES, schema=SCHEMA, samples=len(rows),
        parameters=model.get_params(), sklearn=sklearn.__version__,
        sources=[dict(file=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in recording_paths()])
    path = DATA_DIR / 'model.joblib'
    temp = DATA_DIR / f'model-{uuid.uuid4().hex}.tmp'
    joblib.dump(dict(model=model, metadata=metadata), temp)
    temp.replace(path)
    (DATA_DIR / 'model.json').write_text(json.dumps(metadata, indent=2))
    print(f'Model saved: {path}')


def load_model():
    path = DATA_DIR / 'model.joblib'
    if not path.exists():
        raise ValueError('No model yet. Record a drive, click Pause, then run: python train.py')
    # Only load our locally generated, trusted artifact. There is no upload UI.
    bundle = joblib.load(path)
    meta = bundle['metadata']
    if meta['features'] != FEATURES or meta['schema'] != SCHEMA or meta['sklearn'] != sklearn.__version__:
        raise ValueError('Model format or scikit-learn version changed. Run train.py again.')
    return bundle['model']
