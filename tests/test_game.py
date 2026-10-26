import csv
import math
from types import SimpleNamespace
import numpy as np
import pytest
from shapely.geometry import Polygon
from simulator.core import Simulation, Track, ANGLES, FEATURES, DT
from simulator.game import Game, steering
from simulator import recordings


def test_known_sensor_geometry_and_order():
    p = np.array([[-100,-50],[100,-50],[100,50],[-100,50],[-100,-50]], dtype=float)
    track = SimpleNamespace(seg_a=p[:-1], seg_v=np.diff(p,axis=0), road=Polygon(p),
                            gates=[(np.array([0.,0.]),np.array([1.,0.]))], width=100)
    sim = Simulation(track)
    expected=[min(100/math.cos(math.radians(a)),50/abs(math.sin(math.radians(a))) if a else 100)/180 for a in ANGLES]
    assert sim.sensors() == pytest.approx(expected)
    sim.state.y = 20
    assert sim.sensors()[0] > sim.sensors()[4]
    sim.state.x = 95
    assert sim.collides()  # nose outside even though center is inside


def test_legal_start_and_constant_step():
    a, b = Game(), Game()
    assert not a.sim.collides()
    a.command('Start');b.command('Start')
    for _ in range(30):
        a.advance(.01)
    for _ in range(3):
        b.advance(.1)
    assert a.sim.state.steps == b.sim.state.steps == 3
    assert a.sim.snapshot() == b.sim.snapshot()
    assert not recordings.recording_paths()


def test_recording_alignment_and_waypoint_metadata():
    game = Game()
    game.command('Drive')
    before=game.sim.snapshot(); episode=game.episode
    game.keys.add('ArrowRight')
    game.tick()
    rows=recordings.load_examples()
    row=rows[0]
    assert [row[k] for k in FEATURES] == before['sensors']
    assert row['steering']=='right' and row['step']=='0' and float(row['time'])==0
    assert float(row['x'])==before['x'] and float(row['heading'])==before['heading']
    assert int(row['next_waypoint'])==before['next_checkpoint']
    assert row['episode_id']==episode
    game.pause();game.tick()
    assert len(recordings.load_examples())==1
    game.command('Drive');game.tick()
    assert len(recordings.recording_paths())==1
    game.command('Start');game.tick()
    assert len(recordings.load_examples())==2
    game.command('Reset');game.command('Drive');game.tick()
    assert len(recordings.recording_paths())==2 and game.episode!=episode


def test_controls_pause_focus_and_collision():
    assert steering(set())=='straight'
    assert steering({'ArrowLeft','ArrowRight'})=='straight'
    assert steering({'ArrowLeft'})=='left'
    assert steering({'d'})=='right'
    game=Game();game.command('Drive')
    game.keys.add('ArrowRight')
    assert game.keys
    game.pause()
    assert not game.running and not game.keys
    game.command('Drive')
    for _ in range(500):
        game.tick()
        if game.sim.state.collision:break
    assert game.sim.state.collision and not game.running
    count=game.saved;game.tick();assert game.saved==count
    old=game.episode;game.command('Drive')
    assert game.running and game.episode!=old and not game.sim.state.collision
    game.advance(.5)
    assert not game.running and not game.keys


def test_quit_preserves_rows():
    game=Game();game.command('Drive');game.tick()
    game.heartbeat(game.last_input+1)
    assert not game.running and not game.keys
    assert len(recordings.load_examples())==1


def cross(sim,index,forward=True):
    p,t=sim.track.gates[index]
    sim.state.x,sim.state.y=p-t*2 if forward else p+t*2
    sim.state.heading=math.atan2(t[1],t[0])+(0 if forward else math.pi)
    sim.step('straight')


def test_ordered_waypoints_and_lap():
    sim=Simulation(Track('oval'))
    cross(sim,0);cross(sim,3);cross(sim,1,False)
    assert sim.progress==0
    for i in range(1,len(sim.track.gates)):cross(sim,i)
    assert not sim.state.lap
    cross(sim,0)
    assert sim.state.lap and sim.progress==100
    snapshot=sim.snapshot();sim.step('right');assert sim.snapshot()==snapshot


@pytest.mark.parametrize('column,value', [('left','nan'),('front','1.1'),('right','-0.1'),('steering','reverse'),('split','test'),('track_id','unknown'),('step','-1'),('schema_version','1'),('waypoint_x','inf')])
def test_csv_validation(column,value):
    game=Game();game.command('Drive');game.tick()
    path=recordings.recording_paths()[0]
    with path.open() as file:rows=list(csv.DictReader(file))
    rows[0][column]=value
    with path.open('w',newline='') as file:
        writer=csv.DictWriter(file,recordings.COLUMNS);writer.writeheader();writer.writerows(rows)
    with pytest.raises(ValueError):recordings.load_examples()


def test_empty_data_and_missing_model():
    with pytest.raises(ValueError,match='No driving examples'):recordings.load_examples()
    with pytest.raises(ValueError,match='No model yet'):recordings.load_model()


def test_train_and_ai_use_only_sensor_features():
    import train
    game=Game();game.command('Drive')
    for _ in range(8):game.tick()
    model=train.train()
    assert model.n_features_in_==5
    assert recordings.load_model().predict([[.5]*5])[0] in ('left','straight','right')
    ai=Game();ai.command('AI');ai.tick()
    assert ai.recording is None
    assert ai.sim.state.steps==1 and ai.saved==0
    assert len(recordings.load_examples())==8


def test_browser_api_and_independent_sessions():
    from fastapi.testclient import TestClient
    from driving_school import app, sessions
    with TestClient(app) as client:
        assert client.get('/api/health').json()=={'status':'ok'}
        assert client.get('/').status_code==200
        assert client.get('/app.js').status_code==200
        assert client.get('/runtime/model.joblib').status_code==404
        first=client.post('/api/session').json()
        second=client.post('/api/session').json()
        ident=first['id']; path='/api/control/'+ident
        assert first['id']!=second['id']
        assert first['track']['boundaries']
        response=client.post(path,json={'sequence':1,'command':'Drive'})
        assert response.json()['recording']
        client.post(path,json={'sequence':2,'keys':['ArrowRight']})
        sessions[ident].tick()
        assert sessions[ident].saved==1 and sessions[second['id']].saved==0
        client.post(path,json={'sequence':4,'command':'Pause'})
        client.post(path,json={'sequence':3,'command':'Start'})
        assert not sessions[ident].running  # Late requests cannot undo Pause.
        import train
        train.train()
        response=client.post(path,json={'sequence':5,'command':'AI'})
        assert response.json()['mode']=='AI' and not response.json()['recording']
        sessions[ident].tick()
        assert sessions[ident].saved==1
        client.post(path,json={'sequence':6,'command':'Reset'})
        assert sessions[ident].sim.state.steps==0 and not sessions[ident].running
        assert client.post(path,json={'sequence':7,'keys':['invalid']}).status_code==400
        assert client.post('/api/control/missing',json={'sequence':0}).status_code==404


def test_ai_without_model_is_helpful():
    from fastapi.testclient import TestClient
    from driving_school import app
    with TestClient(app) as client:
        ident=client.post('/api/session').json()['id']
        result=client.post('/api/control/'+ident,json={'sequence':0,'command':'AI'})
        assert result.status_code==400 and 'python train.py' in result.json()['detail']
