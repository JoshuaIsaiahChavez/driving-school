'use strict';
const D = Driving, canvas = document.querySelector('#track'), ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const trackSelect = document.querySelector('#track-select');

// crypto.randomUUID() requires HTTPS; use getRandomValues() so Live Server (http) works too.
function makeId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Populate track dropdown ───────────────────────────────────────────────
D.TRACKS.forEach((t, i) => {
  const opt = document.createElement('option');
  opt.value = i; opt.textContent = t.label;
  trackSelect.appendChild(opt);
});

function currentTrack() { return D.TRACKS[+trackSelect.value] || D.TRACKS[0]; }

let sim = new D.Simulation(currentTrack()), previous = { ...sim.state };
let running = false, recording = false, mode = 'Manual';
let model = null, rows = [], episode = makeId(), keys = new Set(), action = 'straight', accumulator = 0, last = null;

function message(text) { status.textContent = text; }
function pause() { running = false; recording = false; keys.clear(); accumulator = 0; previous = { ...sim.state }; }
function reset() {
  pause();
  sim = new D.Simulation(currentTrack());
  previous = { ...sim.state }; episode = makeId(); action = 'straight';
}
function command(name) {
  pause();
  if (name === 'Reset') { reset(); message('New episode. Your recorded examples are kept.'); return; }
  if (name === 'Pause') { message('Paused. Download your examples before closing this page.'); return; }
  if (name === 'AI' && !model) { message('Load model.json first. Train it using python train.py.'); return; }
  if (sim.state.collision || sim.state.lap || name === 'AI') reset();
  mode = name === 'AI' ? 'AI' : 'Manual'; recording = name === 'Drive'; running = true;
  message(recording ? 'Recording your steering.' : 'AI' === mode ? 'The decision tree is driving.' : 'Practice — not recording.');
  canvas.focus();
}
document.querySelectorAll('[data-command]').forEach(b => b.onclick = () => command(b.dataset.command));
// Switching tracks always pauses and starts a new episode, preserving examples.
trackSelect.addEventListener('change', () => {
  reset();
  message(`Track changed to "${sim.track.label}". Your recorded examples are kept.`);
});
canvas.addEventListener('keydown', e => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' '].includes(e.key)) {
    e.preventDefault(); if (e.key === ' ') { command('Pause'); return; } keys.add(e.key.toLowerCase());
  }
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', pause); window.addEventListener('pagehide', pause); canvas.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('beforeunload', e => { if (rows.length) { e.preventDefault(); e.returnValue = ''; } });
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelector('#download').onclick = () => {
  pause(); if (!rows.length) { message('No examples yet. Click Drive and steer first.'); return; }
  download(`drive-${makeId()}.csv`, [D.COLUMNS.join(','), ...rows.map(r => r.join(','))].join('\n') + '\n', 'text/csv');
  message('CSV downloaded. Upload it to runtime/recordings/ in VS Code, then run train.py.');
};
document.querySelector('#clear').onclick = () => {
  pause(); if (rows.length && !confirm('Clear the examples in this tab? Download them first to keep a copy.')) return;
  rows = []; message('Examples cleared. Existing downloaded files are unchanged.');
};
document.querySelector('#model').onchange = async e => {
  pause(); model = null;
  try {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5000000) throw new Error('Model file is too large.');
    model = D.validateModel(JSON.parse(await file.text())); message('Model loaded. Click AI Drive.');
  } catch (error) { message(error.message); } finally { e.target.value = ''; }
};
function tick() {
  const left = keys.has('arrowleft') || keys.has('a'), right = keys.has('arrowright') || keys.has('d');
  action = mode === 'AI' ? D.predict(model, D.sensors(sim.state, sim.track)) : left === right ? 'straight' : left ? 'left' : 'right';
  if (recording) {
    if (rows.length >= 50000) { pause(); message('Recording limit reached. Download and clear your examples.'); return; }
    rows.push(sim.example(action, episode)); // Observe and label BEFORE advancing.
  }
  previous = { ...sim.state }; sim.step(action);
  if (sim.state.collision || sim.state.lap) {
    pause();
    message(sim.state.lap ? 'Lap complete! Reset or drive another episode.' : 'Collision. Click Drive or Start for a new episode.');
  }
}
function draw(s) {
  ctx.clearRect(0, 0, 900, 600);
  sim.track.render(ctx);
  const gates = sim.track.gates;
  gates.forEach((g, i) => {
    ctx.beginPath();
    ctx.arc(g.x, g.y, i === (sim.state.gates_passed + 1) % gates.length ? 5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = '#eebd68'; ctx.fill();
  });
  D.sensors(s, sim.track).forEach((v, i) => {
    const h = s.heading + D.ANGLES[i] * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(h) * v * 180, s.y + Math.sin(h) * v * 180);
    ctx.strokeStyle = '#ffd05b'; ctx.lineWidth = 2; ctx.stroke();
  });
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.heading);
  ctx.fillStyle = '#172923'; for (const x of [-7, 4]) for (const y of [-7, 4]) ctx.fillRect(x, y, 5, 3);
  ctx.fillStyle = sim.state.collision ? '#ed7053' : '#5ac4eb'; ctx.fillRect(-9, -5, 18, 10);
  ctx.fillStyle = '#1b4055'; ctx.fillRect(1, -4, 4, 8); ctx.fillStyle = '#fff5c9'; ctx.fillRect(7, -4, 2, 2); ctx.fillRect(7, 2, 2, 2); ctx.restore();
}
function frame(now) {
  const elapsed = last === null ? 0 : (now - last) / 1000; last = now;
  if (running && elapsed > .25) { pause(); message('Paused after a slow or hidden frame. Click Start or Drive to resume.'); }
  if (running) { accumulator += elapsed; while (running && accumulator >= D.DT) { accumulator -= D.DT; tick(); } }
  const s = sim.state, a = running ? accumulator / D.DT : 1;
  draw({ ...s, x: previous.x + (s.x - previous.x) * a, y: previous.y + (s.y - previous.y) * a, heading: previous.heading + (s.heading - previous.heading) * a });
  document.querySelector('#details').textContent = `${running ? recording ? 'Recording' : mode === 'AI' ? 'AI driving' : 'Practice' : 'Paused'} · ${rows.length} examples in this tab · ${sim.progress.toFixed(0)}% of lap · ${(s.steps * D.DT).toFixed(1)} s · ${action}`;
  const sensorValues = D.sensors(s, sim.track);
  document.querySelector('#sensors').textContent = D.FEATURES.map((f, i) => `${f}: ${sensorValues[i].toFixed(2)}`).join(' · ');
  requestAnimationFrame(frame);
}
message('Ready. Start to practice, or Drive to record.'); requestAnimationFrame(frame);
