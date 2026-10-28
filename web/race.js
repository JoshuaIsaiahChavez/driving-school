'use strict';
const D=DragDriving,R=DragRace,canvas=document.querySelector('#race-course'),ctx=canvas.getContext('2d');
const race=new R.Race(),clock=new D.Clock(),status=document.querySelector('#race-status');
const palette=['#37aec0','#cf7641','#8758bc','#38855d','#b34668','#9d8428','#5265b0','#7c6661'];
const cards=new Map();let lastReadout=0;
function addDriver(){
  const d=race.addDriver(`Driver ${race.drivers.length+1}`),color=palette[d.id-1];
  const card=document.createElement('section');card.className='driver-card';card.style.setProperty('--driver-color',color);
  const heading=document.createElement('div');heading.className='driver-heading';
  const badge=document.createElement('span');badge.className='driver-number';badge.textContent=d.id;
  const name=document.createElement('strong');name.textContent=d.name;heading.append(badge,name);
  const slot=document.createElement('div');slot.className='model-slot';slot.textContent='Student model: empty — choose a JSON file';
  const result=document.createElement('div');result.className='driver-result';
  const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';
  picker.setAttribute('aria-label',`Load model for ${d.name}`);
  const label=document.createElement('label');label.textContent='Load student model (.json)';label.append(picker);
  picker.onchange=async()=>{
    const file=picker.files[0];if(!file)return;
    try{
      if(file.size>10000000)throw new Error('Model file must be smaller than 10 MB.');
      const model=DragModel.loadModel(JSON.parse(await file.text()));
      race.attachModel(d.id,model,file.name);
      status.textContent=`${d.name}: loaded ${file.name}. ${race.ready?'Ready to race.':'Load the other driver models.'}`;
    }catch(error){status.textContent=`${d.name}: ${error.message} Previous model kept, if any.`;}
    picker.value='';update();
  };
  card.append(heading,label,slot,result);document.querySelector('#drivers').append(card);cards.set(d.id,{slot,result,picker});
  update();
}
function update(){
  for(const d of race.drivers){const elements=cards.get(d.id);elements.picker.disabled=race.running||race.steps>0;
    elements.slot.textContent=d.model?`Model: ${d.modelName}`:'Student model: empty — choose a JSON file';
    elements.result.textContent=`${d.status} · ${d.sim.state.finished?100:Math.floor(d.sim.progress)}% · ${d.sim.state.speed.toFixed(1)} units/s · ${d.sim.elapsed.toFixed(1)} s${d.action?' · Prediction: '+d.action.steering+' / '+d.action.throttle:''}${d.stoppedSteps&&d.status==='Racing'?(race.antiStall?' · Restart in '+Math.max(0,(R.STALL_STEPS-d.stoppedSteps)*D.DT).toFixed(1)+' s':' · Near stop; assist off'):''}${d.assistActive?' · ASSIST: throttle overridden to accelerate':''} · Restarts: ${d.assistCount}${d.error?' · '+d.error:''}`;
  }
  document.querySelector('#anti-stall').disabled=race.running||race.steps>0;
  document.querySelector('#start-race').disabled=!race.ready||race.running;
  document.querySelector('#pause-race').disabled=!race.running;
  document.querySelector('#add-driver').disabled=race.running||race.steps>0||race.drivers.length>=8;
  document.querySelector('#course-button').disabled=race.running;
  document.querySelector('#race-time').textContent=`${race.elapsed.toFixed(1)} s`;
}
function pause(message){race.pause();clock.reset();if(message)status.textContent=message;update();}
document.querySelector('#anti-stall').onchange=event=>{if(!race.running&&!race.steps)race.antiStall=event.target.checked;};
document.querySelector('#start-race').onclick=()=>{
  try{race.start();clock.reset();status.textContent='Race running. Every model controls only its own car.';update();}
  catch(error){status.textContent=error.message;}
};
document.querySelector('#pause-race').onclick=()=>pause('Race paused. Resume to continue.');
document.querySelector('#reset-race').onclick=()=>{race.reset();clock.reset();status.textContent=race.ready?'Ready at the start.':'Waiting for student models. All cars are back at the start.';update();};
document.querySelector('#course-button').onclick=()=>{
  try{const course=R.makeCourse(Number(document.querySelector('#seed').value));race.reset(course);clock.reset();
    status.textContent=`Course ${course.seed} ready. Every driver will face the same 12 obstacles.`;update();
  }catch(error){status.textContent=error.message;}
};
document.querySelector('#add-driver').onclick=()=>{try{addDriver();status.textContent='Driver added with an empty model slot.';}catch(error){status.textContent=error.message;}};
const lostFocus=()=>{if(race.running)pause('Race paused because the page lost focus.');};
window.addEventListener('blur',lostFocus);window.addEventListener('pagehide',lostFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden)lostFocus();});
canvas.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();pause('Race paused.');}});
function draw(alpha){
  const c=race.course,active=race.drivers.filter(d=>d.status==='Racing');
  const camera=Math.max(c.start,...(active.length?active:race.drivers).map(d=>d.previous.y+(d.sim.state.y-d.previous.y)*alpha));
  const screenY=y=>480-(y-camera);
  ctx.fillStyle='#d5dfc9';ctx.fillRect(0,0,900,600);
  ctx.fillStyle='#333f3e';ctx.fillRect(c.left,0,c.right-c.left,600);
  ctx.strokeStyle='#e9e7d4';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(c.left,0);ctx.lineTo(c.left,600);ctx.moveTo(c.right,0);ctx.lineTo(c.right,600);ctx.stroke();
  ctx.setLineDash([14,20]);ctx.lineDashOffset=camera%34;ctx.strokeStyle='#68756d';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(450,0);ctx.lineTo(450,600);ctx.stroke();ctx.setLineDash([]);
  for(const [y,label] of [[c.start,'START'],[c.finish,'FINISH']]){
    const sy=screenY(y);if(sy<0||sy>600)continue;
    for(let i=0;i<22;i++){ctx.fillStyle=i%2?'#253531':'#f9efce';ctx.fillRect(c.left+i*20,sy,20,12);}
    ctx.fillStyle='#365243';ctx.font='bold 12px system-ui';ctx.fillText(label,c.left-65,sy+10);
  }
  for(const o of c.obstacles){const y=screenY(o.y+o.height);if(y+o.height<0||y>600)continue;
    ctx.fillStyle='#cf8252';ctx.fillRect(o.x,y,o.width,o.height);ctx.strokeStyle='#f2c78b';ctx.lineWidth=3;ctx.strokeRect(o.x+2,y+2,o.width-4,o.height-4);
    ctx.save();ctx.beginPath();ctx.rect(o.x+4,y+4,o.width-8,o.height-8);ctx.clip();ctx.strokeStyle='#704c34';ctx.lineWidth=9;
    for(let x=o.x-o.height;x<o.x+o.width;x+=30){ctx.beginPath();ctx.moveTo(x,y+o.height);ctx.lineTo(x+o.height,y);ctx.stroke();}ctx.restore();
    ctx.fillStyle='#fff4df';ctx.font='bold 12px system-ui';ctx.fillText(o.id,o.x+9,y+17);
  }
  // Same physical start: overlapping ghost cars get separate numbered callouts.
  for(const d of race.drivers){
    const s=d.sim.state,x=d.previous.x+(s.x-d.previous.x)*alpha,y=screenY(d.previous.y+(s.y-d.previous.y)*alpha);
    if(y< -30||y>630)continue;
    ctx.save();ctx.translate(x,y);ctx.rotate(d.previous.heading+(s.heading-d.previous.heading)*alpha);
    ctx.globalAlpha=.65;ctx.fillStyle=palette[d.id-1];ctx.fillRect(-11,-19,22,38);
    ctx.globalAlpha=1;ctx.lineWidth=2;ctx.strokeStyle=palette[d.id-1];ctx.strokeRect(-12,-20,24,40);
    ctx.fillStyle='#223d42';ctx.fillRect(-8,-10,16,7);ctx.restore();
    const side=d.id%2?-1:1,lx=x+side*45,ly=y-22+Math.floor((d.id-1)/2)*22;
    ctx.strokeStyle=palette[d.id-1];ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(lx,ly);ctx.stroke();
    ctx.fillStyle='#f3f4e8';ctx.fillRect(side<0?lx-65:lx,ly-12,65,18);
    ctx.fillStyle='#233c33';ctx.font='bold 11px system-ui';ctx.fillText(d.name,side<0?lx-61:lx+4,ly);
  }
  // Full-course overview includes separate columns for overlapping drivers.
  const mx=748,my=80,mh=420,mw=120;
  ctx.fillStyle='#edf2e4';ctx.beginPath();ctx.roundRect(mx-10,my-45,mw+20,mh+90,10);ctx.fill();
  ctx.fillStyle='#456047';ctx.font='bold 12px system-ui';ctx.fillText(`SEED ${c.seed}`,mx,my-24);
  ctx.fillStyle='#8f9d87';ctx.fillRect(mx,my,mw,mh);
  for(const o of c.obstacles){ctx.fillStyle='#b97749';const oy=my+mh-(o.y-c.start)/(c.finish-c.start)*mh;
    ctx.fillRect(mx+(o.x-c.left)/(c.right-c.left)*mw,oy,o.width/(c.right-c.left)*mw,5);}
  for(const d of race.drivers){const x=mx+(d.id-.5)/race.drivers.length*mw,y=my+mh-d.sim.progress/100*mh;
    ctx.fillStyle=palette[d.id-1];ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#122f2b';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(d.id,x,y+3);ctx.textAlign='left';}
  ctx.fillStyle='#456047';ctx.font='10px system-ui';ctx.fillText('FINISH',mx,my-5);ctx.fillText('START',mx,my+mh+25);
  ctx.fillStyle='#365243';ctx.font='12px system-ui';ctx.fillText('Shared track',38,48);ctx.fillText('Independent models',38,68);
}
function frame(now){let alpha=1;
  if(race.running){const result=clock.advance(now,()=>race.tick());alpha=result.alpha;
    if(result.stalled)pause('Race paused after a slow frame.');
    else if(!race.running){pause('Race complete. Results are shown below.');}
  }
  draw(race.running?alpha:1);
  if(now-lastReadout>100){update();lastReadout=now;}
  requestAnimationFrame(frame);
}
addDriver();addDriver();requestAnimationFrame(frame);
