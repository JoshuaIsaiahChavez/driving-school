// Multi-driver orchestration; every car uses the existing obstacle-course physics.
(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./drag-simulation.js'):root.DragDriving;
  const TIME_LIMIT=120;
  const STALL_SPEED=2; // Below 2 units/s counts as effectively stopped.
  const STALL_STEPS=Math.round(5/D.DT),BOOST_STEPS=Math.round(1/D.DT);
  const makeCourse=D.raceCourse;
  class Race {
    constructor(course=makeCourse(),{antiStall=true,minimumDrivers=2}={}){
      this.minimumDrivers=minimumDrivers;this.antiStall=antiStall;this.course=course;this.drivers=[];this.running=false;this.steps=0;
    }
    addDriver(name){
      if(this.running||this.steps)throw new Error('Reset the race before editing drivers.');
      if(this.drivers.length>=8)throw new Error('Eight drivers maximum.');
      const driver={id:this.drivers.length+1,name,model:null,modelName:null,
        sim:new D.Simulation(this.course),previous:null,status:'No model',finishTime:null,error:null,action:null,appliedAction:null,stoppedSteps:0,boostSteps:0,assistCount:0,assistActive:false};
      driver.previous={...driver.sim.state};this.drivers.push(driver);return driver;
    }
    // Future loader hook: an independent predictor receives ONLY six normalized features.
    // No student code or uploaded JavaScript is executed by this page.
    attachModel(id,model,modelName){
      if(this.running||this.steps)throw new Error('Reset the race before changing models.');
      const driver=this.drivers.find(d=>d.id===id);
      if(!driver||!model||typeof model.predict!=='function')throw new Error('A valid driver predictor is required.');
      driver.model=model;driver.modelName=modelName;driver.status='Ready';
    }
    get ready(){return this.drivers.length>=this.minimumDrivers&&this.drivers.every(d=>d.model);}
    get elapsed(){return this.steps*D.DT;}
    reset(course=this.course){
      this.running=false;this.steps=0;this.course=course;
      for(const d of this.drivers){d.sim=new D.Simulation(course);d.previous={...d.sim.state};
        d.status=d.model?'Ready':'No model';d.finishTime=null;d.error=null;d.action=null;d.appliedAction=null;d.stoppedSteps=0;d.boostSteps=0;d.assistCount=0;d.assistActive=false;}
    }
    start(){
      if(!this.ready)throw new Error('Every driver needs a model before the race can start.');
      if(this.drivers.every(d=>['Finished','Collision','Timed out','Model error'].includes(d.status)))
        throw new Error('Reset before starting another race.');
      this.running=true;
    }
    pause(){this.running=false;for(const d of this.drivers)d.previous={...d.sim.state};}
    tick(){
      if(!this.running)return false;
      for(const d of this.drivers){
        if(['Finished','Collision','Timed out','Model error'].includes(d.status))continue;
        d.previous={...d.sim.state};
        try{
          const features=[...D.sensors(d.sim.state,this.course),d.sim.state.speed/D.PHYSICS.maxSpeed];
          const action=d.model.predict(features);
          if(!action||!['left','straight','right'].includes(action.steering)||!['accelerate','brake'].includes(action.throttle))
            throw new Error('Model returned invalid steering or throttle.');
          d.action={...action};
          if(this.antiStall&&d.stoppedSteps>=STALL_STEPS&&!d.boostSteps){
            d.boostSteps=BOOST_STEPS;d.assistCount++;d.stoppedSteps=0;
          }
          d.assistActive=this.antiStall&&d.boostSteps>0;
          d.appliedAction={...action,throttle:d.assistActive?'accelerate':action.throttle};
          if(d.assistActive)d.boostSteps--;
          d.sim.step(d.appliedAction);d.status='Racing';
          d.stoppedSteps=d.sim.state.speed<STALL_SPEED&&!d.assistActive?d.stoppedSteps+1:0;
          if(d.sim.state.collision)d.status='Collision';
          if(d.sim.state.finished){d.status='Finished';d.finishTime=d.sim.elapsed;}
          if(d.status!=='Racing'){d.assistActive=false;d.boostSteps=0;}
        }catch(error){d.assistActive=false;d.boostSteps=0;d.status='Model error';d.error=String(error.message||error);d.sim.state.speed=0;}
      }
      this.steps++;
      if(this.elapsed>=TIME_LIMIT)for(const d of this.drivers)if(d.status==='Racing'){
        d.status='Timed out';d.sim.state.speed=0;d.assistActive=false;d.boostSteps=0;
      }
      if(this.drivers.every(d=>['Finished','Collision','Timed out','Model error'].includes(d.status)))this.running=false;
      return this.running;
    }
  }
  const api={makeCourse,Race,TIME_LIMIT,STALL_SPEED,STALL_STEPS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DragRace=api;
})(globalThis);
