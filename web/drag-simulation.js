// Browser-only obstacle-course physics. Also imported by Node tests.
(function (root) {
  'use strict';
  const DT = 1 / 60;
  const PHYSICS = Object.freeze({maxSpeed:180, acceleration:75, braking:150,
    carWidth:22, carLength:38, sensorRange:300});
  const SENSOR_ANGLES = [-70, -35, 0, 35, 70];
  const COURSE = Object.freeze({id:'drag-practice-2', name:'Wide slalom', tip:'Practice clear left/right steering through generous gaps.',
    left:230, right:670, start:100, finish:2700,
    obstacles:Object.freeze([
      {x:230,y:420,width:280,height:54},
      {x:390,y:730,width:280,height:54},
      {x:230,y:1040,width:280,height:54},
      {x:390,y:1350,width:280,height:54},
      {x:230,y:1660,width:280,height:54},
      {x:390,y:1970,width:280,height:54},
      {x:230,y:2280,width:280,height:54},
    ].map((o,i)=>Object.freeze({...o,id:i+1}))) });
  function practiceCourse(id,name,tip,positions,widths,sides){
    return Object.freeze({id,name,tip,left:230,right:670,start:100,finish:positions.at(-1)+420,
      obstacles:Object.freeze(positions.map((y,i)=>Object.freeze({id:i+1,y,height:54,
        width:widths[i],x:sides[i]==='left'?230:670-widths[i]})))});
  }
  const PRACTICE_COURSES=Object.freeze([
    COURSE,
    practiceCourse('drag-practice-tight-1','Tighter slalom',
      'Try braking before each turn, then accelerating after clearing the barrier.',
      [420,680,940,1200,1460,1720,1980],[300,300,300,300,300,300,300],
      ['left','right','left','right','left','right','left']),
    practiceCourse('drag-practice-mixed-1','Mixed spacing',
      'Vary your speed. Practice safe stops and restarts near different obstacle approaches.',
      [420,800,1060,1500,1770,2130,2400],[260,300,280,250,300,270,290],
      ['right','left','left','right','left','right','right'])
  ]);
  function raceCourse(seed=42){
    if(!Number.isInteger(seed)||seed<1||seed>999999)throw new Error('Choose a seed from 1 to 999999.');
    let state=seed;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const obstacles=Array.from({length:12},(_,i)=>{
      const width=150+Math.floor(random()*41),position=Math.floor(random()*3);
      const x=position===0?230:position===1?450-width/2:670-width;
      return Object.freeze({id:i+1,x,y:420+i*340,width,height:54});
    });
    return Object.freeze({id:`drag-race-${seed}`,name:'Final obstacle straight',seed,
      left:230,right:670,start:100,finish:4600,obstacles:Object.freeze(obstacles)});
  }
  // Same geometry as racing, with a separate versioned training identity.
  function randomPracticeCourse(seed){
    const course=raceCourse(seed);
    return Object.freeze({...course,id:`drag-practice-random-v2-${seed}`,
      name:`Random practice · seed ${seed}`,
      tip:'Same seed = same course on the race page. Practice braking and restarts; reserve other seeds for testing.'});
  }
  const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
  function inputFromKeys(keys) {
    const left=keys.has('arrowleft')||keys.has('a');
    const right=keys.has('arrowright')||keys.has('d');
    const accelerate=keys.has('arrowup')||keys.has('w');
    const brake=keys.has('arrowdown')||keys.has('s');
    return {steering:left===right?'straight':left?'left':'right',
      throttle:brake?'brake':accelerate?'accelerate':'brake'};
  }
  // Heading 0 points forward (+world Y), negative headings turn left.
  function footprint(s) {
    const sn=Math.sin(s.heading),cs=Math.cos(s.heading);
    return [[-11,-19],[11,-19],[11,19],[-11,19]].map(([side,forward])=>
      [s.x+cs*side+sn*forward,s.y-sn*side+cs*forward]);
  }
  function overlapsObstacle(s,o) {
    // Separating-axis test: exact oriented car rectangle against an axis-aligned box.
    const car=footprint(s),box=[[o.x,o.y],[o.x+o.width,o.y],
      [o.x+o.width,o.y+o.height],[o.x,o.y+o.height]];
    const axes=[[1,0],[0,1],[Math.cos(s.heading),-Math.sin(s.heading)],
      [Math.sin(s.heading),Math.cos(s.heading)]];
    return axes.every(([ax,ay])=>{
      const a=car.map(([x,y])=>ax*x+ay*y),b=box.map(([x,y])=>ax*x+ay*y);
      return Math.max(...a)>=Math.min(...b)&&Math.max(...b)>=Math.min(...a);
    });
  }
  function collision(s,course=COURSE) {
    if(footprint(s).some(([x,y])=>x<=course.left||x>=course.right||y<=0))return 'wall';
    const obstacle=course.obstacles.find(o=>overlapsObstacle(s,o));
    return obstacle?`obstacle ${obstacle.id}`:null;
  }
  function rayBox(x,y,dx,dy,o) {
    let near=0,far=PHYSICS.sensorRange;
    for(const [p,d,min,max] of [[x,dx,o.x,o.x+o.width],[y,dy,o.y,o.y+o.height]]) {
      if(Math.abs(d)<1e-10) {if(p<min||p>max)return PHYSICS.sensorRange;continue;}
      let a=(min-p)/d,b=(max-p)/d;if(a>b)[a,b]=[b,a];
      near=Math.max(near,a);far=Math.min(far,b);
      if(near>far)return PHYSICS.sensorRange;
    }
    return near;
  }
  function sensors(s,course=COURSE) {
    return SENSOR_ANGLES.map(degrees=>{
      const angle=s.heading+degrees*Math.PI/180,dx=Math.sin(angle),dy=Math.cos(angle);
      let distance=PHYSICS.sensorRange;
      if(Math.abs(dx)>1e-10)for(const x of [course.left,course.right]){
        const t=(x-s.x)/dx;if(t>=0)distance=Math.min(distance,t);
      }
      if(dy<0)distance=Math.min(distance,-s.y/dy);
      for(const o of course.obstacles)distance=Math.min(distance,rayBox(s.x,s.y,dx,dy,o));
      return clamp(distance/PHYSICS.sensorRange,0,1);
    });
  }
  class Simulation {
    constructor(course=COURSE) {
      this.course=course;
      this.state={x:(course.left+course.right)/2,y:course.start,heading:0,
        speed:0,steps:0,collision:null,finished:false};
    }
    get elapsed(){return this.state.steps*DT;}
    get progress(){return this.state.finished?100:clamp(100*(this.state.y-this.course.start)/
      (this.course.finish+PHYSICS.carLength/2-this.course.start),0,99.9);}
    step(input={steering:'straight',throttle:'brake'}) {
      if(!['left','straight','right'].includes(input.steering)||
        !['accelerate','brake'].includes(input.throttle))throw new Error('Invalid driving input');
      const s=this.state;if(s.collision||s.finished)return;
      const turn={left:-1,straight:0,right:1}[input.steering];
      const acceleration={accelerate:PHYSICS.acceleration,brake:-PHYSICS.braking}[input.throttle];
      // Substeps bound displacement to <1 unit and detect the full car footprint.
      for(let i=0;i<4;i++) {
        const dt=DT/4,oldSpeed=s.speed;
        s.speed=clamp(s.speed+acceleration*dt,0,PHYSICS.maxSpeed);
        const speed=(oldSpeed+s.speed)/2;
        // No pivoting at rest. At speed, less yaw per second gives a wider turn.
        const yawRate=2.8*(speed/(speed+40))/(1+speed/130);
        s.heading+=turn*yawRate*dt;
        s.x+=Math.sin(s.heading)*speed*dt;s.y+=Math.cos(s.heading)*speed*dt;
        s.collision=collision(s,this.course);
        if(s.collision){s.speed=0;break;}
        if(footprint(s).every(([,y])=>y>=this.course.finish)){
          s.finished=true;s.speed=0;break;
        }
      }
      s.steps++;
    }
  }
  // A bounded fixed-step clock; long stalls pause instead of skipping collisions.
  class Clock {
    constructor(){this.reset();}
    reset(){this.accumulator=0;this.last=null;}
    advance(now,tick){
      if(this.last===null){this.last=now;return {stalled:false,alpha:0};}
      const elapsed=(now-this.last)/1000;this.last=now;
      if(elapsed<0||elapsed>.25){this.reset();return {stalled:true,alpha:0};}
      this.accumulator+=elapsed;
      while(this.accumulator+1e-10>=DT){
        this.accumulator=Math.max(0,this.accumulator-DT);
        if(tick()===false){this.reset();return {stalled:false,alpha:1};}
      }
      return {stalled:false,alpha:this.accumulator/DT};
    }
  }
  const RECORDING_SCHEMA='drag-2';
  const FEATURES=['left','front_left','front','front_right','right','speed'];
  const COLUMNS=[...FEATURES,'steering','throttle','track_id','split','session_id',
    'episode_id','step','time','x','y','heading','progress','schema_version'];
  class Recording {
    constructor(sessionId,limit=100000){
      this.sessionId=sessionId;this.limit=limit;this.rows=[];
      this.counts={left:0,straight:0,right:0,accelerate:0,brake:0};
    }
    append(sim,input,episodeId){
      const s=sim.state;
      if(s.collision||s.finished)return false;
      if(this.rows.length>=this.limit)throw new Error('Recording limit reached. Download and clear examples before continuing.');
      if(!['left','straight','right'].includes(input.steering)||
        !['accelerate','brake'].includes(input.throttle))throw new Error('Invalid recording action');
      this.rows.push([...sensors(s,sim.course),s.speed/PHYSICS.maxSpeed,
        input.steering,input.throttle,sim.course.id,'train',this.sessionId,episodeId,
        s.steps,s.steps*DT,s.x,s.y,s.heading,sim.progress,RECORDING_SCHEMA]);
      this.counts[input.steering]++;this.counts[input.throttle]++;return true;
    }
    csv(){
      const escape=value=>{const text=String(value);return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;};
      return [COLUMNS,...this.rows].map(row=>row.map(escape).join(',')).join('\n')+'\n';
    }
  }
  const api={RECORDING_SCHEMA,FEATURES,COLUMNS,Recording,DT,PHYSICS,SENSOR_ANGLES,COURSE,PRACTICE_COURSES,raceCourse,randomPracticeCourse,Simulation,Clock,inputFromKeys,footprint,
    collision,sensors,overlapsObstacle};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DragDriving=api;
})(globalThis);
