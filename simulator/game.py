"""One Python simulation per browser tab; no physics runs in JavaScript."""
import time
import uuid
from .core import Simulation, Track, DT
from .recordings import Recording, load_model


def steering(keys):
    left = 'ArrowLeft' in keys or 'a' in keys
    right = 'ArrowRight' in keys or 'd' in keys
    return 'straight' if left == right else 'left' if left else 'right'


class Game:
    def __init__(self, model=None):
        self.track = Track()
        self.model = model
        self.recording = None
        self.keys = set()
        self.saved = 0
        self.sequence = -1
        self.last_input = time.monotonic()
        self.reset()

    def reset(self):
        self.sim = Simulation(self.track)
        self.episode = uuid.uuid4().hex
        self.running = False
        self.recording = None
        self.accumulator = 0.0
        self.keys.clear()
        self.action = 'straight'
        self.message = 'Start = practice. Drive = record your steering.'

    def pause(self):
        self.running = False
        self.accumulator = 0.0
        self.keys.clear()
        self.action = 'straight'
        self.message = 'Paused. You can run .venv/bin/python train.py in another terminal.'

    def command(self, command):
        if command == 'Reset':
            self.model = None
            self.reset()
        elif command == 'Pause':
            self.pause()
        elif command in ('Start', 'Drive', 'AI'):
            # Reload on every AI click so training never requires a server restart.
            model = load_model() if command == 'AI' else None
            if command == 'AI' or self.sim.state.collision or self.sim.state.lap or self.model is not None:
                self.reset()
            self.model = model
            self.keys.clear()
            self.accumulator = 0.0
            if command == 'Drive':
                if self.recording is None:
                    self.recording = Recording(self.track)
                self.message = 'Recording. Steer with the left and right arrow keys.'
            else:
                self.recording = None
                self.message = 'Practice — no data saved.' if model is None else 'AI driving — using your saved decision tree.'
            self.running = True
            self.last_input = time.monotonic()
        else:
            raise ValueError('Unknown command')

    def tick(self):
        if not self.running or self.sim.state.collision or self.sim.state.lap:
            return
        sensors = self.sim.sensors()
        self.action = steering(self.keys)
        if self.model is not None:
            self.action = str(self.model.predict([sensors])[0])
        if self.recording is not None:
            self.recording.append(self.sim, sensors, self.action, self.episode)
            self.saved += 1
        self.sim.step(self.action)
        if self.sim.state.collision or self.sim.state.lap:
            self.pause()
            self.recording = None
            self.message = 'Collision! Click Start or Drive to try again.' if self.sim.state.collision else 'Lap complete! Click Start or Drive for another lap.'

    def advance(self, elapsed):
        if elapsed > .3:
            self.pause()
        if not self.running:
            return
        self.accumulator += elapsed
        while self.running and self.accumulator + 1e-9 >= DT:
            self.accumulator -= DT
            self.tick()

    def heartbeat(self, now):
        if now - self.last_input > .8:
            self.pause()
            self.recording = None
            self.message = 'Connection paused. Click Start or Drive to continue.'
            return
        try:
            self.tick()
        except Exception as error:
            self.pause()
            self.recording = None
            self.message = f'Could not continue: {error}'

    def snapshot(self):
        return dict(state=self.sim.snapshot(), running=self.running,
                    recording=self.recording is not None and self.running,
                    mode='AI' if self.model is not None else 'Manual',
                    saved=self.saved, action=self.action, message=self.message,
                    sequence=self.sequence)
