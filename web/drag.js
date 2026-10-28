'use strict';
const D=DragDriving,canvas=document.querySelector('#course'),ctx=canvas.getContext('2d');
const status=document.querySelector('#status'),start=document.querySelector('#start');
const keys=new Set(),clock=new D.Clock();
function makeId(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
let recording=new D.Recording(makeId()),episode=makeId(),recordingActive=false;
function updateRecording(){
  document.querySelector('#recording-state').textContent=`${recordingActive?'Recording':'Not recording'} · ${recording.rows.length} examples in this tab`;
  const c=recording.counts;
  document.querySelector('#label-counts').textContent=`Left ${c.left} · Straight ${c.straight} · Right ${c.right} | Accelerate ${c.accelerate} · Brake ${c.brake}`;
}
let loadedModel=null,modelName='',aiRun=null,mode='manual';
let selectedCourse=D.PRACTICE_COURSES[0];
let sim=new D.Simulation(selectedCourse),previous={...sim.state},running=false,lastReadout=0;
function pause(message){
  if(aiRun)aiRun.pause();
  running=false;recordingActive=false;keys.clear();clock.reset();previous={...sim.state};updateRecording();
  if(message)status.textContent=message;
  start.textContent=sim.state.collision||sim.state.finished?'New run':'Resume run';
}
function reset(){pause();aiRun=null;mode='manual';document.querySelector('#ai-readout').textContent='Manual mode';episode=makeId();sim=new D.Simulation(selectedCourse);previous={...sim.state};start.textContent='Start run';
  status.textContent='Ready. Start the run, then hold ↑ or W to accelerate.';}
const layout=document.querySelector('#practice-layout');
function showLayout(){
  document.querySelector('#layout-tip').textContent=selectedCourse.tip;
  document.querySelector('#course-name').textContent=`${selectedCourse.name} · ${selectedCourse.obstacles.length} obstacles`;
}
const seedInput=document.querySelector('#practice-seed');
function chooseCourse(course){
  selectedCourse=course;reset();showLayout();
  status.textContent=`${course.name} ready. Previous examples kept. Click Record drive to collect on this layout.`;
}
layout.onchange=()=>{
  try{
    const course=layout.value==='random'?D.randomPracticeCourse(Number(seedInput.value)):
      D.PRACTICE_COURSES.find(c=>c.id===layout.value);
    if(course)chooseCourse(course);
  }catch(error){layout.value=selectedCourse.seed?'random':selectedCourse.id;status.textContent=error.message;}
};
document.querySelector('#build-practice').onclick=()=>{
  try{const course=D.randomPracticeCourse(Number(seedInput.value));layout.value='random';chooseCourse(course);}
  catch(error){status.textContent=error.message;}
};
document.querySelector('#new-practice').onclick=()=>{
  const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
  let seed=1+bytes[0]%999999;if(seed===selectedCourse.seed)seed=seed%999999+1;
  seedInput.value=seed;layout.value='random';chooseCourse(D.randomPracticeCourse(seed));
};
showLayout();
function begin(collect){
  if(mode==='ai')reset();
  if(sim.state.collision||sim.state.finished)reset();
  keys.clear();clock.reset();running=true;recordingActive=collect;start.textContent='Running';
  status.textContent=collect?'Recording sensors, speed, steering and throttle. Hold ↑ or W to accelerate.':'Practice active — not recording. Accelerate gently; brake before tight turns.';
  canvas.focus();updateRecording();
}
const modelPicker=document.querySelector('#practice-model');
modelPicker.onchange=async()=>{
  pause('Loading model…');const file=modelPicker.files[0];if(!file)return;
  try{
    if(file.size>10000000)throw new Error('Model file must be smaller than 10 MB.');
    const model=DragModel.loadModel(JSON.parse(await file.text()));
    loadedModel=model;modelName=file.name;reset();
    document.querySelector('#model-name').textContent=`Loaded: ${modelName}`;
    document.querySelector('#ai-drive').disabled=false;status.textContent='Model ready. Click AI Drive to test this layout.';
  }catch(error){status.textContent=error.message+' Previous model kept, if any.';}
  modelPicker.value='';
};
document.querySelector('#ai-drive').onclick=()=>{
  if(!loadedModel){status.textContent='Choose a drag-model JSON first.';return;}
  if(mode!=='ai'||!aiRun||['Finished','Collision','Timed out','Model error'].includes(aiRun.drivers[0].status)){
    reset();mode='ai';aiRun=new DragRace.Race(selectedCourse,{minimumDrivers:1,
      antiStall:document.querySelector('#practice-assist').checked});
    const driver=aiRun.addDriver('Practice driver');aiRun.attachModel(driver.id,loadedModel,modelName);
    sim=driver.sim;previous={...sim.state};
  }
  try{aiRun.start();keys.clear();clock.reset();recordingActive=false;running=true;
    status.textContent='AI driving — no examples recorded. Pause then AI Drive to resume.';
    canvas.focus();updateRecording();
  }catch(error){pause(error.message);}
};
document.querySelector('#practice-assist').onchange=()=>{
  if(mode==='ai'){reset();status.textContent='Assist setting changed. Click AI Drive for a fresh run.';}
};
start.onclick=()=>begin(false);
document.querySelector('#record').onclick=()=>begin(true);
document.querySelector('#download').onclick=()=>{
  pause();
  if(!recording.rows.length){status.textContent='No examples yet. Click Record drive and drive first.';return;}
  const url=URL.createObjectURL(new Blob([recording.csv()],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`drag-drive-${makeId()}.csv`;
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='CSV download started. Keep it separate from the original track CSVs. Clear examples before recording a separate dataset.';
};
document.querySelector('#clear').onclick=()=>{
  pause();if(recording.rows.length&&!confirm('Clear all examples in this tab? Download first to keep them.'))return;
  recording=new D.Recording(makeId());updateRecording();status.textContent='Examples cleared. Downloaded files are unchanged.';
};
window.addEventListener('beforeunload',e=>{if(recording.rows.length){e.preventDefault();e.returnValue='';}});
document.querySelector('#pause').onclick=()=>pause('Paused. Resume when you are ready.');
document.querySelector('#reset').onclick=reset;
canvas.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(key)){
    e.preventDefault();if(key===' '){pause('Paused. Resume when you are ready.');return;}
    if(running&&mode==='manual')keys.add(key);
  }
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
function lostFocus(){if(running)pause(mode==='ai'?'AI paused because the track lost focus. Click AI Drive to resume.':'Paused because the track lost focus. Click Record drive to resume recording, or Resume run for practice.');else keys.clear();}
canvas.addEventListener('blur',lostFocus);window.addEventListener('blur',lostFocus);
window.addEventListener('pagehide',lostFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden)lostFocus();});
function tick(){
  if(mode==='ai'){
    previous={...sim.state};const active=aiRun.tick(),d=aiRun.drivers[0];
    if(!active){pause(`AI run ended: ${d.status}${d.error?' — '+d.error:''}. Click AI Drive for a new run.`);return false;}
    return true;
  }
  const input=D.inputFromKeys(keys);
  if(recordingActive){
    try{recording.append(sim,input,episode);}catch(error){pause(error.message);return false;}
  }
  previous={...sim.state};sim.step(input);
  if(sim.state.collision){pause(`Run ended: hit ${sim.state.collision}. Click New run to try again.`);return false;}
  if(sim.state.finished){pause(`Finish! Completed in ${sim.elapsed.toFixed(1)} simulated seconds.`);return false;}
  return true;
}
function drawCar(s,y){
  ctx.save();ctx.translate(s.x,y);ctx.rotate(s.heading);
  ctx.fillStyle='#172b28';for(const x of [-14,10])for(const z of [-13,7])ctx.fillRect(x,z,4,9);
  ctx.fillStyle=sim.state.collision?'#ce6747':'#75d8e5';ctx.strokeStyle='#173d43';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.roundRect(-11,-19,22,38,5);ctx.fill();ctx.stroke();
  ctx.fillStyle='#254c57';ctx.fillRect(-8,-10,16,8);ctx.fillRect(-7,8,14,5);
  ctx.fillStyle='#fff1b1';ctx.fillRect(-9,-18,5,3);ctx.fillRect(4,-18,5,3);
  ctx.fillStyle=keys.has('arrowdown')||keys.has('s')?'#ff5a3c':'#8e3d33';
  ctx.fillRect(-9,16,5,3);ctx.fillRect(4,16,5,3);ctx.restore();
}
function draw(s){
  const c=sim.course,screenY=y=>480-(y-s.y);
  ctx.fillStyle='#d5dfc9';ctx.fillRect(0,0,900,600);
  ctx.fillStyle='#333f3e';ctx.fillRect(c.left,0,c.right-c.left,600);
  // Road boundaries are world geometry; stripes and camera do not change physics.
  for(const x of [c.left,c.right]){
    ctx.fillStyle='#f0ebd9';ctx.fillRect(x-3,0,6,600);
    for(let y=Math.floor((s.y-180)/40)*40;y<s.y+520;y+=40){
      ctx.fillStyle='#b45d43';ctx.fillRect(x-3,screenY(y)-20,6,20);
    }
  }
  ctx.strokeStyle='#63716c';ctx.lineWidth=2;ctx.setLineDash([14,20]);
  ctx.lineDashOffset=s.y%34;ctx.beginPath();ctx.moveTo(450,0);ctx.lineTo(450,600);ctx.stroke();ctx.setLineDash([]);
  ctx.font='12px system-ui';ctx.textAlign='right';ctx.fillStyle='#53684d';
  for(let y=Math.ceil((s.y-130)/200)*200;y<s.y+500;y+=200){
    if(y<0||y>c.finish)continue;
    const sy=screenY(y);ctx.fillText(`${y} u`,c.left-22,sy+4);
    ctx.strokeStyle='#93a789';ctx.beginPath();ctx.moveTo(c.left-14,sy);ctx.lineTo(c.left-5,sy);ctx.stroke();
  }
  ctx.textAlign='left';
  const finish=screenY(c.finish),begin=screenY(c.start);
  if(begin>=-30&&begin<=630){ctx.fillStyle='#c3d4b4';ctx.fillRect(c.left,begin,440,3);ctx.fillStyle='#48614c';ctx.font='bold 13px system-ui';ctx.fillText('START',c.right+18,begin+4);}
  if(finish>=-30&&finish<=630){
    for(let row=0;row<2;row++)for(let col=0;col<22;col++){
      ctx.fillStyle=(row+col)%2?'#263635':'#fff4d9';ctx.fillRect(c.left+col*20,finish+row*12,20,12);
    }
    ctx.fillStyle='#274c3c';ctx.font='bold 14px system-ui';ctx.fillText('FINISH',c.right+18,finish+17);
  }
  for(const o of c.obstacles){
    const y=screenY(o.y+o.height);if(y>620||y+o.height<0)continue;
    ctx.fillStyle='#222e2b';ctx.fillRect(o.x+4,y+5,o.width,o.height);
    ctx.fillStyle='#cc8051';ctx.fillRect(o.x,y,o.width,o.height);
    ctx.strokeStyle='#f7c982';ctx.lineWidth=3;ctx.strokeRect(o.x+2,y+2,o.width-4,o.height-4);
    ctx.save();ctx.beginPath();ctx.rect(o.x+4,y+4,o.width-8,o.height-8);ctx.clip();ctx.strokeStyle='#72472e';ctx.lineWidth=10;
    for(let x=o.x-o.height;x<o.x+o.width;x+=30){ctx.beginPath();ctx.moveTo(x,y+o.height);ctx.lineTo(x+o.height,y);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#fff6e3';ctx.font='bold 12px system-ui';ctx.fillText(String(o.id),o.x+10,y+19);
  }
  if(document.querySelector('#rays').checked){
    const values=D.sensors(s,c);
    values.forEach((v,i)=>{
      const a=s.heading+D.SENSOR_ANGLES[i]*Math.PI/180;
      const x=s.x+Math.sin(a)*v*D.PHYSICS.sensorRange,y=screenY(s.y+Math.cos(a)*v*D.PHYSICS.sensorRange);
      ctx.strokeStyle='#e4de7a';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(s.x,480);ctx.lineTo(x,y);ctx.stroke();
      ctx.fillStyle='#f9e796';ctx.beginPath();ctx.arc(x,y,2.5,0,2*Math.PI);ctx.fill();
    });
  }
  drawCar(s,480);
  // Whole-course overview makes the long world readable without shrinking the car.
  const mx=782,my=80,mh=370;
  ctx.fillStyle='#edf2e4';ctx.beginPath();ctx.roundRect(mx-34,my-39,90,mh+78,10);ctx.fill();
  ctx.fillStyle='#48614c';ctx.font='bold 11px system-ui';ctx.fillText('COURSE',mx-16,my-16);
  ctx.fillStyle='#95a58d';ctx.fillRect(mx,my,10,mh);
  for(const o of c.obstacles){const y=my+mh-(o.y-c.start)/(c.finish-c.start)*mh;ctx.fillStyle='#9e633e';ctx.fillRect(mx-4,y,18,3);}
  ctx.fillStyle='#236c53';ctx.beginPath();ctx.arc(mx+5,my+mh-sim.progress/100*mh,7,0,Math.PI*2);ctx.fill();
  ctx.font='10px system-ui';ctx.fillText('FINISH',mx-12,my-4);ctx.fillText('START',mx-10,my+mh+20);
}
function frame(now){
  let alpha=1;
  if(running){const result=clock.advance(now,tick);alpha=result.alpha;
    if(result.stalled)pause('Paused after a slow frame. Resume to continue safely.');}
  const s=sim.state;if(!running)alpha=1;
  draw({...s,x:previous.x+(s.x-previous.x)*alpha,y:previous.y+(s.y-previous.y)*alpha,
    heading:previous.heading+(s.heading-previous.heading)*alpha});
  if(now-lastReadout>100){
    document.querySelector('#speed').textContent=s.speed.toFixed(0);
    document.querySelector('#progress').textContent=`${sim.state.finished?100:Math.floor(sim.progress)}%`;
    document.querySelector('#elapsed').textContent=`${sim.elapsed.toFixed(1)} s`;
    const values=D.sensors(s,sim.course);
    document.querySelector('#sensor-values').textContent=['Left','Front-left','Front','Front-right','Right'].map((name,i)=>`${name}: ${values[i].toFixed(2)}`).join(' · ');
    if(mode==='ai'&&aiRun){const d=aiRun.drivers[0];
      document.querySelector('#ai-readout').textContent=`AI · ${d.status} · ${s.speed.toFixed(1)} units/s`+
        (d.action?` · Prediction: ${d.action.steering} / ${d.action.throttle}`:'')+
        (d.assistActive?' · ASSIST: accelerating':d.stoppedSteps&&aiRun.antiStall&&d.status==='Racing'?` · Restart in ${Math.max(0,(DragRace.STALL_STEPS-d.stoppedSteps)*D.DT).toFixed(1)} s`:'')+
        ` · Restarts: ${d.assistCount}`;
    }
    updateRecording();lastReadout=now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

updateRecording();
