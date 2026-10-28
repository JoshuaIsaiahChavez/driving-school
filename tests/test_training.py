import csv
import json
import subprocess
import numpy as np
import pytest
import training
from train import train


def make_csv(tmp_path, track_id="round"):
    # Generate actual observations from the same JS used by the browser.
    script = """const D=require('./web/simulation.js');const s=new D.Simulation(D.TRACKS.find(t=>t.id===process.argv[1]));
    const rows=[];for(let i=0;i<45;i++){rows.push(s.example(['left','straight','right'][i%3],'test'));s.step('right');if(s.state.collision)break;}
    console.log(JSON.stringify(rows));"""
    rows = json.loads(subprocess.check_output(['node', '-e', script, track_id], text=True))
    folder = tmp_path / 'recordings'
    folder.mkdir()
    path = folder / 'drive.csv'
    with path.open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(training.COLUMNS)
        writer.writerows(rows)
    return path


def test_train_export_matches_sklearn(tmp_path, monkeypatch):
    monkeypatch.setattr(training, 'DATA_DIR', tmp_path)
    make_csv(tmp_path)
    from sklearn.tree import DecisionTreeClassifier
    rows = training.load_examples()
    X = [[r[f] for f in training.FEATURES] for r in rows]
    model = DecisionTreeClassifier(max_depth=6, min_samples_leaf=3, random_state=42)
    model.fit(X, [r['steering'] for r in rows])
    training.save_model(model, rows)
    artifact = tmp_path / 'model.json'
    rng = np.random.default_rng(1101)
    values = rng.random((200, 5)).tolist()
    script = """const fs=require('fs'),D=require('./web/simulation.js');
    const m=D.validateModel(JSON.parse(fs.readFileSync(process.argv[1])));
    console.log(JSON.stringify(JSON.parse(process.argv[2]).map(x=>D.predict(m,x))));"""
    predictions = json.loads(subprocess.check_output(['node', '-e', script, str(artifact), json.dumps(values)], text=True))
    assert predictions == model.predict(values).tolist()
    meta = json.loads(artifact.read_text())['metadata']
    assert len(meta['sources'][0]['sha256']) == 64


@pytest.mark.parametrize('column,value', [('split','test'),('track_id','validation'),('front','nan'),('left','1.1'),('steering','back'),('step','-1'),('schema_version','unknown')])
def test_invalid_rows_rejected(tmp_path, column, value):
    path = make_csv(tmp_path)
    with path.open() as f:
        rows = list(csv.DictReader(f))
    rows[0][column] = value
    with path.open('w', newline='') as f:
        writer = csv.DictWriter(f, training.COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    with pytest.raises(ValueError):
        training.load_examples([path])


def test_empty_data_helpful():
    with pytest.raises(ValueError, match='download CSV'):
        training.load_examples([])


@pytest.mark.parametrize('track_id', ['round', 'rounded_rect', 'irregular_smooth'])
def test_all_current_tracks_load(tmp_path, track_id):
    path = make_csv(tmp_path, track_id)
    rows = training.load_examples([path])
    assert {r['track_id'] for r in rows} == {track_id}
    assert all(len([r[f] for f in training.FEATURES]) == 5 for r in rows)


@pytest.mark.parametrize('old_track', ['rect', 'oval', 'curvy', 'irregular'])
def test_retired_tracks_rejected(tmp_path, old_track):
    path = make_csv(tmp_path)
    path.write_text(path.read_text().replace(',round,', ',' + old_track + ','))
    with pytest.raises(ValueError, match='not supported training data'):
        training.load_examples([path])


def test_live_coding_starter_has_helpful_message():
    with pytest.raises(ValueError, match='Complete train'):
        train()
