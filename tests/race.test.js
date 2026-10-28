const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../web/drag-simulation.js');
const {Race,makeCourse,TIME_LIMIT}=require('../web/race-simulation.js');
const straight={predict:()=>({steering:'straight',throttle:'accelerate'})};
const clear={...makeCourse(),finish:100000,obstacles:[]};
function setup(course=clear,model=straight){const r=new Race(course);for(let i=0;i<2;i++){const d=r.addDriver(`Driver ${i+1}`);r.attachModel(d.id,model,'test');}return r;}

test('courses are reproducible, varied, bounded and have safe starts',()=>{
 assert.deepEqual(makeCourse(42),makeCourse(42));assert.notDeepEqual(makeCourse(42),makeCourse(43));
 for(const seed of [0,-1,1.5,1000000,NaN])assert.throws(()=>makeCourse(seed),/seed/);
 for(let seed=1;seed<=100;seed++){
  const c=makeCourse(seed);assert.equal(c.obstacles.length,12);assert.equal(D.collision(new D.Simulation(c).state,c),null);
  for(const o of c.obstacles){assert.ok(o.x>=c.left&&o.x+o.width<=c.right);assert.ok(Math.max(o.x-c.left,c.right-o.x-o.width)>=125);}
 }
});
test('empty slots do not start; models receive six normalized features independently',()=>{
 const r=new Race(clear);r.addDriver('Driver 1');r.addDriver('Driver 2');assert.throws(()=>r.start(),/needs a model/);
 const seen=[];r.attachModel(1,{predict:x=>{seen.push(x);return straight.predict();}},'first');
 r.attachModel(2,{predict:()=>({steering:'straight',throttle:'brake'})},'second');r.start();r.tick();r.tick();
 assert.equal(seen[0].length,6);seen.flat().forEach(v=>assert.ok(v>=0&&v<=1));assert.equal(seen[0][5],0);
 assert.ok(r.drivers[0].sim.state.y>r.drivers[1].sim.state.y);assert.equal(r.drivers[1].sim.state.speed,0);
 assert.throws(()=>r.attachModel(1,straight,'new'),/Reset/);
});
test('overlapping ghost cars remain identical; pause and reset are deterministic',()=>{
 const r=setup();r.start();for(let i=0;i<100;i++)r.tick();
 assert.deepEqual(r.drivers[0].sim.state,r.drivers[1].sim.state);const snapshot={...r.drivers[0].sim.state};
 r.pause();r.tick();assert.deepEqual(r.drivers[0].sim.state,snapshot);assert.throws(()=>r.addDriver('late'),/Reset/);
 r.reset();r.start();for(let i=0;i<100;i++)r.tick();assert.deepEqual(r.drivers[0].sim.state,snapshot);
});
test('model failure stops only its own car; collision ends the other run',()=>{
 const r=setup(D.COURSE);r.attachModel(1,{predict:()=>null},'broken');r.start();r.tick();
 assert.equal(r.drivers[0].status,'Model error');assert.equal(r.running,true);
 for(let i=0;i<1000&&r.running;i++)r.tick();assert.equal(r.drivers[1].status,'Collision');assert.equal(r.running,false);
 assert.throws(()=>r.start(),/Reset/);
});
test('finishes and time limits end runs with bounded progress',()=>{
 const r=setup({...clear,finish:250});r.start();while(r.running)r.tick();
 assert.equal(r.drivers[0].status,'Finished');assert.equal(r.drivers[0].sim.progress,100);
 assert.equal(r.drivers[0].finishTime,r.drivers[1].finishTime);
 const idle=setup(clear,{predict:()=>({steering:'straight',throttle:'brake'})});idle.start();
 for(let i=0;i<8000&&idle.running;i++)idle.tick();assert.equal(idle.elapsed,TIME_LIMIT);
 assert.equal(idle.drivers[0].status,'Timed out');
});
test('generated courses can be completed using discrete controls and shared physics',()=>{
 // Geometry check only: this controller is never supplied to student cars.
 for(const seed of [1,2,3,42,43,99,12345,999999]){
  const c=makeCourse(seed),path=[];
  for(const o of c.obstacles){const leftGap=o.x-c.left,rightGap=c.right-o.x-o.width;
   const x=leftGap>=rightGap?c.left+leftGap/2:o.x+o.width+rightGap/2;
   path.push([x,o.y-100],[x,o.y+o.height+75]);}
  path.push([450,c.finish+100]);let target=0;const sim=new D.Simulation(c);
  for(let i=0;i<7200&&!sim.state.finished&&!sim.state.collision;i++){
   const s=sim.state;let p=path[target];if(Math.hypot(s.x-p[0],s.y-p[1])<30&&target<path.length-1)p=path[++target];
   const a=Math.atan2(p[0]-s.x,p[1]-s.y),e=Math.atan2(Math.sin(a-s.heading),Math.cos(a-s.heading));
   sim.step({steering:e>.025?'right':e<-.025?'left':'straight',throttle:s.speed>65?'brake':'accelerate'});
  }
  assert.equal(sim.state.collision,null,`seed ${seed}`);assert.equal(sim.state.finished,true,`seed ${seed}`);
 }
});

test('random practice and race use identical geometry and physics for each seed',()=>{
 for(const seed of [1,42,43,12345,999999]){
  const practice=D.randomPracticeCourse(seed),race=makeCourse(seed);
  for(const key of ['seed','left','right','start','finish','obstacles'])assert.deepEqual(practice[key],race[key]);
  assert.equal(practice.id,`drag-practice-random-v2-${seed}`);
  assert.equal(race.id,`drag-race-${seed}`);
  const a=new D.Simulation(practice),b=new D.Simulation(race);
  for(let i=0;i<120;i++){const action={steering:i<40?'left':'straight',throttle:'accelerate'};a.step(action);b.step(action);}
  assert.deepEqual(a.state,b.state);
 }
 // Preserve the existing race seed algorithm, not just agreement between callers.
 assert.deepEqual(makeCourse(42).obstacles[0],{id:1,x:230,y:420,width:160,height:54});
 assert.equal(makeCourse(42).finish,4600);
});

test('assist waits five simulated seconds, boosts for one, preserves steering and resets cleanly',()=>{
 const stopped={predict:()=>({steering:'left',throttle:'brake'})};
 const r=setup({...clear,left:-10000,right:10000},stopped);r.start();
 for(let i=0;i<300;i++)r.tick();
 const d=r.drivers[0];assert.equal(d.sim.state.speed,0);assert.equal(d.assistCount,0);
 r.pause();for(let i=0;i<600;i++)r.tick();assert.equal(d.stoppedSteps,300);
 r.start();r.tick();assert.equal(d.assistCount,1);assert.equal(d.assistActive,true);
 assert.deepEqual(d.action,{steering:'left',throttle:'brake'});
 assert.deepEqual(d.appliedAction,{steering:'left',throttle:'accelerate'});
 for(let i=0;i<59;i++)r.tick();assert.ok(d.sim.state.speed>74);assert.equal(d.boostSteps,0);
 r.tick();assert.equal(d.assistActive,false);assert.equal(d.appliedAction.throttle,'brake');
 r.reset();assert.equal(d.assistCount,0);assert.equal(d.stoppedSteps,0);assert.equal(d.boostSteps,0);
});
test('assist is optional and never restarts crashed cars',()=>{
 const stopped={predict:()=>({steering:'straight',throttle:'brake'})};
 const r=setup(clear,stopped);r.antiStall=false;r.start();for(let i=0;i<400;i++)r.tick();
 assert.equal(r.drivers[0].sim.state.speed,0);assert.equal(r.drivers[0].assistCount,0);
 const hit=setup({...clear,obstacles:[{id:1,x:400,y:125,width:100,height:54}]},stopped);
 hit.start();for(let i=0;i<400&&hit.running;i++)hit.tick();assert.equal(hit.drivers[0].status,'Collision');
 const state={...hit.drivers[0].sim.state};for(let i=0;i<400;i++)hit.tick();
 assert.deepEqual(hit.drivers[0].sim.state,state);assert.equal(hit.drivers[0].assistActive,false);
});

test('creeping and throttle oscillation cannot continually reset the stall timer',()=>{
 const creeping={predict:features=>({steering:'straight',throttle:features[5]*180<.4?'accelerate':'brake'})};
 const r=setup(clear,creeping);r.start();
 for(let i=0;i<300;i++)r.tick();
 const d=r.drivers[0];assert.equal(d.assistCount,0);assert.equal(d.stoppedSteps,300);
 r.tick();assert.equal(d.assistCount,1);assert.equal(d.assistActive,true);
 for(let i=0;i<59;i++)r.tick();assert.ok(d.sim.state.speed>=75);
});
