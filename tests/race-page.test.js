const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const D=require('../web/drag-simulation.js'),R=require('../web/race-simulation.js'),M=require('../web/drag-model.js');
function page(){
 const elements=new Map(),pickers=[];let frame;
 const context=new Proxy({}, {get:()=>()=>{}});
 function element(){return {style:{setProperty(){}},append(){},setAttribute(){},addEventListener(){},getContext:()=>context};}
 const document={querySelector:q=>{if(!elements.has(q))elements.set(q,element());return elements.get(q);},
  createElement:()=>{const e=element();pickers.push(e);return e;},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../web/race.js'),'utf8'),{DragDriving:D,DragRace:R,DragModel:M,document,
  window:{addEventListener(){}},requestAnimationFrame:fn=>{frame=fn;}});
 return {get:id=>elements.get('#'+id),pickers:pickers.filter(e=>e.type==='file'),frame:t=>frame(t)};
}
const artifact={schema:'drag-model-2',features:['left','front_left','front','front_right','right','speed'],outputs:['steering','throttle'],
 classes:[['straight'],['accelerate']],nodes:[{left:-1,right:-1,feature:-2,threshold:-2,predictions:[0,0]}]};
test('file pickers load separate models, enable race, reject old files and preserve loaded model',async()=>{
 const p=page();assert.equal(p.get('start-race').disabled,true);assert.equal(p.pickers.length,2);
 async function upload(i,data){p.pickers[i].files=[{name:`driver-${i}.json`,size:100,text:async()=>JSON.stringify(data)}];await p.pickers[i].onchange();}
 await upload(0,artifact);assert.equal(p.get('start-race').disabled,true);
 await upload(1,artifact);assert.equal(p.get('start-race').disabled,false);
 await upload(1,{schema:'browser-1'});assert.match(p.get('race-status').textContent,/incompatible/);
 assert.equal(p.get('start-race').disabled,false);p.get('start-race').onclick();p.frame(0);p.frame(200);
 assert.equal(p.pickers[0].disabled,true);assert.notEqual(p.get('race-time').textContent,'0.0 s');
 p.get('reset-race').onclick();assert.equal(p.pickers[0].disabled,false);assert.equal(p.get('start-race').disabled,false);
});

test('old three-action models require retraining, new models reject coast classes',()=>{
 assert.throws(()=>M.loadModel({...artifact,schema:'drag-model-1'}),/automatic braking/);
 assert.throws(()=>M.loadModel({...artifact,classes:[['straight'],['coast']]}),/Invalid drag model/);
});
