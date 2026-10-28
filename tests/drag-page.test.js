const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const D=require('../web/drag-simulation.js');
function page(){
  const ctx=new Proxy({}, {get:()=>()=>{}}),elements=new Map(),winEvents={};let raf,blob,filename;
  for(const id of ['practice-model','model-name','ai-drive','practice-assist','ai-readout','practice-seed','build-practice','new-practice','practice-layout','layout-tip','course-name','course','status','start','pause','reset','rays','speed','progress','elapsed','sensor-values','record','download','clear','recording-state','label-counts'])
    elements.set('#'+id,{textContent:'',checked:true,events:{},addEventListener(name,fn){this.events[name]=fn;},focus(){},getContext(){return ctx;}});
  const doc={body:{appendChild(){}},createElement:()=>({click(){filename=this.download;},remove(){}}),hidden:false,events:{},querySelector:q=>elements.get(q),addEventListener(name,fn){this.events[name]=fn;}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/drag.js'),'utf8'),{
    DragDriving:D,DragRace:require('../web/race-simulation.js'),DragModel:require('../web/drag-model.js'),document:doc,window:{addEventListener(name,fn){winEvents[name]=fn;}},
    crypto:require('node:crypto').webcrypto,Uint8Array,Array,Blob,URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn(),confirm:()=>true,requestAnimationFrame:fn=>{raf=fn;},Set,Math});
  let time=0;raf(time);
  return {download:async()=>{elements.get('#download').onclick();return {text:await blob.text(),filename};},get:id=>elements.get('#'+id),blur:()=>winEvents.blur(),
    key:key=>elements.get('#course').events.keydown({key,preventDefault(){}}),
    frames(count){for(let i=0;i<count;i++){time+=1000/60;raf(time);}}};
}
test('page controls accelerate, brake, pause, reset and clear keys on lost focus',()=>{
  const p=page();p.get('start').onclick();p.key('w');p.frames(120);
  assert.ok(Number(p.get('speed').textContent)>140);
  p.key('s');p.frames(70);assert.equal(Number(p.get('speed').textContent),0);
  p.get('reset').onclick();p.frames(10);assert.equal(p.get('progress').textContent,'0%');
  p.get('start').onclick();p.key('w');p.frames(30);p.blur();p.frames(10);
  const elapsed=p.get('elapsed').textContent,speed=Number(p.get('speed').textContent);
  p.frames(60);assert.equal(p.get('elapsed').textContent,elapsed);assert.match(p.get('status').textContent,/lost focus/);
  p.get('start').onclick();p.frames(20);assert.ok(Number(p.get('speed').textContent)<speed);
  p.key(' ');p.frames(10);assert.match(p.get('status').textContent,/Paused/);
});
test('page reports collision, freezes run and new run returns to zero speed',()=>{
  const p=page();p.get('start').onclick();p.key('ArrowUp');p.frames(300);
  assert.match(p.get('status').textContent,/Run ended: hit obstacle 1/);
  assert.equal(p.get('start').textContent,'New run');
  const elapsed=p.get('elapsed').textContent;p.frames(60);assert.equal(p.get('elapsed').textContent,elapsed);
  p.get('start').onclick();p.frames(10);assert.equal(p.get('speed').textContent,'0');assert.equal(p.get('progress').textContent,'0%');
});


test('recording is explicit, aligned, exportable, and stops on pause/focus loss',async()=>{
  const p=page();p.get('start').onclick();p.key('w');p.frames(20);p.get('pause').onclick();
  assert.match(p.get('recording-state').textContent,/0 examples/);
  p.get('reset').onclick();p.get('record').onclick();p.key('w');p.frames(31);p.blur();
  assert.match(p.get('recording-state').textContent,/Not recording/);
  const saved=await p.download(),lines=saved.text.trim().split('\n');
  assert.equal(lines[0],D.COLUMNS.join(','));assert.equal(lines.length,31);
  const first=lines[1].split(',');assert.equal(first[5],'0');assert.equal(first[6],'straight');
  assert.equal(first[7],'accelerate');assert.equal(first[12],'0');assert.equal(first[13],'0');
  assert.equal(first[15],'100');assert.match(saved.filename,/^drag-drive-[a-f0-9]+\.csv$/);
  p.frames(60);assert.equal((await p.download()).text,saved.text);
  p.get('start').onclick();p.key('w');p.frames(20);assert.equal((await p.download()).text,saved.text);
  p.get('reset').onclick();p.get('record').onclick();p.key('s');p.frames(11);
  const later=(await p.download()).text.trim().split('\n');
  assert.equal(later.length,41);assert.notEqual(later[31].split(',')[11],first[11]);
  assert.equal(later[31].split(',')[7],'brake');
  p.get('clear').onclick();assert.match(p.get('recording-state').textContent,/0 examples/);
});

test('collision ends collection without post-collision samples',async()=>{
  const p=page();p.get('record').onclick();p.key('w');p.frames(300);
  assert.match(p.get('status').textContent,/Run ended/);
  const saved=(await p.download()).text;p.frames(120);assert.equal((await p.download()).text,saved);
  const data=saved.trim().split('\n').slice(1).map(l=>l.split(','));
  assert.ok(data.length>0);assert.ok(data.every(r=>Number(r[15])<420-19));
});


test('switching layouts pauses, keeps examples, changes CSV identity and starts a new episode',async()=>{
 const p=page();p.get('record').onclick();p.key('w');p.frames(20);
 const first=(await p.download()).text.trim().split('\n');
 p.get('practice-layout').value='drag-practice-tight-1';p.get('practice-layout').onchange();p.frames(10);
 assert.match(p.get('recording-state').textContent,/Not recording/);
 assert.equal(p.get('progress').textContent,'0%');
 assert.equal((await p.download()).text.trim().split('\n').length,first.length);
 p.get('record').onclick();p.key('w');p.frames(20);
 const rows=(await p.download()).text.trim().split('\n').slice(1).map(r=>r.split(','));
 assert.equal(rows[0][8],'drag-practice-2');assert.equal(rows.at(-1)[8],'drag-practice-tight-1');
 assert.notEqual(rows[0][11],rows.at(-1)[11]);
 p.get('reset').onclick();p.get('record').onclick();p.key('w');p.frames(5);
 assert.equal((await p.download()).text.trim().split('\n').at(-1).split(',')[8],'drag-practice-tight-1');
});


test('random practice builds reproducibly, records seed, and reset retains the course',async()=>{
 const p=page();p.get('practice-seed').value='123';p.get('build-practice').onclick();
 assert.match(p.get('course-name').textContent,/seed 123/);
 p.get('record').onclick();p.key('w');p.frames(10);
 const first=(await p.download()).text.trim().split('\n').at(-1).split(',');
 assert.equal(first[8],'drag-practice-random-v2-123');
 p.get('practice-seed').value='0';p.get('build-practice').onclick();
 assert.match(p.get('status').textContent,/Choose a seed/);
 assert.match(p.get('course-name').textContent,/seed 123/);
 p.get('reset').onclick();assert.match(p.get('course-name').textContent,/seed 123/);
 p.get('new-practice').onclick();assert.notEqual(p.get('practice-seed').value,123);
 assert.match(p.get('recording-state').textContent,/Not recording/);
 assert.equal((await p.download()).text.trim().split('\n').at(-1).split(',')[8],first[8]);
});

const aiArtifact={schema:'drag-model-2',features:D.FEATURES,outputs:['steering','throttle'],classes:[['straight'],['accelerate']],
 nodes:[{left:-1,right:-1,feature:-2,threshold:-2,predictions:[0,0]}]};
async function loadAI(p,artifact=aiArtifact){
 p.get('practice-model').files=[{name:'student.json',size:100,text:async()=>JSON.stringify(artifact)}];
 await p.get('practice-model').onchange();
}
test('single-model practice drives without recording, pauses, resumes, switches layout and returns to manual',async()=>{
 const p=page();p.get('ai-drive').onclick();assert.match(p.get('status').textContent,/Choose a drag-model/);
 p.get('record').onclick();p.key('w');p.frames(10);const saved=(await p.download()).text;
 await loadAI(p);assert.equal(p.get('ai-drive').disabled,false);
 p.get('ai-drive').onclick();p.frames(60);assert.ok(Number(p.get('speed').textContent)>50);
 p.blur();p.frames(10);const time=p.get('elapsed').textContent;p.frames(20);assert.equal(p.get('elapsed').textContent,time);
 p.get('ai-drive').onclick();p.frames(15);assert.notEqual(p.get('elapsed').textContent,time);
 assert.equal((await p.download()).text,saved);
 p.get('practice-layout').value='drag-practice-tight-1';p.get('practice-layout').onchange();
 p.get('ai-drive').onclick();p.frames(20);assert.match(p.get('ai-readout').textContent,/AI/);
 p.get('record').onclick();p.key('w');p.frames(10);
 assert.match(p.get('ai-readout').textContent,/Manual/);assert.match(p.get('recording-state').textContent,/^Recording/);
 assert.ok((await p.download()).text.length>saved.length);
});
test('practice AI shares stall assist and collision termination; invalid model preserves prior model',async()=>{
 const p=page(),coast=JSON.parse(JSON.stringify(aiArtifact));coast.classes[1]=['brake'];await loadAI(p,coast);
 await loadAI(p,{schema:'browser-1'});assert.match(p.get('status').textContent,/incompatible/);
 p.get('ai-drive').onclick();p.frames(310);assert.match(p.get('ai-readout').textContent,/ASSIST/);
 assert.ok(Number(p.get('speed').textContent)>0);
 p.get('reset').onclick();await loadAI(p);p.get('ai-drive').onclick();p.frames(300);
 assert.match(p.get('status').textContent,/AI run ended: Collision/);
 const time=p.get('elapsed').textContent;p.frames(60);assert.equal(p.get('elapsed').textContent,time);
 assert.match(p.get('recording-state').textContent,/0 examples/);
});
