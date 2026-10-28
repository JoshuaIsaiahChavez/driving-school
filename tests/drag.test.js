const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../web/drag-simulation.js');
const input=(steering='straight',throttle='brake')=>({steering,throttle});
const empty={...D.COURSE,left:-9550,right:10450,finish:100000,obstacles:[]};

test('fixed course has safe start, seven non-overlapping obstacles and generous passing gaps',()=>{
  const s=new D.Simulation();assert.equal(D.collision(s.state),null);
  assert.equal(D.COURSE.obstacles.length,7);
  for(let i=0;i<7;i++){
    const o=D.COURSE.obstacles[i];assert.ok(o.x>=D.COURSE.left&&o.x+o.width<=D.COURSE.right);
    assert.ok(Math.max(o.x-D.COURSE.left,D.COURSE.right-o.x-o.width)>=160);
    assert.equal(o.width,280);assert.equal(o.x,i%2===0?D.COURSE.left:D.COURSE.right-o.width);
    if(i)assert.ok(o.y-D.COURSE.obstacles[i-1].y-D.COURSE.obstacles[i-1].height>250);
  }
});
test('acceleration is gradual and speed capped; neutral input brakes; braking stops without reverse',()=>{
  const sim=new D.Simulation(empty);sim.step(input('straight','accelerate'));
  assert.ok(Math.abs(sim.state.speed-75/60)<1e-9);
  for(let i=0;i<240;i++)sim.step(input('straight','accelerate'));
  assert.equal(sim.state.speed,180);
  sim.step(input());assert.ok(Math.abs(sim.state.speed-177.5)<1e-8);
  const y=sim.state.y;for(let i=0;i<120;i++)sim.step(input('straight','brake'));
  assert.equal(sim.state.speed,0);assert.ok(sim.state.y-y<110);
  const stopped=sim.state.y;for(let i=0;i<20;i++)sim.step(input('straight','brake'));
  assert.equal(sim.state.y,stopped);
});
test('cannot steer in place; high-speed turn radius is wider',()=>{
  const still=new D.Simulation(empty);for(let i=0;i<60;i++)still.step(input('left'));
  assert.equal(still.state.heading,0);assert.equal(still.state.x,450);
  const low=new D.Simulation(empty),high=new D.Simulation(empty);
  low.state.speed=60;high.state.speed=180;
  low.step(input('right'));high.step(input('right'));
  assert.ok(high.state.speed/(high.state.heading/D.DT)>low.state.speed/(low.state.heading/D.DT));
});
test('opposed steering cancels; braking wins over acceleration',()=>{
  assert.deepEqual(D.inputFromKeys(new Set(['w','s','a','d'])),input('straight','brake'));
  assert.deepEqual(D.inputFromKeys(new Set(['arrowup','arrowleft'])),input('left','accelerate'));
  assert.deepEqual(D.inputFromKeys(new Set()),input());
});
test('sensors detect obstacle and walls in left-to-right order',()=>{
  const s={x:450,y:200,heading:0};const values=D.sensors(s);
  assert.ok(Math.abs(values[2]-220/300)<1e-9);
  assert.ok(Math.abs(values[0]-220/Math.sin(70*Math.PI/180)/300)<1e-9);
  assert.ok(values[1]<values[3]);values.forEach(v=>assert.ok(v>=0&&v<=1));
  const left=D.sensors({...s,x:250});assert.ok(left[0]<left[4]);
  assert.equal(D.sensors({...s,y:420})[2],0);
});
test('full rotated footprint detects wall and obstacle contact, not only car center',()=>{
  assert.equal(D.collision({x:240,y:100,heading:0}),'wall');
  const s={x:520,y:440,heading:Math.PI/4};
  assert.equal(D.overlapsObstacle(s,D.COURSE.obstacles[0]),true);
  assert.equal(D.overlapsObstacle({...s,x:580},D.COURSE.obstacles[0]),false);
});
test('full-throttle straight drive ends on first obstacle and freezes state',()=>{
  const sim=new D.Simulation();for(let i=0;i<600&&!sim.state.collision;i++)sim.step(input('straight','accelerate'));
  assert.equal(sim.state.collision,'obstacle 1');assert.equal(sim.state.speed,0);assert.equal(sim.state.finished,false);
  const snapshot={...sim.state};sim.step(input('left','accelerate'));assert.deepEqual(sim.state,snapshot);
  assert.equal(new D.Simulation().state.steps,0);
});
test('substeps detect even a thin obstacle at maximum speed',()=>{
  const sim=new D.Simulation({...empty,obstacles:[{id:1,x:400,y:120,width:100,height:.1}]});
  sim.state.speed=180;sim.step(input('straight','accelerate'));
  assert.equal(sim.state.collision,'obstacle 1');
});
test('finish requires entire car across line; progress is capped and completion freezes state',()=>{
  const sim=new D.Simulation({...empty,finish:200});sim.state.y=200;sim.state.speed=100;
  sim.step(input());assert.equal(sim.state.finished,false);assert.ok(sim.progress<100);
  for(let i=0;i<60&&!sim.state.finished;i++)sim.step(input('straight','accelerate'));
  assert.equal(sim.state.finished,true);assert.equal(sim.progress,100);assert.equal(sim.state.speed,0);
  const snapshot={...sim.state};sim.step(input());assert.deepEqual(sim.state,snapshot);
});
test('render frequency does not change simulated motion; stalls are bounded',()=>{
  function run(fps){const sim=new D.Simulation(empty),clock=new D.Clock();
    for(let i=0;i<=fps*2;i++)clock.advance(i*1000/fps,()=>sim.step(input('right','accelerate')));
    return sim.state;}
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(60),run(144));assert.equal(run(60).steps,120);
  const clock=new D.Clock();let steps=0;clock.advance(0,()=>steps++);
  assert.equal(clock.advance(1000,()=>steps++).stalled,true);assert.equal(steps,0);
  clock.advance(2000,()=>steps++);assert.equal(steps,0);
});
test('clock reset prevents held-over elapsed time; terminal tick stops backlog',()=>{
  const clock=new D.Clock();let steps=0;clock.advance(0,()=>steps++);
  clock.advance(10,()=>steps++);clock.reset();clock.advance(6000,()=>steps++);assert.equal(steps,0);
  clock.advance(6100,()=>{steps++;return false;});assert.equal(steps,1);assert.equal(clock.accumulator,0);
});
test('course is drivable with discrete steering and acceleration/braking',()=>{
  // Test-only path follower, never used by the page or a learned driver.
  const path=D.COURSE.obstacles.flatMap((o,i)=>{
    const x=i%2===0?590:310;return [[x,o.y-100],[x,o.y+o.height+65]];
  });path.push([450,2800]);
  const sim=new D.Simulation();let target=0;
  for(let i=0;i<6000&&!sim.state.finished&&!sim.state.collision;i++){
    const s=sim.state;let p=path[target];
    if(Math.hypot(s.x-p[0],s.y-p[1])<35&&target<path.length-1)p=path[++target];
    const angle=Math.atan2(p[0]-s.x,p[1]-s.y),error=Math.atan2(Math.sin(angle-s.heading),Math.cos(angle-s.heading));
    sim.step(input(error>.025?'right':error<-.025?'left':'straight',s.speed>65?'brake':'accelerate'));
  }
  assert.equal(sim.state.collision,null);assert.equal(sim.state.finished,true);assert.equal(sim.progress,100);
  assert.ok(sim.elapsed<90);
});


test('recording schema uses only six normalized features, pre-step state, and bounded storage',()=>{
  const sim=new D.Simulation(),rec=new D.Recording('session',2);
  const action={steering:'right',throttle:'accelerate'};
  const before=D.sensors(sim.state);rec.append(sim,action,'episode');sim.step(action);
  assert.deepEqual(rec.rows[0].slice(0,5),before);assert.equal(rec.rows[0][5],0);
  assert.deepEqual(rec.rows[0].slice(6,8),['right','accelerate']);assert.equal(rec.rows[0][12],0);
  rec.append(sim,action,'episode');assert.ok(rec.rows[1][5]>0&&rec.rows[1][5]<=1);
  assert.throws(()=>rec.append(sim,action,'episode'),/limit/);
  sim.state.collision='wall';assert.equal(rec.append(sim,action,'episode'),false);
  assert.deepEqual(rec.counts,{left:0,straight:0,right:2,accelerate:2,brake:0});
  assert.equal(rec.csv().trim().split('\n').length,3);
});

test('all three practice layouts have clear starts and are traversable with acceleration and braking',()=>{
 assert.equal(D.PRACTICE_COURSES.length,3);
 assert.equal(new Set(D.PRACTICE_COURSES.map(c=>c.id)).size,3);
 for(const c of D.PRACTICE_COURSES){
  const sim=new D.Simulation(c);assert.equal(D.collision(sim.state,c),null);
  const path=c.obstacles.flatMap(o=>{
   assert.ok(o.width>=250&&o.width<=300);
   const gap=440-o.width,x=o.x===c.left?c.right-gap/2:c.left+gap/2;
   return [[x,o.y-90],[x,o.y+o.height+55]];
  });path.push([450,c.finish+100]);let target=0;
  for(let i=0;i<10000&&!sim.state.finished&&!sim.state.collision;i++){
   const s=sim.state;let p=path[target];
   if(Math.hypot(s.x-p[0],s.y-p[1])<25&&target<path.length-1)p=path[++target];
   const a=Math.atan2(p[0]-s.x,p[1]-s.y),e=Math.atan2(Math.sin(a-s.heading),Math.cos(a-s.heading));
   sim.step(input(e>.025?'right':e<-.025?'left':'straight',s.speed>50?'brake':'accelerate'));
  }
  assert.equal(sim.state.collision,null,c.name);assert.equal(sim.state.finished,true,c.name);
 }
});

test('random practice is repeatable, bounded and traversable across 100 seeds',()=>{
 assert.deepEqual(D.randomPracticeCourse(42),D.randomPracticeCourse(42));
 assert.notDeepEqual(D.randomPracticeCourse(42).obstacles,D.randomPracticeCourse(43).obstacles);
 for(const seed of [0,-1,1.5,1000000,NaN])assert.throws(()=>D.randomPracticeCourse(seed),/seed/);
 for(const seed of [...Array.from({length:100},(_,i)=>i+1),999999]){
  const c=D.randomPracticeCourse(seed),sim=new D.Simulation(c);
  assert.equal(D.collision(sim.state,c),null);assert.equal(c.obstacles.length,12);
  const path=c.obstacles.flatMap((o,i)=>{
   assert.ok(o.x>=c.left&&o.x+o.width<=c.right);
   if(i)assert.ok(o.y-c.obstacles[i-1].y>=300);
   const lg=o.x-c.left,rg=c.right-o.x-o.width;assert.ok(Math.max(lg,rg)>=125);
   const x=lg>=rg?c.left+lg/2:o.x+o.width+rg/2;
   return [[x,o.y-100],[x,o.y+o.height+60]];
  });path.push([450,c.finish+100]);let target=0;
  for(let i=0;i<10000&&!sim.state.finished&&!sim.state.collision;i++){
   const s=sim.state;let p=path[target];if(Math.hypot(s.x-p[0],s.y-p[1])<25&&target<path.length-1)p=path[++target];
   const a=Math.atan2(p[0]-s.x,p[1]-s.y),e=Math.atan2(Math.sin(a-s.heading),Math.cos(a-s.heading));
   sim.step(input(e>.025?'right':e<-.025?'left':'straight',s.speed>50?'brake':'accelerate'));
  }
  assert.equal(sim.state.collision,null,`seed ${seed}`);assert.equal(sim.state.finished,true,`seed ${seed}`);
 }
});

test('released accelerator applies braking and coast is rejected in new physics and recordings',()=>{
 const sim=new D.Simulation(empty);sim.state.speed=60;
 const released=D.inputFromKeys(new Set());assert.equal(released.throttle,'brake');
 sim.step(released);assert.ok(Math.abs(sim.state.speed-57.5)<1e-9);
 assert.throws(()=>sim.step({steering:'straight',throttle:'coast'}),/Invalid driving input/);
 const rec=new D.Recording('two-actions');
 assert.throws(()=>rec.append(sim,{steering:'straight',throttle:'coast'},'episode'),/Invalid recording action/);
 rec.append(sim,released,'episode');assert.equal(rec.rows[0].at(-1),'drag-2');
});
