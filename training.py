"""Supplied data validation and JSON export; students edit train.py."""
from pathlib import Path
from collections import Counter
import csv
import hashlib
import json
import math
import os
import uuid
import sklearn

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('DRIVING_DATA_DIR', ROOT / 'runtime'))
FEATURES = ['left', 'front_left', 'front', 'front_right', 'right']
ACTIONS = ('left', 'straight', 'right')
SCHEMA = 'browser-1'
COLUMNS = FEATURES + ['steering', 'track_id', 'split', 'episode_id', 'step',
    'time', 'x', 'y', 'heading', 'next_waypoint', 'waypoint_x', 'waypoint_y',
    'waypoints_passed', 'progress', 'schema_version']

def recording_paths():
    # Old Python-simulator recordings are preserved, but use different geometry.
    paths = []
    for path in sorted((DATA_DIR / 'recordings').glob('*.csv')):
        with path.open(newline='') as file:
            first = next(csv.DictReader(file), None)
        if first and first.get('schema_version') == 'pygame-1':
            print(f'Skipping legacy recording: {path.name}. Collect new browser examples.')
        else:
            paths.append(path)
    return paths

def load_examples(paths=None):
    paths = recording_paths() if paths is None else paths
    training_ids = {'round', 'rounded_rect', 'irregular_smooth'}
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
                        raise ValueError('not supported training data; use Round, Rounded rectangle, or Irregular recordings')
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
        raise ValueError('No driving examples yet. Click Drive in the browser, download CSV, and put it in runtime/recordings/.')
    counts = Counter(row['steering'] for row in rows)
    print('Examples: ' + ', '.join(f'{action}={counts[action]}' for action in ACTIONS))
    missing = [action for action in ACTIONS if not counts[action]]
    if missing:
        print('Note: no examples of ' + ', '.join(missing) + '. The model cannot learn those actions yet.')
    if max(counts.values()) / len(rows) > .85:
        print('Note: more than 85% of your examples use one action. Try more varied steering.')
    return rows



def save_model(model, rows):
    if getattr(model, 'n_features_in_', None) != 5:
        raise ValueError('Train with exactly the five sensor features.')
    if any(label not in ACTIONS for label in model.classes_):
        raise ValueError('Invalid steering labels.')
    tree = model.tree_
    artifact = dict(schema=SCHEMA, features=FEATURES,
        classes=model.classes_.tolist(),
        nodes=[dict(left=int(tree.children_left[i]), right=int(tree.children_right[i]),
            feature=int(tree.feature[i]), threshold=float(tree.threshold[i]),
            **{'class': int(tree.value[i][0].argmax())}) for i in range(tree.node_count)],
        metadata=dict(samples=len(rows), parameters=model.get_params(), sklearn=sklearn.__version__,
            sources=[dict(file=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
                for p in recording_paths()]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / 'model.json'
    temporary = DATA_DIR / f'model-{uuid.uuid4().hex}.tmp'
    temporary.write_text(json.dumps(artifact, indent=2, allow_nan=False))
    temporary.replace(path)
    print(f'Model saved: {path}. Download it from VS Code and load it in the browser.')
