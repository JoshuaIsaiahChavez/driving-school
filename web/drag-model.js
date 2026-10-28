// Data-only decision trees. Never execute code from uploaded files.
(function(root){
 'use strict';
 const features=['left','front_left','front','front_right','right','speed'];
 const actions=[['left','straight','right'],['accelerate','brake']];
 function loadModel(data){
  const fail=()=>{throw new Error('Invalid drag model. Train obstacle recordings with train_drag.py.');};
  if(!data||data.schema!=='drag-model-2')throw new Error('This simulator needs a drag-model-2 JSON. Older models are incompatible with automatic braking. Record new drag-2 demonstrations and retrain with train_drag.py.');
  if(JSON.stringify(data.features)!==JSON.stringify(features)||JSON.stringify(data.outputs)!==JSON.stringify(['steering','throttle']))fail();
  if(!Array.isArray(data.classes)||data.classes.length!==2)fail();
  data.classes.forEach((c,i)=>{if(!Array.isArray(c)||!c.length||new Set(c).size!==c.length||c.some(v=>!actions[i].includes(v)))fail();});
  const nodes=data.nodes;
  if(!Array.isArray(nodes)||!nodes.length||nodes.length>100000)fail();
  const visited=new Set(),pending=[0];
  while(pending.length){
   const i=pending.pop();if(!Number.isInteger(i)||i<0||i>=nodes.length||visited.has(i))fail();visited.add(i);
   const n=nodes[i];if(!n||!Number.isFinite(n.threshold)||!Array.isArray(n.predictions)||n.predictions.length!==2)fail();
   n.predictions.forEach((v,j)=>{if(!Number.isInteger(v)||v<0||v>=data.classes[j].length)fail();});
   if(n.left===-1&&n.right===-1){if(n.feature!==-2)fail();}
   else {if(!Number.isInteger(n.feature)||n.feature<0||n.feature>=6)fail();pending.push(n.left,n.right);}
  }
  if(visited.size!==nodes.length)fail();
  // Take a private copy so callers cannot mutate a validated tree.
  const tree=nodes.map(n=>({...n,predictions:[...n.predictions]})),classes=data.classes.map(c=>[...c]);
  return {predict(values){
   if(!Array.isArray(values)||values.length!==6||values.some(v=>!Number.isFinite(v)||v<0||v>1))throw new Error('Expected six normalized features.');
   let n=tree[0];while(n.left!==-1)n=tree[Math.fround(values[n.feature])<=n.threshold?n.left:n.right];
   return {steering:classes[0][n.predictions[0]],throttle:classes[1][n.predictions[1]]};
  }};
 }
 const api={loadModel};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DragModel=api;
})(globalThis);
