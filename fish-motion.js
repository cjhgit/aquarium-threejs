/* Upright swimming and length-aware collision handling; no runtime dependencies beyond Three.js. */
(() => {
'use strict';
const T=globalThis.THREE, clamp=T.MathUtils.clamp;
const contact={x:0,y:0,z:0,gap:0};
const pairReach=(a,b)=>a.lengthRadius+b.lengthRadius+(a.radius+b.radius)*Math.max(a.vertical,b.vertical);
// Closest points of two capsules. Their vertical scale accounts for tall fins.
function measureStraight(a,b,lead=0,margin=0){
  const ay=Math.max(a.vertical,b.vertical),ap=a.g.position,bp=b.g.position;
  const ax=ap.x+a.velocity.x*lead, az=ap.z+a.velocity.z*lead, axY=(ap.y+a.velocity.y*lead)/ay;
  const bx=bp.x+b.velocity.x*lead, bz=bp.z+b.velocity.z*lead, bxY=(bp.y+b.velocity.y*lead)/ay;
  const aaAxis=a.axis,bbAxis=b.axis;
  const p1x=ax+(a.offset?.x||0)+aaAxis.x*a.back,p1y=axY+((a.offset?.y||0)+aaAxis.y*a.back)/ay,p1z=az+(a.offset?.z||0)+aaAxis.z*a.back;
  const p2x=bx+(b.offset?.x||0)+bbAxis.x*b.back,p2y=bxY+((b.offset?.y||0)+bbAxis.y*b.back)/ay,p2z=bz+(b.offset?.z||0)+bbAxis.z*b.back;
  const al=a.front-a.back,bl=b.front-b.back,d1x=aaAxis.x*al,d1y=aaAxis.y*al/ay,d1z=aaAxis.z*al,d2x=bbAxis.x*bl,d2y=bbAxis.y*bl/ay,d2z=bbAxis.z*bl;
  const rx=p1x-p2x,ry=p1y-p2y,rz=p1z-p2z;
  const aa=d1x*d1x+d1y*d1y+d1z*d1z,ee=d2x*d2x+d2y*d2y+d2z*d2z,bb=d1x*d2x+d1y*d2y+d1z*d2z;
  const cc=d1x*rx+d1y*ry+d1z*rz,ff=d2x*rx+d2y*ry+d2z*rz,den=aa*ee-bb*bb;
  let s=Math.abs(den)>1e-8?clamp((bb*ff-cc*ee)/den,0,1):0,t=(bb*s+ff)/ee;
  if(t<0){t=0;s=clamp(-cc/aa,0,1);}else if(t>1){t=1;s=clamp((bb-cc)/aa,0,1);}
  let dx=p1x+d1x*s-p2x-d2x*t,ny=p1y+d1y*s-p2y-d2y*t,dz=p1z+d1z*s-p2z-d2z*t;
  let dist=Math.hypot(dx,ny,dz);
  if(dist<1e-6){dx=((a.id+b.id)%2?1:-1)*.01;dz=(a.id<b.id?1:-1)*.01;ny=.002;dist=Math.hypot(dx,ny,dz);}
  contact.x=dx/dist;contact.y=ny/dist*ay;contact.z=dz/dist;contact.gap=dist-a.radius-b.radius-margin;
  return contact;
}
// Large fish use a short chain of capsules following the bent spine. Smaller
// fish retain their existing generous envelope, which already covers the bend.
function measure(a,b,lead=0,margin=0){
  if(!a.segments&&!b.segments)return measureStraight(a,b,lead,margin);
  let gap=Infinity,x=0,y=0,z=0;
  const as=a.segments||[a],bs=b.segments||[b];
  for(const sa of as)for(const sb of bs){const c=measureStraight(sa,sb,lead,margin);if(c.gap<gap){gap=c.gap;x=c.x;y=c.y;z=c.z;}}
  contact.gap=gap;contact.x=x;contact.y=y;contact.z=z;return contact;
}
class AquariumMotion {
  constructor(fish,random,environment={}){this.obstacles=environment.obstacles||[];this.grazingSites=environment.grazingSites||[];this.fish=fish;this.predators=[];this.random=random;this.count=0;this.elapsed=0;this.accumulator=0;this.stepSize=1/60;this.lastMaxCorrection=0;}
  static floorHeight(x,z){return -4.7+.13*Math.sin(x*.6+z*.25)+.17*Math.cos(z*.4)+.1*Math.sin(x*1.8+z*.7);}
  register(f){
    // Keep collision constraints on a simulation transform. The visible model follows
    // with bounded velocity/acceleration, so a solver correction cannot teleport it.
    f.model=f.g;f.g=new T.Object3D();f.g.userData=f.model.userData;f.g.position.copy(f.model.position);f.g.quaternion.copy(f.model.quaternion);
    f.traits=f.species?.traits||{schooling:3,danger:1,activity:3};f.predator=!!f.species?.predator;f.fear=0;f.id=this.fish.length;f.yaw=f.direction>0?0:Math.PI;f.pitch=0;f.roll=0;f.yawVelocity=0;f.pitchVelocity=0;f.turnSide=f.id%2?1:-1;f.bendYaw=0;f.bendPitch=0;f.bendYawVelocity=0;f.bendPitchVelocity=0;
    f.radius=f.size*(f.rounded?.98:.9);f.vertical=f.kind===2?2.15:1.25;f.back=-1.2*f.size;f.front=.23*f.size;if(f.predator){f.radius=.30*f.size;f.vertical=2.05;f.back=-1.68*f.size;f.front=.74*f.size;}
    f.lengthRadius=Math.max(-f.back,f.front);f.boundRadius=f.lengthRadius+f.radius*f.vertical;
    if(f.predator)f.segments=Array.from({length:4},()=>({g:f.g,id:f.id,velocity:null,axis:new T.Vector3(),offset:new T.Vector3(),radius:f.radius+f.size*.04,vertical:f.vertical,back:0,front:1}));
    f.goal=new T.Vector3();f.steer=new T.Vector3();f.axis=new T.Vector3();f.smoothSteer=new T.Vector3();f.home=new T.Vector3();
    f.cruise=(f.species?f.species.speed:(f.kind===3?.85:.58))*(.93+this.random()*.14);
    f.speed=f.species?.locomotion==='burst-rest'?.035:f.cruise;f.wanderPhase=this.random()*Math.PI*2;f.tailPhase=f.phase||this.random()*Math.PI*2;f.effort=.6;
    const anal=f.species?Math.max(...f.species.anal.map(p=>p[1])):.25;
    const dorsal=f.species?Math.max(...f.species.dorsal.map(p=>p[1])):.4;f.maxY=10-((f.species?f.species.height:.5)+dorsal)*f.size-.12;
    f.floorClearance=f.kind===2?1.9*f.size+.12:((f.species?f.species.height:.5)+anal)*f.size+.10;
    f.nose=f.size*1.014;f.previousMouth=new T.Vector3();f.reverse=0;f.feedSpeed=clamp(f.cruise*3.2,1.8,2.8);f.targetFood=null;f.nextSense=this.elapsed+this.random()*.2;f.cooldownUntil=0;f.chewUntil=0;f.servingBites=new WeakMap();
    f.forage=null;f.nextForage=f.predator||f.species?.locomotion==='burst-rest'?Infinity:this.elapsed+5+((f.wanderPhase/(Math.PI*2)+f.id*.61803398875)%1)*22;f.grazingBites=0;f.mouthOpen=0;
    f.playTarget=null;f.nextPlay=this.elapsed+18+this.random()*24;f.playUntil=0;f.playCount=0;f.mode='cruise';f.activity='cruise';f.activityFactor=1;f.activityUntil=this.elapsed+2+this.random()*6;f.homeUntil=this.elapsed+16+this.random()*25;
    f.velocity=new T.Vector3(Math.cos(f.yaw)*f.speed,0,-Math.sin(f.yaw)*f.speed);
    this.orient(f);this.fish.push(f);if(f.predator)this.predators.push(f);this.place(f,this.fish.length-1);f.home.copy(f.g.position);this.chooseGoal(f);this.orient(f);this.syncModel(f,0,true);
  }
  minY(f,x=f.g.position.x,z=f.g.position.z){const clearance=Math.max(f.floorClearance*Math.cos(Math.min(1.4,Math.abs(f.pitch))),f.nose*Math.max(0,-Math.sin(f.pitch))+.04);
    return AquariumMotion.floorHeight(x,z)+clearance;}
  chooseActivity(f){if(f.species?.locomotion==='burst-rest'){this.chooseGoal(f);return;}if(f.predator){f.activity='cruise';f.activityFactor=.85+this.random()*.25;f.activityUntil=this.elapsed+6+this.random()*7;this.chooseGoal(f);return;}const r=this.random(),activity=(f.traits.activity-1)/4,hover=.58-.56*activity,glide=hover+.30-.18*activity,dart=.40*activity*activity;
    if(r<hover){f.activity='hover';f.activityFactor=.015+this.random()*.065;f.activityUntil=this.elapsed+1.5+(1-activity)*3+this.random()*3;}
    else if(r<glide){f.activity='glide';f.activityFactor=.18+this.random()*.3;f.activityUntil=this.elapsed+1.5+this.random()*3.5;}
    else if(r>1-dart){f.activity='dart';f.activityFactor=1.4+this.random()*.55;f.activityUntil=this.elapsed+.7+this.random()*1.3;}
    else {f.activity='cruise';f.activityFactor=.7+activity*.2+this.random()*.4;f.activityUntil=this.elapsed+2.5+this.random()*5;}
    if(f.activity==='hover')f.goal.copy(f.g.position).addScaledVector(f.axis,.6);else this.chooseGoal(f);
  }
  habitatPoint(f,excursion=false){const h=f.species?.habitat,r=this.random;
    if(!h)return new T.Vector3(-11+r()*22,-1.9+r()*6,-6+r()*11);
    const y=excursion?(h.zone==='bottom'||h.zone==='reef'?-1+r()*2:1+r()*3):h.min+r()*(h.max-h.min);
    let x=-12+r()*24,z=-6+r()*17;
    if(!excursion&&h.zone==='reef'){x=-9.4+(r()-.5)*1.4;z=(f.id%2?1:-1)*(2+r()*1.6);}
    if(!excursion&&h.zone==='grass'){x=5.5+r()*4;z=-3+r()*5;}
    return new T.Vector3(x,y,z);
  }
  play(f){
    if(!f.predator)return;
    const target=f.playTarget;
    if(target&&(target.id>=this.count||this.elapsed>f.playUntil||this.pointClearance(f,target.g.position)<2.2||f.g.position.distanceToSquared(target.g.position)>225)){
      f.playTarget=null;f.nextPlay=this.elapsed+28+this.random()*35;this.chooseGoal(f);
    }
    if(!f.playTarget&&this.elapsed>=f.nextPlay){
      const candidates=this.fish.slice(0,this.count).filter(o=>!o.predator&&!o.feeding&&o.g.position.y>-.5&&o.g.position.y<5&&o.g.position.x>-5&&o.g.position.x<9&&o.g.position.distanceToSquared(f.g.position)<169&&this.pointClearance(f,o.g.position)>3.5&&!this.predators.some(other=>other!==f&&other.playTarget===o));
      if(candidates.length){f.playTarget=candidates[Math.floor(this.random()*candidates.length)];f.playUntil=this.elapsed+5+this.random()*2;f.playCount++;}else f.nextPlay=this.elapsed+6;
    }
  }
  chooseGoal(f){const r=this.random,p=f.g.position;
    if(f.species?.locomotion==='burst-rest'){
      // Pick a different destination, with room to accelerate and brake.
      const h=f.species.habitat;let best=null,bestDistance=0;
      for(let i=0;i<24;i++){
        const angle=f.yaw+(r()-.5)*Math.PI*2,reach=9+r()*7;
        const q=new T.Vector3(clamp(p.x+Math.cos(angle)*reach,-15,15),clamp(p.y+(r()-.5)*2.8,h.min+.3,h.max-.3),clamp(p.z-Math.sin(angle)*reach,-5,12));
        const clear=this.obstacles.every(o=>{const d=q.clone().sub(o.center);if(!o.radii)return d.length()>o.radius+f.size*1.5;if(o.inverseRotation)d.applyQuaternion(o.inverseRotation);return Math.hypot(d.x/(o.radii.x+f.size*1.5),d.y/(o.radii.y+f.size*1.5),d.z/(o.radii.z+f.size*1.5))>1;});
        const distance=q.distanceTo(p);if(clear&&distance>bestDistance){best=q;bestDistance=distance;}if(clear&&distance>8)break;
      }
      f.goal.copy(best||new T.Vector3(-Math.sign(p.x||1)*8,3.6,5));
      f.activity='dash';f.activityUntil=this.elapsed+12;f.nextGoal=f.activityUntil;f.burstLaunched=false;return;
    }
    if(f.predator){
      // Large sharks take broad circuits behind the smaller residents instead of repeatedly turning at the feeding patch.
      f.patrolAngle=(f.patrolAngle??(Math.PI*.5+f.id*Math.PI))+.65;
      const a=f.patrolAngle;f.goal.set(Math.sin(a)*13.5,2+Math.sin(a*.6+f.id)*.7,-5.5+Math.cos(a)*3.2);f.nextGoal=this.elapsed+14;return;
    }
    // Independent, slowly changing territories replace synchronized trips to the two tank ends.
    if(this.elapsed>f.homeUntil){f.home.copy(this.habitatPoint(f,r()<.16));f.homeUntil=this.elapsed+22+r()*32;}
    const angle=f.yaw+(r()-.5)*2.8,reach=1.8+f.traits.activity*.35+r()*(2+f.traits.activity*.7);
    f.goal.set(p.x+Math.cos(angle)*reach,p.y+(r()-.5)*3.8,p.z-Math.sin(angle)*reach);
    f.goal.lerp(f.home,.16+r()*.17);f.goal.x=clamp(f.goal.x,-17,17);f.goal.z=clamp(f.goal.z,-9,25);
    const h=f.species?.habitat;
    if(h){f.goal.lerp(f.home,.45);f.goal.y=clamp(f.goal.y,h.min,h.max);if(h.zone==='reef'&&r()<.6){f.goal.set(-9.6,-2.45,p.z>0?-3.8:3.8);}}
    f.goal.y=clamp(f.goal.y,Math.max(-3.4,this.minY(f,f.goal.x,f.goal.z)+.25),h?.zone==='surface'?7.6:5.2);
    f.nextGoal=this.elapsed+4+(6-f.traits.activity)+r()*6;
  }
  place(f,limit){if(f.predator){const a=f.id<2?Math.PI*.5+f.id*Math.PI:Math.PI+(f.id-2)*2.4;f.patrolAngle=a;f.g.position.set(Math.sin(a)*12,2+f.id*.6,-5+Math.cos(a)*2.8);f.yaw=Math.atan2(Math.sin(a)*2.8,Math.cos(a)*12);this.orient(f);f.velocity.copy(f.axis).multiplyScalar(f.speed);return;}for(let attempt=0;attempt<400;attempt++){
    f.g.position.copy(this.habitatPoint(f));
    // A crowded preferred habitat may be inside a jelly's safety zone.
    // Expand horizontally rather than accepting an unsafe final sample.
    if(attempt>=200&&this.obstacles.some(o=>o.kind==='jellyfish')){f.g.position.x=-15+this.random()*30;f.g.position.z=-6+this.random()*18;}
    let clear=true;for(let j=0;j<limit;j++)if(measure(f,this.fish[j],0,.3).gap<0){clear=false;break;}if(clear&&!this.obstacles.some(o=>this.obstacleGap(f,o)<(o.kind==='jellyfish'?4:.12)))return;
  }}
  setCount(count){const before=this.count;this.count=count;
    for(let i=before;i<count;i++){const f=this.fish[i];this.place(f,i);f.home.copy(f.g.position);if(f.species?.locomotion==='burst-rest')this.restBurst(f,true);else this.chooseGoal(f);}
    for(let i=count;i<before;i++)this.releaseFood(this.fish[i],false);this.resolve(12);for(let i=before;i<count;i++)this.syncModel(this.fish[i],0,true);
  }
  orient(f){f.g.rotation.set(f.roll,f.yaw,f.pitch,'YZX');f.axis.set(Math.cos(f.yaw)*Math.cos(f.pitch),Math.sin(f.pitch),-Math.sin(f.yaw)*Math.cos(f.pitch));this.updateSpineBounds(f);}
  dampBend(f,key,velocityKey,target,dt){
    // Exact critically damped spring: continuous velocity, no elastic overshoot.
    const omega=4,offset=f[key]-target,decay=Math.exp(-omega*dt),spring=(f[velocityKey]+omega*offset)*dt;
    const next=target+(offset+spring)*decay;
    f[velocityKey]=(f[velocityKey]-omega*spring)*decay;
    // A reversed target can carry a little momentum; keep the original limits.
    const limit=key==='bendYaw'?.48:.24;
    f[key]=clamp(next,-limit,limit);if(f[key]!==next)f[velocityKey]=0;
  }
  updateSpineBounds(f){
    if(!f.segments)return;f.boundsVersion=(f.boundsVersion||0)+1;
    const k=Math.hypot(f.bendPitch,f.bendYaw),bounds=[f.back/f.size,-.95,-.25,.45,f.front/f.size];
    // Match fishCenter, including its traveling stroke. Capsule thickness
    // covers the small error between each curve section and its chord.
    const point=x=>{const d=Math.max(0,.45-x),along=k>.001?Math.sin(d*k)/k:d,across=k>.001?(1-Math.cos(d*k))/(k*k):.5*d*d;return new T.Vector3(x+d-along,f.bendPitch*across,f.bendYaw*across+Math.sin(f.tailPhase+x*2.5)*Math.pow(Math.max(0,.25-x),2)*.065*f.effort).multiplyScalar(f.size).applyQuaternion(f.g.quaternion);};
    let start=point(bounds[0]);
    for(let i=0;i<f.segments.length;i++){const segment=f.segments[i],end=point(bounds[i+1]);segment.offset.copy(start);segment.axis.copy(end).sub(start);segment.front=segment.axis.length();segment.axis.divideScalar(segment.front);segment.velocity=f.velocity;start=end;}
  }
  releaseFood(f,satisfied){const food=f.targetFood;if(food&&food.meal&&food.meal.diner===f.id)delete food.meal.diner;if(food&&food.pursuer===f.id){delete food.pursuer;delete food.reservedUntil;}f.targetFood=null;f.feeding=false;
    if(satisfied||food){f.activity='depart';f.activityFactor=1.4;f.activityUntil=this.elapsed+3+this.random()*3;f.cooldownUntil=this.elapsed+(satisfied?4+this.random()*6:.6+this.random());
      // Leave on different headings after a bite; other fish get a turn at the food.
      const angle=f.yaw+(f.id%2?1:-1)*(.7+this.random()*1.2),p=f.g.position,reach=4+this.random()*4;
      f.goal.set(clamp(p.x+Math.cos(angle)*reach,-16,16),clamp(p.y+(this.random()-.5)*2,Math.max(-2.5,this.minY(f)+.3),5),clamp(p.z-Math.sin(angle)*reach,-8,16));f.nextGoal=f.activityUntil;
    }
  }
  stopForage(f){
    f.forage=null;f.nextForage=this.elapsed+14+this.random()*28;f.reverseTarget=0;
    f.activityUntil=this.elapsed;f.mouthOpen=0;f.forageDrift=null;
  }
  foragePoint(site){
    const q=site.point.clone();
    // Match the grass vertex shader, so a fish nibbles the moving leaf itself.
    if(site.kind==='grass'){const h=site.height;q.x+=Math.sin(this.elapsed*.65+site.point.z*.6+site.point.x*.35+h*2)*h*h*.48;q.z+=Math.cos(this.elapsed*.42+site.point.x*.3+h*2)*h*h*.24;}
    return q;
  }
  startForage(f){
    if(!this.grazingSites.length||f.predator||f.species?.locomotion==='burst-rest'||f.fear>.08||this.elapsed<f.cooldownUntil||this.elapsed<f.chewUntil)return;
    const h=f.species?.habitat,preferGrass=h?.zone==='grass'||f.kind===2;
    const candidates=this.grazingSites.filter(site=>{
      if((site.availableAt||0)>this.elapsed)return false;
      if(preferGrass&&site.kind!=='grass')return false;
      const q=this.foragePoint(site),d=q.distanceTo(f.g.position);
      if(d>7||d<.6||q.y>(h?.max??5)+.5)return false;
      return !this.fish.slice(0,this.count).some(o=>o!==f&&o.forage&&o.forage.site.point.distanceToSquared(site.point)<4);
    }).map(site=>({site,score:this.foragePoint(site).distanceTo(f.g.position)+this.random()*2})).sort((a,b)=>a.score-b.score);
    for(const {site} of candidates){
      const q=this.foragePoint(site),yaw=Math.atan2(-(q.z-f.g.position.z),q.x-f.g.position.x),pitch=site.kind==='sand'?-1.28:-.25;
      const axis=new T.Vector3(Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.sin(yaw)*Math.cos(pitch));
      const center=q.clone().addScaledVector(axis,-f.nose-.06);
      // Test the entire tilted fish, including its fins, before accepting a patch.
      const probe={...f,g:{position:center},axis,pitch};
      if(center.y<this.minY(probe,center.x,center.z)+.01||this.obstacles.some(o=>this.obstacleGap(probe,o)<.75))continue;
      f.forage={site,yaw,pitch,axis,stage:'approach',started:this.elapsed,bitesLeft:2+Math.floor(this.random()*3),center};return;
    }
    f.nextForage=this.elapsed+4+this.random()*5;
  }
  steerForage(f){
    const a=f.forage,q=this.foragePoint(a.site),p=f.g.position;
    a.center.copy(q).addScaledVector(a.axis,-f.nose-.06);
    if(this.elapsed-a.started>32){this.stopForage(f);return false;}
    const distance=p.distanceTo(a.center),aligned=f.axis.dot(a.axis)>.97;
    if(a.stage==='approach'&&distance<.18&&aligned&&f.speed<.2){a.stage='inspect';a.until=this.elapsed+.45+this.random()*.5;}
    if(a.stage==='inspect'&&this.elapsed>a.until){a.stage='peck';a.stroke=this.elapsed;a.contacted=false;}
    let peck=0;
    if(a.stage==='peck'){
      const t=this.elapsed-a.stroke;
      // Lean in, close the lips at contact, then draw back and chew between bites.
      peck=t<.28?Math.sin(t/.28*Math.PI):0;
      f.mouthOpen=t<.28?Math.sin(Math.min(1,t/.18)*Math.PI):.25*Math.max(0,Math.sin((t-.28)*19))*Math.exp(-(t-.28)*4);
      const mouth=f.model.position.clone().add(new T.Vector3(f.nose,0,0).applyQuaternion(f.model.quaternion));
      if(!a.contacted&&t>.12&&t<.35&&mouth.distanceTo(q)<.22){a.contacted=true;f.grazingBites++;}
      if(t>.9){if(!a.contacted){a.stage='approach';f.mouthOpen=0;return true;}a.bitesLeft--;if(!a.bitesLeft){
        if(a.site.kind==='sand')a.site.availableAt=this.elapsed+35;
        this.stopForage(f);f.activity='depart';f.activityFactor=.65;f.activityUntil=this.elapsed+2.5;
        f.goal.copy(p).addScaledVector(a.axis,-.4);f.goal.y+=.6;f.nextGoal=f.activityUntil;return false;}a.stage='inspect';a.until=this.elapsed+.35+this.random()*.65;}
    }else f.mouthOpen=0;
    a.peck=peck;
    const target=a.center.clone().addScaledVector(a.axis,peck*f.size*.10),error=target.sub(p);
    if(distance<.55){
      f.steer.copy(a.axis);const along=error.dot(f.axis);
      f.desiredSpeed=clamp(along*2.8,0,.32);f.reverseTarget=clamp(along*2.8,-.3,0);
      // Tiny lateral station keeping lets the mouth track a swaying blade.
      f.forageDrift=error.addScaledVector(f.axis,-along).multiplyScalar(1.8).clampLength(0,.22);
    }else {f.steer.copy(error);f.desiredSpeed=Math.min(f.cruise*.85,distance*1.6);f.reverseTarget=0;f.forageDrift=null;}
    f.mode=a.stage==='approach'?'forage-approach':a.stage==='peck'?'grazing':'forage-inspect';return true;
  }
  prepareMeals(foods){
    // Preserve the original serving before spatial queues merge adjacent feeding batches.
    for(const food of foods)if(!food.serving&&food.meal)food.serving=food.meal;
    // Pellets in one small feeding patch share a turn, so mouths don't deadlock nose to nose.
    for(const food of foods){if(!food.meal)food.meal={};if(food.meal.registered)continue;
      const old=food.meal,neighbor=foods.find(other=>other!==food&&other.meal&&other.meal.registered&&other.mesh.position.distanceToSquared(food.mesh.position)<2.25);
      if(neighbor){for(const item of foods)if(item.meal===old)item.meal=neighbor.meal;}else old.registered=true;
    }
    for(const food of foods){if(!food.serving)food.serving=food.meal;const meal=food.meal;if(meal.diner===undefined)continue;const diner=this.fish[meal.diner];if(!diner||diner.id>=this.count||!diner.targetFood||diner.targetFood.eaten||!foods.includes(diner.targetFood)||diner.targetFood.meal!==meal)delete meal.diner;}
  }
  canEat(f,food){return !f.predator&&this.elapsed>=f.chewUntil&&(f.servingBites.get(food.serving)||0)<2;}
  pointClearance(f,q){if(f.segments)return Math.min(...f.segments.map(segment=>this.pointClearance(segment,q)));const p=f.g.position,dx=q.x-p.x-(f.offset?.x||0),dy=(q.y-p.y-(f.offset?.y||0))/f.vertical,dz=q.z-p.z-(f.offset?.z||0),ax=f.axis.x,ay=f.axis.y/f.vertical,az=f.axis.z,t=clamp((dx*ax+dy*ay+dz*az)/(ax*ax+ay*ay+az*az),f.back,f.front);return Math.hypot(dx-ax*t,dy-ay*t,dz-az*t)-f.radius;}
  foodScore(f,food){
    if(this.obstacles.some(o=>o.kind==='jellyfish'&&food.mesh.position.distanceTo(o.center)<Math.max(o.radii.x,o.radii.y,o.radii.z)+4))return Infinity;
    if(f.fear>.45||!this.canEat(f,food)||f.targetFood||this.elapsed<f.cooldownUntil||(food.failedBy&&food.failedBy[f.id]>this.elapsed))return Infinity;
    for(const shark of this.predators){if(shark.id<this.count&&this.pointClearance(shark,food.mesh.position)<1.1)return Infinity;}
    // The open foreground sand remains visible beyond the usual midwater patrol depth.
    const p=f.g.position,q=food.mesh.position,dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,distance=Math.hypot(dx,dy,dz),sight=(f.kind===3?8.5:9.5)+clamp(q.z-6,0,6);
    if(distance>sight)return Infinity;const view=(dx*f.axis.x+dy*f.axis.y+dz*f.axis.z)/Math.max(.01,distance);
    if(distance>2.7&&view<-.28)return Infinity;
    if(q.y<AquariumMotion.floorHeight(q.x,q.z)+.02||q.y>f.maxY+f.nose*.99+.2)return Infinity;
    const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(-dz,dx)-f.yaw),Math.cos(Math.atan2(-dz,dx)-f.yaw)));
    return distance/f.feedSpeed+angle*.6+Math.abs(dy)*.4+f.fear*4;
  }
  perceive(f,foods){
    if(this.elapsed<f.nextSense||this.elapsed<f.cooldownUntil)return;f.nextSense=this.elapsed+.10+this.random()*.15;
    let best=null,bestScore=Infinity;
    for(const food of foods){if(food.eaten||(food.meal.diner!==undefined&&food.meal.diner!==f.id))continue;
      const score=this.foodScore(f,food);if(score>=bestScore)continue;
      // Give the nearest well-positioned observer the turn, rather than the first array entry.
      let nearest=true;for(let i=0;i<this.count;i++)if(this.fish[i]!==f&&this.foodScore(this.fish[i],food)<score-.001){nearest=false;break;}
      if(nearest){best=food;bestScore=score;}
    }
    if(best){best.meal.diner=f.id;best.pursuer=f.id;best.reservedUntil=this.elapsed+5;f.targetFood=best;f.noticeUntil=this.elapsed+.06+this.random()*.16;f.chaseStarted=this.elapsed;f.bestFoodDistance=Infinity;f.lastFoodProgress=this.elapsed;}
  }
  steerFish(f,foods){const p=f.g.position;
    if(f.targetFood&&(f.targetFood.eaten||!foods.includes(f.targetFood)||f.targetFood.pursuer!==f.id||f.targetFood.meal.diner!==f.id||this.elapsed-f.chaseStarted>14))this.releaseFood(f,!!f.targetFood.eaten);
    if(!f.targetFood)this.perceive(f,foods);this.play(f);
    if(f.forage&&(f.targetFood||f.fear>.15))this.stopForage(f);
    if(!f.forage&&!f.targetFood&&this.elapsed>=f.nextForage)this.startForage(f);
    if(this.elapsed>f.activityUntil&&!f.targetFood&&!f.forage)this.chooseActivity(f);
    let goal=f.goal;f.feeding=!!f.targetFood&&this.elapsed>=f.noticeUntil;
    if(f.feeding){const food=f.targetFood;food.reservedUntil=this.elapsed+5;
      const q=food.mesh.position,dx=q.x-p.x,dz=q.z-p.z;
      // Keep facing the pellet itself. A moving offset goal caused reversal/orbiting near the mouth.
      f.steer.set(dx,q.y-p.y,dz);
      const mouthDistance=Math.hypot(q.x-p.x-f.axis.x*f.nose,q.y-p.y-f.axis.y*f.nose,q.z-p.z-f.axis.z*f.nose);
      if(mouthDistance<f.bestFoodDistance-.025){f.bestFoodDistance=mouthDistance;f.lastFoodProgress=this.elapsed;}
      const distance=p.distanceTo(q),remaining=distance-f.nose;
      // Arrive all the way at the mouth; no mandatory minimum speed and no endless circles.
      f.desiredSpeed=Math.min(f.feedSpeed,Math.max(0,remaining)*2.5);
      const facing=distance>.001?f.axis.dot(f.steer)/distance:1;
      f.reverseTarget=remaining<-.08&&mouthDistance>.2&&facing>.85?clamp(remaining*1.6,-.65,0):0;f.mode='feeding';
      if(this.elapsed-f.lastFoodProgress>3.5){if(!food.failedBy)food.failedBy={};food.failedBy[f.id]=this.elapsed+3;this.releaseFood(f,false);}
    }else if(f.forage&&this.steerForage(f)){
      // Independent of player feeding and its pellet reservations.
    }else if(f.species?.locomotion==='burst-rest'&&f.activity!=='depart'){
      this.steerBurstRest(f);
    }else{
      f.reverseTarget=0;if(f.activity!=='hover'&&(p.distanceToSquared(goal)<1||this.elapsed>f.nextGoal)){
        if(f.activity==='depart'){goal.copy(p).addScaledVector(f.axis,4);f.nextGoal=f.activityUntil;}else if(!f.predator&&this.random()<(.30-.05*f.traits.activity)){f.activity='hover';f.activityFactor=.08;f.activityUntil=this.elapsed+1+this.random()*2;goal.copy(p).addScaledVector(f.axis,.5);}else this.chooseGoal(f);
      }
      f.steer.copy(goal).sub(p);f.steer.y*=.5;
      // Low-frequency wandering and stroke/glide rhythms are independent for every fish.
      f.steer.x+=Math.sin(this.elapsed*.47+f.wanderPhase)*.45;
      f.steer.z+=Math.cos(this.elapsed*.37+f.wanderPhase*1.7)*.45;
      const rhythm=1+.15*Math.sin(this.elapsed*.8+f.wanderPhase)+.08*Math.sin(this.elapsed*1.7+f.wanderPhase*2);
      f.desiredSpeed=f.cruise*(this.elapsed<f.chewUntil?.55:f.activityFactor)*rhythm;f.mode=f.activity;
    }
    if(f.playTarget){const target=f.playTarget;const q=target.g.position;f.steer.copy(q).addScaledVector(target.velocity,.65).sub(p);f.desiredSpeed=f.cruise*1.65;f.mode='playing';}
    const length=f.steer.length();if(length>.001)f.steer.multiplyScalar(Math.max(f.feeding?1.2:f.species?.locomotion==='burst-rest'&&f.activity==='dash'&&!f.burstLaunched?1.6:.18,f.desiredSpeed)/length);
    if(!f.feeding&&!f.forage&&f.species?.habitat?.zone!=='reef'&&Math.abs(p.x)>10&&p.z< -1&&p.y<-.6){f.steer.y+=(-.6-p.y)*.5;f.steer.x-=Math.sign(p.x)*.4;}
    const bottom=this.minY(f)+.12;if(p.y<bottom)f.steer.y+=(bottom-p.y)*.9;
    const h=f.species?.habitat;
    if(!f.feeding&&!f.forage&&f.activity!=='depart'&&!f.predator&&h&&!(f.species?.locomotion==='burst-rest'&&f.activity==='dash'&&!f.burstLaunched)){const low=Math.max(h.min,this.minY(f)+.15),high=h.max;f.steer.y+=(p.y<low?(low-p.y)*.85:p.y>high?(high-p.y)*.9:0);}
    const top=f.feeding?f.maxY:h?.zone==='surface'?8:5.9,side=f.feeding?Math.max(17,Math.abs(f.targetFood.mesh.position.x)+1):17,front=f.feeding?Math.max(6,f.targetFood.mesh.position.z+1):25;
    if(p.y>top)f.steer.y-=(p.y-top)*.9;
    if(p.x>side)f.steer.x-=(p.x-side)*.8;if(p.x< -side)f.steer.x+=(-side-p.x)*.8;
    if(p.z< -9)f.steer.z+=(-9-p.z)*.7;if(p.z>front)f.steer.z-=(p.z-front)*.7;
  }
  restBurst(f,initial=false){
    f.activity='rest';f.burstLaunched=false;f.restCenter=f.g.position.clone();f.restStarted=this.elapsed;
    f.activityUntil=this.elapsed+(initial?12:24)+this.random()*18;f.nextGoal=f.activityUntil;f.goal.copy(f.restCenter);
  }
  steerBurstRest(f){
    const p=f.g.position;
    if(!['dash','brake','rest'].includes(f.activity))this.chooseGoal(f);
    if(f.activity==='dash'&&f.burstLaunched&&(this.elapsed>=f.burstUntil||p.distanceTo(f.goal)<.85)){f.activity='brake';f.brakeDirection=f.axis.clone();}
    if(f.activity==='brake'&&f.speed<.1&&(f.renderVelocity?.length()||0)<.3)this.restBurst(f);
    if(f.activity==='rest'){
      const a=(this.elapsed-f.restStarted)*.12+f.wanderPhase;
      f.goal.copy(f.restCenter).add(new T.Vector3(Math.cos(a)*.12,Math.sin(a*.7)*.06,Math.sin(a)*.12));
      f.steer.copy(f.goal).sub(p);
      f.desiredSpeed=Math.min(.07,f.steer.length()*.25);
    }else if(f.activity==='brake'){
      f.steer.copy(f.brakeDirection);f.desiredSpeed=0;
    }else{
      f.steer.copy(f.goal).sub(p);
      // Aim while nearly still, then commit to a short, decisive forward burst.
      // Increasing top speed alone was being erased by the shared slow follower.
      const distance=f.steer.length(),facing=f.axis.dot(f.steer)/Math.max(.001,distance);
      if(!f.burstLaunched&&facing>.994&&Math.abs(f.yawVelocity)<.4&&Math.abs(f.pitch)<.45){f.burstLaunched=true;f.dashStarted=this.elapsed;f.burstUntil=this.elapsed+clamp(distance/(f.cruise*4.2)+.18,.8,1.8);}
      f.desiredSpeed=f.burstLaunched?Math.min(f.cruise*4.2,Math.sqrt(2*36*Math.max(0,distance-.3))):.035;
      f.steer.y*=.95;
    }
    f.reverseTarget=0;f.mode=f.activity==='dash'&&!f.burstLaunched?'aim':f.activity;
  }
  obstacleContact(f,o,lead=0,proximity=lead?4.5:.025){
    if((o.kind==='jellyfish'||o.kind==='rock')&&f.predator&&!f.residentEnvelope)f=this.residentBounds(f);
    if(!o.radii){const away=f.g.position.clone().sub(o.center).normalize();return {gap:this.pointClearance(f,o.center)-o.radius,x:away.x,y:away.y,z:away.z};}
    if(o.box){let separation=Infinity;for(const b of f.segments||[f]){const br=b.radius*Math.max(1,b.vertical),p=b.g.position,v=f.velocity,offset=b.offset||{x:0,y:0,z:0},x=p.x+offset.x+v.x*lead,y=p.y+offset.y+v.y*lead,z=p.z+offset.z+v.z*lead,ax=x+b.axis.x*b.back,ay=y+b.axis.y*b.back,az=z+b.axis.z*b.back,bx=x+b.axis.x*b.front,by=y+b.axis.y*b.front,bz=z+b.axis.z*b.front;
      const dx=Math.max(o.box.min.x-Math.max(ax,bx)-br,Math.min(ax,bx)-br-o.box.max.x,0),dy=Math.max(o.box.min.y-Math.max(ay,by)-br,Math.min(ay,by)-br-o.box.max.y,0),dz=Math.max(o.box.min.z-Math.max(az,bz)-br,Math.min(az,bz)-br-o.box.max.z,0);separation=Math.min(separation,Math.hypot(dx,dy,dz));}
      if(separation>proximity)return {gap:separation,x:0,y:0,z:0};
    }
    let gap=Infinity,nx=0,ny=0,nz=0;
    for(const body of f.segments||[f]){const p=body.g.position,offset=body.offset||{x:0,y:0,z:0},v=f.velocity;
      const start=new T.Vector3(p.x+offset.x+v.x*lead+body.axis.x*body.back-o.center.x-(o.velocity?.x||0)*lead,p.y+offset.y+v.y*lead+body.axis.y*body.back-o.center.y-(o.velocity?.y||0)*lead,p.z+offset.z+v.z*lead+body.axis.z*body.back-o.center.z-(o.velocity?.z||0)*lead),axis=body.axis.clone().multiplyScalar(body.front-body.back);
      const support=i=>body.radius*Math.sqrt(1+(body.vertical*body.vertical-1)*o.axes[i].y*o.axes[i].y);
      const rx=o.radii.x+(o.axes?support(0):body.radius),ry=o.radii.y+(o.axes?support(1):body.radius*body.vertical),rz=o.radii.z+(o.axes?support(2):body.radius);
      if(o.inverseRotation){start.applyQuaternion(o.inverseRotation);axis.applyQuaternion(o.inverseRotation);}start.set(start.x/rx,start.y/ry,start.z/rz);axis.set(axis.x/rx,axis.y/ry,axis.z/rz);
      const t=clamp(-start.dot(axis)/Math.max(1e-9,axis.lengthSq()),0,1),q=start.addScaledVector(axis,t),d=q.length(),signed=(d-1)*Math.min(rx,ry,rz);
      if(signed<gap){gap=signed;q.set(q.x/rx,q.y/ry,q.z/rz).normalize();if(o.rotation)q.applyQuaternion(o.rotation);nx=q.x;ny=q.y;nz=q.z;}
    }return {gap,x:nx,y:ny,z:nz};
  }
  obstacleGap(f,o){return this.obstacleContact(f,o).gap;}
  reefAvoid(f){
    const reach=f.predator?2.5:.65;let closest=null,gap=reach;
    for(const o of this.obstacles){
      if(o.kind==='jellyfish')continue;
      const c=this.obstacleContact(f,o,f.predator?1.4:.35);if(c.gap<gap){gap=c.gap;closest=c;}
    }
    if(!closest)return;const force=(reach-gap)*(f.predator?1.65:1.8);f.steer.x+=closest.x*force;f.steer.y+=closest.y*force;f.steer.z+=closest.z*force;
    if(f.predator&&gap<.7)f.desiredSpeed=Math.min(f.desiredSpeed,f.cruise*.65);
  }
  correctPosition(f,x,z){f.g.position.x+=x;f.g.position.z+=z;}
  resolveReef(passes=3){let maxDepth=0;
    for(let i=0;i<this.count;i++){const f=this.fish[i];for(let pass=0;pass<passes;pass++)for(const o of this.obstacles){const c=this.obstacleContact(f,o);if(c.gap>=.025)continue;const horizontal=Math.hypot(c.x,c.z),nx=horizontal>.02?c.x/horizontal:0,nz=horizontal>.02?c.z/horizontal:1;maxDepth=Math.max(maxDepth,.025-c.gap);const shift=Math.min(.2,.025-c.gap);this.correctPosition(f,nx*shift,nz*shift);}}return maxDepth;
  }
  schoolFish(f){
    if(f.feeding||f.forage)return;
    if(f.predator){
      // Solitary sharks keep personal space around the entire curved body.
      for(const other of this.predators){if(other===f||other.id>=this.count||f.g.position.distanceToSquared(other.g.position)>Math.pow(pairReach(f,other)+6,2))continue;
        const c=measure(f,other,1,0),weight=clamp(1-c.gap/5,0,1);f.steer.x+=c.x*weight*3.6;f.steer.y+=c.y*weight*.4;f.steer.z+=c.z*weight*3.6;
      }return;
    }
    const affinity=Math.pow((f.traits.schooling-1)/4,2);if(affinity===0||f.activity==='hover')return;
    const p=f.g.position,range=4+f.traits.schooling;let x=0,y=0,z=0,vx=0,vy=0,vz=0,weight=0;
    for(let i=0;i<this.count;i++){const other=this.fish[i];if(other===f||other.species!==f.species||other.feeding)continue;
      const d2=p.distanceToSquared(other.g.position);if(d2>range*range)continue;const w=1/(1+d2*.06);weight+=w;x+=other.g.position.x*w;y+=other.g.position.y*w;z+=other.g.position.z*w;vx+=other.velocity.x*w;vy+=other.velocity.y*w;vz+=other.velocity.z*w;
    }
    if(!weight)return;
    const dx=x/weight-p.x,dy=y/weight-p.y,dz=z/weight-p.z,distance=Math.hypot(dx,dy,dz),pull=clamp((distance-1.2)*.24,0,1.3),scale=pull/Math.max(.01,distance),blend=.65*affinity;
    f.steer.multiplyScalar(1-blend);f.steer.x+=affinity*(dx*scale+vx/weight*.8);f.steer.y+=affinity*(dy*scale+vy/weight*.8);f.steer.z+=affinity*(dz*scale+vz/weight*.8);
    if(f.traits.schooling>=4)f.desiredSpeed=Math.max(f.desiredSpeed,f.cruise*(.7+clamp(distance*.12,0,.65)));
  }
  avoidPredators(f,dt){
    let threat=0,escapeX=0,escapeY=0,escapeZ=0;
    for(const shark of this.predators){if(f.predator||shark.id>=this.count||f.g.position.distanceToSquared(shark.g.position)>Math.pow(shark.boundRadius+f.boundRadius+7,2))continue;
      const danger=shark.traits.danger/5,range=2+danger*4.5,c=measure(f,shark,.9,0),weight=clamp(1-c.gap/range,0,1);if(weight<=0)continue;
      threat=Math.max(threat,weight);escapeX+=c.x*weight*danger;escapeY+=c.y*weight*.35*danger;escapeZ+=c.z*weight*danger;
      // Sideways motion opens a passage instead of reversing straight into following fish.
      if(Math.abs(c.x*shark.axis.x+c.z*shark.axis.z)>.75){const side=f.id%2?1:-1;escapeX+=shark.axis.z*side*weight*.8;escapeZ-=shark.axis.x*side*weight*.8;}
    }
    // Jellyfish are the highest danger for every swimmer, including sharks.
    // React to both current and predicted clearance so a turn cannot hide a close threat.
    for(const o of this.obstacles){if(o.kind!=='jellyfish')continue;
      const current=this.obstacleContact(f,o),future=this.obstacleContact(f,o,f.predator?3:1.2),c=current.gap<future.gap?current:future;
      const range=4+(o.danger??5)*.6,weight=clamp(1-c.gap/range,0,1);if(!weight)continue;
      const tx=-f.axis.z,tz=f.axis.x,lateral=c.x*tx+c.z*tz,side=Math.abs(lateral)>.12?Math.sign(lateral):-f.turnSide;
      threat=Math.max(threat,weight);escapeX+=(c.x+tx*side*.7)*weight;escapeY+=c.y*weight*.5;escapeZ+=(c.z+tz*side*.7)*weight;
    }
    f.fear+=(threat-f.fear)*(1-Math.exp(-dt*(threat>f.fear?4:1.3)));
    if(f.species?.locomotion==='burst-rest'&&!f.feeding&&f.activity==='rest'&&threat>=.65){
      // A close threat warrants one relocation, not repeated flights back to
      // the resting spot next to the same shark.
      const away=new T.Vector3(escapeX,escapeY,escapeZ).normalize();
      f.goal.copy(f.g.position).addScaledVector(away,10);f.goal.x=clamp(f.goal.x,-15,15);f.goal.z=clamp(f.goal.z,-5,12);f.goal.y=clamp(f.goal.y,2.1,5.2);
      f.activity='dash';f.burstLaunched=true;f.dashStarted=this.elapsed;f.burstUntil=this.elapsed+1.5;f.activityUntil=this.elapsed+12;f.nextGoal=f.activityUntil;
    }
    // A distant alarm must not accelerate a nose-down grazer into the sand.
    // Stay at the patch for weak threats, or release the pose before fleeing.
    if(f.forage&&threat<=.15)return;
    if(threat>.15&&f.forage)this.stopForage(f);
    if(threat>.08){if(f.targetFood&&threat>.45)this.releaseFood(f,false);
      f.steer.multiplyScalar(1-threat*.95);f.steer.x+=escapeX*5;f.steer.y+=escapeY*2.5;f.steer.z+=escapeZ*5;
    }
    // Its own burst is already faster than the generic escape cruise. A weak
    // alarm must not override arrival braking or keep a resting fish cruising.
    if(f.predator){if(threat>.08){f.desiredSpeed=Math.min(f.desiredSpeed,f.cruise*(1-threat*.7));f.mode='avoiding';if(f.playTarget){f.playTarget=null;f.nextPlay=this.elapsed+15;}}return;}
    if(f.species?.locomotion==='burst-rest'&&!f.feeding)return;
    if(f.fear>.08){f.desiredSpeed=Math.max(f.desiredSpeed,f.cruise*(1.25+f.fear*1.65));f.mode='avoiding';}
  }
  step(dt,foods){this.elapsed+=dt;this.prepareMeals(foods);
    for(let i=0;i<this.count;i++){const f=this.fish[i];f.previousMouth.copy(f.g.position).addScaledVector(f.axis,f.nose);}
    for(const food of foods)if(food.pursuer>=this.count){delete food.pursuer;delete food.reservedUntil;}
    for(let i=0;i<this.count;i++)this.steerFish(this.fish[i],foods);
    for(let i=0;i<this.count;i++)this.schoolFish(this.fish[i]);
    for(let i=0;i<this.count;i++){this.avoidPredators(this.fish[i],dt);this.reefAvoid(this.fish[i]);}
    for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
      const a=this.fish[i],b=this.fish[j],d2=a.g.position.distanceToSquared(b.g.position);if(d2>Math.pow(pairReach(a,b)+4,2))continue;
      const lead=Math.min(1.2,1.4/Math.max(.6,a.speed+b.speed)),c=measure(a,b,lead,.5);
      if(c.gap<0){const force=Math.min(2.5,-c.gap*1.7),nx=c.x,ny=c.y,nz=c.z;
        const aw=a.predator&&!b.predator?.10:!a.predator&&b.predator?1.9:a.feeding&&!b.feeding?.12:(!a.feeding&&b.feeding?1.8:1),bw=b.predator&&!a.predator?.10:!b.predator&&a.predator?1.9:b.feeding&&!a.feeding?.12:(!b.feeding&&a.feeding?1.8:1);
        a.steer.x+=nx*force*aw;a.steer.y+=ny*force*.7*aw;a.steer.z+=nz*force*aw;b.steer.x-=nx*force*bw;b.steer.y-=ny*force*.7*bw;b.steer.z-=nz*force*bw;
        const dx=a.g.position.x-b.g.position.x,dz=a.g.position.z-b.g.position.z;
        if(Math.abs(dx)>Math.abs(dz)*2){const side=a.id<b.id?1:-1;a.steer.z+=side*force*.5*aw;b.steer.z-=side*force*.5*bw;}
      }
    }
    for(let i=0;i<this.count;i++){
      const f=this.fish[i];
      // Filter the combined steering intent before taking atan2: capsule contacts
      // and competing neighbors can otherwise flip its heading every fixed step.
      f.smoothSteer.lerp(f.steer,1-Math.exp(-dt*(f.feeding?10:f.fear>.15?7:4)));
      const s=f.smoothSteer,horizontal=Math.hypot(s.x,s.z);
      const targetYaw=horizontal>Math.max(.04,Math.abs(s.y)*.22)?Math.atan2(-s.z,s.x):f.yaw;
      let delta=Math.atan2(Math.sin(targetYaw-f.yaw),Math.cos(targetYaw-f.yaw));
      // Keep the chosen turning side for targets directly behind the fish.
      if(Math.abs(delta)>Math.PI-.25)delta=Math.abs(delta)*f.turnSide;
      else if(Math.abs(delta)>.15)f.turnSide=Math.sign(delta);
      const burst=f.species?.locomotion==='burst-rest';
      const turnRate=f.predator?.48:f.fear>.15?1.8:f.feeding?2.2:burst?(f.activity==='rest'||f.activity==='brake'?.75:2.2):f.activity==='hover'?.45:.75+(f.activity==='dart'?.25:0);
      const desiredTurn=clamp(delta*(f.predator?1.15:f.feeding?4:2.4),-turnRate,turnRate);
      f.yawVelocity+=clamp(desiredTurn-f.yawVelocity,-dt*(f.predator?.6:5),dt*(f.predator?.6:5));
      const turn=f.yawVelocity*dt;f.yaw+=turn;
      const pitchLimit=f.feeding||f.forage?1.4:f.fear>.15?.55:.32;
      let pitchTarget=clamp(Math.atan2(s.y,Math.max(.04,horizontal)),-pitchLimit,pitchLimit);
      if(f.forage&&f.g.position.distanceTo(f.forage.center)<.55)pitchTarget=f.forage.pitch-(f.forage.peck||0)*.07;
      // Start pitching away before reaching the floor or surface, instead of
      // translating an upright fish vertically to correct its depth afterwards.
      const floorDistance=f.g.position.y-this.minY(f),surfaceDistance=f.maxY-f.g.position.y;
      const nearBite=!!f.forage||(f.feeding&&f.g.position.distanceTo(f.targetFood.mesh.position)<f.nose+.3);
      if(floorDistance<.35&&!nearBite)pitchTarget=Math.max(pitchTarget,clamp((.22-floorDistance)*2.5,-.2,.5));
      if(surfaceDistance<.35)pitchTarget=Math.min(pitchTarget,-.2*(1-clamp(surfaceDistance/.35,0,1)));
      const previousPitch=f.pitch,pitchError=pitchTarget-f.pitch;
      const desiredPitch=clamp(pitchError*(f.feeding?4:2.4),-1.1,1.1);
      f.pitchVelocity+=clamp(desiredPitch-f.pitchVelocity,-dt*4,dt*4);f.pitch+=f.pitchVelocity*dt;
      // Retain short bursts, but accelerate along the current body axis. Brake
      // while turning toward food above/below instead of sinking sideways.
      const headingBrake=f.predator?.8+.2*Math.max(0,Math.cos(delta)):f.feeding?Math.max(0,f.axis.dot(s)/Math.max(.001,s.length())):burst?Math.max(0,Math.cos(delta)):1-.56*clamp(Math.abs(delta)/1.9,0,1);
      const targetSpeed=f.desiredSpeed*headingBrake,acceleration=f.predator?.32:burst&&!f.feeding?48:f.feeding||f.fear>.15?2.2:1.0,deceleration=f.predator?.48:burst&&!f.feeding?42:f.feeding?3:1.3;
      const previousSpeed=f.speed,drive=clamp((targetSpeed-f.speed)/Math.max(.2,acceleration),0,1);
      // Tail effort leads the speed ramp; heavy sharks take longer to build momentum.
      f.thrust=f.thrust??0;f.thrust+=(drive-f.thrust)*(1-Math.exp(-dt*(drive>f.thrust?5:2.5)));
      f.speed+=clamp(targetSpeed-f.speed,-deceleration*dt,acceleration*dt*(f.predator?.35+.65*f.thrust:1));
      f.acceleration=(f.speed-previousSpeed)/dt;
      f.reverse+=clamp((f.reverseTarget||0)-f.reverse,-1.5*dt,1.5*dt);
      f.roll+=(clamp(-f.yawVelocity*.055,-.075,.075)-f.roll)*(1-Math.exp(-dt*3));this.orient(f);
      f.velocity.copy(f.axis).multiplyScalar(f.speed+f.reverse);
      if(f.forage&&f.forageDrift)f.velocity.add(f.forageDrift);
      const vy=f.velocity.y;
      if(vy<0&&-vy*dt>Math.max(0,floorDistance))f.velocity.multiplyScalar(Math.max(0,floorDistance)/(-vy*dt));
      else if(vy>0&&vy*dt>Math.max(0,surfaceDistance))f.velocity.multiplyScalar(Math.max(0,surfaceDistance)/(vy*dt));
      f.g.position.addScaledVector(f.velocity,dt);
      // Pursuit can enter the visible foreground and surface. Soft patrol bounds bring fish back afterwards.
      f.g.position.x=clamp(f.g.position.x,-43,43);f.g.position.z=clamp(f.g.position.z,-33,33);f.g.position.y=Math.min(f.g.position.y,f.maxY);
      const swimSpeed=f.velocity.length();f.tailPhase=(f.tailPhase+dt*(f.predator?1.0+swimSpeed*1.6+f.thrust*1.7:1.5+swimSpeed*4.4+(f.feeding?.9:0)+f.thrust*2.2))%(Math.PI*40);
      f.effort+=(clamp(.17+swimSpeed/Math.max(.3,f.cruise)*.38+(f.feeding?.18:0)+f.thrust*.65,.18,1.65)-f.effort)*(1-Math.exp(-dt*4));
      // Curvature follows angular velocity / forward speed: the rear follows the
      // previous heading instead of swinging around as a rigid lever. Smooth and
      // limit it at low speed so tight turns never fold the body back on itself.
      const travel=Math.max(f.predator?.65:.45,f.speed);
      const yawBend=clamp(-turn/dt*f.size/travel,-.48,.48),pitchBend=clamp((f.pitch-previousPitch)/dt*f.size/travel,-.24,.24);
      this.dampBend(f,'bendYaw','bendYawVelocity',yawBend,dt);
      this.dampBend(f,'bendPitch','bendPitchVelocity',pitchBend,dt);
      this.updateSpineBounds(f);
      if(f.g.userData.swim){const swim=f.g.userData.swim;swim.phase.value=f.tailPhase;swim.effort.value=f.effort;if(swim.bend)swim.bend.value.set(f.bendPitch,f.bendYaw);}
    }
    this.resolve(10);
    for(let i=foods.length-1;i>=0;i--){const food=foods[i];if(food.eaten)continue;const q=food.mesh.position;
      for(let j=0;j<this.count;j++){const f=this.fish[j];if(!this.canEat(f,food))continue;const p=f.g.position,m=f.previousMouth,ex=p.x+f.axis.x*f.nose,ey=p.y+f.axis.y*f.nose,ez=p.z+f.axis.z*f.nose;
        const sx=ex-m.x,sy=ey-m.y,sz=ez-m.z,length=sx*sx+sy*sy+sz*sz,t=length>1e-9?clamp(((q.x-m.x)*sx+(q.y-m.y)*sy+(q.z-m.z)*sz)/length,0,1):0;
        const dx=q.x-m.x-sx*t,dy=q.y-m.y-sy*t,dz=q.z-m.z-sz*t,mouthRadius=.17+f.size*.1;
        if(dx*dx+dy*dy+dz*dz<mouthRadius*mouthRadius){
          // Consume only one pellet, then release the feeding spot for another fish.
          food.eaten=true;food.eatenBy=f.id;food.eatenAt=this.elapsed;food.mesh.visible=false;food.mesh.removeFromParent?.();foods.splice(i,1);
          f.bites=(f.bites||0)+1;
          f.servingBites.set(food.serving,(f.servingBites.get(food.serving)||0)+1);
          this.releaseFood(f,true);
          if(food.meal.diner===f.id)delete food.meal.diner;
          delete food.pursuer;delete food.reservedUntil;
          f.chewUntil=this.elapsed+2.5;
          f.cooldownUntil=f.chewUntil;f.activityUntil=Math.max(f.activityUntil,this.elapsed+5);
          break;
        }
      }
    }
  }
  resolve(iterations){this.lastMaxCorrection=0;
    const limit=this.predators.length?Math.max(iterations,24):iterations;for(let k=0;k<limit;k++){let maxDepth=0;
      for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
        const a=this.fish[i],b=this.fish[j];if(a.g.position.distanceToSquared(b.g.position)>Math.pow(pairReach(a,b)+.1,2))continue;
        const c=measure(a,b,0,.06);if(c.gap>=-.0001)continue;const depth=-c.gap,shift=Math.min(depth*.52,.2);maxDepth=Math.max(maxDepth,depth);this.lastMaxCorrection=Math.max(this.lastMaxCorrection,shift);
        const aw=a.predator&&!b.predator?.08:!a.predator&&b.predator?1.92:a.feeding&&!b.feeding?.2:(!a.feeding&&b.feeding?1.8:1),bw=b.predator&&!a.predator?.08:!b.predator&&a.predator?1.92:b.feeding&&!a.feeding?.2:(!b.feeding&&a.feeding?1.8:1);
        const horizontal=Math.hypot(c.x,c.z),nx=horizontal>.05?c.x/horizontal:Math.sin(a.yaw),nz=horizontal>.05?c.z/horizontal:Math.cos(a.yaw);
        this.correctPosition(a,nx*shift*aw,nz*shift*aw);this.correctPosition(b,-nx*shift*bw,-nz*shift*bw);
      }maxDepth=Math.max(maxDepth,this.resolveReef(1));if(maxDepth<.002)break;
    }
  }
  syncModel(f,dt,immediate=false){const model=f.model,burst=f.species?.locomotion==='burst-rest'&&!f.feeding;
    if(immediate||!f.renderVelocity){model.position.copy(f.g.position);model.quaternion.copy(f.g.quaternion);f.renderVelocity=f.velocity.clone();f.renderAcceleration=0;this.syncSharkPose(f,0);return;}
    const desired=f.g.position.clone().sub(model.position).multiplyScalar(f.predator?3.5:10).add(f.velocity),maxSpeed=f.predator?f.cruise*2.1:burst?f.cruise*4.6:Math.max(f.feedSpeed,f.cruise*3.2);
    if(f.predator)this.avoidRenderedRocks(f,desired);
    if(desired.length()>maxSpeed)desired.setLength(maxSpeed);
    const change=desired.sub(f.renderVelocity),limit=(f.predator?.48:burst?60:5)*dt;if(change.length()>limit)change.setLength(limit);
    const before=f.renderVelocity.length();f.renderVelocity.add(change);f.renderAcceleration=(f.renderVelocity.length()-before)/dt;model.position.addScaledVector(f.renderVelocity,dt);
    model.quaternion.slerp(f.g.quaternion,1-Math.exp(-dt*(f.predator?6:12)));
    if(f.g.userData.swim){const swim=f.g.userData.swim,boost=clamp(Math.max(f.acceleration||0,f.renderAcceleration)/Math.max(.3,f.predator?.48:2.2),0,1);swim.effort.value=Math.max(swim.effort.value,.35+f.renderVelocity.length()/Math.max(.3,f.cruise)*.38+boost*.65);}
    const fold=f.g.userData.swim?.tailFold;if(fold){const target=burst&&f.activity==='dash'&&f.burstLaunched?clamp(f.renderVelocity.length()/(f.cruise*3.5),0,1):0;fold.value+=(target-fold.value)*(1-Math.exp(-dt*14));}
    this.syncSharkPose(f,dt);
    const mouth=model.userData.mouth;
    if(mouth){const target=f.forage?f.mouthOpen:this.elapsed<f.chewUntil?.25*Math.max(0,Math.sin(this.elapsed*16)):0;
      mouth.open+=(target-mouth.open)*(1-Math.exp(-dt*24));
      mouth.cavity.scale.y=.004+mouth.open*.017;
      mouth.upper.position.y=.006+mouth.open*.010;mouth.lower.position.y=-.006-mouth.open*.014;
    }
  }
  syncSharkPose(f,dt){
    if(!f.predator)return;
    const swim=f.g.userData.swim;
    if(swim)swim.phase.value=f.tailPhase;
    f.visualState={phase:f.tailPhase,effort:swim?.effort.value??f.effort,bendPitch:swim?.bend?.value.x??f.bendPitch,bendYaw:swim?.bend?.value.y??f.bendYaw};
    if(dt&&f.visualEffort!==undefined){const delta=f.visualState.effort-f.visualEffort;f.visualState.effort=f.visualEffort+clamp(delta*(1-Math.exp(-dt*4)),-dt*1.2,dt*1.2);if(swim)swim.effort.value=f.visualState.effort;}
    f.visualEffort=f.visualState.effort;
    // Separate only at spawn. Never clip a live stroke or reset momentum at contact.
    if(dt)return;
    for(let i=0;i<96;i++){
      const bounds=this.renderedBounds(f);let closest={gap:Infinity};
      for(const o of this.obstacles)if(o.kind==='rock'||o.kind==='jellyfish'){const c=this.obstacleContact(bounds,o,0,3);if(c.gap<closest.gap)closest=c;}
      if(closest.gap>=2.5)break;
      f.model.position.addScaledVector(new T.Vector3(closest.x,closest.y,closest.z).normalize(),Math.min(.25,2.5-closest.gap));
    }
    f.g.position.copy(f.model.position);
  }
  avoidRenderedRocks(f,desired){
    const constraints=[],rotation=f.model.quaternion.clone(),state=f.visualState;
    // A larger body sweeps a wider arc while its momentum settles.
    const rockClearance=2.4+Math.max(0,f.size-(f.species?.size??f.size))*2;
    // Evaluate the coming turn and half-stroke as well as the current pose.
    // A turning tail can approach a wall even when root velocity points away.
    for(const horizon of [0,1.5,3]){
      if(horizon){const e=new T.Euler().setFromQuaternion(rotation,'YZX');e.y+=f.yawVelocity*horizon;e.z+=clamp(f.pitchVelocity*horizon,-.2,.2);f.model.quaternion.setFromEuler(e);f.visualState={...state,phase:state.phase+horizon*(1+f.speed*1.6)};}
      const bounds=this.renderedBounds(f);
      for(const o of this.obstacles){if(o.kind!=='rock'&&o.kind!=='jellyfish')continue;
        const jelly=o.kind==='jellyfish',range=jelly?9:Math.max(5,rockClearance+2.6),c=this.obstacleContact(bounds,o,0,range);
        if(c.gap>range)continue;
        const normal=new T.Vector3(c.x,c.y,c.z).normalize();
        constraints.push({normal,priority:jelly?0:1,minimum:jelly?(5-c.gap)*.9+normal.dot(o.velocity||new T.Vector3()):(rockClearance-c.gap)*.65});
      }
    }
    f.model.quaternion.copy(rotation);f.visualState=state;
    // Brake and round the rock well before the tail/pectoral sweep reaches it.
    // Velocity is filtered afterwards; the body and tail keep their own clocks.
    constraints.push({normal:new T.Vector3(0,-1,0),minimum:(f.model.position.y-f.maxY+.2)*.8});
    // Resolve rock constraints last when a jelly safety margin approaches a wall.
    constraints.sort((a,b)=>(a.priority??2)-(b.priority??2));
    for(let pass=0;pass<3;pass++)for(const {normal,minimum} of constraints){
      const along=desired.dot(normal);if(along<minimum)desired.addScaledVector(normal,minimum-along);
    }
  }
  residentBounds(f,rendered=false){
    // Include the dorsal, pectoral tips and caudal fin, not just the torso.
    // Keep the torso round instead of extending the dorsal height below the belly.
    // The body capsules alone are narrower than the shark's long swept wings.
    const key=rendered?'renderBounds':'simulationResidentBounds',g=rendered?f.model:f.g;
    const proxy=f[key]||(f[key]={predator:true,residentEnvelope:true,g,segments:Array.from({length:f.segments.length+4},()=>({g,axis:new T.Vector3(),offset:new T.Vector3(),back:0,front:1,radius:f.size*.16,vertical:1}))});
    proxy.velocity=rendered?(f.renderVelocity||f.velocity):f.velocity;if(!rendered&&proxy.version===f.boundsVersion)return proxy;proxy.version=f.boundsVersion;
    const state=rendered?f.visualState:null,effort=state?.effort??(rendered?(f.g.userData.swim?.effort.value??f.effort):f.effort),bendPitch=state?.bendPitch??f.bendPitch,bendYaw=state?.bendYaw??f.bendYaw,phase=state?.phase??f.tailPhase;
    const k=Math.hypot(bendPitch,bendYaw),center=x=>{const d=Math.max(0,.45-x),along=k>.001?Math.sin(d*k)/k:d,across=k>.001?(1-Math.cos(d*k))/(k*k):.5*d*d;return new T.Vector3(x+d-along,bendPitch*across,bendYaw*across+Math.sin(phase+x*2.5)*Math.pow(Math.max(0,.25-x),2)*.065*effort);};
    const bounds=[f.back/f.size,-.95,-.25,.45,f.front/f.size];
    for(let i=0;i<f.segments.length;i++){const source=f.segments[i],target=proxy.segments[i];target.offset.copy(center(bounds[i])).multiplyScalar(f.size).applyQuaternion(g.quaternion);target.axis.copy(center(bounds[i+1])).multiplyScalar(f.size).applyQuaternion(g.quaternion).sub(target.offset);target.front=target.axis.length();target.axis.divideScalar(target.front);target.radius=source.radius;target.vertical=1;target.velocity=proxy.velocity;}
    const deform=([x,y,z])=>{const tangent=center(x+.002).sub(center(x-.002)).normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),tangent);return new T.Vector3(0,y,z).applyQuaternion(q).add(center(x)).multiplyScalar(f.size).applyQuaternion(g.quaternion);};
    const fins=[[[.08,-.07,-.25],[-.49,-.145,-.68]],[[.08,-.07,.25],[-.49,-.145,.68]],[[-1.96,.54,0],[-1.84,-.30,0]],[[.12,.26,0],[-.22,.64,0]]];
    fins.forEach(([a,b],i)=>{const segment=proxy.segments[f.segments.length+i];segment.offset.copy(deform(a));segment.axis.copy(deform(b)).sub(segment.offset);segment.front=segment.axis.length();segment.axis.divideScalar(segment.front);segment.velocity=proxy.velocity;});
    return proxy;
  }
  renderedBounds(f){return this.residentBounds(f,true);}
  update(dt,foods){this.accumulator=Math.min(this.accumulator+dt,.2);while(this.accumulator>=this.stepSize){this.step(this.stepSize,foods);this.accumulator-=this.stepSize;for(let i=0;i<this.count;i++)this.syncModel(this.fish[i],this.stepSize);}}
  audit(){let minGap=Infinity,minUp=1,minSpeed=Infinity,maxSpeed=0,pursuers=0,bites=0;const up=new T.Vector3(0,1,0),modes={};
    for(let i=0;i<this.count;i++){const f=this.fish[i];minUp=Math.min(minUp,up.clone().applyQuaternion(f.g.quaternion).y);minSpeed=Math.min(minSpeed,f.speed);maxSpeed=Math.max(maxSpeed,f.speed);pursuers+=f.feeding?1:0;bites+=f.bites||0;modes[f.mode]=(modes[f.mode]||0)+1;for(let j=i+1;j<this.count;j++)minGap=Math.min(minGap,measure(f,this.fish[j]).gap);}
    let jellyfishGap=Infinity,rockGap=Infinity;const jellies=this.obstacles.filter(o=>o.kind==='jellyfish'),rocks=this.obstacles.filter(o=>o.kind==='rock');for(const f of this.predators){if(f.id>=this.count||(!jellies.length&&!rocks.length))continue;const visible=this.renderedBounds(f);for(const o of jellies)jellyfishGap=Math.min(jellyfishGap,this.obstacleGap(visible,o));for(const o of rocks)rockGap=Math.min(rockGap,this.obstacleGap(visible,o));}
    return {minGap,minUp,rockGap:Number.isFinite(rockGap)?rockGap:null,jellyfishGap:Number.isFinite(jellyfishGap)?jellyfishGap:null,overlaps:minGap<-.01?1:0,fish:this.count,behavior:{pursuers,bites,grazingBites:this.fish.slice(0,this.count).reduce((n,f)=>n+f.grazingBites,0),foragers:this.fish.slice(0,this.count).filter(f=>f.forage).length,grazing:this.fish.slice(0,this.count).filter(f=>f.forage).map(f=>({id:f.id,kind:f.forage.site.kind,stage:f.forage.stage,distance:f.g.position.distanceTo(f.forage.center),age:this.elapsed-f.forage.started})),minSpeed,maxSpeed,modes,playChases:this.predators.reduce((n,f)=>n+f.playCount,0),playing:this.predators.filter(f=>f.id<this.count&&f.playTarget).map(f=>({shark:f.id,target:f.playTarget.id,until:f.playUntil}))}};
  }
}
globalThis.AquariumMotion=AquariumMotion;
})();
