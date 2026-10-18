/* Open motion.html to run these deterministic behavior regressions without a build or server. */
(() => {
'use strict';
const T=globalThis.THREE;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
function seeded(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function fixture(count=12,seed=11042,sharks=false){const random=seeded(seed),fish=[],engine=new AquariumMotion(fish,random),plan=[0,5,1,5,2,5,3,5,4,5];
  for(let i=0;i<count;i++){const species=AQUARIUM_SPECIES[sharks&&i<2?6:plan[(sharks?i-2:i)%plan.length]],g=new T.Group();g.userData.swim={phase:{value:0},effort:{value:.6}};engine.register({g,species,kind:species.kind,rounded:species.heritage,size:species.size*(.94+random()*.12),phase:random()*6.28,direction:random()>.5?1:-1});}engine.setCount(count);return {fish,engine};
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
  await test('吃到的鱼饵当步消失，未吃到的鱼饵保留',()=>{const {engine,fish}=fixture(1),f=fish[0];position(engine,f,0,1,0);
    const scene=new T.Scene(),food=pellet(f.size*.98,1,0),other=pellet(10,1,4);food.mesh=new T.Object3D();food.mesh.position.set(f.size*.98,1,0);other.mesh=new T.Object3D();other.mesh.position.set(10,1,4);scene.add(food.mesh,other.mesh);const foods=[food,other];
    engine.update(1/60,foods);assert(food.eaten,'嘴边鱼饵没有被吃掉');assert(!food.mesh.visible,'吃到后鱼饵仍可见');assert(food.mesh.parent===null,'吃到后鱼饵仍留在场景中');assert(foods.length===1&&foods[0]===other,'未即时移除吃到的那颗鱼饵，或误删其他鱼饵');assert(other.mesh.visible&&other.mesh.parent===scene,'未吃到的鱼饵被错误移除');assert(f.bites===1,'吃食计数没有同步');
  });
  await test('独立的巡游、滑行、停留与短冲刺改变真实速度',()=>{const {engine,fish}=fixture(12),f=fish[0],modes=new Set();let lo=Infinity,hi=0,effortLo=Infinity,effortHi=0,lastStroke=Math.sin(f.tailPhase*.65),maxStrokeStep=0;advance(engine,100,[],()=>{lo=Math.min(lo,f.speed);hi=Math.max(hi,f.speed);modes.add(f.mode);effortLo=Math.min(effortLo,f.effort);effortHi=Math.max(effortHi,f.effort);const stroke=Math.sin(f.g.userData.swim.phase.value*.65);maxStrokeStep=Math.max(maxStrokeStep,Math.abs(stroke-lastStroke));lastStroke=stroke;});assert(hi-lo>f.cruise*.7,'巡游速度几乎恒定');assert(modes.size>=3,'没有足够的行为变化');assert(effortHi-effortLo>.2,'摆尾力度没有随游速变化');assert(maxStrokeStep<.18,'胸鳍摆动在相位循环时发生跳变');return {minSpeed:lo,maxSpeed:hi,modes:[...modes],maxStrokeStep};});
  await test('食物消失后散开，各自继续游动',()=>{const {engine,fish}=fixture(8),foods=Array.from({length:3},(_,i)=>pellet(i*.15,1,0));fish.forEach((f,i)=>{const angle=i/8*Math.PI*2;position(engine,f,Math.cos(angle)*4,1,Math.sin(angle)*4,Math.atan2(Math.sin(angle),-Math.cos(angle)));});engine.resolve(15);advance(engine,1,foods);const pursuers=fish.filter(f=>f.targetFood);assert(pursuers.length>=1,'没有鱼发现食物');const before=pursuers.reduce((sum,f)=>sum+Math.hypot(f.g.position.x,f.g.position.z),0)/pursuers.length;advance(engine,12,[]);const after=pursuers.reduce((sum,f)=>sum+Math.hypot(f.g.position.x,f.g.position.z),0)/pursuers.length;assert(pursuers.every(f=>!f.targetFood),'食物消失后仍然锁定目标');assert(after>before+.5,'追食的鱼没有散开');return {before,after};});
  await test('每吃一颗休息 2.5 秒，同一批最多两颗，下一批重新计数',()=>{
    const {engine,fish}=fixture(1),f=fish[0],meal={},foods=Array.from({length:3},()=>({...pellet(f.nose,1,0),meal})),original=[...foods];
    position(engine,f,0,1,0);engine.update(1/60,foods);
    assert(f.bites===1&&foods.length===2,'同一帧连续吞掉多颗鱼饵');assert(!f.targetFood&&meal.diner===undefined,'吃完没有让出投喂位置');
    const firstAt=original.find(food=>food.eaten).eatenAt;
    // Keep the mouth touching the food: the pause must also guard physical consumption.
    for(let i=0;i<149;i++){position(engine,f,0,1,0);for(const food of foods)food.mesh.position.set(f.nose,1,0);engine.update(1/60,foods);assert(f.bites===1,'休息期间仍然吃食');assert(!f.targetFood,'休息期间又追食');}
    while(f.bites<2&&engine.elapsed<4){position(engine,f,0,1,0);engine.update(1/60,foods);}
    assert(f.bites===2&&foods.length===1,'休息结束后不能吃第二颗');const secondAt=original.filter(food=>food.eaten).map(food=>food.eatenAt).sort((a,b)=>a-b)[1];assert(secondAt-firstAt>=2.5,'两次吃食没有间隔');
    advance(engine,3,foods);position(engine,f,0,1,0);foods[0].mesh.position.set(f.nose,1,0);advance(engine,.1,foods);
    assert(f.bites===2&&foods.length===1&&!f.targetFood,'同一批第三颗仍被追食或吃掉');
    // A new click beside the old pellet merges the spatial queue, but keeps its own allowance.
    const newMeal={},next={...pellet(f.nose,1,0),meal:newMeal};foods.push(next);position(engine,f,0,1,0);engine.update(1/60,foods);
    assert(next.eaten&&f.bites===3,'新一批没有恢复进食资格');assert(foods.length===1&&!foods[0].eaten,'把旧批次剩余的第三颗也吃掉');
    return {firstAt,secondAt,oldBatchBites:f.servingBites.get(meal),newBatchBites:f.servingBites.get(newMeal)};
  });
  await test('前景沙地和近水面也能吃到，吃完不会瞬移回巡游区',()=>{const cases=[];for(const [name,x,y,z,fx,fy,fz,yaw] of [['前景',0,-1,6,0,AquariumMotion.floorHeight(0,12)+.06,12,-Math.PI/2],['近水面',-3,4.5,2,0,9.2,2,0]]){
    const species=AQUARIUM_SPECIES.find(s=>s.id==='starlight-tetra'),fish=[],engine=new AquariumMotion(fish,seeded(42)),f={g:new T.Group(),species,kind:species.kind,rounded:species.heritage,size:species.size,direction:1};engine.register(f);engine.setCount(1);position(engine,f,x,y,z,yaw);const food=pellet(fx,fy,fz),foods=[food];let time=0;
    while(foods.length&&time<8){engine.update(1/60,foods);if(foods.length)food.mesh.position.y=Math.max(AquariumMotion.floorHeight(fx,fz)+.06,food.mesh.position.y-food.speed/60);time+=1/60;}
    assert(food.eaten,`${name} 的鱼饵仍在可达范围之外`);const before=f.g.position.clone();engine.update(1/60,foods);assert(f.g.position.distanceTo(before)<.15,`${name} 吃完后发生边界瞬移`);cases.push({name,seconds:time});
  }return cases;});
  await test('六种鱼在前方、头顶、身下和过近位置都真正吃到鱼饵',()=>{let total=0,maxTime=0;
    for(const species of AQUARIUM_SPECIES.filter(s=>!s.predator))for(const [dx,dy] of [[4,0],[4,1.7],[4,-1.7],[0,1.7],[0,-1.2],[.25,0],[-.6,.2]]){
      const random=seeded(42),fish=[],engine=new AquariumMotion(fish,random),f={g:new T.Group(),species,kind:species.kind,rounded:species.heritage,size:species.size,direction:1};engine.register(f);engine.setCount(1);position(engine,f,0,1,0);const food=pellet(dx,1+dy,0),foods=[food];let time=0;
      while(foods.length&&time<6){engine.update(1/60,foods);if(foods.length)food.mesh.position.y=Math.max(AquariumMotion.floorHeight(dx,0)+.06,food.mesh.position.y-food.speed/60);time+=1/60;}
      assert(food.eaten&&foods.length===0,`${species.name} 没吃到相对位置 ${dx}, ${dy} 的鱼饵`);assert(food.mesh.visible===false,'吃食后鱼饵没有隐藏');maxTime=Math.max(maxTime,time);total++;
    }return {cases:total,maxSeconds:maxTime};
  });
  await test('32 尾鱼争食三颗近邻鱼饵，不堵在外圈，三颗全部吃完',()=>{const cases=[];for(const seed of [42,11042,512,2026,8192]){const {engine,fish}=fixture(32,seed);advance(engine,2);const foods=Array.from({length:3},(_,i)=>pellet(i*.15,.6,2)),original=[...foods];let time=0,maxDiners=0;
    while(foods.length&&time<12){engine.update(1/60,foods);for(const food of foods)food.mesh.position.y=Math.max(AquariumMotion.floorHeight(food.mesh.position.x,food.mesh.position.z)+.06,food.mesh.position.y-food.speed/60);maxDiners=Math.max(maxDiners,fish.filter(f=>f.feeding).length);time+=1/60;}
    assert(foods.length===0,`随机种子 ${seed} 仍有 ${foods.length} 颗鱼饵未吃到`);assert(original.every(food=>food.eaten&&food.mesh.visible===false),'鱼饵没有被真正吃掉');const diners=new Map();for(const food of original)diners.set(food.eatenBy,(diners.get(food.eatenBy)||0)+1);assert(diners.size>=2&&Math.max(...diners.values())<=2,'一条鱼包揽了三颗');assert(maxDiners<=1,'同一进食点出现互相阻挡的多个追食者');assert(engine.audit().minGap>-.015,'抢食时鱼体发生相交');cases.push({seed,seconds:time});
  }return cases;});
  await test('小鱼提前转向避开鲨鱼，近距离加速，远处不惊扰',()=>{
    const {engine,fish}=fixture(3,11042,true),[a,b,f]=fish;position(engine,a,0,1,0);position(engine,b,30,1,0);position(engine,f,3.9,1,0,Math.PI);
    const before=f.g.position.distanceTo(a.g.position),cruise=f.cruise;let maxFear=0,maxSpeed=0;advance(engine,4,[],()=>{maxFear=Math.max(maxFear,f.fear);maxSpeed=Math.max(maxSpeed,f.speed);});
    assert(maxFear>.3,'靠近鲨鱼没有产生避让');assert(maxSpeed>cruise*1.4,'小鱼没有加速拉开距离');assert(f.g.position.distanceTo(a.g.position)>before,'避让后与鲨鱼的距离没有增大');assert(engine.audit().minGap>-.015,'避让期间穿模');
    const distant=fixture(3,11042,true);position(distant.engine,distant.fish[0],30,1,0);position(distant.engine,distant.fish[1],-30,1,0);position(distant.engine,distant.fish[2],0,1,0);advance(distant.engine,1);assert(distant.fish[2].fear===0,'远处鲨鱼使小鱼无故惊慌');return {maxFear,maxSpeed,before,after:f.g.position.distanceTo(a.g.position)};
  });
  await test('鲨鱼持续巡游，不停悬，不抢鱼饵',()=>{const {engine,fish}=fixture(2,42,true),foods=[pellet(0,1,0)];position(engine,fish[0],-4,1,0);position(engine,fish[1],4,1,0,Math.PI);let minSpeed=Infinity;advance(engine,40,foods,()=>{for(const f of fish){minSpeed=Math.min(minSpeed,f.speed);assert(!f.targetFood&&!f.feeding,'鲨鱼追逐颗粒鱼饵');assert(f.activity!=='hover','鲨鱼原地停悬');}});assert(foods.length===1&&!foods[0].eaten,'鲨鱼抢走了小鱼的食物');assert(minSpeed>.4,'鲨鱼巡游速度过低');return {minSpeed};});
  await test('有鲨鱼时，前景沙地的三颗鱼饵仍由多条小鱼接力吃完',()=>{const cases=[];for(const seed of [42,11042,2026]){const {engine}=fixture(34,seed,true);advance(engine,2);const x=-4,z=14,y=AquariumMotion.floorHeight(x,z)+.06,foods=Array.from({length:3},(_,i)=>pellet(x+i*.14,y,z)),original=[...foods];let time=0;while(foods.length&&time<24){engine.update(1/60,foods);time+=1/60;}assert(foods.length===0,`种子 ${seed} 前景还有 ${foods.length} 颗没有被吃掉`);assert(new Set(original.map(food=>food.eatenBy)).size>=2,'前景三颗被同一条鱼吃完');cases.push({seed,seconds:time});}return cases;});
  await test('两条鲨鱼与 52 尾小鱼长时间共游，保持直立且不相交',async()=>{let minUp=1,minGap=Infinity,bites=0;for(const seed of [11042,512,2026]){const {engine,fish}=fixture(54,seed,true);let foods=[];
    for(let frame=0;frame<10800;frame++){
      if(frame%1800===0){const f=fish[(frame/1800*7)%fish.length],p=f.g.position.clone().addScaledVector(f.axis,3);foods.push(...Array.from({length:3},(_,i)=>pellet(p.x+i*.13,p.y+.7,p.z)));}
      const dt=frame%7===0?1/30:1/60;engine.update(dt,foods);
      foods=foods.filter(food=>{food.life+=dt;food.mesh.position.y=Math.max(AquariumMotion.floorHeight(food.mesh.position.x,food.mesh.position.z)+.06,food.mesh.position.y-food.speed*dt);return !food.eaten&&food.life<24;});
      if(frame%60===0){const a=engine.audit();minUp=Math.min(minUp,a.minUp);minGap=Math.min(minGap,a.minGap);assert(a.minUp>.90,'追食时出现翻肚');assert(a.minGap>-.015,`种子 ${seed} 第 ${frame} 帧碰撞包络相交：${a.minGap}`);assert(fish.every(f=>Number.isFinite(f.g.position.x)&&Number.isFinite(f.speed)),'出现无效运动数值');}
      if(frame%600===0)await new Promise(r=>setTimeout(r,0));
    }bites+=fish.reduce((sum,f)=>sum+(f.bites||0),0);
  }assert(bites>15,'集中投喂后实际吃到的食物太少');return {simulatedSeconds:617,minUp,minGap,bites};});
  return {passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
};
})();
