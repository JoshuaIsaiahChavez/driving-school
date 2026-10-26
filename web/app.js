// Python owns physics, sensors, recording and prediction. This file draws and sends keys.
const canvas = document.querySelector('#track');
const ctx = canvas.getContext('2d');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('button')];
let session, track, latest, sequence = 0, renderedSequence = -1;
let keys = new Set(), commands = [], polling = true, errorUntil = 0;
buttons.forEach(button => button.disabled = true);

async function api(path, body) {
  const response = await fetch(path, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Invalid request. Refresh and try again.');
  return result;
}
function showError(message) { status.textContent = message; errorUntil = Date.now()+7000; }
function pause() {
  keys.clear(); commands = [];
  if (!session) return;
  // Higher sequence wins even if an older request reaches Python after this one.
  fetch(`/api/control/${session}`, {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({sequence:++sequence,command:'Pause',keys:[]}),keepalive:true})
    .then(r=>r.ok?r.json():null).then(s=>{if(s)render(s);}).catch(()=>{});
}
buttons.forEach(button => button.onclick = () => {
  const command = button.dataset.command;
  if (command === 'Pause') { pause(); return; }
  keys.clear();
  if (commands.length < 6) commands.push(command);
  if (['Start','Drive','AI'].includes(command)) canvas.focus();
});
canvas.addEventListener('keydown', event => {
  if (['ArrowLeft','ArrowRight','a','A','d','D',' '].includes(event.key)) {
    event.preventDefault();
    if (event.key === ' ') pause();
    else keys.add(event.key.length===1?event.key.toLowerCase():event.key);
  }
});
window.addEventListener('keyup', event => keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
window.addEventListener('blur', pause);
window.addEventListener('pagehide', pause);
canvas.addEventListener('blur', pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

function draw(state) {
  ctx.clearRect(0,0,900,600);
  track.boundaries.forEach((ring,i)=>{
    ctx.beginPath();ring.forEach((p,j)=>j?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
    ctx.fillStyle=i?'#edf2ed':'#58635f';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#243b30';ctx.stroke();
  });
  track.waypoints.forEach((p,i)=>{
    ctx.beginPath();ctx.arc(...p,i===state.next_checkpoint?5:2,0,2*Math.PI);
    ctx.fillStyle=i===state.next_checkpoint?'#ef9e42':'#acb8ae';ctx.fill();
  });
  const [x,y]=track.waypoints[0];
  ctx.strokeStyle='white';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-40,y);ctx.lineTo(x+40,y);ctx.stroke();
  ctx.fillStyle='#203129';ctx.font='bold 14px system-ui';ctx.fillText('START',x+52,y+5);
  state.sensors.forEach((value,i)=>{
    const angle=state.heading+[-70,-35,0,35,70][i]*Math.PI/180;
    ctx.beginPath();ctx.moveTo(state.x,state.y);
    ctx.lineTo(state.x+Math.cos(angle)*value*180,state.y+Math.sin(angle)*value*180);
    ctx.strokeStyle='#ffd05b';ctx.lineWidth=2;ctx.stroke();
  });
  ctx.save();ctx.translate(state.x,state.y);ctx.rotate(state.heading);
  ctx.fillStyle='#172923';for(const x of [-7,4])for(const y of [-7,4])ctx.fillRect(x,y,5,3);
  ctx.fillStyle=state.collision?'#ed7053':'#5ac4eb';ctx.fillRect(-9,-5,18,10);
  ctx.fillStyle='#1b4055';ctx.fillRect(1,-4,4,8);ctx.fillStyle='#fff5c9';ctx.fillRect(7,-4,2,2);ctx.fillRect(7,2,2,2);ctx.restore();
}
function render(result) {
  if (result.sequence < renderedSequence) return;
  renderedSequence=result.sequence;latest=result;
  if(Date.now()>errorUntil)status.textContent=result.message;
  document.querySelector('#details').textContent=`${!result.running?'Paused':result.recording?'Recording':result.mode==='AI'?'AI driving':'Practice'} · ${result.saved} examples saved this tab · ${result.state.progress.toFixed(0)}% of lap · ${result.action}`;
  document.querySelector('#sensors').textContent=['Left','Front-left','Front','Front-right','Right'].map((name,i)=>`${name}: ${result.state.sensors[i].toFixed(2)}`).join(' · ');
  draw(result.state);
}
async function poll() {
  if(!polling)return;
  try {
    const command=commands.shift();
    const result=await api(`/api/control/${session}`,{sequence:++sequence,keys:[...keys],command});
    render(result);
  } catch(error) {
    keys.clear();commands=[];showError(error.message);
    if(error.message.includes('Refresh this page'))polling=false;
  } finally {if(polling)setTimeout(poll,100);}
}
(async()=>{
  try {
    const result=await api('/api/session',{});session=result.id;track=result.track;
    render(result);buttons.forEach(button=>button.disabled=false);poll();
  } catch(error) {showError('Start python driving_school.py and open port 8000. Live Server alone cannot run Python.');}
})();
