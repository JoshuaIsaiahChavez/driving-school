const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../web/simulation.js');
test('legal start, analytical sensor geometry and ordering',()=>{
  const s=new D.Simulation().state;assert.equal(D.collides(s),false);
  const values=D.sensors(s);assert.equal(values.length,5);values.forEach(v=>assert.ok(v>=0&&v<=1));
  assert.ok(Math.abs(values[2]-Math.sqrt(255**2-210**2)/180)<1e-10);
  assert.ok(values[0]<values[4]); // outer wall on left, inner wall on right
  assert.equal(D.collides({...s,x:704}),true);
});
test('deterministic physics and pre-step observation/label alignment',()=>{
  const a=new D.Simulation(),b=new D.Simulation();
  const row=a.example('right','episode');assert.deepEqual(row.slice(0,5),D.sensors(a.state));
  assert.equal(row[5],'right');assert.equal(row[9],0);
  for(let i=0;i<40;i++){a.step(i%4?'straight':'right');b.step(i%4?'straight':'right');}
  assert.deepEqual(a.state,b.state);assert.notEqual(a.state.x,row[11]);
});
test('ordered gates complete a lap and cap progress',()=>{
  const sim=new D.Simulation();
  for(let i=0;i<500&&!sim.state.lap&&!sim.state.collision;i++){
    const s=sim.state,desired=Math.atan2(s.y-300,s.x-450)+Math.PI/2;
    const error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
    sim.step(error>.03?'right':error<-.03?'left':'straight');
  }
  assert.equal(sim.state.lap,true);assert.equal(sim.progress,100);const last={...sim.state};sim.step('right');assert.deepEqual(sim.state,last);
  const skipped=new D.Simulation();skipped.state.x=450;skipped.state.y=510;skipped.state.heading=Math.PI;
  skipped.step('straight');assert.equal(skipped.state.gates_passed,0);
});
test('JSON models validate and match float32 decision semantics',()=>{
  const m={schema:D.SCHEMA,features:D.FEATURES,classes:['left','right'],nodes:[{left:1,right:2,feature:0,threshold:.5},{left:-1,right:-1,class:0},{left:-1,right:-1,class:1}]};
  D.validateModel(m);assert.equal(D.predict(m,[.5,0,0,0,0]),'left');assert.equal(D.predict(m,[.6,0,0,0,0]),'right');
  m.nodes[0].left=0;assert.throws(()=>D.validateModel(m));
});

// A test-only waypoint follower verifies that the geometry is drivable.
// It is never available to the browser AI, which receives only sensor distances.
function driveLap(track, offset=0, headingOffset=0){
  const sim=new D.Simulation(track),g=track.gates[0];
  sim.state.x+=g.ty*offset;sim.state.y-=g.tx*offset;sim.state.heading+=headingOffset;
  assert.equal(track.collides(sim.state),false);
  for(let i=0;i<1000&&!sim.state.lap&&!sim.state.collision;i++){
    const s=sim.state,target=track.gates[(s.gates_passed+1)%track.gates.length];
    const desired=Math.atan2(target.y-s.y,target.x-s.x);
    const error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
    sim.step(error>.035?'right':error<-.035?'left':'straight');
  }
  return sim;
}
function crosses(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
}
for(const track of D.TRACKS){
  test(`${track.label}: legal centerline, walls, normalized sensors, aligned finish`,()=>{
    assert.ok(Math.hypot(track.startX-track.gates[0].x,track.startY-track.gates[0].y)<1e-8);
    const samples=track.centerline||track.gates;
    samples.forEach((p,i)=>{
      const prev=samples[(i+samples.length-1)%samples.length],next=samples[(i+1)%samples.length];
      const s={x:p.x,y:p.y,heading:Math.atan2(next.y-prev.y,next.x-prev.x)};
      assert.equal(track.collides(s),false,`centerline ${i}`);
      D.sensors(s,track).forEach(v=>assert.ok(Number.isFinite(v)&&v>=0&&v<=1));
    });
    for(const wall of [track.outerP,track.innerP].filter(Boolean)){
      wall.forEach(([x,y])=>assert.ok(x>0&&x<900&&y>0&&y<600));
      for(let i=0;i<wall.length;i++)for(let j=i+2;j<wall.length;j++){
        if(i===0&&j===wall.length-1)continue;
        assert.equal(crosses(wall[i],wall[(i+1)%wall.length],wall[j],wall[(j+1)%wall.length]),false,'wall self-intersects');
      }
    }
    if(track.outerP)for(let i=0;i<track.outerP.length;i++)for(let j=0;j<track.innerP.length;j++){
      assert.equal(crosses(track.outerP[i],track.outerP[(i+1)%track.outerP.length],track.innerP[j],track.innerP[(j+1)%track.innerP.length]),false,'inner/outer walls cross');
    }
  });
  test(`${track.label}: lap from three deterministic starts; CSV track identity`,()=>{
    for(const [offset,heading] of [[0,0],[-8,-.04],[8,.04]]){
      const sim=driveLap(track,offset,heading);
      assert.equal(sim.state.collision,false);assert.equal(sim.state.lap,true);assert.equal(sim.progress,100);
      assert.deepEqual(sim.state,driveLap(track,offset,heading).state);
      assert.equal(sim.example('right','test')[6],track.id);
    }
  });
}
test('exactly three classroom tracks; rounded rectangle straight sensors',()=>{
  assert.deepEqual(D.TRACKS.map(t=>t.id),['round','rounded_rect','irregular_smooth']);
  const t=D.TRACKS[1],s=new D.Simulation(t).state,values=t.sensors(s);
  assert.ok(Math.abs(values[0]-50/Math.sin(70*Math.PI/180)/180)<.002);
  assert.ok(Math.abs(values[4]-50/Math.sin(70*Math.PI/180)/180)<.002);
  assert.equal(t.collides({...s,x:807}),true);
  assert.equal(t.collides({...s,x:450,y:300}),true);
});
