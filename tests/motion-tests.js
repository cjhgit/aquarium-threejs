/* Open motion.html to run these deterministic behavior regressions without a build or server. */
(() => {
'use strict';
const T=globalThis.THREE;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
function seeded(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function fixture(count=12,seed=11042){const random=seeded(seed),fish=[],engine=new AquariumMotion(fish,random),plan=[0,5,1,5,2,5,3,5,4,5];
  for(let i=0;i<count;i++){const species=AQUARIUM_SPECIES[plan[i%plan.length]],g=new T.Group();g.userData.swim={phase:{value:0},effort:{value:.6}};engine.register({g,species,kind:species.kind,rounded:species.heritage,size:species.size*(.94+random()*.12),phase:random()*6.28,direction:random()>.5?1:-1});}engine.setCount(count);return {fish,engine};
}
function position(engine,f,x,y,z,yaw=0){f.g.position.set(x,y,z);f.yaw=yaw;f.pitch=0;f.roll=0;f.speed=f.cruise;f.velocity.set(Math.cos(yaw)*f.speed,0,-Math.sin(yaw)*f.speed);f.home.copy(f.g.position);f.goal.set(x+Math.cos(yaw)*8,y,z-Math.sin(yaw)*8);f.nextSense=0;f.nextGoal=100;f.activity='cruise';f.activityFactor=1;f.activityUntil=100;engine.orient(f);}
function pellet(x,y,z){return {mesh:{position:new T.Vector3(x,y,z)},speed:.17,life:0};}
function advance(engine,seconds,foods=[],sample=()=>{}){for(let i=0;i<Math.ceil(seconds*60);i++){engine.update(1/60,foods);sample(i);}}
globalThis.runMotionTests=async function(report=()=>{}){const results=[];
  async function test(name,run){try{const detail=await run();results.push({name,pass:true,detail});}catch(error){results.push({name,pass:false,detail:error.message});}report(results[results.length-1]);await new Promise(r=>setTimeout(r,0));}
  await test('看见食物后快速转入追食并明显加速',()=>{const {engine,fish}=fixture(1),f=fish[0];position(engine,f,-4,1,2);const food=pellet(0,1,2),before=f.g.position.distanceTo(food.mesh.position);advance(engine,1,[food]);assert(f.feeding,'没有进入追食状态');assert(f.speed>f.cruise*2,'追食没有达到巡游速度的两倍');assert(before-f.g.position.distanceTo(food.mesh.position)>1,'一秒内接近食物的距离不足');return {cruise:f.cruise,chase:f.speed};});
  await test('远处看不到的食物不改变其他鱼的速度',()=>{const a=fixture(1),b=fixture(1);position(a.engine,a.fish[0],-4,1,2);position(b.engine,b.fish[0],-4,1,2);advance(a.engine,1,[]);advance(b.engine,1,[pellet(40,1,2)]);assert(!b.fish[0].targetFood,'发现了视野外的食物');assert(Math.abs(a.fish[0].speed-b.fish[0].speed)<1e-8,'不可见食物改变了鱼速');});
  await test('鱼不会隔着后脑勺发现远处食物',()=>{const {engine,fish}=fixture(1),f=fish[0];position(engine,f,-4,1,2);advance(engine,.8,[pellet(-10,1,2)]);assert(!f.targetFood,'把身后远处的食物当成可见食物');});
  await test('用嘴吃到食物后游开，而不是停在原地',()=>{const {engine,fish}=fixture(1),f=fish[0];position(engine,f,-4,1,2);const food=pellet(0,1,2);let elapsed=0;while(!food.eaten&&elapsed<8){engine.update(1/60,[food]);elapsed+=1/60;}assert(food.eaten,'八秒内没有吃到前方食物');const distance=f.g.position.distanceTo(food.mesh.position);advance(engine,5,[]);assert(f.g.position.distanceTo(food.mesh.position)>distance+1,'吃完后没有明显离开投喂点');assert(!f.targetFood,'吃完仍锁定旧食物');return {biteAt:elapsed,bites:f.bites};});
  await test('独立的巡游、滑行、停留与短冲刺改变真实速度',()=>{const {engine,fish}=fixture(12),f=fish[0],modes=new Set();let lo=Infinity,hi=0,effortLo=Infinity,effortHi=0,lastStroke=Math.sin(f.tailPhase*.65),maxStrokeStep=0;advance(engine,100,[],()=>{lo=Math.min(lo,f.speed);hi=Math.max(hi,f.speed);modes.add(f.mode);effortLo=Math.min(effortLo,f.effort);effortHi=Math.max(effortHi,f.effort);const stroke=Math.sin(f.g.userData.swim.phase.value*.65);maxStrokeStep=Math.max(maxStrokeStep,Math.abs(stroke-lastStroke));lastStroke=stroke;});assert(hi-lo>f.cruise*.7,'巡游速度几乎恒定');assert(modes.size>=3,'没有足够的行为变化');assert(effortHi-effortLo>.2,'摆尾力度没有随游速变化');assert(maxStrokeStep<.18,'胸鳍摆动在相位循环时发生跳变');return {minSpeed:lo,maxSpeed:hi,modes:[...modes],maxStrokeStep};});
  await test('食物消失后散开，各自继续游动',()=>{const {engine,fish}=fixture(8),foods=Array.from({length:12},(_,i)=>pellet((i%4)*.15,1,Math.floor(i/4)*.15));fish.forEach((f,i)=>{const angle=i/8*Math.PI*2;position(engine,f,Math.cos(angle)*4,1,Math.sin(angle)*4,Math.atan2(Math.sin(angle),-Math.cos(angle)));});engine.resolve(15);advance(engine,5,foods);const pursuers=fish.filter(f=>f.targetFood);assert(pursuers.length>=2,'没有足够的鱼发现食物');const before=pursuers.reduce((sum,f)=>sum+Math.hypot(f.g.position.x,f.g.position.z),0)/pursuers.length;advance(engine,12,[]);const after=pursuers.reduce((sum,f)=>sum+Math.hypot(f.g.position.x,f.g.position.z),0)/pursuers.length;assert(pursuers.every(f=>!f.targetFood),'食物消失后仍然锁定目标');assert(after>before+.5,'追食的鱼没有散开');return {before,after};});
  await test('52 尾混合鱼长时间变速追食，保持直立且不相交',async()=>{let minUp=1,minGap=Infinity,bites=0;for(const seed of [11042,512,2026]){const {engine,fish}=fixture(52,seed);let foods=[];
    for(let frame=0;frame<10800;frame++){
      if(frame%1800===0){const f=fish[(frame/1800*7)%fish.length],p=f.g.position.clone().addScaledVector(f.axis,3);foods.push(...Array.from({length:12},(_,i)=>pellet(p.x+(i%4)*.13,p.y+.7,p.z+Math.floor(i/4)*.13)));}
      const dt=frame%7===0?1/30:1/60;engine.update(dt,foods);
      foods=foods.filter(food=>{food.life+=dt;food.mesh.position.y=Math.max(AquariumMotion.floorHeight(food.mesh.position.x,food.mesh.position.z)+.06,food.mesh.position.y-food.speed*dt);return !food.eaten&&food.life<24;});
      if(frame%60===0){const a=engine.audit();minUp=Math.min(minUp,a.minUp);minGap=Math.min(minGap,a.minGap);assert(a.minUp>.90,'追食时出现翻肚');assert(a.minGap>-.015,'变速追食出现碰撞包络相交');assert(fish.every(f=>Number.isFinite(f.g.position.x)&&Number.isFinite(f.speed)),'出现无效运动数值');}
      if(frame%600===0)await new Promise(r=>setTimeout(r,0));
    }bites+=fish.reduce((sum,f)=>sum+(f.bites||0),0);
  }assert(bites>15,'集中投喂后实际吃到的食物太少');return {simulatedSeconds:617,minUp,minGap,bites};});
  return {passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
};
})();
