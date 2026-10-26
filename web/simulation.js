// Shared by the page and Node tests. No network or Python is involved in driving.
(function (root) {
  'use strict';
  const FEATURES = ['left','front_left','front','front_right','right'];
  const ANGLES = [-70,-35,0,35,70], DT = 0.1, RANGE = 180;
  const SCHEMA = 'browser-1';
  const COLUMNS = [...FEATURES,'steering','track_id','split','episode_id','step','time','x','y','heading','next_waypoint','waypoint_x','waypoint_y','waypoints_passed','progress','schema_version'];

  // ─── Track API ───────────────────────────────────────────────────────────────
  // Each track object exposes:
  //   id, label, gates [{x,y,tx,ty}], startX/Y/heading
  //   collides(state) → bool
  //   sensors(state)  → [0..1] × 5
  //   render(ctx)     → draws background + track markings (no car)

  // ─── Polygon utilities (used by rounded rectangle and irregular) ────────────────
  // Ray vs finite segment: returns t > 0 at intersection, else RANGE.
  function raySegment(ox,oy,dx,dy,ax,ay,bx,by){
    const ex=bx-ax,ey=by-ay,den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-10)return RANGE;
    const t=((ax-ox)*ey-(ay-oy)*ex)/den;
    const u=((ax-ox)*dy-(ay-oy)*dx)/den;
    return(t>1e-6&&u>=0&&u<=1)?t:RANGE;
  }
  // Min positive distance from ray origin to any polygon edge.
  function rayPoly(ox,oy,dx,dy,verts){
    let min=RANGE;
    for(let i=0;i<verts.length;i++){
      const[ax,ay]=verts[i],[bx,by]=verts[(i+1)%verts.length];
      const t=raySegment(ox,oy,dx,dy,ax,ay,bx,by);
      if(t<min)min=t;
    }
    return min;
  }
  // Point-in-polygon (ray-casting, winding-independent).
  function pointInPoly(px,py,verts){
    let inside=false;
    for(let i=0,j=verts.length-1;i<verts.length;j=i++){
      const[xi,yi]=verts[i],[xj,yj]=verts[j];
      if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function segmentsIntersect(a,b,c,d){
    const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
    const on=(p,q,r)=>Math.abs(cross(p,q,r))<1e-9&&
      r[0]>=Math.min(p[0],q[0])-1e-9&&r[0]<=Math.max(p[0],q[0])+1e-9&&
      r[1]>=Math.min(p[1],q[1])-1e-9&&r[1]<=Math.max(p[1],q[1])+1e-9;
    const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
    return (abC*abD<0&&cdA*cdB<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  }
  // Whole rectangle vs walls, including intersections between sampled corners.
  function polyCollides(s,outerP,innerP){
    const c=Math.cos(s.heading),n=Math.sin(s.heading);
    const pts=[[9,5],[9,-5],[-9,-5],[-9,5]].map(([a,b])=>[s.x+c*a-n*b,s.y+n*a+c*b]);
    if(pts.some(([x,y])=>!pointInPoly(x,y,outerP)||pointInPoly(x,y,innerP)))return true;
    for(const wall of [outerP,innerP])for(let i=0;i<wall.length;i++)for(let j=0;j<4;j++){
      if(segmentsIntersect(pts[j],pts[(j+1)%4],wall[i],wall[(i+1)%wall.length]))return true;
    }
    return innerP.some(([x,y])=>pointInPoly(x,y,pts));
  }
  // Sensor rays vs two polygon walls.
  function polySensors(s,outerP,innerP){
    return ANGLES.map(angle=>{
      const h=s.heading+angle*Math.PI/180,dx=Math.cos(h),dy=Math.sin(h);
      return Math.max(0,Math.min(rayPoly(s.x,s.y,dx,dy,outerP),rayPoly(s.x,s.y,dx,dy,innerP))/RANGE);
    });
  }

  // ─── Parametric track builder ────────────────────────────────────────────────
  // clFn(θ) → {x, y} traces the centerline once for θ ∈ [0, 2π].
  // The centerline is assumed to travel CLOCKWISE in canvas coords (y-down).
  // width is half the road width in pixels (road = 2×width).
  function buildParamTrack(id,label,clFn,width,Nv,Ng){
    Nv=Nv||180; Ng=Ng||36;
    // ── Sample centerline ──
    const cl=Array.from({length:Nv},(_,i)=>clFn(i*2*Math.PI/Nv));
    // ── Offset into outer & inner polygon boundaries ──
    // For CW travel: right-normal = (ty,-tx), left-normal = (-ty,tx)
    //   outer = centerline + rightNormal*width  (outside the loop)
    //   inner = centerline + leftNormal*width   (inside the loop / island)
    const outerP=[],innerP=[];
    for(let i=0;i<Nv;i++){
      const p=cl[i],nx=cl[(i+1)%Nv],pv=cl[(i-1+Nv)%Nv];
      let tx=nx.x-pv.x,ty=nx.y-pv.y;
      const len=Math.hypot(tx,ty)||1;tx/=len;ty/=len;
      outerP.push([p.x+ty*width, p.y-tx*width]);
      innerP.push([p.x-ty*width, p.y+tx*width]);
    }
    // ── Gates along centerline at equal parameter steps ──
    const gates=Array.from({length:Ng},(_,i)=>{
      const idx=Math.round(i*Nv/Ng)%Nv;
      const p=cl[idx],nx=cl[(idx+1)%Nv],pv=cl[(idx-1+Nv)%Nv];
      let tx=nx.x-pv.x,ty=nx.y-pv.y;const len=Math.hypot(tx,ty)||1;
      return{x:p.x,y:p.y,tx:tx/len,ty:ty/len};
    });
    // ── Start position: first centerline sample, heading = tangent direction ──
    const startX=cl[0].x,startY=cl[0].y;
    const startHeading=Math.atan2(gates[0].ty,gates[0].tx);
    // ── Start/finish line across the road at gate 0 ──
    function render(ctx){
      ctx.beginPath();ctx.moveTo(outerP[0][0],outerP[0][1]);
      outerP.forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();
      ctx.fillStyle='#58635f';ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#243b30';ctx.stroke();
      ctx.beginPath();ctx.moveTo(innerP[0][0],innerP[0][1]);
      innerP.forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();
      ctx.fillStyle='#edf2ed';ctx.fill();ctx.strokeStyle='#243b30';ctx.stroke();
      // Start/finish line
      const g=gates[0],w=width+2;
      ctx.strokeStyle='white';ctx.lineWidth=4;ctx.beginPath();
      ctx.moveTo(g.x-g.ty*w,g.y+g.tx*w);ctx.lineTo(g.x+g.ty*w,g.y-g.tx*w);ctx.stroke();
      ctx.fillStyle='#203129';ctx.font='bold 14px system-ui';
      ctx.fillText('START',g.x+g.ty*(w+4)+2,g.y-g.tx*(w+4)+5);
    }
    return{
      id,label,gates,startX,startY,startHeading,halfWidth:width,outerP,innerP,centerline:cl,
      collides:(s)=>polyCollides(s,outerP,innerP),
      sensors:(s)=>polySensors(s,outerP,innerP),
      render,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Track 0 · Round  ── analytic circles, original implementation
  // ═══════════════════════════════════════════════════════════════════════════
  const RND_IN=165,RND_OUT=255,RND_CX=450,RND_CY=300;
  const roundGates=Array.from({length:38},(_,i)=>{
    const a=i*2*Math.PI/38;
    return{x:RND_CX+210*Math.cos(a),y:RND_CY+210*Math.sin(a),tx:-Math.sin(a),ty:Math.cos(a)};
  });
  function roundCollides(s){
    const c=Math.cos(s.heading),n=Math.sin(s.heading);
    const pts=[[9,5],[9,-5],[-9,-5],[-9,5]].map(([a,b])=>[s.x+c*a-n*b-RND_CX,s.y+n*a+c*b-RND_CY]);
    if(pts.some(([x,y])=>Math.hypot(x,y)>RND_OUT))return true;
    for(let i=0;i<4;i++){
      const[x,y]=pts[i],[ex,ey]=pts[(i+1)%4],dx=ex-x,dy=ey-y;
      const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy)));
      if(Math.hypot(x+t*dx,y+t*dy)<RND_IN)return true;
    }
    return false;
  }
  function roundSensors(s){
    return ANGLES.map(angle=>{
      const h=s.heading+angle*Math.PI/180,dx=Math.cos(h),dy=Math.sin(h);
      const px=s.x-RND_CX,py=s.y-RND_CY,b=px*dx+py*dy;
      let d=RANGE;
      for(const r of[RND_IN,RND_OUT]){
        const disc=b*b-(px*px+py*py-r*r);
        if(disc>=0)for(const t of[-b-Math.sqrt(disc),-b+Math.sqrt(disc)])if(t>0)d=Math.min(d,t);
      }
      return Math.max(0,d/RANGE);
    });
  }
  function roundRender(ctx){
    for(const[r,color]of[[RND_OUT,'#58635f'],[RND_IN,'#edf2ed']]){
      ctx.beginPath();ctx.arc(RND_CX,RND_CY,r,0,Math.PI*2);
      ctx.fillStyle=color;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='#243b30';ctx.stroke();
    }
    ctx.strokeStyle='white';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(615,RND_CY);ctx.lineTo(705,RND_CY);ctx.stroke();
    ctx.fillStyle='#203129';ctx.font='bold 14px system-ui';ctx.fillText('START',720,RND_CY+5);
  }
  const trackRound={id:'round',label:'Round',gates:roundGates,startX:660,startY:300,startHeading:Math.PI/2,halfWidth:45,
    collides:roundCollides,sensors:roundSensors,render:roundRender};

  // Rounded rectangle: 90-unit corner radii exceed the car's minimum turn radius.
  // Start at the middle of the right straight, at gate 0, heading down.
  const rectParts = [
    [100, t=>({x:760,y:300+100*t})],
    [45*Math.PI, t=>({x:670+90*Math.cos(t*Math.PI/2),y:400+90*Math.sin(t*Math.PI/2)})],
    [440, t=>({x:670-440*t,y:490})],
    [45*Math.PI, t=>({x:230+90*Math.cos((1+t)*Math.PI/2),y:400+90*Math.sin((1+t)*Math.PI/2)})],
    [200, t=>({x:140,y:400-200*t})],
    [45*Math.PI, t=>({x:230+90*Math.cos((2+t)*Math.PI/2),y:200+90*Math.sin((2+t)*Math.PI/2)})],
    [440, t=>({x:230+440*t,y:110})],
    [45*Math.PI, t=>({x:670+90*Math.cos((3+t)*Math.PI/2),y:200+90*Math.sin((3+t)*Math.PI/2)})],
    [100, t=>({x:760,y:200+100*t})],
  ];
  const rectLength=rectParts.reduce((sum,[length])=>sum+length,0);
  const trackRect=buildParamTrack('rounded_rect','Rounded rectangle',angle=>{
    let distance=angle/(2*Math.PI)*rectLength;
    for(const [length,point] of rectParts){
      if(distance<=length)return point(distance/length);
      distance-=length;
    }
    return {x:760,y:300};
  },50,240,52);

  // ═══════════════════════════════════════════════════════════════════════════
  // Irregular  ── smooth S-distorted loop (parametric polygon)
  //   Centerline: primary oval + 2nd-harmonic distortion (phase-shifted so
  //   x and y bumps don't align, giving an asymmetric S-curve shape).
  //   Gentle asymmetric bends; road width: 104 px.
  // ═══════════════════════════════════════════════════════════════════════════
  const trackIrregular=buildParamTrack('irregular_smooth','Irregular',
    θ=>({
      x:450+245*Math.cos(θ)+35*Math.cos(2*θ+0.55),
      y:300+180*Math.sin(θ)-15*Math.sin(2*θ)
    }),
    52, 200, 36
  );

  // Geometry changes use new IDs so old recordings cannot silently mix in.
  const TRACKS=[trackRound,trackRect,trackIrregular];

  // ── sensors() public API — dispatches to the track's own sensor function ──
  function sensors(s,track){return(track||trackRound).sensors(s);}

  // ─── Simulation ──────────────────────────────────────────────────────────────
  class Simulation{
    constructor(track){
      this.track=track||trackRound;
      this.state={x:this.track.startX,y:this.track.startY,heading:this.track.startHeading,
        steps:0,gates_passed:0,collision:false,lap:false};
    }
    get progress(){return Math.min(100,this.state.gates_passed/this.track.gates.length*100);}
    step(action){
      if(!['left','straight','right'].includes(action))throw new Error('Invalid action');
      const s=this.state;if(s.collision||s.lap)return;
      const old={...s},turn={left:-1,straight:0,right:1}[action];
      const gates=this.track.gates;
      for(let i=0;i<6;i++){
        s.heading+=turn*0.9*DT/6;
        s.x+=Math.cos(s.heading)*48*DT/6;s.y+=Math.sin(s.heading)*48*DT/6;
        if(this.track.collides(s)){s.collision=true;break;}
      }
      s.steps++;if(s.collision)return;
      const g=gates[(s.gates_passed+1)%gates.length];
      const before=(old.x-g.x)*g.tx+(old.y-g.y)*g.ty;
      const after=(s.x-g.x)*g.tx+(s.y-g.y)*g.ty;
      if(before<0&&after>=0){
        const t=-before/(after-before);
        const cx=old.x+(s.x-old.x)*t,cy=old.y+(s.y-old.y)*t;
        if(Math.hypot(cx-g.x,cy-g.y)<=this.track.halfWidth){
          s.gates_passed++;s.lap=s.gates_passed===gates.length;
        }
      }
    }
    example(action,episode){
      const s=this.state,gates=this.track.gates;
      const g=gates[(s.gates_passed+1)%gates.length];
      return[
        ...sensors(s,this.track),action,
        this.track.id,'train',episode,
        s.steps,s.steps*DT,s.x,s.y,s.heading,
        (s.gates_passed+1)%gates.length,g.x,g.y,
        s.gates_passed,this.progress,SCHEMA
      ];
    }
  }

  // ─── Model validation & inference (unchanged) ────────────────────────────────
  function validateModel(m){
    const fail=()=>{throw new Error('Invalid model. Choose the model.json exported by train.py.');};
    if(!m||m.schema!==SCHEMA||JSON.stringify(m.features)!==JSON.stringify(FEATURES)||
       !Array.isArray(m.nodes)||!m.nodes.length||m.nodes.length>100000||
       !Array.isArray(m.classes)||!m.classes.length||
       m.classes.some(c=>!['left','straight','right'].includes(c)))fail();
    const seen=new Set();
    function visit(i,depth){
      if(!Number.isInteger(i)||i<0||i>=m.nodes.length||seen.has(i)||depth>100)fail();
      seen.add(i);const n=m.nodes[i];if(!n)fail();
      if(n.left===-1&&n.right===-1){if(!Number.isInteger(n.class)||!m.classes[n.class])fail();return;}
      if(!Number.isInteger(n.feature)||n.feature<0||n.feature>=5||!Number.isFinite(n.threshold))fail();
      visit(n.left,depth+1);visit(n.right,depth+1);
    }
    visit(0,0);if(seen.size!==m.nodes.length)fail();return m;
  }
  function predict(m,values){
    let n=m.nodes[0];
    while(n.left!==-1)n=m.nodes[Math.fround(values[n.feature])<=n.threshold?n.left:n.right];
    return m.classes[n.class];
  }

  const api={FEATURES,ANGLES,DT,RANGE,SCHEMA,COLUMNS,TRACKS,
    gates:roundGates, sensors, collides:roundCollides,    // legacy aliases
    Simulation,validateModel,predict};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Driving=api;
})(globalThis);
