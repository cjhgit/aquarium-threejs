/* Procedural reef residents. Shared factories keep the field guide faithful to the tank. */
(() => {
'use strict';
const T=globalThis.THREE;
const entries=[
  ['tide-crab','青钳沙蟹','甲壳类','青绿色甲壳 · 成对大钳',['固定腿根与三段步足','宽扁齿缘硬壳','活动眼柄与开合蟹钳'],'沙地与礁石脚下','藻屑与沉落的有机碎屑','在沙地上横向探索，交替抬脚与支撑；转身时以落地步足为支点分段换步，停留时会转动眼柄、抬动钳臂和开合钳口。'],
  ['cleaner-shrimp','绯线清洁虾','甲壳类','绯红节腹 · 象牙白长须',['弯曲分节腹部','白色长触须','展开的尾扇'],'珊瑚旁与礁石缝隙','藻膜与微小碎屑','常在礁脚小范围探索，触须随水流轻摆，偶尔短距离游起再落下。'],
  ['pearl-clam','珠光扇贝','双壳类','放射贝肋 · 珠光内缘',['放射壳纹','成对贝壳','柔软外套膜'],'平缓的沙地','过滤水中的微小浮游生物','固定在沙底，贝壳缓慢开合，靠水流过滤食物。'],
  ['ochre-star','杏橘海星','棘皮类','五条腕足 · 细颗粒表面',['五条渐尖腕足','隆起的中央盘','背部细小颗粒'],'沙地与低矮礁面','底栖有机物','贴着海底极慢移动，用腕足探索周围，几乎不会离开底面。'],
  ['moon-jelly','月光水母','水母类','半透明伞盖 · 淡紫口腕',['通透伞盖','四瓣口腕','细长触手'],'远离礁石的中上层缓流','细小浮游生物','通过伞盖有节奏地收缩，缓慢上浮、下沉和漂移，保持在开阔水域。']
];
const descriptions=[
  '青绿色的宽扁硬壳带有细小侧齿与背部隆脊。四对三段步足从固定的腿根伸出，末节短而尖。小眼睛随眼柄转动，前方的关节钳臂能抬起、收拢，两只钳口各自缓慢开合。',
  '绯红与象牙白相间的节腹弯出柔和的弧线，尾端展开小巧尾扇。两条细长白须伸向前方，比身体还长。',
  '浅玫瑰色的双壳从铰合处向外展开，放射状贝肋形成柔和的起伏。开合间可以看见珠光色的外套膜。',
  '杏橘色的中央盘向外延伸五条渐尖的柔软腕足，背面隆起细小浅色颗粒。圆润的轮廓贴合沙地。',
  '淡蓝透明的伞盖下，四瓣淡紫色口腕与细长触手一起舒展。伞缘轻轻收拢后再展开，像水中的一盏月光灯。'
];
const species=Object.freeze(entries.map(([id,name,family,subtitle,features,environment,diet,habit],i)=>Object.freeze({id,name,family,subtitle,features:Object.freeze(features),description:descriptions[i],temperament:habit,habitat:Object.freeze({environment,diet,habit}),resident:true,traits:Object.freeze({size:i===4?2:1,schooling:1,danger:1,activity:i===2||i===3?1:2,speed:1})})));
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.57,...extra});
const red=material('#c6654b'),light=material('#f1be8c'),white=material('#f5e4ca'),dark=material('#182c30'),pink=material('#d397aa',{side:T.DoubleSide}),starMat=material('#e6a064');
const sphere=new T.SphereGeometry(1,12,8);
function blob(g,mat,x,y,z,sx,sy,sz){const m=new T.Mesh(sphere,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);g.add(m);return m;}
function tube(g,points,r,mat){const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),12,r,5,false),mat);g.add(m);return m;}
function limb(g,a,b,r,mat){const mid=a.map((v,i)=>(v+b[i])/2);return tube(g,[a,mid,b],r,mat);}
// Merge static surfaces by material while preserving animated joints as separate subtrees.
function batchStatic(group,animated=[]){
  group.updateMatrixWorld(true);const skip=new Set();for(const root of animated)root.traverse(o=>skip.add(o));
  const inverse=group.matrixWorld.clone().invert(),buckets=new Map();group.traverse(o=>{if(!o.isMesh||skip.has(o))return;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o);});
  for(const [mat,parts] of buckets){if(parts.length<2)continue;const positions=[],normals=[];
    for(const m of parts){const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);geo.dispose();m.removeFromParent();}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));group.add(new T.Mesh(geo,mat));
  }
}
function createModel(s){const g=new T.Group();g.userData.species=s.id;g.userData.legs=[];g.userData.tendrils=[];
  if(s.id==='tide-crab')return AQUARIUM_CRAB.createModel();
  if(s.id==='cleaner-shrimp'){
    for(let i=0;i<7;i++)blob(g,i%2?white:red,-.47+i*.16,.22+Math.sin(i/6*Math.PI)*.19,0,.14,.16-i*.009,.14-i*.009);
    for(const side of [-1,1]){
      for(let i=0;i<5;i++){const leg=new T.Group();tube(leg,[[i*.12-.25,.28,side*.1],[i*.10-.30,.11,side*.26],[i*.09-.40,.025,side*.35]],.012,white);g.add(leg);g.userData.legs.push(leg);}
      const antenna=tube(g,[[.42,.34,side*.1],[.9,.65,side*.3],[1.38,.7,side*.58],[1.7,.48,side*.7]],.012,white);g.userData.tendrils.push(antenna);
      blob(g,dark,.48,.48,side*.12,.045,.045,.045);const tail=blob(g,red,-.66,.16,side*.12,.22,.035,.15);tail.rotation.y=side*.5;
    }
  }else if(s.id==='pearl-clam'){
    function shell(top){const pivot=new T.Group();pivot.position.z=-.46;const positions=[],indices=[],n=36,rows=8;
      for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){const a=-1.35+i/n*2.7,r=j/rows,bulge=Math.sin(r*Math.PI)*.16;positions.push(Math.sin(a)*r*.62,(top?1:-1)*(bulge+.018*Math.cos(i/n*Math.PI*24)*r),Math.cos(a)*r*1.02);}
      for(let j=0;j<rows;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i;indices.push(a,a+1,a+n+1,a+1,a+n+2,a+n+1);}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();pivot.add(new T.Mesh(geo,pink));pivot.position.y=.16;g.add(pivot);return pivot;}
    g.userData.lid=shell(true);shell(false);blob(g,white,0,.17,.03,.43,.06,.4);
  }else if(s.id==='ochre-star'){
    const vertices=[],indices=[],rings=8,sides=80;
    for(let row=0;row<=rings;row++)for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,t=row/rings,r=(.27+.59*Math.pow((Math.cos(a*5)+1)*.5,1.55))*t;vertices.push(Math.sin(a)*r,.07+.20*Math.pow(1-t,.8),Math.cos(a)*r);}
    for(let row=0;row<rings;row++)for(let i=0;i<sides;i++){const a=row*(sides+1)+i;indices.push(a,a+sides+1,a+1,a+1,a+sides+1,a+sides+2);}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();g.add(new T.Mesh(geo,starMat));
    for(let arm=0;arm<5;arm++)for(let i=1;i<7;i++){const a=arm*Math.PI*2/5,r=i*.105;blob(g,light,Math.sin(a)*r,.22-i*.012,Math.cos(a)*r,.025,.025,.025);}
  }else{
    const glass=material('#bed5ed',{transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false,roughness:.18,emissive:'#6679ba',emissiveIntensity:.28});
    const bell=new T.Group();bell.add(new T.Mesh(new T.SphereGeometry(.72,28,16,0,Math.PI*2,0,Math.PI*.52),glass));
    const rim=new T.Mesh(new T.TorusGeometry(.72,.035,6,48),material('#e0d1ed',{transparent:true,opacity:.65,depthWrite:false}));rim.rotation.x=Math.PI/2;bell.add(rim);g.add(bell);g.userData.bell=bell;
    const armMat=material('#d0aacb',{transparent:true,opacity:.65,depthWrite:false});
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=i<4?.23:.58,len=i<4?1.05:1.65;const strand=tube(g,[[Math.cos(a)*r,0,Math.sin(a)*r],[Math.cos(a+.2)*r,-len*.4,Math.sin(a+.2)*r],[Math.cos(a+.5)*r*.8,-len,Math.sin(a+.5)*r]],i<4?.055:.012,armMat);g.userData.tendrils.push(strand);}
    for(let i=0;i<4;i++){const a=i*Math.PI/2;blob(bell,armMat,Math.cos(a)*.2,.13,Math.sin(a)*.2,.16,.045,.12);}
  }
  for(const leg of g.userData.legs)batchStatic(leg);batchStatic(g,[...g.userData.legs,...g.userData.tendrils,g.userData.lid,g.userData.bell].filter(Boolean));return g;
}
function animateModel(g,t){const u=g.userData;
  if(u.species==='tide-crab'){AQUARIUM_CRAB.animate(g,t);return;}
  u.legs.forEach((leg,i)=>{leg.rotation.y=Math.sin(t*4+i*1.8)*.09;});
  u.tendrils.forEach((m,i)=>{m.rotation.x=Math.sin(t*1.3+i)*.055;m.rotation.z=Math.cos(t*.9+i)*.045;});if(u.lid)u.lid.rotation.x=-.13-.10*(1+Math.sin(t*.7));if(u.bell){const pulse=Math.sin(t*2.2);u.bell.scale.set(1+pulse*.09,1-pulse*.13,1+pulse*.09);}}
function populate(scene){const residents=[],layout=[[0,-5.4,4,.9],[0,7,3.8,.82],[2,-2.2,5.2,.95],[2,3.8,4.5,.75],[2,-11.9,4.7,.85],[3,-8.5,4.4,.85],[3,5.5,3.6,.67],[4,-3.8,-2.2,.9],[4,5.2,-3,.72]];
  for(const [index,x,z,size] of layout){const s=species[index],g=createModel(s);g.scale.setScalar(size);const y=index===4?3.8:AquariumMotion.floorHeight(x,z)+.04;g.position.set(x,y,z);g.rotation.y=index===4?0:x*.37;scene.add(g);const id=residents.length;residents.push({g,species:s,home:new T.Vector3(x,y,z),phase:id*1.79,randomState:11042+id*733,mode:'rest',until:id?3:.8,speed:0,target:new T.Vector3(x,y,z),direction:1});g.userData.walkSpeed=0;if(s.id==='tide-crab')residents[id].crabController=AQUARIUM_CRAB.makeController(g,AquariumMotion.floorHeight);}
  let previous=0;
  const rand=r=>{r.randomState=(r.randomState*1664525+1013904223)>>>0;return r.randomState/4294967296;};
  function crab(r,t,dt){const {g}=r,p=g.position;
    if(t>=r.until){if(r.mode==='walk'){r.mode='rest';r.until=t+1.5+rand(r)*3;}else{r.mode='walk';r.target.set(Math.max(-12.7,Math.min(11.5,p.x+(rand(r)>.5?1:-1)*(1.8+rand(r)*3.4))),0,3.8+rand(r)*3.2);const heading=Math.atan2(-(r.target.z-p.z),r.target.x-p.x);r.direction=Math.cos(heading-g.rotation.y)>=0?1:-1;r.until=t+11+rand(r)*7;}}
    const dx=r.target.x-p.x,dz=r.target.z-p.z,distance=Math.hypot(dx,dz),heading=Math.atan2(-dz,dx)+(r.direction<0?Math.PI:0),delta=Math.atan2(Math.sin(heading-g.rotation.y),Math.cos(heading-g.rotation.y));
    const turn=r.mode==='walk'&&Math.abs(delta)>.15?T.MathUtils.clamp(delta,-dt*.42,dt*.42):0;
    const desired=r.mode==='walk'&&Math.abs(delta)<=.15&&distance>.18?.36:0;r.speed+=T.MathUtils.clamp(desired-r.speed,-dt*1.1,dt*.55);
    if(distance<.18&&r.mode==='walk'){r.mode='rest';r.until=t+1.5+rand(r)*3;}
    r.crabController.update({dt,t,turn,speed:r.speed,direction:r.direction});
  }
  return {residents,update(t){const dt=Math.max(0,Math.min(.5,t-previous));previous=t;for(const r of residents){const {g,home,phase,species:s}=r,q=t+phase;
    if(s.id==='tide-crab')crab(r,t,dt);
    if(s.id==='moon-jelly'){g.position.set(home.x+Math.sin(q*.12)*1.1,home.y+Math.sin(q*.3)*.8,home.z+Math.cos(q*.16)*.6);g.rotation.z=Math.sin(q*.21)*.08;}else{if(s.id==='ochre-star')g.position.x=home.x+Math.sin(q*.025)*.06;g.position.y=AquariumMotion.floorHeight(g.position.x,g.position.z)+.04;}
    animateModel(g,q);
  }}};
}
// Tapered curves avoid uniform-width pipes, repeated forks and the geometric fan lattice.
function taper(g,points,start,end,mat){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),segments=14,sides=7,geo=new T.TubeGeometry(curve,segments,start,sides,false),p=geo.attributes.position;
  for(let row=0;row<=segments;row++){const t=row/segments,center=curve.getPointAt(t),scale=T.MathUtils.lerp(1,end/start,t);for(let j=0;j<=sides;j++){const i=row*(sides+1)+j;p.setXYZ(i,center.x+(p.getX(i)-center.x)*scale,center.y+(p.getY(i)-center.y)*scale,center.z+(p.getZ(i)-center.z)*scale);}}geo.computeVertexNormals();g.add(new T.Mesh(geo,mat));}
function decorate(scene){const obstacles=[],stones=new T.Group();let seed=7321;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;},span=(a,b)=>a+(b-a)*random();
  const stoneMats=['#63766c','#748174','#556b65','#809083'].map(c=>material(c,{roughness:.98,flatShading:true}));
  function stone(x,y,z,sx,sy,sz,index){const geo=new T.IcosahedronGeometry(1,2),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const a=p.getX(i),b=p.getY(i),c=p.getZ(i),noise=1+.085*Math.sin(a*7+b*5+index)*Math.cos(c*6-index);p.setXYZ(i,a*noise,b*noise,c*noise);}geo.computeVertexNormals();const m=new T.Mesh(geo,stoneMats[index%4]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);stones.add(m);obstacles.push({center:new T.Vector3(x,y,z),radii:new T.Vector3(sx*1.04,sy*1.04,sz*1.04)});}
  // A broad buried foundation carries uneven side blocks and a fallen capstone.
  // Their negative space is an off-centre passage, rather than a continuous torus.
  [[-9.8,-4.95,.05,5.15,1.18,2.6],[-13,-3.25,-.2,1.85,2.0,2.05],[-12.8,-1.15,-.45,1.38,1.18,1.6],[-6.45,-3.32,.15,1.85,1.75,2.0],[-6.9,-1.25,-.3,1.24,1.0,1.45],[-9.65,-.57,-.25,3.15,.88,1.7],[-10.7,.42,-.42,1.6,.65,1.15],[-8.6,.22,-.1,1.2,.60,1.05],[-13.55,-4.1,1.1,1.9,.85,1.3],[-5.35,-4.12,1.0,1.5,.72,1.35],[-12.4,-4.0,-2,1.5,1,1.15]].forEach((p,i)=>stone(...p,i));batchStatic(stones);scene.add(stones);
  const coral=new T.Group(),coralMat=material('#c78b7d',{roughness:.9,emissive:'#a96351',emissiveIntensity:.08}),tips=material('#dfb89c',{roughness:.86});
  function grow(root,direction,length,radius,depth,group,mat,flat=false){const end=root.clone().addScaledVector(direction,length),bend=root.clone().lerp(end,.52).add(new T.Vector3(span(-.08,.08),span(-.02,.08),flat?span(-.025,.025):span(-.1,.1)));taper(group,[root.toArray(),bend.toArray(),end.toArray()],radius,radius*.5,mat);
    if(!depth){blob(group,tips,...end.toArray(),radius*.55,radius*.8,radius*.55);return;}
    const forks=random()<.22?3:2;for(let i=0;i<forks;i++){const side=i%2?-1:1,d=direction.clone().multiplyScalar(.55).add(new T.Vector3(side*span(.30,.65),span(.3,.65),flat?span(-.10,.10):span(-.5,.5))).normalize();grow(end,d,length*span(.60,.82),radius*span(.54,.70),depth-1,group,mat,flat);}}
  for(let i=0;i<4;i++)grow(new T.Vector3(span(-.35,.35),0,span(-.22,.22)),new T.Vector3(span(-.35,.35),1,span(-.18,.18)).normalize(),span(.5,.8),span(.08,.11),3,coral,coralMat);
  batchStatic(coral);coral.scale.setScalar(1.22);coral.position.set(-4.8,AquariumMotion.floorHeight(-4.8,1.1),1.1);scene.add(coral);
  const fan=new T.Group(),fanMat=material('#b18a9d',{roughness:.88,emissive:'#906b8b',emissiveIntensity:.08});
  for(let i=0;i<3;i++)grow(new T.Vector3((i-1)*.12,0,0),new T.Vector3((i-1)*.5,1,.03).normalize(),span(.35,.5),.055,5,fan,fanMat,true);batchStatic(fan);fan.position.set(7.1,AquariumMotion.floorHeight(7.1,2.3),2.3);fan.rotation.y=-.26;scene.add(fan);
  // A weathered trunk lies on the sand. Side branches get progressively thinner.
  const drift=new T.Group(),wood=material('#645f49',{roughness:1});
  const ground=(x,z,lift)=>[x,AquariumMotion.floorHeight(x,z)+lift,z];
  taper(drift,[ground(-4.3,2.9,.17),ground(-1.8,2.5,.23),ground(.5,2.65,.20),ground(3.1,1.85,.10)],.24,.075,wood);
  [[[-1.8,2.5,.23],[-1.1,3.4,.15],[.2,4.1,.07]],[[.5,2.65,.20],[1.3,3.25,.13],[2.5,3.6,.055]],[[-2.4,2.6,.21],[-2.8,1.65,.15],[-3.8,1.2,.05]],[[1.5,2.3,.15],[2.0,1.2,.11],[3,.65,.05]],[[1.25,3.25,.13],[.9,3.9,.09],[1.15,4.5,.04]]].forEach((points,i)=>taper(drift,points.map(([x,z,y])=>ground(x,z,y)),i===4?.045:.085,i===4?.012:.024,wood));batchStatic(drift);scene.add(drift);
  return {obstacles};
}
globalThis.AQUARIUM_REEF=Object.freeze({species,createModel,animateModel,populate,decorate});
})();
