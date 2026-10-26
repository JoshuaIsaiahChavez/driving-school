"""Run the classroom server: python driving_school.py, then open port 8000."""
import asyncio
from contextlib import asynccontextmanager
import time
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from simulator.core import ROOT, DT
from simulator.game import Game

sessions = {}


async def simulation_clock():
    deadline = time.monotonic() + DT
    while True:
        await asyncio.sleep(max(0, deadline-time.monotonic()))
        now = time.monotonic()
        stalled = now-deadline > .3
        for ident, game in list(sessions.items()):
            if now-game.last_input > 1800:
                del sessions[ident]
            elif stalled:
                game.pause()
            else:
                game.heartbeat(now)
        # Never replay a backlog of old control steps after a server stall.
        deadline = (now if stalled else deadline) + DT


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(simulation_clock())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    sessions.clear()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(ValueError)
@app.exception_handler(OSError)
async def readable_error(request, error):
    return JSONResponse(status_code=400, content={'detail': str(error)})


@app.get('/api/health')
def health():
    return {'status': 'ok'}


@app.post('/api/session')
async def new_session():
    if len(sessions) >= 20:
        raise HTTPException(429, 'Too many open tabs. Close unused tabs and restart the server.')
    ident = uuid.uuid4().hex
    game = Game()
    sessions[ident] = game
    return dict(id=ident, **game.snapshot(), track=dict(
        boundaries=game.track.boundaries,
        waypoints=[p.tolist() for p, _ in game.track.gates]))


class Control(BaseModel):
    sequence: int = Field(ge=0)
    keys: list[str] = Field(default_factory=list, max_length=4)
    command: str | None = None


@app.post('/api/control/{ident}')
async def control(ident: str, request: Control):
    if ident not in sessions:
        raise HTTPException(404, 'Server restarted or session expired. Refresh this page; saved data is safe.')
    game = sessions[ident]
    if request.sequence <= game.sequence:
        return game.snapshot()
    if not set(request.keys) <= {'ArrowLeft', 'ArrowRight', 'a', 'd'}:
        raise ValueError('Invalid steering key')
    game.sequence = request.sequence
    game.last_input = time.monotonic()
    game.keys = set(request.keys)
    if request.command:
        game.command(request.command)
    return game.snapshot()


# Only serve frontend files, never recordings, model artifacts or instructor notes.
app.mount('/', StaticFiles(directory=ROOT/'web', html=True), name='site')


if __name__ == '__main__':
    import uvicorn
    print('Open http://localhost:8000 or the forwarded port 8000 in Codespaces.')
    uvicorn.run(app, host='0.0.0.0', port=8000)
