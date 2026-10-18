/* Open motion.html to run these deterministic behavior regressions without a build or server. */
(() => {
'use strict';
const T=globalThis.THREE;
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
function seeded(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function fixture(count=12,seed=11042,sharks=false){const random=seeded(seed),fish=[],engine=new AquariumMotion(fish,random),plan=AQUARIUM_FISH_PLAN;
  for(let i=0;i<count;i++){const species=AQUARIUM_SPECIES[sharks&&i<2?6:plan[(sharks?i-2:i)%plan.length]],g=new T.Group();g.userData.swim={phase:{value:0},effort:{value:.6},bend:{value:new T.Vector2()}};engine.register({g,species,kind:species.kind,rounded:species.heritage,size:species.size*(.94+random()*.12),phase:random()*6.28,direction:random()>.5?1:-1});}engine.setCount(count);return {fish,engine};
}
function speciesFixture(species,count=1,seed=42){const fish=[],engine=new AquariumMotion(fish,seeded(seed));for(let i=0;i<count;i++)engine.register({g:new T.Group(),species,kind:species.kind,rounded:species.heritage,size:species.size,direction:1});engine.setCount(count);return {fish,engine};}
function position(engine,f,x,y,z,yaw=0){f.g.position.set(x,y,z);f.yaw=yaw;f.pitch=0;f.roll=0;f.speed=f.cruise;f.velocity.set(Math.cos(yaw)*f.speed,0,-Math.sin(yaw)*f.speed);f.home.copy(f.g.position);f.goal.set(x+Math.cos(yaw)*8,y,z-Math.sin(yaw)*8);f.nextSense=0;f.nextGoal=100;f.activity='cruise';f.activityFactor=1;f.activityUntil=100;engine.orient(f);}
function pellet(x,y,z){return {mesh:{position:new T.Vector3(x,y,z)},speed:.17,life:0};}
function advance(engine,seconds,foods=[],sample=()=>{}){for(let i=0;i<Math.ceil(seconds*60);i++){engine.update(1/60,foods);sample(i);}}
globalThis.runMotionTests=async function(report=()=>{}){const results=[];
  async function test(name,run){try{const detail=await run();results.push({name,pass:true,detail});}catch(error){results.push({name,pass:false,detail:error.message});}report(results[results.length-1]);await new Promise(r=>setTimeout(r,0));}
  await test('图鉴五项属性完整，鲨鱼最危险、最独处，灯鱼最聚群',()=>{
    for(const species of AQUARIUM_SPECIES)for(const key of ['size','schooling','danger','activity','speed'])assert(Number.isInteger(species.traits[key])&&species.traits[key]>=1&&species.traits[key]<=5,`${species.name} 缺少有效属性 ${key}`);
    const shark=AQUARIUM_SPECIES.find(s=>s.predator),tetra=AQUARIUM_SPECIES.find(s=>s.kind===3),active=AQUARIUM_SPECIES.find(s=>s.id==='tidal-swallow'),quiet=AQUARIUM_SPECIES.find(s=>s.id==='moon-angelfish');
    assert(shark.traits.schooling===1&&shark.traits.danger===5,'鲨鱼属性未设为最低聚集、最高危险');assert(tetra.traits.schooling===5&&tetra.size===Math.min(...AQUARIUM_SPECIES.map(s=>s.size)),'最小鱼未设为最高聚集');assert(active.traits.activity===5&&quiet.traits.activity===1,'鱼种活跃程度未区分');const fastest=AQUARIUM_SPECIES.find(s=>s.id==='silver-dart');assert(fastest.speed===Math.max(...AQUARIUM_SPECIES.map(s=>s.speed))&&fastest.speed>active.speed*2,'电光银梭没有独立的最高速度');
  });
  await test('电光银梭快速抵达不同地点，每次在附近休息后再次冲刺',()=>{
    const species=AQUARIUM_SPECIES.find(s=>s.id==='silver-dart'),cases=[];
    for(const fps of [25,60])for(const seed of [42,11042,2026]){
      const {engine,fish}=speciesFixture(species,1,seed),f=fish[0];let rests=0,dashes=0,restFrames=0,peak=0,maxRestRadius=0,maxAcceleration=0,lastActivity=f.activity,lastRest=null;
      let p=f.model.position.clone(),v=f.renderVelocity.clone();
      const sync=engine.syncModel.bind(engine);engine.syncModel=(f,dt,...args)=>{sync(f,dt,...args);if(!dt)return;const next=f.model.position.clone().sub(p).divideScalar(dt);maxAcceleration=Math.max(maxAcceleration,next.clone().sub(v).length()/dt);p.copy(f.model.position);v.copy(next);};
      for(let i=0;i<fps*180;i++){
        engine.update(1/fps,[]);peak=Math.max(peak,f.renderVelocity.length());
        if(f.activity!==lastActivity){if(f.activity==='rest'){rests++;assert(f.activityUntil-engine.elapsed>=23.9&&f.activityUntil-engine.elapsed<=42.01,'休息时间不是 24–42 秒');if(lastRest)assert(lastRest.distanceTo(f.restCenter)>6,'没有游到另一个地点');lastRest=f.restCenter.clone();}else if(f.activity==='dash')dashes++;lastActivity=f.activity;}
        if(f.activity==='rest')restFrames++;
        if(f.activity==='rest'&&engine.elapsed-f.restStarted>1)maxRestRadius=Math.max(maxRestRadius,f.model.position.distanceTo(f.restCenter));
        assert(Number.isFinite(f.speed)&&f.g.position.y<f.maxY+.01,'冲刺产生无效姿态或越过水面');
      }
      assert(rests>=3&&dashes>=3,`没有反复完成冲刺和休息：${rests}/${dashes}`);assert(peak>9,'没有达到爆发冲刺速度');assert(maxRestRadius<.6,`休息时游离停留点：${maxRestRadius}`);assert(maxAcceleration<=60.001,`冲刺急停产生速度跳变：${maxAcceleration}`);assert(restFrames/(fps*180)>.8,'没有将绝大多数时间用于休息');cases.push({fps,seed,rests,dashes,restFraction:restFrames/(fps*180),peak,maxRestRadius,maxAcceleration});
    }return cases;
  });
  await test('电光银梭数量稀少、体型缩小，起步四分之一秒内形成直线爆发',()=>{
    const counts=[14,26,34,42,54].map(n=>AQUARIUM_FISH_PLAN.slice(0,n-2).filter(i=>AQUARIUM_SPECIES[i].id==='silver-dart').length);assert(JSON.stringify(counts)===JSON.stringify([1,2,2,2,3]),'电光银梭占比过高');
    const species=AQUARIUM_SPECIES.find(s=>s.id==='silver-dart');assert(species.size<.7,'体型仍然过大');const cases=[];
    for(const fps of [25,60]){const {engine,fish}=speciesFixture(species),f=fish[0];position(engine,f,0,3,0);f.speed=.035;f.velocity.set(.035,0,0);f.smoothSteer.set(1,0,0);engine.chooseGoal(f);f.goal.set(12,3,0);engine.syncModel(f,0,true);let launched=null,quarterSpeed=0,firstSecond=null;
      for(let i=0;i<fps*4;i++){engine.update(1/fps,[]);if(f.burstLaunched&&launched===null)launched=engine.elapsed;if(launched!==null&&engine.elapsed-launched<.26)quarterSpeed=Math.max(quarterSpeed,f.renderVelocity.length());if(firstSecond===null&&launched!==null&&engine.elapsed-launched>=1)firstSecond=f.model.position.clone();}
      assert(quarterSpeed>8,'起步仍被慢速平滑拖住');assert(firstSecond&&firstSecond.x>7&&Math.abs(firstSecond.z)<.2,'没有明显沿朝向向前冲出的感觉');assert(f.activity==='rest','短促冲刺后没有收住并休息');cases.push({fps,quarterSpeed,firstSecond:firstSecond.toArray()});
    }return {counts,cases};
  });
  await test('电光银梭警戒余波不阻止刹停，近距离危险才打断长休息',()=>{
    const species=AQUARIUM_SPECIES.find(s=>s.id==='silver-dart'),{engine,fish}=speciesFixture(species),f=fish[0];position(engine,f,0,3,0);f.activity='brake';f.brakeDirection=f.axis.clone();f.speed=8;f.velocity.copy(f.axis).multiplyScalar(8);f.fear=.4;engine.syncModel(f,0,true);advance(engine,.6);
    assert(f.fear>.08,'警戒余波场景没有覆盖到');assert(f.activity==='rest'&&f.renderVelocity.length()<.2,'轻度警戒导致持续巡游，无法刹停');
    const other=speciesFixture(AQUARIUM_SPECIES[6]),shark=other.fish[0],g=new T.Group();other.engine.register({g,species,kind:species.kind,size:species.size,direction:1});other.engine.setCount(2);const dart=other.fish[1];position(other.engine,shark,0,3,0);position(other.engine,dart,0,3,4,-Math.PI/2);dart.speed=.035;dart.velocity.copy(dart.axis).multiplyScalar(.035);other.engine.restBurst(dart);other.engine.syncModel(dart,0,true);let peak=0;
    advance(other.engine,2,[],()=>{peak=Math.max(peak,dart.renderVelocity.length());});assert(peak>8&&dart.g.position.z>7,'迫近的鲨鱼没有触发一次短促逃离');return {residualFear:f.fear,stoppedSpeed:f.renderVelocity.length(),escapePeak:peak};
  });
  await test('多条电光银梭独立冲刺休息，混游时持续避开鱼群与礁石',()=>{
    const {engine,fish}=fixture(34,11042,true),garden=AQUARIUM_REEF.makeRockGarden(Array.from({length:4},()=>new T.MeshBasicMaterial()),seeded(11042)),environment=AQUARIUM_REEF.decorate(new T.Scene());engine.obstacles=[...environment.obstacles,...garden.obstacles];engine.resolve(48);for(const f of fish)engine.syncModel(f,0,true);
    const sprinters=fish.filter(f=>f.species.id==='silver-dart');let minGap=Infinity,minRock=Infinity,independent=0,rests=0,peak=0;
    advance(engine,70,[],frame=>{if(frame%30)return;const states=new Set(sprinters.map(f=>f.activity));if(states.size>1)independent++;rests+=sprinters.filter(f=>f.activity==='rest').length;for(const f of sprinters){peak=Math.max(peak,f.renderVelocity.length());for(const o of engine.obstacles)minRock=Math.min(minRock,engine.obstacleGap(f,o));}minGap=Math.min(minGap,engine.audit().minGap);});
    assert(sprinters.length>=2&&independent>10&&rests>10,'新鱼同步冲刺或从不休息');assert(peak>4,'混游时没有高速冲刺');assert(minGap>-.015&&minRock>-.015,`高速混游穿模：鱼群 ${minGap}，礁石 ${minRock}`);return {sprinters:sprinters.length,independent,rests,peak,minGap,minRock};
  });
  await test('高聚集灯鱼主动靠拢，并保持共同游动方向',()=>{
    const cases=[];for(const schooling of [1,5]){const base=AQUARIUM_SPECIES.find(s=>s.kind===3),species={...base,traits:{...base.traits,schooling}},{engine,fish}=speciesFixture(species,12);
      fish.forEach((f,i)=>position(engine,f,-6+i%4*4,1,Math.floor(i/4)*3-3));let distance=0,alignment=0,samples=0;
      advance(engine,90,[],frame=>{if(frame<=1800||frame%60)return;distance+=fish.reduce((sum,f)=>sum+Math.min(...fish.filter(o=>o!==f).map(o=>f.g.position.distanceTo(o.g.position))),0)/fish.length;const direction=new T.Vector3();for(const f of fish)direction.add(f.axis);alignment+=direction.length()/fish.length;samples++;});
      cases.push({schooling,nearest:distance/samples,alignment:alignment/samples});assert(engine.audit().minGap>-.015,'结群时身体相交');
    }assert(cases[1].nearest<cases[0].nearest*.7,'高聚集没有缩短同类间距');assert(cases[1].alignment>.7&&cases[1].alignment>cases[0].alignment+.2,'结群鱼没有共同游动');return cases;
  });
  await test('安静鱼多数时间停留，活跃鱼更常穿梭和冲刺',()=>{
    const cases=[];for(const id of ['moon-angelfish','tidal-swallow']){const species=AQUARIUM_SPECIES.find(s=>s.id===id),{engine,fish}=speciesFixture(species);let hover=0,dart=0,speed=0,samples=0;
      advance(engine,180,[],frame=>{if(frame<=600)return;const f=fish[0];hover+=f.activity==='hover'?1:0;dart+=f.activity==='dart'?1:0;speed+=f.speed;samples++;});cases.push({id,hover:hover/samples,dart:dart/samples,speed:speed/samples});
    }assert(cases[0].hover>.5,'安静鱼停留时间不足一半');assert(cases[1].hover<.15&&cases[1].dart>.1,'活跃鱼没有持续穿梭与短冲刺');assert(cases[1].speed>cases[0].speed*4,'活跃与安静鱼的实际游速没有区别');return cases;
  });
  await test('两条鲨鱼接近时主动分开，保持独自巡游空间',()=>{
    const {engine,fish}=speciesFixture(AQUARIUM_SPECIES.find(s=>s.predator),2);position(engine,fish[0],0,2,-2.5);position(engine,fish[1],0,2,2.5);
    engine.steerFish=f=>{f.steer.set(1,0,0);f.desiredSpeed=f.cruise;};const before=engine.audit().minGap;advance(engine,10);const after=engine.audit().minGap;assert(after>before+2,'鲨鱼没有主动拉开同类间距');return {before,after};
  });
  await test('普通鱼在鲨鱼碰撞范围之外就警觉并加速远离',()=>{
    const cases=[];for(const species of AQUARIUM_SPECIES.filter(s=>!s.predator)){const {engine,fish}=speciesFixture(AQUARIUM_SPECIES.find(s=>s.predator));const f={g:new T.Group(),species,kind:species.kind,rounded:species.heritage,size:species.size,direction:1};engine.register(f);engine.setCount(2);position(engine,fish[0],0,1,0);position(engine,f,0,1,7.5,Math.PI/2);const before=engine.audit().minGap;let fear=0,speed=0;advance(engine,6,[],()=>{fear=Math.max(fear,f.fear);speed=Math.max(speed,f.speed);});assert(before>4,'起始位置没有在碰撞范围之外');assert(fear>.18,`${species.name} 没有提前警觉`);if(species.locomotion!=='burst-rest')assert(speed>f.cruise*1.4,`${species.name} 没有提前加速避鲨`);cases.push({id:species.id,fear,speed});}return cases;
  });
  await test('转向时后半身滞后，左右弯曲对称，直游后平滑恢复',()=>{
    const bends=[];
    for(const sign of [-1,1]){const {engine,fish}=fixture(1,42,true),f=fish[0];position(engine,f,0,1,0);
      engine.steerFish=f=>{f.steer.set(1,0,sign);f.desiredSpeed=f.cruise;};advance(engine,.4);
      const bend=f.bendYaw;assert(bend*sign>0,'尾部没有滞后于转向');assert(Math.abs(bend)>.15&&Math.abs(bend)<=.48,'转向没有明显弯曲或弯曲过度');
      assert(f.g.userData.swim.bend.value.y===bend,'渲染参数没有同步');
      engine.steerFish=f=>{f.steer.copy(f.axis);f.desiredSpeed=f.cruise;};let last=bend;advance(engine,3.5,[],()=>{assert(Math.abs(f.bendYaw-last)<.025,'回正发生跳变');last=f.bendYaw;});
      assert(Math.abs(f.bendYaw)<.003,'直游后身体没有恢复');bends.push(bend);
    }assert(Math.abs(bends[0]+bends[1])<1e-8,'左右转向不对称');return {bends};
  });
  await test('鲨鱼转弯收尾逐渐减速，尾部回正不会突然加速',()=>{
    const {engine,fish}=fixture(1,42,true),f=fish[0];position(engine,f,0,1,0);
    engine.steerFish=f=>{f.steer.set(0,0,-1);f.desiredSpeed=f.cruise;};
    let previousYaw=f.yaw,previousRate=0,maxRateChange=0;advance(engine,8,[],frame=>{const rate=(f.yaw-previousYaw)*60;if(frame>0)maxRateChange=Math.max(maxRateChange,Math.abs(rate-previousRate));previousYaw=f.yaw;previousRate=rate;});
    assert(maxRateChange<.012,'转弯后半段的角速度突然下降');assert(Math.abs(f.yaw-Math.PI/2)<.01,'缓和转向后未能对准目标');
    // Establish a full bend, then abruptly stop steering to exercise the worst
    // possible release. The tail must ramp into recovery rather than whip back.
    f.bendYaw=.48;f.bendYawVelocity=0;engine.steerFish=f=>{f.steer.copy(f.axis);f.desiredSpeed=f.cruise;};
    let lastBend=f.bendYaw,lastRate=0,maxRecoveryRateChange=0,firstRecoveryRate=0,maxRecoveryRate=0;
    advance(engine,3,[],frame=>{const rate=(f.bendYaw-lastBend)*60;if(frame===0)firstRecoveryRate=Math.abs(rate);maxRecoveryRate=Math.max(maxRecoveryRate,Math.abs(rate));maxRecoveryRateChange=Math.max(maxRecoveryRateChange,Math.abs(rate-lastRate));lastBend=f.bendYaw;lastRate=rate;assert(f.bendYaw>=0,'尾部回正过冲');});
    assert(firstRecoveryRate<.08,'尾部回正第一帧突然加速');assert(maxRecoveryRateChange<.13,'尾部回正速度不连续');assert(f.bendYaw<.001,'尾部没有完成回正');
    return {maxRateChange,firstRecoveryRate,maxRecoveryRate,maxRecoveryRateChange};
  });
  await test('上浮下潜带动纵向弯曲，低速急转仍保持有限变形',()=>{
    for(const sign of [-1,1]){const {engine,fish}=fixture(1,42,true),f=fish[0];position(engine,f,0,1,0);engine.steerFish=f=>{f.steer.set(1,sign,0);f.desiredSpeed=.02;};advance(engine,.3);
      assert(f.bendPitch*sign>0,'俯仰时身体没有纵向跟随');assert(Math.abs(f.bendPitch)<=.24,'纵向弯曲过度');assert(f.g.userData.swim.bend.value.x===f.bendPitch,'纵向变形没有传给材质');
      engine.steerFish=f=>{f.steer.set(-1,0,1);f.desiredSpeed=.02;};advance(engine,3,[],()=>{assert(Number.isFinite(f.bendYaw)&&Math.abs(f.bendYaw)<=.48,'低速转向折叠或产生无效值');});
    }
  });
  await test('鲨鱼碰撞链覆盖弯曲尾部，头部和鱼嘴位置保持稳定',()=>{
    const {engine,fish}=fixture(1,42,true),f=fish[0];position(engine,f,0,1,0);f.bendYaw=.48;f.bendPitch=.24;f.effort=0;engine.orient(f);
    const tail=f.g.position.clone().add(f.segments[0].offset);assert(Math.hypot(tail.y-f.g.position.y,tail.z-f.g.position.z)>f.radius,'未产生足够弯曲来验证碰撞');assert(engine.pointClearance(f,tail)<0,'弯曲尾部漏出碰撞范围');
    const head=f.segments[3],front=head.offset.clone().addScaledVector(head.axis,head.front);assert(front.distanceTo(f.axis.clone().multiplyScalar(f.front))<1e-8,'头部被身体变形带偏');
    for(let i=1;i<f.segments.length;i++){const previous=f.segments[i-1],end=previous.offset.clone().addScaledVector(previous.axis,previous.front);assert(end.distanceTo(f.segments[i].offset)<1e-8,'碰撞链发生断裂');}
  });
  await test('小鱼面对交替避让指令和正后方目标时不反复猛甩头',()=>{
    const {engine,fish}=fixture(1),f=fish[0];position(engine,f,0,1,0);f.fear=.7;
    engine.avoidPredators=()=>{};engine.steerFish=f=>{const sign=Math.floor(engine.elapsed*60)%2?1:-1;f.steer.set(-1,0,sign*.08);f.desiredSpeed=f.cruise*1.8;};
    let previousYaw=f.yaw,lastRate=0,maxAcceleration=0,violentFlips=0;advance(engine,4,[],frame=>{const rate=(f.yaw-previousYaw)*60;if(frame>0){maxAcceleration=Math.max(maxAcceleration,Math.abs(rate-lastRate)*60);if(rate*lastRate<0&&Math.abs(rate-lastRate)>.4)violentFlips++;}previousYaw=f.yaw;lastRate=rate;});
    assert(maxAcceleration<=5.001,'相邻帧突然反转转向速度');assert(violentFlips===0,'小鱼仍然左右抽动');assert(Math.abs(f.yaw)>2,'平滑处理导致鱼不能完成掉头');return {maxAcceleration,violentFlips};
  });
  await test('追逐上下方食物和吃完离开时，实际升降沿身体方向',()=>{
    let cases=0,maxVerticalSlip=0;
    for(const species of AQUARIUM_SPECIES.filter(s=>!s.predator))for(const sign of [-1,1]){
      const random=seeded(42),fish=[],engine=new AquariumMotion(fish,random),f={g:new T.Group(),species,kind:species.kind,rounded:species.heritage,size:species.size,direction:1};engine.register(f);engine.setCount(1);position(engine,f,0,1,0);
      const food=pellet(0,1+sign*1.7,0),foods=[food];let pitched=false,last=f.g.position.clone();
      advance(engine,8,foods,()=>{const movement=f.g.position.clone().sub(last),slip=Math.abs(movement.y-f.velocity.y/60);maxVerticalSlip=Math.max(maxVerticalSlip,slip);assert(slip<1e-7,'位置被独立的升降或边界纠正拖动');assert(f.velocity.clone().cross(f.axis).length()<1e-7,'实际游动偏离身体方向');if(movement.lengthSq()>1e-10)assert(Math.abs(movement.dot(f.axis))/movement.length()>.99999,'实际位移没有沿身体方向');if(Math.abs(f.pitch)>.1&&Math.abs(movement.y)*60>.3)pitched=true;last.copy(f.g.position);});
      assert(food.eaten,'取消独立升降后吃不到上下方的食物');assert(pitched,'没有通过俯仰接近食物');cases++;
    }return {cases,maxVerticalSlip};
  });
  await test('碰撞纠正不把水平鱼体上下推走',()=>{
    const {engine,fish}=fixture(2),[a,b]=fish;position(engine,a,0,1,0);position(engine,b,.05,1.1,.05,Math.PI);const ay=a.g.position.y,by=b.g.position.y;
    engine.resolve(48);assert(a.g.position.y===ay&&b.g.position.y===by,'碰撞纠正改变了鱼的高度');assert(engine.audit().minGap>-.015,'取消垂直推挤后发生相交');
  });
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
  await test('七种鱼在前方、头顶、身下和过近位置都真正吃到鱼饵',()=>{let total=0,maxTime=0;
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
  await test('两条鲨鱼与 52 尾小鱼长时间共游，保持直立且不相交',async()=>{let minUp=1,minGap=Infinity,bites=0,maxVerticalSlip=0,maxTurnAcceleration=0;for(const seed of [11042,512,2026]){const {engine,fish}=fixture(54,seed,true);let foods=[];
    const beforeY=new Float64Array(fish.length),beforeRate=new Float64Array(fish.length),step=engine.step;
    engine.step=function(dt,foods){for(let i=0;i<fish.length;i++){beforeY[i]=fish[i].g.position.y;beforeRate[i]=fish[i].yawVelocity;}step.call(this,dt,foods);for(let i=0;i<fish.length;i++){const f=fish[i];maxVerticalSlip=Math.max(maxVerticalSlip,Math.abs(f.g.position.y-beforeY[i]-f.velocity.y*dt));maxTurnAcceleration=Math.max(maxTurnAcceleration,Math.abs(f.yawVelocity-beforeRate[i])/dt);}};
    for(let frame=0;frame<10800;frame++){
      if(frame%1800===0){const f=fish[(frame/1800*7)%fish.length],p=f.g.position.clone().addScaledVector(f.axis,3);foods.push(...Array.from({length:3},(_,i)=>pellet(p.x+i*.13,p.y+.7,p.z)));}
      const dt=frame%7===0?1/30:1/60;engine.update(dt,foods);
      foods=foods.filter(food=>{food.life+=dt;food.mesh.position.y=Math.max(AquariumMotion.floorHeight(food.mesh.position.x,food.mesh.position.z)+.06,food.mesh.position.y-food.speed*dt);return !food.eaten&&food.life<24;});
      if(frame%60===0){const a=engine.audit();minUp=Math.min(minUp,a.minUp);minGap=Math.min(minGap,a.minGap);assert(a.minUp>.12&&fish.every(f=>Math.abs(f.roll)<.08&&Math.abs(f.pitch)<1.45),'追食时出现翻肚或过度倾斜');assert(a.minGap>-.015,`种子 ${seed} 第 ${frame} 帧碰撞包络相交：${a.minGap}`);assert(fish.every(f=>Number.isFinite(f.g.position.x)&&Number.isFinite(f.speed)),'出现无效运动数值');}
      if(frame%600===0)await new Promise(r=>setTimeout(r,0));
    }bites+=fish.reduce((sum,f)=>sum+(f.bites||0),0);
  }assert(bites>15,'集中投喂后实际吃到的食物太少');assert(maxVerticalSlip<1e-7,'拥挤避让或追食后发生独立于游动的垂直位移');assert(maxTurnAcceleration<=5.001,'拥挤避让时突然反转转向速度');return {simulatedSeconds:617,minUp,minGap,bites,maxVerticalSlip,maxTurnAcceleration};});
  await test('环境偏好影响真实水层，鱼会在偏好范围内上下探索',()=>{
    const cases=[];for(const s of AQUARIUM_SPECIES.filter(s=>!s.predator)){const {engine,fish}=speciesFixture(s,3);let total=0,inBand=0,lo=Infinity,hi=-Infinity,nearHome=0;
      advance(engine,140,[],frame=>{if(frame<1800||frame%30)return;for(const f of fish){const p=f.g.position;total++;inBand+=p.y>s.habitat.min-.6&&p.y<s.habitat.max+.6?1:0;lo=Math.min(lo,p.y);hi=Math.max(hi,p.y);nearHome+=s.habitat.zone==='grass'?p.x>4:s.habitat.zone==='reef'?p.x< -6:1;}});
      assert(inBand/total>.8,`${s.name} 未主要停留在偏好水层`);assert(hi-lo>.3,`${s.name} 一直停在同一高度`);assert(nearHome/total>.6,`${s.name} 未偏好草丛或礁石`);cases.push({id:s.id,inBand:inBand/total,verticalRange:hi-lo});
    }return cases;
  });
  await test('礁洞居民真正穿过拱洞，并避开实体岩壁',()=>{
    const environment=AQUARIUM_REEF.decorate(new T.Scene()),{engine,fish}=speciesFixture(AQUARIUM_SPECIES[3]);engine.obstacles=environment.obstacles;
    position(engine,fish[0],-9.6,-2.45,3.8,Math.PI/2);let previous=3.8,crossings=0,minGap=Infinity;
    advance(engine,120,[],()=>{const f=fish[0],p=f.g.position;if(previous*p.z<0&&p.x> -11&&p.x< -8&&p.y< -1)crossings++;previous=p.z;for(const o of environment.obstacles)minGap=Math.min(minGap,engine.obstacleGap(f,o));});
    assert(crossings>=2,'鱼没有往返穿过拱洞');assert(minGap>=-.015,`鱼穿入岩壁：${minGap}`);return {crossings,minGap};
  });
  await test('鲨鱼偶尔追玩单条小鱼，限时结束且不会吃掉居民',()=>{
    const {engine,fish}=fixture(34,42,true);const count=fish.length,previous=new Map(),starts=new Map();let chases=0,maxDuration=0;
    advance(engine,150,[],()=>{for(const f of engine.predators){const old=previous.get(f.id),target=f.playTarget;
      if(target&&!old){assert(!target.predator&&target.id<engine.count,'追玩目标无效');const last=starts.get(f.id);if(last!==undefined)assert(engine.elapsed-last>27,'追逐过于频繁');starts.set(f.id,engine.elapsed);chases++;}
      if(old&&!target)maxDuration=Math.max(maxDuration,engine.elapsed-starts.get(f.id));previous.set(f.id,target);
    }});
    assert(chases>=2&&chases<=10,`追逐次数异常：${chases}`);assert(maxDuration<=7.1,'追玩没有及时结束');assert(fish.length===count&&fish.every(f=>!f.bites),'追玩移除或吞食了小鱼');
    const shark=fish[0];shark.playTarget=fish[5];engine.setCount(2);engine.update(1/60,[]);assert(!shark.playTarget,'减少数量后仍追逐隐藏的小鱼');return {chases,maxDuration};
  });
  await test('新增居民数量克制，底栖生物贴底，水母与海龟各守水层',()=>{
    const scene=new T.Scene(),life=AQUARIUM_REEF.populate(scene);assert(life.residents.length===10&&AQUARIUM_REEF.species.length===6,'新增居民数量异常');
    for(let t=0;t<180;t+=.5){life.update(t);for(const r of life.residents){const p=r.g.position;assert(p.toArray().every(Number.isFinite),'居民位置无效');if(r.species.id==='moon-jelly')assert(p.y>2.5&&p.y<5,'水母离开中上层');else if(r.species.id==='sea-turtle')assert(p.y>AquariumMotion.floorHeight(p.x,p.z)+.55&&p.y<4.5,'海龟离开中层水域');else assert(p.y-AquariumMotion.floorHeight(p.x,p.z)>=.039&&p.y-AquariumMotion.floorHeight(p.x,p.z)<.3,'底栖生物离开沙地');}}
    return Object.fromEntries(AQUARIUM_REEF.species.map(s=>[s.name,life.residents.filter(r=>r.species===s).length]));
  });
  await test('青蟹时停时走并横向探索，虾不出现在场景中',()=>{
    const life=AQUARIUM_REEF.populate(new T.Scene()),crabs=life.residents.filter(r=>r.species.id==='tide-crab');assert(!life.residents.some(r=>r.species.id==='cleaner-shrimp'),'虾仍然可见');
    const stats=crabs.map(r=>({last:r.g.position.clone(),start:r.g.position.clone(),distance:0,extent:0,moving:0,resting:0,frontSlip:0}));
    for(let frame=1;frame<=90*60;frame++){life.update(frame/60);crabs.forEach((r,i)=>{const s=stats[i],delta=r.g.position.clone().sub(s.last),front=new T.Vector3(Math.sin(r.g.rotation.y),0,Math.cos(r.g.rotation.y));if(!r.g.userData.crab.turning)s.frontSlip=Math.max(s.frontSlip,Math.abs(delta.dot(front)));s.distance+=Math.hypot(delta.x,delta.z);s.extent=Math.max(s.extent,r.g.position.distanceTo(s.start));s.moving+=r.speed>.1?1:0;s.resting+=r.mode==='rest'?1:0;s.last.copy(r.g.position);assert(r.g.userData.crab.legs.every(l=>l.root.position.distanceTo(l.hip)<1e-10),'螃蟹腿根在身体表面移动');});}
    for(const s of stats){assert(s.distance>8&&s.extent>3,'青蟹没有明显探索周围沙地');assert(s.moving>800&&s.resting>200,'青蟹没有交替行走与停留');assert(s.frontSlip<1e-8,'青蟹沿身体前后方向爬行');}return stats.map(({distance,extent,frontSlip})=>({distance,extent,frontSlip}));
  });
  await test('碰撞修正不会让可见鲨鱼瞬移，提速保持加速度且增强摆尾',()=>{
    const {engine,fish}=fixture(2,42,true),f=fish[0];engine.setCount(1);position(engine,f,0,2,-3);engine.syncModel(f,0,true);
    engine.steerFish=f=>{f.steer.set(1,0,0);f.desiredSpeed=f.cruise*1.65;};const beforePhase=f.tailPhase,beforeEffort=f.effort,initialSpeed=f.speed;
    let previous=f.model.position.clone(),velocity=f.renderVelocity.clone(),maxAcceleration=0,maxStep=0;
    f.g.position.x+=2.5;
    advance(engine,4,[],()=>{const p=f.model.position,step=p.clone().sub(previous);maxStep=Math.max(maxStep,step.length());const v=step.multiplyScalar(60);maxAcceleration=Math.max(maxAcceleration,v.clone().sub(velocity).length()*60);previous.copy(p);velocity.copy(v);});
    assert(maxStep<f.cruise*2.1/60+.0001,'可见鲨鱼发生瞬移');assert(maxAcceleration<=.481,'可见鲨鱼的加速度不连续或没有上限');assert(f.speed>initialSpeed+.3,'鲨鱼没有逐步加速');assert(f.tailPhase-beforePhase>4*(1+initialSpeed*1.6)&&f.effort>beforeEffort+.08,'加速时没有加强摆尾');return {maxStep,maxAcceleration};
  });
  await test('堆石礁区共游时不穿岩壁，可见鲨鱼保持连续移动',()=>{
    const {engine,fish}=fixture(34,11042,true);engine.obstacles=AQUARIUM_REEF.decorate(new T.Scene()).obstacles;engine.resolve(48);for(const f of fish)engine.syncModel(f,0,true);let minReef=Infinity,minFish=Infinity,maxVisibleStep=0;const before=engine.predators.map(f=>f.model.position.clone());
    advance(engine,65,[],frame=>{engine.predators.forEach((f,i)=>{maxVisibleStep=Math.max(maxVisibleStep,f.model.position.distanceTo(before[i]));before[i].copy(f.model.position);});if(frame%60)return;minFish=Math.min(minFish,engine.audit().minGap);for(const f of fish)for(const o of engine.obstacles)minReef=Math.min(minReef,engine.obstacleGap(f,o));});
    assert(minReef>-.015&&minFish>-.015,`堆石共游发生相交：岩壁 ${minReef}，鱼群 ${minFish}`);assert(maxVisibleStep<.04,'鲨鱼接近堆石时出现短距离跳动');return {minReef,minFish,maxVisibleStep};
  });
  await test('蟹壳宽扁，三段步足保留固定腿根和连续关节',()=>{
    const g=AQUARIUM_CRAB.createModel(),rig=g.userData.crab,box=new T.Box3().setFromObject(rig.body),size=box.getSize(new T.Vector3());
    assert(size.x>size.z*1.4&&size.y<size.x*.24,'蟹壳仍然是高耸的椭球');assert(rig.legs.length===8,'步足数量不正确');
    const roots=rig.legs.map(l=>l.root.position.clone());let maxConnection=0;
    for(let frame=0;frame<300;frame++){AQUARIUM_CRAB.animate(g,frame/30);g.updateMatrixWorld(true);rig.legs.forEach((l,i)=>{
      assert(l.root.position.distanceTo(roots[i])<1e-12,'腿根在身体表面漂移');assert(l.lengths.length===3&&l.lengths[2]<Math.min(l.lengths[0],l.lengths[1])*.25,'足部末节没有明显短于前两节');
      const a=l.root.getWorldPosition(new T.Vector3()),b=l.lower.getWorldPosition(new T.Vector3()),c=l.toe.getWorldPosition(new T.Vector3()),d=l.tip.getWorldPosition(new T.Vector3());
      maxConnection=Math.max(maxConnection,Math.abs(a.distanceTo(b)-l.lengths[0]),Math.abs(b.distanceTo(c)-l.lengths[1]),Math.abs(c.distanceTo(d)-l.lengths[2]));
    });}assert(maxConnection<1e-8,'步足关节脱开或肢段被拉长');return {shellRatio:size.x/size.z,maxConnection};
  });
  await test('眼柄与钳臂能独立活动，钳口能闭拢并围绕真实铰点开合',()=>{
    const g=AQUARIUM_CRAB.createModel(),rig=g.userData.crab,roots=rig.arms.map(a=>a.shoulder.position.clone()),eyeRoots=rig.eyes.map(e=>e.position.clone()),ranges=rig.arms.map(()=>({minGap:Infinity,maxGap:0,minAngle:Infinity,maxAngle:-Infinity}));
    let eyeMin=Infinity,eyeMax=-Infinity,armMin=Infinity,armMax=-Infinity;
    for(let frame=0;frame<900;frame++){AQUARIUM_CRAB.animate(g,frame/30);g.updateMatrixWorld(true);rig.arms.forEach((a,i)=>{const r=ranges[i],gap=a.fixedTip.getWorldPosition(new T.Vector3()).distanceTo(a.movingTip.getWorldPosition(new T.Vector3()));r.minGap=Math.min(r.minGap,gap);r.maxGap=Math.max(r.maxGap,gap);r.minAngle=Math.min(r.minAngle,a.jaw.rotation.y);r.maxAngle=Math.max(r.maxAngle,a.jaw.rotation.y);assert(a.shoulder.position.distanceTo(roots[i])<1e-12,'钳臂根部脱离身体');assert(a.jaw.position.distanceTo(new T.Vector3(-.075,0,.22))<1e-12,'钳口铰点漂移');});
      rig.eyes.forEach((e,i)=>{eyeMin=Math.min(eyeMin,e.rotation.y);eyeMax=Math.max(eyeMax,e.rotation.y);assert(e.position.distanceTo(eyeRoots[i])<1e-12,'眼柄根部脱离眼窝');const pupil=e.children.find(o=>o.material?.color?.getHexString()==='171f1b');assert(pupil&&Math.max(pupil.scale.x,pupil.scale.y,pupil.scale.z)<.04,'眼睛仍然过大');});armMin=Math.min(armMin,rig.arms[0].shoulder.rotation.x);armMax=Math.max(armMax,rig.arms[0].shoulder.rotation.x);
    }
    assert(eyeMax-eyeMin>.35&&armMax-armMin>.18,'眼柄或钳臂没有明显活动');for(const r of ranges){assert(r.minGap<.03&&r.maxGap>.13&&r.maxAngle-r.minAngle>.5,'蟹钳没有真正闭拢与张开');}return {eyeRotationRange:eyeMax-eyeMin,armRotationRange:armMax-armMin,ranges};
  });
  await test('蟹足贴地不打滑，转身绕支撑足走弧线，低帧率也不拉伸',()=>{
    const result=[];for(const fps of [60,25]){const scene=new T.Scene(),life=AQUARIUM_REEF.populate(scene),crabs=life.residents.filter(r=>r.species.id==='tide-crab'),previous=new Map(),before=new Map();let maxSlip=0,maxIKError=0,minSupport=8,turnSamples=0,maxPivotError=0,minGround=Infinity;
      for(let frame=1;frame<=90*fps;frame++){for(const r of crabs)before.set(r,{p:r.g.position.clone(),yaw:r.g.rotation.y});life.update(frame/fps);scene.updateMatrixWorld(true);
        for(const r of crabs){const rig=r.g.userData.crab,old=before.get(r);minSupport=Math.min(minSupport,rig.legs.filter(l=>l.stance).length);
          for(const l of rig.legs){const tip=l.tip.getWorldPosition(new T.Vector3()),last=previous.get(l);maxIKError=Math.max(maxIKError,tip.distanceTo(l.anchor),l.reachError);if(last?.stance&&l.stance)maxSlip=Math.max(maxSlip,tip.distanceTo(last.tip));minGround=Math.min(minGround,tip.y-AquariumMotion.floorHeight(tip.x,tip.z));previous.set(l,{tip,stance:l.stance});}
          if(rig.turning&&rig.pivot&&r.speed<1e-8){const pivot=rig.pivot.anchor,expected=old.p.clone().sub(pivot).applyAxisAngle(new T.Vector3(0,1,0),r.g.rotation.y-old.yaw).add(pivot);maxPivotError=Math.max(maxPivotError,Math.hypot(expected.x-r.g.position.x,expected.z-r.g.position.z));assert(Math.hypot(old.p.x-r.g.position.x,old.p.z-r.g.position.z)>1e-6,'转身仍然绕身体中心旋转');assert(rig.pivot.stance,'用离地的脚当转身支点');turnSamples++;}
        }
      }
      assert(maxSlip<1e-7&&maxIKError<1e-7,'支撑脚打滑、关节脱节或步幅超出腿长');assert(minSupport>=4,'同时抬起过多步足');assert(minGround>-.002,'足尖穿入沙地');assert(turnSamples>100&&maxPivotError<1e-8,'转身没有绕落地步足协调换步');result.push({fps,maxSlip,maxIKError,minSupport,turnSamples,maxPivotError});
    }return result;
  });
  await test('八条腿规则成排，俯视三段共线，关节只在腿的竖直平面内屈伸',()=>{
    const g=AQUARIUM_CRAB.createModel(),rig=g.userData.crab;let maxOffLine=0,maxRowDrift=0;
    for(let frame=0;frame<240;frame++){AQUARIUM_CRAB.animate(g,frame/30);g.updateMatrixWorld(true);
      for(const l of rig.legs){const joints=[l.root,l.lower,l.toe,l.tip].map(o=>o.getWorldPosition(new T.Vector3()));for(const p of joints)maxRowDrift=Math.max(maxRowDrift,Math.abs(p.z-l.hip.z));assert(Math.abs(l.lower.rotation.x)+Math.abs(l.lower.rotation.y)+Math.abs(l.toe.rotation.x)+Math.abs(l.toe.rotation.y)<1e-12,'肘、末节关节仍在前后甩动');}
    }
    for(const side of [-1,1]){const legs=rig.legs.filter(l=>l.side===side);for(let i=1;i<4;i++)assert(Math.abs(legs[i].hip.z-legs[i-1].hip.z-.19)<1e-10,'四条腿的前后间距不规律');}
    const scene=new T.Scene(),life=AQUARIUM_REEF.populate(scene);for(let frame=1;frame<=60*60;frame++){life.update(frame/60);scene.updateMatrixWorld(true);for(const r of life.residents.filter(r=>r.species.id==='tide-crab'))for(const l of r.g.userData.crab.legs){const joints=[l.root,l.lower,l.toe,l.tip].map(o=>o.getWorldPosition(new T.Vector3())),a=joints[0],b=joints[3],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);for(const p of joints)maxOffLine=Math.max(maxOffLine,Math.abs((p.x-a.x)*dz-(p.z-a.z)*dx)/Math.max(length,.001));}}
    assert(maxRowDrift<1e-8,'直行步态出现前后摆腿');assert(maxOffLine<1e-8,'俯视腿部三段折成锯齿');return {maxRowDrift,maxOffLine};
  });
  await test('水母伞盖与触须碰撞包络随脉动、摆动和漂移更新',()=>{
    const scene=new T.Scene(),obstacles=[],life=AQUARIUM_REEF.populate(scene,obstacles),jellies=life.residents.filter(r=>r.species.id==='moon-jelly');assert(obstacles.length===4,'水母未注册双层碰撞体');let maxOutside=0;
    for(let frame=0;frame<120;frame++){life.update(frame/20);scene.updateMatrixWorld(true);for(const r of jellies){assert(r.colliders.every(o=>o.velocity===r.driftVelocity&&o.owner===r),'碰撞体未绑定活动水母');r.g.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,v=new T.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const distance=Math.min(...r.colliders.map(c=>Math.hypot((v.x-c.center.x)/c.radii.x,(v.y-c.center.y)/c.radii.y,(v.z-c.center.z)/c.radii.z)));maxOutside=Math.max(maxOutside,distance-1);}});}}
    assert(maxOutside<.025,`可见伞盖或触须超出碰撞范围：${maxOutside}`);return {jellies:jellies.length,colliders:obstacles.length,maxOutside};
  });
  await test('鲨鱼提前绕开水母，正面接近时稳定选择一侧并减速',()=>{
    for(const direction of [-1,1]){const {engine,fish}=speciesFixture(AQUARIUM_SPECIES[6]),f=fish[0],o={kind:'jellyfish',center:new T.Vector3(0,2,0),radii:new T.Vector3(.75,1,.75),velocity:new T.Vector3()};engine.obstacles=[o];position(engine,f,-direction*10,2,0,direction===1?0:Math.PI);f.steer.copy(f.axis);f.desiredSpeed=f.cruise;assert(engine.obstacleGap(f,o)>1,'提前避让检查起点太近');engine.reefAvoid(f);assert(Math.abs(f.steer.z)>.1,'迎面接近没有侧向绕行');assert(f.desiredSpeed<f.cruise*.95,'接近水母没有减速');}
  });
  await test('水母碰撞覆盖鲨鱼长胸鳍与上尾鳍尖端',()=>{
    const {engine,fish}=speciesFixture(AQUARIUM_SPECIES[6]),f=fish[0];position(engine,f,0,2,0);f.effort=0;engine.updateSpineBounds(f);engine.syncModel(f,0,true);const visible=engine.renderedBounds(f);
    for(const [x,y,z] of [[-.49,-.145,-.68],[-.49,-.145,.68],[-1.96,.54,0]]){const p=new T.Vector3(x,y,z).multiplyScalar(f.size).add(f.model.position),o={kind:'jellyfish',center:p,radii:new T.Vector3(.03,.03,.03)};assert(engine.obstacleGap(visible,o)<0,'水母可从胸鳍或尾鳍尖端穿过');}
  });
  await test('25 / 60 帧迎面接近漂浮水母，可见鲨鱼和水母始终分离',()=>{
    let minGap=Infinity,maxJellyStep=0,maxPressure=0;
    for(const fps of [25,60])for(const direction of [-1,1]){const obstacles=[],life=AQUARIUM_REEF.populate(new T.Scene(),obstacles),r=life.residents.find(r=>r.species.id==='moon-jelly');obstacles.splice(0,obstacles.length,...r.colliders);r.home.set(0,2,-.6);r.phase=0;life.update(0);
      const {engine,fish}=speciesFixture(AQUARIUM_SPECIES[6]),f=fish[0];engine.obstacles=obstacles;position(engine,f,-direction*11,2,0,direction===1?0:Math.PI);f.goal.set(direction*14,2,0);f.nextGoal=1000;f.nextPlay=1000;f.activityUntil=1000;engine.syncModel(f,0,true);let previous=r.g.position.clone();
      for(let i=1;i<=fps*24;i++){life.update(i/fps);engine.update(1/fps,[]);const visible=engine.renderedBounds(f);for(const o of obstacles)minGap=Math.min(minGap,engine.obstacleGap(visible,o));maxJellyStep=Math.max(maxJellyStep,r.g.position.distanceTo(previous));maxPressure=Math.max(maxPressure,r.displacement.length());previous.copy(r.g.position);assert(r.g.position.toArray().every(Number.isFinite),'水母挤开后坐标无效');}
    }
    assert(minGap>-.01,`可见鲨鱼与水母穿模：${minGap}，最大水母位移 ${maxJellyStep}，偏移 ${maxPressure}`);assert(maxJellyStep<.4,'水母单帧位移超过快速摆尾的接触上限');return {minGap,maxJellyStep,maxPressure};
  });
  await test('水母漂向鲨鱼侧腹和弯曲尾部时被轻推，碰撞以可见模型为准',()=>{
    let minGap=Infinity,maxPush=0;
    for(const x of [-6,-2,2]){const obstacles=[],life=AQUARIUM_REEF.populate(new T.Scene(),obstacles),r=life.residents.find(r=>r.species.id==='moon-jelly');obstacles.splice(0,obstacles.length,...r.colliders);const {engine,fish}=speciesFixture(AQUARIUM_SPECIES[6]),f=fish[0];engine.obstacles=obstacles;position(engine,f,30,2,0);f.bendYaw=.32;f.bendPitch=.1;engine.updateSpineBounds(f);f.model.position.set(0,2,0);f.model.quaternion.identity();r.g.rotation.set(0,0,0);r.g.position.set(x,2,5);r.updateColliders();let pushes=0;
      for(let i=0;i<300;i++){r.displace(0,-.015);const previous=r.g.position.clone();engine.resolveResidentContacts();const shift=r.g.position.distanceTo(previous);pushes+=shift>.001?1:0;maxPush=Math.max(maxPush,shift);const visible=engine.renderedBounds(f);for(const o of obstacles)minGap=Math.min(minGap,engine.obstacleGap(visible,o));}
      assert(pushes>0,'只检查模拟坐标，漏掉可见身侧或尾部');assert(f.model.position.distanceTo(new T.Vector3(0,2,0))<1e-9,'挤开水母时移动了鲨鱼');
    }assert(minGap>-.01,'水母穿过可见鲨鱼侧腹或尾部');assert(maxPush<.25,`水母接触分离产生过大位移：${maxPush}`);return {minGap,maxPush};
  });
  await test('真实礁湾中两条鲨鱼与水母长时间共游，追玩与摆尾不穿模',()=>{
    let minGap=Infinity,maxStep=0;
    for(const fps of [25,60]){const environment=AQUARIUM_REEF.decorate(new T.Scene()),originalRandom=Math.random;let life;try{Math.random=seeded(11042);life=AQUARIUM_REEF.populate(new T.Scene(),environment.obstacles);}finally{Math.random=originalRandom;}const {engine,fish}=fixture(34,11042,true);engine.obstacles=environment.obstacles;const turtle=life.residents.find(r=>r.species.id==='sea-turtle');environment.obstacles.push({center:turtle.g.position,radius:1.35});const jellies=life.residents.filter(r=>r.species.id==='moon-jelly');engine.resolve(24);for(const f of fish)engine.syncModel(f,0,true);let previous=jellies.map(r=>r.g.position.clone());
      for(let i=1;i<=fps*90;i++){life.update(i/fps);engine.update(1/fps,[]);for(const f of engine.predators){const visible=engine.renderedBounds(f);for(const r of jellies)for(const o of r.colliders)minGap=Math.min(minGap,engine.obstacleGap(visible,o));}jellies.forEach((r,j)=>{maxStep=Math.max(maxStep,r.g.position.distanceTo(previous[j]));previous[j].copy(r.g.position);});}
    }assert(minGap>-.01,`真实礁湾中鲨鱼与水母穿模：${minGap}`);assert(maxStep<.45,`真实礁湾中水母位移突跳：${maxStep}`);return {minGap,maxStep};
  });
  await test('礁石碰撞从可见网格生成，覆盖旋转和凹凸表面',()=>{
    const geometry=new T.IcosahedronGeometry(1,2),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.1*Math.sin(x*8+y*5)*Math.cos(z*6);p.setXYZ(i,x*k,y*k,z*k);}
    const mesh=new T.Mesh(geometry);mesh.position.set(13,-2.8,-5);mesh.scale.set(3.3,4.2,3);mesh.rotation.set(.27,2.1,-.24);mesh.updateMatrixWorld(true);const o=AQUARIUM_REEF.rockObstacle(mesh),v=new T.Vector3();let maxRadius=0;
    for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);assert(o.box.containsPoint(v),'石块顶点超出碰撞包围盒');v.sub(o.center).applyQuaternion(o.inverseRotation);maxRadius=Math.max(maxRadius,Math.hypot(v.x/o.radii.x,v.y/o.radii.y,v.z/o.radii.z));}assert(maxRadius<=1,'可见礁石露出碰撞包络');return {maxRadius,vertices:p.count};
  });
  await test('25 / 60 帧鲨鱼接近大型旋转礁石，身体与鱼鳍不穿模且无突跳',()=>{
    let minVisibleGap=Infinity,maxStep=0,travel=0;
    for(const fps of [25,60]){const mesh=new T.Mesh(new T.IcosahedronGeometry(1.1,2));mesh.position.set(10,-1.6,-3);mesh.scale.set(3.3,4.2,2.6);mesh.rotation.set(.27,1.1,-.24);const o=AQUARIUM_REEF.rockObstacle(mesh),{engine,fish}=speciesFixture(AQUARIUM_SPECIES[6]),f=fish[0];engine.obstacles=[o];position(engine,f,-5,2,-3);f.goal.set(16,2,-3);f.nextGoal=1000;f.nextPlay=1000;f.activityUntil=1000;engine.resolve(48);engine.syncModel(f,0,true);const start=f.model.position.clone();let previous=start.clone();
      for(let i=0;i<fps*40;i++){engine.update(1/fps,[]);const gap=engine.obstacleGap(engine.renderedBounds(f),o),step=f.model.position.distanceTo(previous);minVisibleGap=Math.min(minVisibleGap,gap);maxStep=Math.max(maxStep,step);assert(gap>=-.001,`可见鲨鱼穿入旋转礁石：${gap}`);assert(step<f.cruise*2.1*Math.ceil(60/fps)/60+.001,`碰撞造成鲨鱼突跳：${step}`);previous.copy(f.model.position);}travel=Math.max(travel,start.distanceTo(f.model.position));
    }assert(travel>2,'鲨鱼卡在礁石旁不再移动');return {minVisibleGap,maxStep,travel};
  });
  await test('完整礁石布局中两条鲨鱼逐步运动平滑，转向与摆尾不断帧',()=>{
    let minTravel=Infinity,minStroke=Infinity,minGap=Infinity,maxStep=0,maxAcceleration=0,maxAngularAcceleration=0,minPhaseStep=Infinity,maxEffortRate=0;const cases=[];
    for(const [fps,sizeFactor] of [[25,.94],[60,1.06]]){const scene=new T.Scene(),garden=AQUARIUM_REEF.makeRockGarden(Array.from({length:4},()=>new T.MeshBasicMaterial()),seeded(11042)),environment=AQUARIUM_REEF.decorate(scene);environment.obstacles.push(...garden.obstacles);assert(environment.obstacles.filter(o=>o.kind==='rock').length===81,'检查没有包含实际右侧礁石与散石');
      const originalRandom=Math.random;let life;try{Math.random=seeded(11042);life=AQUARIUM_REEF.populate(scene,environment.obstacles);}finally{Math.random=originalRandom;}
      const turtle=life.residents.find(r=>r.species.id==='sea-turtle');environment.obstacles.push({center:turtle.g.position,radius:1.35});const fish=[],engine=new AquariumMotion(fish,seeded(11042),environment),species=AQUARIUM_SPECIES[6];
      for(let i=0;i<2;i++){const g=new T.Group();g.userData.swim={phase:{value:0},effort:{value:.6},bend:{value:new T.Vector2()}};engine.register({g,species,kind:species.kind,rounded:false,size:species.size*sizeFactor,direction:i?-1:1,phase:0});}engine.setCount(2);
      // Sample every physics step, including the 2/3 substeps of a 25 Hz frame.
      // Coarse displacement checks miss the old stop/escape/reset jitter entirely.
      const samples=fish.map(f=>({p:f.model.position.clone(),v:f.renderVelocity.clone(),q:f.model.quaternion.clone(),angular:new T.Vector3(),phase:f.visualState.phase,effort:f.visualState.effort})),sync=engine.syncModel.bind(engine);
      engine.syncModel=(f,dt,immediate=false)=>{sync(f,dt,immediate);if(!dt)return;const last=samples[f.id],v=f.model.position.clone().sub(last.p).divideScalar(dt),rotation=f.model.quaternion.clone().multiply(last.q.clone().invert());if(rotation.w<0)rotation.set(-rotation.x,-rotation.y,-rotation.z,-rotation.w);const axis=new T.Vector3(rotation.x,rotation.y,rotation.z),length=axis.length(),angular=axis.multiplyScalar(length>1e-9?2*Math.atan2(length,rotation.w)/length/dt:0);
        maxAcceleration=Math.max(maxAcceleration,v.clone().sub(last.v).length()/dt);maxAngularAcceleration=Math.max(maxAngularAcceleration,angular.clone().sub(last.angular).length()/dt);const phaseStep=(f.visualState.phase-last.phase+Math.PI*40)%(Math.PI*40);minPhaseStep=Math.min(minPhaseStep,phaseStep);maxEffortRate=Math.max(maxEffortRate,Math.abs(f.visualState.effort-last.effort)/dt);
        assert(v.clone().sub(last.v).length()/dt<=.481,`${fps} 帧鲨鱼 ${f.id} 速度突变`);assert(phaseStep>=dt*.99&&phaseStep<=dt*10,'避礁时摆尾时钟被截停或跳变');assert(Math.abs(f.visualState.effort-last.effort)/dt<=1.201,'摆尾振幅突然改变');
        assert(f.model.position.y<=f.maxY+1.2,'避礁时鲨鱼持续向水面漂移');
        last.p.copy(f.model.position);last.v.copy(v);last.q.copy(f.model.quaternion);last.angular.copy(angular);last.phase=f.visualState.phase;last.effort=f.visualState.effort;
      };
      const previous=fish.map(f=>f.model.position.clone()),windowStart=previous.map(p=>p.clone()),phase=fish.map(f=>f.visualState.phase),stroke=[0,0];let lowest=Infinity;
      for(let i=1;i<=fps*96;i++){life.update(i/fps);engine.update(1/fps,[]);for(let j=0;j<2;j++){const f=fish[j],p=f.model.position,step=p.distanceTo(previous[j]),delta=f.visualState.phase-phase[j];stroke[j]+=Math.abs(Math.atan2(Math.sin(delta),Math.cos(delta)));phase[j]=f.visualState.phase;previous[j].copy(p);maxStep=Math.max(maxStep,step);assert(step<f.cruise*2.1*Math.ceil(60/fps)/60+.001,'脱困时鲨鱼突然跳动');if(i%10===0){const visible=engine.renderedBounds(f);for(const o of environment.obstacles.filter(o=>o.kind==='rock'))minGap=Math.min(minGap,engine.obstacleGap(visible,o));}
          if(i%(fps*4)===0){const distance=p.distanceTo(windowStart[j]);lowest=Math.min(lowest,distance);minTravel=Math.min(minTravel,distance);minStroke=Math.min(minStroke,stroke[j]);assert(distance>.12,`${fps} 帧鲨鱼 ${j} 在第 ${i/fps} 秒前四秒没有继续游动：${distance}`);assert(stroke[j]>.15,`${fps} 帧鲨鱼 ${j} 摆尾冻结：${stroke[j]}`);windowStart[j].copy(p);stroke[j]=0;}
        }}cases.push({fps,sizeFactor,minWindowTravel:lowest});
    }assert(minGap>=-.001,`持续游动时穿入礁石：${minGap}`);assert(maxAngularAcceleration<4.7,`转向加速度突变：${maxAngularAcceleration}`);return {cases,minTravel,minStroke,minGap,maxStep,maxAcceleration,maxAngularAcceleration,minPhaseStep,maxEffortRate};
  });
  return {passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results};
};
})();
