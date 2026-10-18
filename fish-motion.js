/* Upright swimming and length-aware collision handling; no runtime dependencies beyond Three.js. */
(() => {
'use strict';
const T=globalThis.THREE, clamp=T.MathUtils.clamp;
const contact={x:0,y:0,z:0,gap:0};
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
  constructor(fish,random){this.fish=fish;this.random=random;this.count=0;this.elapsed=0;this.accumulator=0;this.stepSize=1/60;this.lastMaxCorrection=0;}
  static floorHeight(x,z){return -4.7+.13*Math.sin(x*.6+z*.25)+.17*Math.cos(z*.4)+.1*Math.sin(x*1.8+z*.7);}
  register(f){
    f.id=this.fish.length;f.yaw=f.direction>0?0:Math.PI;f.pitch=0;f.roll=0;
    f.radius=f.size*(f.rounded?.98:.9);f.vertical=f.kind===2?2.15:1.25;f.back=-1.2*f.size;f.front=.23*f.size;
    f.goal=new T.Vector3();f.steer=new T.Vector3();f.axis=new T.Vector3();f.home=new T.Vector3();
    f.cruise=(f.species?f.species.speed:(f.kind===3?.85:.58))*(.93+this.random()*.14);
    f.speed=f.cruise;f.wanderPhase=this.random()*Math.PI*2;f.tailPhase=f.phase||this.random()*Math.PI*2;f.effort=.6;
    const anal=f.species?Math.max(...f.species.anal.map(p=>p[1])):.25;
    f.floorClearance=f.kind===2?1.9*f.size+.12:((f.species?f.species.height:.5)+anal)*f.size+.10;
    f.feedSpeed=clamp(f.cruise*3.2,1.8,2.8);f.targetFood=null;f.nextSense=this.elapsed+this.random()*.2;f.cooldownUntil=0;
    f.mode='cruise';f.activity='cruise';f.activityFactor=1;f.activityUntil=this.elapsed+2+this.random()*6;f.homeUntil=this.elapsed+16+this.random()*25;
    f.velocity=new T.Vector3(Math.cos(f.yaw)*f.speed,0,-Math.sin(f.yaw)*f.speed);
    this.orient(f);this.fish.push(f);this.place(f,this.fish.length-1);f.home.copy(f.g.position);this.chooseGoal(f);this.orient(f);
  }
  minY(f,x=f.g.position.x,z=f.g.position.z){return AquariumMotion.floorHeight(x,z)+f.floorClearance;}
  chooseActivity(f){const r=this.random(),small=f.kind===3;
    if(r<.13){f.activity='hover';f.activityFactor=.05+this.random()*.13;f.activityUntil=this.elapsed+1.1+this.random()*2.3;}
    else if(r<.38){f.activity='glide';f.activityFactor=.28+this.random()*.28;f.activityUntil=this.elapsed+1.8+this.random()*3.7;}
    else if(r>(small?.82:.9)){f.activity='dart';f.activityFactor=1.45+this.random()*.5;f.activityUntil=this.elapsed+.8+this.random()*1.5;}
    else {f.activity='cruise';f.activityFactor=.72+this.random()*.5;f.activityUntil=this.elapsed+3.5+this.random()*6.5;}
    if(f.activity==='hover')f.goal.copy(f.g.position).addScaledVector(f.axis,.6);else this.chooseGoal(f);
  }
  chooseGoal(f){const r=this.random,p=f.g.position;
    // Independent, slowly changing territories replace synchronized trips to the two tank ends.
    if(this.elapsed>f.homeUntil){f.home.set(-11+r()*22,-1.9+r()*6,-6+r()*11);f.homeUntil=this.elapsed+22+r()*32;}
    const angle=f.yaw+(r()-.5)*2.8,reach=2.5+r()*5;
    f.goal.set(p.x+Math.cos(angle)*reach,p.y+(r()-.5)*3.8,p.z-Math.sin(angle)*reach);
    f.goal.lerp(f.home,.16+r()*.17);f.goal.x=clamp(f.goal.x,-12.5,12.5);f.goal.z=clamp(f.goal.z,-6.8,5.8);
    f.goal.y=clamp(f.goal.y,Math.max(-2.3,this.minY(f,f.goal.x,f.goal.z)+.25),5.2);
    f.nextGoal=this.elapsed+6+r()*9;
  }
  place(f,limit){for(let attempt=0;attempt<400;attempt++){
    f.g.position.set(-13+this.random()*26,-2+this.random()*6,-7+this.random()*13);
    let clear=true;for(let j=0;j<limit;j++)if(measure(f,this.fish[j],0,.3).gap<0){clear=false;break;}if(clear)return;
  }}
  setCount(count){const before=this.count;this.count=count;
    for(let i=before;i<count;i++){const f=this.fish[i];this.place(f,i);f.home.copy(f.g.position);this.chooseGoal(f);}
    for(let i=count;i<before;i++)this.releaseFood(this.fish[i],false);this.resolve(12);
  }
  orient(f){f.g.rotation.set(f.roll,f.yaw,f.pitch,'YZX');f.axis.set(Math.cos(f.yaw)*Math.cos(f.pitch),Math.sin(f.pitch),-Math.sin(f.yaw)*Math.cos(f.pitch));}
  releaseFood(f,satisfied){const food=f.targetFood;if(food&&food.pursuer===f.id){delete food.pursuer;delete food.reservedUntil;}f.targetFood=null;
    if(satisfied||food){f.activity='depart';f.activityFactor=1.15;f.activityUntil=this.elapsed+3+this.random()*3;f.cooldownUntil=this.elapsed+(satisfied?4+this.random()*6:.6+this.random());
      // Leave on different headings after a bite; other fish get a turn at the food.
      const angle=f.yaw+(f.id%2?1:-1)*(.7+this.random()*1.2),p=f.g.position,reach=4+this.random()*4;
      f.goal.set(clamp(p.x+Math.cos(angle)*reach,-12,12),clamp(p.y+(this.random()-.5)*2,Math.max(-2.5,this.minY(f)+.3),5),clamp(p.z-Math.sin(angle)*reach,-6.5,5.8));f.nextGoal=f.activityUntil;
    }
  }
  perceive(f,foods){
    if(this.elapsed<f.nextSense||this.elapsed<f.cooldownUntil)return;
    f.nextSense=this.elapsed+.10+this.random()*.15;
    let best=null,bestScore=Infinity;const p=f.g.position;
    for(const food of foods){
      if(food.eaten||(food.pursuer!==undefined&&food.pursuer!==f.id&&food.reservedUntil>this.elapsed))continue;
      const q=food.mesh.position,dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d2=dx*dx+dy*dy+dz*dz;
      const sight=f.kind===3?8.5:9.5;if(d2>sight*sight)continue;
      const distance=Math.sqrt(d2),view=(dx*f.axis.x+dy*f.axis.y+dz*f.axis.z)/Math.max(.01,distance);
      if(distance>2.7&&view<-.28)continue;
      // Tall fish don't dive through the sand to chase a pellet only a small fish can reach.
      if(q.y<this.minY(f,q.x,q.z)-f.size*.43-.2)continue;
      const score=distance+(1-view)*1.2;
      if(score<bestScore){best=food;bestScore=score;}
    }
    if(best){best.pursuer=f.id;best.reservedUntil=this.elapsed+5;f.targetFood=best;f.noticeUntil=this.elapsed+.06+this.random()*.16;f.chaseStarted=this.elapsed;}
  }
  steerFish(f,foods){const p=f.g.position;
    if(f.targetFood&&(f.targetFood.eaten||!foods.includes(f.targetFood)||f.targetFood.pursuer!==f.id||this.elapsed-f.chaseStarted>14))this.releaseFood(f,!!f.targetFood.eaten);
    if(!f.targetFood)this.perceive(f,foods);
    if(this.elapsed>f.activityUntil&&!f.targetFood)this.chooseActivity(f);
    let goal=f.goal;f.feeding=!!f.targetFood&&this.elapsed>=f.noticeUntil;
    if(f.feeding){const food=f.targetFood;food.reservedUntil=this.elapsed+5;
      const q=food.mesh.position,dx=q.x-p.x,dz=q.z-p.z,hd=Math.max(.05,Math.hypot(dx,dz)),nose=f.size*.92;
      // Aim the mouth, not the body's centre, at a slowly sinking pellet.
      f.seekX=q.x-dx/hd*nose;f.seekZ=q.z-dz/hd*nose;
      const prediction=clamp(hd/Math.max(1.2,f.feedSpeed),0,.45)*(food.speed||0);
      f.seekY=clamp(q.y-prediction,this.minY(f,f.seekX,f.seekZ)+.04,6.1);
      f.steer.set(f.seekX-p.x,(f.seekY-p.y)*.95,f.seekZ-p.z);
      const mouthDistance=Math.hypot(q.x-p.x-f.axis.x*f.size*.98,q.y-p.y-f.axis.y*f.size*.98,q.z-p.z-f.axis.z*f.size*.98);
      f.desiredSpeed=f.feedSpeed*(.25+.75*T.MathUtils.smoothstep(mouthDistance,.25,2));f.mode='feeding';
    }else{
      if(f.activity!=='hover'&&(p.distanceToSquared(goal)<1||this.elapsed>f.nextGoal)){
        if(this.random()<.2){f.activity='hover';f.activityFactor=.08;f.activityUntil=this.elapsed+1+this.random()*2;goal.copy(p).addScaledVector(f.axis,.5);}else this.chooseGoal(f);
      }
      f.steer.copy(goal).sub(p);f.steer.y*=.5;
      // Low-frequency wandering and stroke/glide rhythms are independent for every fish.
      f.steer.x+=Math.sin(this.elapsed*.47+f.wanderPhase)*.45;
      f.steer.z+=Math.cos(this.elapsed*.37+f.wanderPhase*1.7)*.45;
      const rhythm=1+.15*Math.sin(this.elapsed*.8+f.wanderPhase)+.08*Math.sin(this.elapsed*1.7+f.wanderPhase*2);
      f.desiredSpeed=f.cruise*f.activityFactor*rhythm;f.mode=f.activity;
    }
    const length=f.steer.length();if(length>.001)f.steer.multiplyScalar(Math.max(.18,f.desiredSpeed)/length);
    if(Math.abs(p.x)>7.3&&p.y<-.6){f.steer.y+=(-.6-p.y)*.5;f.steer.x-=Math.sign(p.x)*.4;}
    const bottom=this.minY(f)+.12;if(p.y<bottom)f.steer.y+=(bottom-p.y)*.9;
    if(p.y>5.9)f.steer.y-=(p.y-5.9)*.9;
    if(p.x>13)f.steer.x-=(p.x-13)*.8;if(p.x< -13)f.steer.x+=(-13-p.x)*.8;
    if(p.z< -7)f.steer.z+=(-7-p.z)*.7;if(p.z>6)f.steer.z-=(p.z-6)*.7;
  }
  step(dt,foods){this.elapsed+=dt;
    for(const food of foods)if(food.pursuer>=this.count){delete food.pursuer;delete food.reservedUntil;}
    for(let i=0;i<this.count;i++)this.steerFish(this.fish[i],foods);
    for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
      const a=this.fish[i],b=this.fish[j],d2=a.g.position.distanceToSquared(b.g.position);if(d2>49)continue;
      const lead=Math.min(1.2,1.4/Math.max(.6,a.speed+b.speed)),c=measure(a,b,lead,.5);
      if(c.gap<0){const force=Math.min(2.5,-c.gap*1.7),nx=c.x,ny=c.y,nz=c.z;
        a.steer.x+=nx*force;a.steer.y+=ny*force*.7;a.steer.z+=nz*force;b.steer.x-=nx*force;b.steer.y-=ny*force*.7;b.steer.z-=nz*force;
        const dx=a.g.position.x-b.g.position.x,dz=a.g.position.z-b.g.position.z;
        if(Math.abs(dx)>Math.abs(dz)*2){const side=a.id<b.id?1:-1;a.steer.z+=side*force*.5;b.steer.z-=side*force*.5;}
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
      const turnRate=f.feeding?1.65:f.activity==='hover'?.45:.75+(f.activity==='dart'?.25:0),turn=clamp(delta,-dt*turnRate,dt*turnRate);f.yaw+=turn;
      // Accelerate into a chase, brake before a sharp turn or a bite, then glide out.
      const headingBrake=1-(f.feeding?.52:.56)*clamp(Math.abs(delta)/1.9,0,1),targetSpeed=f.desiredSpeed*headingBrake;
      const acceleration=f.feeding?2.2:1.0,deceleration=f.feeding?3:1.3;
      f.speed+=clamp(targetSpeed-f.speed,-deceleration*dt,acceleration*dt);
      const pitchLimit=f.feeding?.40:.22,pitchTarget=clamp(Math.atan2(s.y,Math.max(.12,horizontal)),-pitchLimit,pitchLimit);
      f.pitch+=(pitchTarget-f.pitch)*(1-Math.exp(-dt*(f.feeding?3.2:1.5)));
      f.roll+=(clamp(-turn/dt*.055,-.075,.075)-f.roll)*(1-Math.exp(-dt*3));this.orient(f);
      f.velocity.copy(f.axis).multiplyScalar(f.speed);f.g.position.addScaledVector(f.velocity,dt);
      f.g.position.x=clamp(f.g.position.x,-15,15);f.g.position.z=clamp(f.g.position.z,-8,7);f.g.position.y=clamp(f.g.position.y,this.minY(f),6.3);
      f.tailPhase=(f.tailPhase+dt*(1.5+f.speed*4.4+(f.feeding?.9:0)))%(Math.PI*40);
      f.effort+=(clamp(.17+f.speed/Math.max(.3,f.cruise)*.38+(f.feeding?.18:0),.18,1.45)-f.effort)*(1-Math.exp(-dt*4));
      if(f.g.userData.swim){f.g.userData.swim.phase.value=f.tailPhase;f.g.userData.swim.effort.value=f.effort;}
    }
    this.resolve(10);
    for(const food of foods){if(food.eaten)continue;const q=food.mesh.position;
      for(let j=0;j<this.count;j++){const f=this.fish[j];if(this.elapsed<f.cooldownUntil)continue;const p=f.g.position,nose=f.size*.98,dx=q.x-p.x-f.axis.x*nose,dy=q.y-p.y-f.axis.y*nose,dz=q.z-p.z-f.axis.z*nose,mouthRadius=.17+f.size*.10;
        if(dx*dx+dy*dy+dz*dz<mouthRadius*mouthRadius){food.eaten=true;f.bites=(f.bites||0)+1;this.releaseFood(f,true);break;}
      }
    }
  }
  resolve(iterations){this.lastMaxCorrection=0;
    for(let k=0;k<iterations;k++){let maxDepth=0;
      for(let i=0;i<this.count;i++)for(let j=i+1;j<this.count;j++){
        const a=this.fish[i],b=this.fish[j];if(a.g.position.distanceToSquared(b.g.position)>49)continue;
        const c=measure(a,b,0,.06);if(c.gap>=-.0001)continue;const depth=-c.gap,shift=Math.min(depth*.52,.2);maxDepth=Math.max(maxDepth,depth);this.lastMaxCorrection=Math.max(this.lastMaxCorrection,shift);
        a.g.position.x+=c.x*shift;a.g.position.y+=c.y*shift;a.g.position.z+=c.z*shift;b.g.position.x-=c.x*shift;b.g.position.y-=c.y*shift;b.g.position.z-=c.z*shift;
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
