/* AUV-01: rigid armour and servo joints, +X forward, +Y dorsal. No external assets. */
(() => {
'use strict';
const T=THREE,TAU=Math.PI*2,clamp=T.MathUtils.clamp;
const species=Object.freeze({id:'robot-fish',name:'机械仿生鱼 AUV-01',family:'水下机器人',subtitle:'海盐白装甲 · 湖蓝机械鳍',resident:true,
  description:'这是一台模仿鱼类推进的水下机器人。机身采用海盐白与湖蓝双色设计：海盐白装甲包覆头部和主体，湖蓝色集中在侧面板、尾部推进舱和机械鳍片，白色检修盖与鳍尖收边呼应主装甲。低亮度冰蓝灯带和外露螺栓保留清晰的工业细节。头部的圆形光学镜头负责观察环境；尾部通过两级伺服关节驱动硬质分叉尾鳍，身体不会像活鱼一样柔软弯曲。',
  features:Object.freeze(['分节装甲与外露伺服轴','冰蓝灯带与光学镜头','湖蓝硬质尾鳍与白色检修盖']),
  habitat:Object.freeze({environment:'中层开阔水域的巡检航线',diet:'电池供能，无需投喂',habit:'单独巡航，机械尾鳍周期摆动，转弯时微微侧倾；传感器灯缓慢呼吸，不争抢鱼饵。'}),
  traits:Object.freeze({size:3,schooling:1,danger:1,activity:3,speed:3})});
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.48,metalness:.38,...extra});
// Two-tone colour blocking: salt-white armour, lake-blue panels and propulsion fins.
const saltWhite=mat('#e5e9df',{roughness:.56,metalness:.18}),lakeBlue=mat('#4d91ad',{roughness:.54,metalness:.20});
const cyan=mat('#b6dfe5',{emissive:'#80bdcf',emissiveIntensity:.16,roughness:.52,metalness:.15}),glass=mat('#76a4b8',{roughness:.30,metalness:.18});
const sphere=new T.SphereGeometry(1,12,8),box=new T.BoxGeometry(1,1,1);
function mesh(g,geo,m,p=[0,0,0],s=[1,1,1]){const o=new T.Mesh(geo,m);o.position.fromArray(p);o.scale.fromArray(s);g.add(o);return o;}
function block(g,m,p,s){return mesh(g,box,m,p,s);}
function ring(g,x,r,m){const o=mesh(g,new T.TorusGeometry(r,.025,6,24),m,[x,0,0]);o.rotation.y=Math.PI/2;return o;}
function shell(g,sections,m){const geo=new T.LatheGeometry(sections.map(([x,r])=>new T.Vector2(r,x)),10);geo.rotateZ(-Math.PI/2);geo.scale(1,1,.70);return mesh(g,geo,m);}
function blade(g,points,m,thickness=.045){const shape=new T.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false});geo.translate(0,0,-thickness/2);return mesh(g,geo,m);}
function createModel(){const g=new T.Group(),glow=cyan.clone();g.userData.species=species.id;
  shell(g,[[-.62,.25],[-.48,.42],[.24,.48],[.67,.32],[.84,.17],[.84,0]],saltWhite);
  shell(g,[[-.73,.22],[-.62,.25],[.69,.28]],lakeBlue);
  // Deliberately exposed rectangular service plate, fasteners and luminous side rails.
  for(const side of [-1,1]){
    block(g,lakeBlue,[-.02,.015,side*.318],[.92,.32,.055]);
    block(g,saltWhite,[.16,.015,side*.352],[.28,.22,.025]);
    block(g,glow,[-.10,.215,side*.293],[.85,.038,.035]);
    block(g,glow,[-.18,-.21,side*.275],[.64,.024,.032]);
    for(const x of [-.4,.39])for(const y of [-.10,.13])mesh(g,sphere,saltWhite,[x,y,side*.353],[.030,.030,.018]);
    for(let i=0;i<3;i++){const vent=block(g,saltWhite,[-.29+i*.085,.01,side*.355],[.024,.17,.025]);vent.rotation.z=-.25;}
    // Flat concentric camera bezel, no organic eyeball, pupil or mouth.
    const bezel=mesh(g,new T.CylinderGeometry(.14,.14,.07,16),lakeBlue,[.57,.045,side*.235]);bezel.rotation.x=Math.PI/2;
    const optic=mesh(g,new T.CylinderGeometry(.095,.095,.078,20),glass,[.57,.045,side*.25]);optic.rotation.x=Math.PI/2;
    mesh(g,new T.TorusGeometry(.105,.017,6,24),glow,[.57,.045,side*.295]);
    mesh(g,sphere,glow,[.585,.06,side*.3],[.033,.033,.009]);
  }
  blade(g,[[-.40,.34],[-.23,.88],[.01,.83],[.22,.42]],lakeBlue,.09);
  blade(g,[[-.21,.77],[-.18,.85],[0,.80],[.04,.74]],saltWhite,.095);
  block(g,saltWhite,[-.10,.51,0],[.27,.09,.10]);
  // Exposed spine, two rigid nested tail modules and visible circular actuator covers.
  const tail=new T.Group();tail.position.x=-.64;g.add(tail);
  ring(tail,0,.22,glow);shell(tail,[[-.48,.14],[-.38,.23],[-.10,.25]],lakeBlue);
  block(tail,lakeBlue,[-.07,0,0],[.22,.16,.17]);
  const tip=new T.Group();tip.position.x=-.44;tail.add(tip);
  block(tip,saltWhite,[-.13,0,0],[.33,.15,.15]);ring(tip,-.04,.125,saltWhite);
  blade(tip,[[-.19,.09],[-.58,.69],[-.78,.69],[-.62,.13],[-.48,0],[-.62,-.13],[-.78,-.69],[-.58,-.69],[-.19,-.09]],lakeBlue,.075);
  for(const side of [-1,1]){
    blade(tip,[[-.57,side*.52],[-.62,side*.65],[-.74,side*.65],[-.70,side*.52]],saltWhite,.082);
    const cover=mesh(tail,new T.CylinderGeometry(.11,.11,.045,12),lakeBlue,[-.08,0,side*.22]);cover.rotation.x=Math.PI/2;
  }
  const fins=[];for(const side of [-1,1]){const fin=new T.Group();fin.position.set(.16,-.19,side*.23);fin.rotation.x=side*.85;g.add(fin);blade(fin,[[.12,0],[-.03,-.42],[-.37,-.55],[-.24,-.03]],lakeBlue,.06);blade(fin,[[-.08,-.37],[-.13,-.47],[-.34,-.51],[-.28,-.41]],saltWhite,.065);fins.push(fin);}
  g.userData.robot={tail,tip,fins,glow,worldControlled:false};animate(g,0);return g;
}
function animate(g,t){const r=g.userData.robot;if(!r)return;r.glow.emissiveIntensity=.16+.03*Math.sin(t*1.8);r.tail.rotation.y=Math.sin(t*TAU*.82)*.20;r.tip.rotation.y=Math.sin(t*TAU*.82-.75)*.32;r.fins.forEach((f,i)=>f.rotation.x=(i?1:-1)*(.85+.06*Math.sin(t*2.3)));}
function makeController(g,obstacles=[]){g.userData.robot.worldControlled=true;let t=0,yaw=g.rotation.y,rate=0,pitch=0,accumulator=0;
  return {update({dt}){accumulator+=clamp(dt,0,.5);while(accumulator>=1/60-1e-9){const h=1/60;accumulator=Math.max(0,accumulator-h);t+=h;
    const a=t*.11,target=new T.Vector3(7.8*Math.cos(a),3.9+.75*Math.sin(a*1.7),2+3.3*Math.sin(a));
    let dx=target.x-g.position.x,dz=target.z-g.position.z;
    const ahead=g.position.clone().add(new T.Vector3(Math.cos(yaw)*2.1,0,-Math.sin(yaw)*2.1));
    for(const o of obstacles){if(o.owner===g||o.center===g.position)continue;const rr=o.radii||new T.Vector3(o.radius,o.radius,o.radius),c=o.center;if(Math.abs(ahead.y-c.y)>rr.y+.8)continue;const x=ahead.x-c.x,z=ahead.z-c.z,d=Math.hypot(x/(rr.x+1.6),z/(rr.z+1.6));if(d<1.5){const force=(1.5-d)*12/Math.max(.2,Math.hypot(x,z));dx+=x*force;dz+=z*force;}}
    dx-=Math.sign(ahead.x)*Math.max(0,Math.abs(ahead.x)-10)*14;dz-=Math.sign(ahead.z-1)*Math.max(0,Math.abs(ahead.z-1)-5)*14;
    const error=Math.atan2(Math.sin(Math.atan2(-dz,dx)-yaw),Math.cos(Math.atan2(-dz,dx)-yaw));rate+=clamp(clamp(error*.9,-.48,.48)-rate,-.55*h,.55*h);yaw+=rate*h;
    pitch+=(clamp((target.y-g.position.y)*.18,-.22,.22)-pitch)*(1-Math.exp(-h*1.8));
    const speed=.85*(1-.35*Math.abs(rate));g.position.addScaledVector(new T.Vector3(Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.sin(yaw)*Math.cos(pitch)),speed*h);g.rotation.set(-rate*.35,yaw,pitch,'YZX');
  }animate(g,t);}};
}
globalThis.AQUARIUM_ROBOT=Object.freeze({species,createModel,animate,makeController});
})();
