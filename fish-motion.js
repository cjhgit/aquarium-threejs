/* Upright swimming and length-aware collision handling; no runtime dependencies beyond Three.js. */
(() => {
'use strict';
const T=globalThis.THREE, clamp=T.MathUtils.clamp;
const contact={x:0,y:0,z:0,gap:0};
const pairReach=(a,b)=>a.lengthRadius+b.lengthRadius+(a.radius+b.radius)*Math.max(a.vertical,b.vertical);
// Closest points of two capsules. Their vertical scale accounts for tall fins.
function measure(a,b,lead=0,margin=0){
  const ay=Math.max(a.vertical,b.vertical),ap=a.g.position,bp=b.g.position;
  const ax=ap.x+a.velocity.x*lead, az=ap.z+a.velocity.z*lead, axY=(ap.y+a.velocity.y*lead)/ay;
  const bx=bp.x+b.velocity.x*lead, bz=bp.z+b.velocity.z*lead, bxY=(bp.y+b.velocity.y*lead)/ay;
  const aaAxis=a.axis,bbAxis=b.axis;
  const p1x=ax+aaAxis.x*a.back,p1y=axY+aaAxis.y*a.back/ay,p1z=az+aaAxis.z*a.back;
  const p2x=bx+bbAxis.x*b.back,p2y=bxY+bbAxis.y*b.back/ay,p2z=bz+bbAxis.z*b.back;
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
class AquariumMotion {
  constructor(fish,random){this.fish=fish;this.predators=[];this.random=random;this.count=0;this.elapsed=0;this.accumulator=0;this.stepSize=1/60;this.lastMaxCorrection=0;}
  static floorHeight(x,z){return -4.7+.13*Math.sin(x*.6+z*.25)+.17*Math.cos(z*.4)+.1*Math.sin(x*1.8+z*.7);}
  register(f){
    f.predator=!!f.species?.predator;f.fear=0;f.id=this.fish.length;f.yaw=f.direction>0?0:Math.PI;f.pitch=0;f.roll=0;
    f.radius=f.size*(f.rounded?.98:.9);f.vertical=f.kind===2?2.15:1.25;f.back=-1.2*f.size;f.front=.23*f.size;if(f.predator){f.radius=.30*f.size;f.vertical=2.05;f.back=-1.68*f.size;f.front=.74*f.size;}
    f.lengthRadius=Math.max(-f.back,f.front);f.boundRadius=f.lengthRadius+f.radius*f.vertical;
    f.goal=new T.Vector3();f.steer=new T.Vector3();f.axis=new T.Vector3();f.home=new T.Vector3();
    f.cruise=(f.species?f.species.speed:(f.kind===3?.85:.58))*(.93+this.random()*.14);
    f.speed=f.cruise;f.wanderPhase=this.random()*Math.PI*2;f.tailPhase=f.phase||this.random()*Math.PI*2;f.effort=.6;
    const anal=f.species?Math.max(...f.species.anal.map(p=>p[1])):.25;
    const dorsal=f.species?Math.max(...f.species.dorsal.map(p=>p[1])):.4;f.maxY=10-((f.species?f.species.height:.5)+dorsal)*f.size-.12;
    f.floorClearance=f.kind===2?1.9*f.size+.12:((f.species?f.species.height:.5)+anal)*f.size+.10;
    f.nose=f.size*1.014;f.previousMouth=new T.Vector3();f.lift=0;f.reverse=0;f.feedSpeed=clamp(f.cruise*3.2,1.8,2.8);f.targetFood=null;f.nextSense=this.elapsed+this.random()*.2;f.cooldownUntil=0;f.chewUntil=0;f.servingBites=new WeakMap();
    f.mode='cruise';f.activity='cruise';f.activityFactor=1;f.activityUntil=this.elapsed+2+this.random()*6;f.homeUntil=this.elapsed+16+this.random()*25;
    f.velocity=new T.Vector3(Math.cos(f.yaw)*f.speed,0,-Math.sin(f.yaw)*f.speed);
    this.orient(f);this.fish.push(f);if(f.predator)this.predators.push(f);this.place(f,this.fish.length-1);f.home.copy(f.g.position);this.chooseGoal(f);this.orient(f);
  }
  minY(f,x=f.g.position.x,z=f.g.position.z){return AquariumMotion.floorHeight(x,z)+f.floorClearance;}
  chooseActivity(f){if(f.predator){f.activity='cruise';f.activityFactor=.85+this.random()*.25;f.activityUntil=this.elapsed+6+this.random()*7;this.chooseGoal(f);return;}const r=this.random(),small=f.kind===3;
    if(r<.13){f.activity='hover';f.activityFactor=.05+this.random()*.13;f.activityUntil=this.elapsed+1.1+this.random()*2.3;}
    else if(r<.38){f.activity='glide';f.activityFactor=.28+this.random()*.28;f.activityUntil=this.elapsed+1.8+this.random()*3.7;}
    else if(r>(small?.82:.9)){f.activity='dart';f.activityFactor=1.45+this.random()*.5;f.activityUntil=this.elapsed+.8+this.random()*1.5;}
    else {f.activity='cruise';f.activityFactor=.72+this.random()*.5;f.activityUntil=this.elapsed+3.5+this.random()*6.5;}
    if(f.activity==='hover')f.goal.copy(f.g.position).addScaledVector(f.axis,.6);else this.chooseGoal(f);
  }
  chooseGoal(f){const r=this.random,p=f.g.position;
    if(f.predator){
      // Large sharks take broad circuits behind the smaller residents instead of repeatedly turning at the feeding patch.
      f.patrolAngle=(f.patrolAngle??(Math.PI*.5+f.id*Math.PI))+.65;
      const a=f.patrolAngle;f.goal.set(Math.sin(a)*12,2+Math.sin(a*.6+f.id)*.7,-5+Math.cos(a)*2.8);f.nextGoal=this.elapsed+14;return;
    }
    // Independent, slowly changing territories replace synchronized trips to the two tank ends.
    if(this.elapsed>f.homeUntil){f.home.set(-11+r()*22,-1.9+r()*6,-6+r()*11);f.homeUntil=this.elapsed+22+r()*32;}
    const angle=f.yaw+(r()-.5)*2.8,reach=2.5+r()*5;
    f.goal.set(p.x+Math.cos(angle)*reach,p.y+(r()-.5)*3.8,p.z-Math.sin(angle)*reach);
    f.goal.lerp(f.home,.16+r()*.17);f.goal.x=clamp(f.goal.x,-12.5,12.5);f.goal.z=clamp(f.goal.z,-6.8,5.8);
    f.goal.y=clamp(f.goal.y,Math.max(-2.3,this.minY(f,f.goal.x,f.goal.z)+.25),5.2);
    f.nextGoal=this.elapsed+6+r()*9;
  }
  place(f,limit){if(f.predator){const a=Math.PI*.5+f.id*Math.PI;f.patrolAngle=a;f.g.position.set(Math.sin(a)*12,2+f.id*.6,-5+Math.cos(a)*2.8);f.yaw=Math.atan2(Math.sin(a)*2.8,Math.cos(a)*12);this.orient(f);f.velocity.copy(f.axis).multiplyScalar(f.speed);return;}for(let attempt=0;attempt<400;attempt++){
    f.g.position.set(-13+this.random()*26,-2+this.random()*6,-7+this.random()*13);
    let clear=true;for(let j=0;j<limit;j++)if(measure(f,this.fish[j],0,.3).gap<0){clear=false;break;}if(clear)return;
  }}
  setCount(count){const before=this.count;this.count=count;
    for(let i=before;i<count;i++){const f=this.fish[i];this.place(f,i);f.home.copy(f.g.position);this.chooseGoal(f);}
    for(let i=count;i<before;i++)this.releaseFood(this.fish[i],false);this.resolve(12);
  }
  orient(f){f.g.rotation.set(f.roll,f.yaw,f.pitch,'YZX');f.axis.set(Math.cos(f.yaw)*Math.cos(f.pitch),Math.sin(f.pitch),-Math.sin(f.yaw)*Math.cos(f.pitch));}
  releaseFood(f,satisfied){const food=f.targetFood;if(food&&food.meal&&food.meal.diner===f.id)delete food.meal.diner;if(food&&food.pursuer===f.id){delete food.pursuer;delete food.reservedUntil;}f.targetFood=null;f.feeding=false;
    if(satisfied||food){f.activity='depart';f.activityFactor=1.15;f.activityUntil=this.elapsed+3+this.random()*3;f.cooldownUntil=this.elapsed+(satisfied?4+this.random()*6:.6+this.random());
      // Leave on different headings after a bite; other fish get a turn at the food.
      const angle=f.yaw+(f.id%2?1:-1)*(.7+this.random()*1.2),p=f.g.position,reach=4+this.random()*4;
      f.goal.set(clamp(p.x+Math.cos(angle)*reach,-12,12),clamp(p.y+(this.random()-.5)*2,Math.max(-2.5,this.minY(f)+.3),5),clamp(p.z-Math.sin(angle)*reach,-6.5,5.8));f.nextGoal=f.activityUntil;
    }
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
  pointClearance(f,q){const p=f.g.position,dx=q.x-p.x,dy=(q.y-p.y)/f.vertical,dz=q.z-p.z,ax=f.axis.x,ay=f.axis.y/f.vertical,az=f.axis.z,t=clamp((dx*ax+dy*ay+dz*az)/(ax*ax+ay*ay+az*az),f.back,f.front);return Math.hypot(dx-ax*t,dy-ay*t,dz-az*t)-f.radius;}
  foodScore(f,food){
    if(f.fear>.45||!this.canEat(f,food)||f.targetFood||this.elapsed<f.cooldownUntil||(food.failedBy&&food.failedBy[f.id]>this.elapsed))return Infinity;
    for(const shark of this.predators){if(shark.id<this.count&&this.pointClearance(shark,food.mesh.position)<.3)return Infinity;}
    // The open foreground sand remains visible beyond the usual midwater patrol depth.
    const p=f.g.position,q=food.mesh.position,dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,distance=Math.hypot(dx,dy,dz),sight=(f.kind===3?8.5:9.5)+clamp(q.z-6,0,6);
    if(distance>sight)return Infinity;const view=(dx*f.axis.x+dy*f.axis.y+dz*f.axis.z)/Math.max(.01,distance);
    if(distance>2.7&&view<-.28)return Infinity;
    if(q.y<this.minY(f,q.x,q.z)-f.size*.43-.2||q.y>f.maxY+f.nose*.39+.2)return Infinity;
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
    if(!f.targetFood)this.perceive(f,foods);
    if(this.elapsed>f.activityUntil&&!f.targetFood)this.chooseActivity(f);
    let goal=f.goal;f.feeding=!!f.targetFood&&this.elapsed>=f.noticeUntil;
    if(f.feeding){const food=f.targetFood;food.reservedUntil=this.elapsed+5;
      const q=food.mesh.position,dx=q.x-p.x,dz=q.z-p.z,hd=Math.hypot(dx,dz);
      // Keep facing the pellet itself. A moving offset goal caused reversal/orbiting near the mouth.
      f.seekX=q.x;f.seekZ=q.z;f.seekY=clamp(q.y-f.axis.y*f.nose,this.minY(f,q.x,q.z),f.maxY);
      f.steer.set(dx,(q.y-p.y)*.8,dz);
      const mouthDistance=Math.hypot(q.x-p.x-f.axis.x*f.nose,q.y-p.y-f.axis.y*f.nose,q.z-p.z-f.axis.z*f.nose);
      if(mouthDistance<f.bestFoodDistance-.025){f.bestFoodDistance=mouthDistance;f.lastFoodProgress=this.elapsed;}
      const remaining=hd-f.nose*Math.cos(f.pitch);
      // Arrive all the way at the mouth; no mandatory minimum speed and no endless circles.
      f.desiredSpeed=Math.min(f.feedSpeed,Math.max(0,remaining)*2.5);
      f.reverse=remaining<-.08&&mouthDistance>.2?clamp(remaining*1.6,-.65,0):0;f.mode='feeding';
      if(this.elapsed-f.lastFoodProgress>3.5){if(!food.failedBy)food.failedBy={};food.failedBy[f.id]=this.elapsed+3;this.releaseFood(f,false);}
    }else{
      f.reverse=0;if(f.activity!=='hover'&&(p.distanceToSquared(goal)<1||this.elapsed>f.nextGoal)){
        if(!f.predator&&this.random()<.2){f.activity='hover';f.activityFactor=.08;f.activityUntil=this.elapsed+1+this.random()*2;goal.copy(p).addScaledVector(f.axis,.5);}else this.chooseGoal(f);
      }
      f.steer.copy(goal).sub(p);f.steer.y*=.5;
      // Low-frequency wandering and stroke/glide rhythms are independent for every fish.
      f.steer.x+=Math.sin(this.elapsed*.47+f.wanderPhase)*.45;
      f.steer.z+=Math.cos(this.elapsed*.37+f.wanderPhase*1.7)*.45;
      const rhythm=1+.15*Math.sin(this.elapsed*.8+f.wanderPhase)+.08*Math.sin(this.elapsed*1.7+f.wanderPhase*2);
      f.desiredSpeed=f.cruise*(this.elapsed<f.chewUntil?.55:f.activityFactor)*rhythm;f.mode=f.activity;
    }
    const length=f.steer.length();if(length>.001)f.steer.multiplyScalar(Math.max(f.feeding?1.2:.18,f.desiredSpeed)/length);
    if(!f.feeding&&Math.abs(p.x)>7.3&&p.z<4&&p.y<-.6){f.steer.y+=(-.6-p.y)*.5;f.steer.x-=Math.sign(p.x)*.4;}
    const bottom=this.minY(f)+.12;if(p.y<bottom)f.steer.y+=(bottom-p.y)*.9;
    const top=f.feeding?f.maxY:5.9,side=f.feeding?Math.max(13,Math.abs(f.targetFood.mesh.position.x)+1):13,front=f.feeding?Math.max(6,f.targetFood.mesh.position.z+1):6;
    if(p.y>top)f.steer.y-=(p.y-top)*.9;
    if(p.x>side)f.steer.x-=(p.x-side)*.8;if(p.x< -side)f.steer.x+=(-side-p.x)*.8;
    if(p.z< -7)f.steer.z+=(-7-p.z)*.7;if(p.z>front)f.steer.z-=(p.z-front)*.7;
  }
  avoidPredators(f,dt){if(f.predator)return;
    let threat=0,escapeX=0,escapeY=0,escapeZ=0;
    for(const shark of this.predators){if(shark.id>=this.count||f.g.position.distanceToSquared(shark.g.position)>Math.pow(shark.boundRadius+f.boundRadius+5,2))continue;
      const c=measure(f,shark,.65,0),weight=clamp(1-c.gap/4,0,1);if(weight<=0)continue;
      threat=Math.max(threat,weight);escapeX+=c.x*weight;escapeY+=c.y*weight*.35;escapeZ+=c.z*weight;
      // Sideways motion opens a passage instead of reversing straight into following fish.
      if(Math.abs(c.x*shark.axis.x+c.z*shark.axis.z)>.75){const side=f.id%2?1:-1;escapeX+=shark.axis.z*side*weight*.8;escapeZ-=shark.axis.x*side*weight*.8;}
    }
    f.fear+=(threat-f.fear)*(1-Math.exp(-dt*(threat>f.fear?4:1.3)));
    if(threat>.08){if(f.targetFood&&threat>.45)this.releaseFood(f,false);
      f.steer.multiplyScalar(1-threat*.85);f.steer.x+=escapeX*3.5;f.steer.y+=escapeY*2;f.steer.z+=escapeZ*3.5;
    }
    if(f.fear>.08){f.desiredSpeed=Math.max(f.desiredSpeed,f.cruise*(1.15+f.fear*1.25));f.mode='avoiding';}
  }
  step(dt,foods){this.elapsed+=dt;this.prepareMeals(foods);
    for(let i=0;i<this.count;i++){const f=this.fish[i];f.previousMouth.copy(f.g.position).addScaledVector(f.axis,f.nose);}
    for(const food of foods)if(food.pursuer>=this.count){delete food.pursuer;delete food.reservedUntil;}
    for(let i=0;i<this.count;i++)this.steerFish(this.fish[i],foods);
    for(let i=0;i<this.count;i++)this.avoidPredators(this.fish[i],dt);
    for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
      const a=this.fish[i],b=this.fish[j],d2=a.g.position.distanceToSquared(b.g.position);if(d2>Math.pow(pairReach(a,b)+4,2))continue;
      const lead=Math.min(1.2,1.4/Math.max(.6,a.speed+b.speed)),c=measure(a,b,lead,.5);
      if(c.gap<0){const force=Math.min(2.5,-c.gap*1.7),nx=c.x,ny=c.y,nz=c.z;
        const aw=a.predator&&!b.predator?.10:!a.predator&&b.predator?1.9:a.feeding&&!b.feeding?.12:(!a.feeding&&b.feeding?1.8:1),bw=b.predator&&!a.predator?.10:!b.predator&&a.predator?1.9:b.feeding&&!a.feeding?.12:(!b.feeding&&a.feeding?1.8:1);
        a.steer.x+=nx*force*aw;a.steer.y+=ny*force*.7*aw;a.steer.z+=nz*force*aw;b.steer.x-=nx*force*bw;b.steer.y-=ny*force*.7*bw;b.steer.z-=nz*force*bw;
        const dx=a.g.position.x-b.g.position.x,dz=a.g.position.z-b.g.position.z;
        if(Math.abs(dx)>Math.abs(dz)*2){const side=a.id<b.id?1:-1;a.steer.z+=side*force*.5*aw;b.steer.z-=side*force*.5*bw;}
      }
      // Small fish sometimes swim loosely together, then return to their own paths.
      if(a.kind===3&&b.kind===3&&!a.feeding&&!b.feeding&&d2>3&&d2<16){
        if(Math.sin(this.elapsed*.11+a.wanderPhase)>.6)a.steer.addScaledVector(b.velocity,.09);
        if(Math.sin(this.elapsed*.11+b.wanderPhase)>.6)b.steer.addScaledVector(a.velocity,.09);
      }
    }
    for(let i=0;i<this.count;i++){
      const f=this.fish[i],s=f.steer,horizontal=Math.hypot(s.x,s.z);
      const targetYaw=horizontal>.04?Math.atan2(-s.z,s.x):f.yaw,delta=Math.atan2(Math.sin(targetYaw-f.yaw),Math.cos(targetYaw-f.yaw));
      const turnRate=f.predator?.48:f.fear>.15?1.8:f.feeding?2.2:f.activity==='hover'?.45:.75+(f.activity==='dart'?.25:0),turn=clamp(delta,-dt*turnRate,dt*turnRate);f.yaw+=turn;
      // Accelerate into a chase, brake before a sharp turn or a bite, then glide out.
      const headingBrake=f.predator?.8+.2*Math.max(0,Math.cos(delta)):f.feeding?Math.max(0,Math.cos(delta)):1-.56*clamp(Math.abs(delta)/1.9,0,1),targetSpeed=f.desiredSpeed*headingBrake;
      const acceleration=f.feeding||f.fear>.15?2.2:1.0,deceleration=f.feeding?3:1.3;
      f.speed+=clamp(targetSpeed-f.speed,-deceleration*dt,acceleration*dt);
      const pitchLimit=f.feeding?.40:.22,pitchTarget=clamp(Math.atan2(s.y,Math.max(.12,horizontal)),-pitchLimit,pitchLimit);
      f.pitch+=(pitchTarget-f.pitch)*(1-Math.exp(-dt*(f.feeding?3.2:1.5)));
      f.roll+=(clamp(-turn/dt*.055,-.075,.075)-f.roll)*(1-Math.exp(-dt*3));this.orient(f);
      // Pectoral lift aligns height without requiring a steep dive or a perpetual orbit.
      const liftTarget=f.feeding?clamp((f.seekY-f.g.position.y)*2.2-(f.targetFood.speed||0),-1.3,1.3)-f.axis.y*f.speed:0;
      f.lift+=clamp(liftTarget-f.lift,-3*dt,3*dt);
      f.velocity.copy(f.axis).multiplyScalar(f.speed);f.velocity.x+=f.axis.x*f.reverse;f.velocity.z+=f.axis.z*f.reverse;f.velocity.y+=f.lift;f.g.position.addScaledVector(f.velocity,dt);
      // Pursuit can enter the visible foreground and surface. Soft patrol bounds bring fish back afterwards.
      f.g.position.x=clamp(f.g.position.x,-43,43);f.g.position.z=clamp(f.g.position.z,-33,33);f.g.position.y=clamp(f.g.position.y,this.minY(f),f.maxY);
      const swimSpeed=f.velocity.length();f.tailPhase=(f.tailPhase+dt*(f.predator?.85+swimSpeed*1.25:1.5+swimSpeed*4.4+(f.feeding?.9:0)))%(Math.PI*40);
      f.effort+=(clamp(.17+swimSpeed/Math.max(.3,f.cruise)*.38+(f.feeding?.18:0),.18,1.45)-f.effort)*(1-Math.exp(-dt*4));
      if(f.g.userData.swim){f.g.userData.swim.phase.value=f.tailPhase;f.g.userData.swim.effort.value=f.effort;}
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
        a.g.position.x+=c.x*shift*aw;a.g.position.y+=c.y*shift*aw;a.g.position.z+=c.z*shift*aw;b.g.position.x-=c.x*shift*bw;b.g.position.y-=c.y*shift*bw;b.g.position.z-=c.z*shift*bw;
      }if(maxDepth<.002)break;
    }
  }
  update(dt,foods){this.accumulator=Math.min(this.accumulator+dt,.2);while(this.accumulator>=this.stepSize){this.step(this.stepSize,foods);this.accumulator-=this.stepSize;}}
  audit(){let minGap=Infinity,minUp=1,minSpeed=Infinity,maxSpeed=0,pursuers=0,bites=0;const up=new T.Vector3(0,1,0),modes={};
    for(let i=0;i<this.count;i++){const f=this.fish[i];minUp=Math.min(minUp,up.clone().applyQuaternion(f.g.quaternion).y);minSpeed=Math.min(minSpeed,f.speed);maxSpeed=Math.max(maxSpeed,f.speed);pursuers+=f.feeding?1:0;bites+=f.bites||0;modes[f.mode]=(modes[f.mode]||0)+1;for(let j=i+1;j<this.count;j++)minGap=Math.min(minGap,measure(f,this.fish[j]).gap);}
    return {minGap,minUp,overlaps:minGap<-.01?1:0,fish:this.count,behavior:{pursuers,bites,minSpeed,maxSpeed,modes}};
  }
}
globalThis.AquariumMotion=AquariumMotion;
})();
