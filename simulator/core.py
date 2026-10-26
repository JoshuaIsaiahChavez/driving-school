"""Authoritative fixed-step simulation, shared by the browser server and tests."""
from dataclasses import dataclass
from pathlib import Path
import math
import numpy as np
from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DT = 0.1
SPEED = 48.0
TURN_RATE = 0.9
SENSOR_RANGE = 180.0
ANGLES = (-70, -35, 0, 35, 70)  # screen coordinates: negative is left
FEATURES = ['left', 'front_left', 'front', 'front_right', 'right']
ACTIONS = ('left', 'straight', 'right')
TRACK_ID = 'oval'  # Retained so existing recorded CSVs still load.


class Track:
    def __init__(self, track_id=TRACK_ID):
        if track_id != TRACK_ID:
            raise ValueError('Unknown track ID')
        self.id, self.split, self.name = TRACK_ID, 'train', 'Round track'
        self.width = 90.0
        self.points = np.array([
            [450 + 210*math.cos(i*math.tau/180), 300 + 210*math.sin(i*math.tau/180)]
            for i in range(180)
        ])
        if self.points.ndim != 2 or self.points.shape[1] != 2 or len(self.points) < 12 or not np.isfinite(self.points).all():
            raise ValueError('Track requires at least 12 finite 2D points')
        if not 70 <= self.width <= 120:
            raise ValueError('Track width must be 70–120')
        self.line = LineString([*self.points, self.points[0]])
        if not self.line.is_simple:
            raise ValueError('Self-intersecting centerline')
        self.road = self.line.buffer(self.width / 2, join_style=1)
        if self.road.geom_type != 'Polygon' or len(self.road.interiors) != 1 or not self.road.is_valid:
            raise ValueError('Track must form a simple loop with an infield')
        # Cross-sections every ~35 units; dense gates make shortcuts unhelpful.
        self.length = self.line.length
        self.gates = []
        count = max(24, math.ceil(self.length / 35))
        for i in range(count):
            s = self.length * i / count
            p = np.array(self.line.interpolate(s).coords[0])
            a = np.array(self.line.interpolate((s - 2) % self.length).coords[0])
            b = np.array(self.line.interpolate((s + 2) % self.length).coords[0])
            tangent = (b - a) / np.linalg.norm(b - a)
            self.gates.append((p, tangent))
            normal = np.array([-tangent[1], tangent[0]])
            # Entire lane cross-section must stay on the road.
            if not all(self.road.covers(Point(p + normal * d)) for d in (-self.width*.42, self.width*.42)):
                raise ValueError('Insufficient checkpoint clearance')
        rings = [self.road.exterior, *self.road.interiors]
        self.boundaries = [list(map(list, r.coords)) for r in rings]
        starts, ends = [], []
        for ring in self.boundaries:
            starts.extend(ring[:-1]); ends.extend(ring[1:])
        self.seg_a = np.asarray(starts)
        self.seg_v = np.asarray(ends) - self.seg_a
        for offset, heading in ((0, 0), (-8, -.06), (8, .06)):
            car = Simulation(self, offset, heading)
            if car.collides():
                raise ValueError('Illegal prescribed start')



@dataclass
class State:
    x: float
    y: float
    heading: float
    steps: int = 0
    gates_passed: int = 0
    collision: bool = False
    lap: bool = False


class Simulation:
    def __init__(self, track, offset=0.0, heading_offset=0.0):
        self.track = track
        p, t = track.gates[0]
        p = p + np.array([-t[1], t[0]]) * offset
        self.state = State(float(p[0]), float(p[1]), math.atan2(t[1], t[0]) + heading_offset)

    def footprint(self):
        s = self.state
        c, n = np.array([math.cos(s.heading), math.sin(s.heading)]), np.array([-math.sin(s.heading), math.cos(s.heading)])
        return Polygon([np.array([s.x, s.y]) + c*a + n*b for a, b in ((9,5),(9,-5),(-9,-5),(-9,5))])

    def collides(self):
        return not self.track.road.covers(self.footprint())

    def sensors(self):
        s = self.state
        origin = np.array([s.x, s.y])
        q = self.track.seg_a - origin
        v = self.track.seg_v
        values = []
        for angle in ANGLES:
            h = s.heading + math.radians(angle)
            d = np.array([math.cos(h), math.sin(h)])
            den = d[0]*v[:,1] - d[1]*v[:,0]
            safe = np.where(abs(den) > 1e-10, den, np.nan)
            distance = (q[:,0]*v[:,1] - q[:,1]*v[:,0]) / safe
            along = (q[:,0]*d[1] - q[:,1]*d[0]) / safe
            valid = (distance >= 0) & (along >= 0) & (along <= 1)
            values.append(float(min(SENSOR_RANGE, np.min(distance[valid], initial=SENSOR_RANGE)) / SENSOR_RANGE))
        return values

    @property
    def progress(self):
        return min(100.0, 100.0 * self.state.gates_passed / len(self.track.gates))

    def step(self, action):
        if action not in ACTIONS:
            raise ValueError('Steering must be left, straight, or right')
        s = self.state
        if s.collision or s.lap:
            return
        previous = np.array([s.x, s.y])
        turn = {'left': -1, 'straight': 0, 'right': 1}[action]
        # Four swept substeps prevent tunneling; sensors/labels still sampled once per control step.
        for _ in range(4):
            s.heading += turn * TURN_RATE * DT / 4
            s.x += math.cos(s.heading) * SPEED * DT / 4
            s.y += math.sin(s.heading) * SPEED * DT / 4
            if self.collides():
                s.collision = True
                break
        s.steps += 1
        if s.collision:
            return
        current = np.array([s.x, s.y])
        index = (s.gates_passed + 1) % len(self.track.gates)
        center, tangent = self.track.gates[index]
        before, after = np.dot(previous-center, tangent), np.dot(current-center, tangent)
        if before < 0 <= after and np.dot(current-previous, tangent) > 0:
            cross = previous + (current-previous) * (-before / (after-before))
            if np.linalg.norm(cross-center) <= self.track.width / 2:
                s.gates_passed += 1
                s.lap = s.gates_passed == len(self.track.gates)

    def snapshot(self):
        s = self.state
        return dict(x=s.x, y=s.y, heading=s.heading, steps=s.steps, elapsed=round(s.steps*DT, 1),
                    collision=s.collision, lap=s.lap, progress=round(self.progress, 2),
                    next_checkpoint=(s.gates_passed+1) % len(self.track.gates), sensors=self.sensors())
