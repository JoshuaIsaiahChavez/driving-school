import csv
import json
from pathlib import Path
import subprocess
import pytest
import train_drag as T


def recording(tmp_path):
    p = tmp_path / 'drive.csv'
    fields = T.FEATURES + T.LABELS + ['schema_version', 'track_id', 'split']
    rows = []
    for i in range(30):
        rows.append(dict(zip(T.FEATURES, [i / 30] * 6), steering=T.ACTIONS[0][i % 3],
            throttle=T.ACTIONS[1][i % 2], schema_version='drag-2', track_id='drag-practice-1', split='train'))
    with p.open('w', newline='') as f:
        w = csv.DictWriter(f, fields); w.writeheader(); w.writerows(rows)
    return p


def test_export_predicts_like_sklearn_and_drives_independent_slots(tmp_path):
    p = recording(tmp_path)
    rows = T.load_examples([p]); model = T.train(rows)
    artifact = T.export_model(model, rows, [p])
    X = [[r[k] for k in T.FEATURES] for r in rows]
    # Include values immediately around every tree split to verify float32 semantics.
    for feature, threshold in zip(model.tree_.feature, model.tree_.threshold):
        if feature >= 0:
            for delta in [-1e-9, 0, 1e-9]:
                x = [.5] * 6; x[feature] = threshold + delta; X.append(x)
    source = """
const fs=require('fs'),assert=require('assert/strict');
const {loadModel}=require('./web/drag-model.js');
const {Race}=require('./web/race-simulation.js');
const {artifact,X}=JSON.parse(fs.readFileSync(0,'utf8'));
const model=loadModel(artifact),race=new Race();
for(let i=0;i<2;i++){const d=race.addDriver('Driver '+i);race.attachModel(d.id,loadModel(artifact),'student');}
race.start();race.tick();assert.equal(race.drivers[0].sim.state.steps,1);
assert.throws(()=>loadModel({...artifact,schema:'browser-1'}),/incompatible/);
const broken=structuredClone(artifact);broken.nodes[0].left=0;assert.throws(()=>loadModel(broken),/Invalid/);
console.log(JSON.stringify(X.map(x=>{const p=model.predict(x);return [p.steering,p.throttle];})));
"""
    result = subprocess.run(['node', '-e', source], input=json.dumps(dict(artifact=artifact, X=X)),
        text=True, capture_output=True, check=True, cwd=Path(__file__).resolve().parents[1])
    assert json.loads(result.stdout) == model.predict(X).tolist()
    assert artifact['metadata']['sources'][0]['sha256']


def test_bad_data_rejected(tmp_path):
    p = recording(tmp_path)
    original = p.read_text()
    for old, new in [('train', 'test'), ('drag-practice-1', 'drag-race-42'), ('0.0', 'nan'), ('straight', 'reverse')]:
        p.write_text(original.replace(old, new))
        with pytest.raises(ValueError): T.load_examples([p])
    with pytest.raises(ValueError, match='No examples'): T.load_examples([])


def test_idle_wait_excluded_but_launch_and_moving_braking_kept(tmp_path):
    p = recording(tmp_path)
    with p.open() as f:
        reader = csv.DictReader(f); fields = reader.fieldnames; base = next(reader)
    launch = dict(base, speed='0', throttle='accelerate')
    idle = dict(base, speed='0', throttle='brake')
    moving = dict(base, speed='0.2', throttle='brake')
    with p.open('w', newline='') as f:
        w = csv.DictWriter(f, fields); w.writeheader(); w.writerows([idle] * 46 + [launch, moving])
    original = p.read_bytes();rows = T.load_examples([p])
    assert len(rows) == 2
    assert [r['throttle'] for r in rows] == ['accelerate', 'brake']
    assert p.read_bytes() == original
    with p.open('w', newline='') as f:
        w = csv.DictWriter(f, fields); w.writeheader(); w.writerow(idle)
    with pytest.raises(ValueError, match='No examples'): T.load_examples([p])


@pytest.mark.parametrize('track_id', ['drag-practice-2', 'drag-practice-tight-1', 'drag-practice-mixed-1'])
def test_widened_practice_recordings_are_accepted(tmp_path, track_id):
    p = recording(tmp_path)
    p.write_text(p.read_text().replace('drag-practice-1', track_id))
    assert len(T.load_examples([p])) == 30


@pytest.mark.parametrize('track_id', ['drag-practice-random-v1-42', 'drag-practice-random-v1-999999', 'drag-practice-random-v2-42', 'drag-practice-random-v2-999999'])
def test_random_practice_accepted(tmp_path, track_id):
    p = recording(tmp_path)
    p.write_text(p.read_text().replace('drag-practice-1', track_id))
    assert len(T.load_examples([p])) == 30


@pytest.mark.parametrize('track_id', ['drag-race-42', 'drag-practice-random-v1-0',
    'drag-practice-random-v1-1000000', 'drag-practice-random-v1-42junk'])
def test_random_identity_rejects_invalid_or_race_data(tmp_path, track_id):
    p = recording(tmp_path)
    p.write_text(p.read_text().replace('drag-practice-1', track_id))
    with pytest.raises(ValueError): T.load_examples([p])


def test_old_physics_rejected_with_recovery_instructions(tmp_path):
    p = recording(tmp_path)
    p.write_text(p.read_text().replace('drag-2', 'drag-1'))
    with pytest.raises(ValueError, match='record fresh drag-2'): T.load_examples([p])
