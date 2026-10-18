/* Authored shore-crab anatomy and contact-aware locomotion.
 * Visual references: https://www.marlin.ac.uk/species/detail/1497 (front / dorsal photos).
 * The three visible leg sections are an intentional visual simplification.
 */
(() => {
'use strict';
const T=globalThis.THREE,clamp=T.MathUtils.clamp,X=new T.Vector3(1,0,0),UP=new T.Vector3(0,1,0);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.68,...extra});
const shellMat=mat('#5a7965',{vertexColors:true}),edgeMat=mat('#3c6155'),limbMat=mat('#637e67'),jointMat=mat('#a8ad7e'),bellyMat=mat('#949f81'),tipMat=mat('#4b5547'),eyeMat=mat('#171f1b',{roughness:.25});
const ball=new T.SphereGeometry(1,10,7);
function oval(parent,material,position,scale){const m=new T.Mesh(ball,material);m.position.fromArray(position);m.scale.fromArray(scale);parent.add(m);return m;}
function rod(parent,a,b,r0,r1,material){const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start),m=new T.Mesh(new T.CylinderGeometry(r1,r0,delta.length(),7),material);m.position.copy(start).addScaledVector(delta,.5);m.quaternion.setFromUnitVectors(UP,delta.normalize());parent.add(m);return m;}
function curve(parent,points,r0,r1,material){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),geo=new T.TubeGeometry(path,12,r0,7,false),p=geo.attributes.position;
  for(let row=0;row<=12;row++){const t=row/12,c=path.getPointAt(t),k=T.MathUtils.lerp(1,r1/r0,t);for(let j=0;j<=7;j++){const i=row*8+j;p.setXYZ(i,c.x+(p.getX(i)-c.x)*k,c.y+(p.getY(i)-c.y)*k,c.z+(p.getZ(i)-c.z)*k);}}geo.computeVertexNormals();parent.add(new T.Mesh(geo,material));}
function merge(group){group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map();group.traverse(o=>{if(!o.isMesh)return;if(!buckets.has(o.material))buckets.set(o.material,[]);buckets.get(o.material).push(o);});
  for(const [material,meshes] of buckets){if(meshes.length<2)continue;const positions=[],normals=[];for(const m of meshes){const geo=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();geo.applyMatrix4(inverse.clone().multiply(m.matrixWorld));positions.push(...geo.attributes.position.array);normals.push(...geo.attributes.normal.array);geo.dispose();m.removeFromParent();}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));group.add(new T.Mesh(geo,material));}}
function carapace(parent){
  // A broad, angular shield with a shallow dome and a folded lower rim.
  const outline=[[0,-.43],[.30,-.41],[.49,-.29],[.62,-.11],[.65,.06],[.57,.23],[.43,.35],[.27,.38],[.15,.35],[.07,.39],[0,.37],[-.07,.39],[-.15,.35],[-.27,.38],[-.43,.35],[-.57,.23],[-.65,.06],[-.62,-.11],[-.49,-.29],[-.30,-.41]],n=outline.length;
  const positions=[],colors=[],indices=[],rings=[[0,.455],[.32,.448],[.70,.403],[1,.272],[.96,.213],[.62,.185],[0,.185]];
  for(let row=0;row<rings.length;row++){const [radius,y]=rings[row];for(let i=0;i<n;i++){const [x,z]=outline[i],grain=Math.sin(x*41+z*29)*Math.cos(z*43-x*19),k=.90+.09*grain+(row<3?.06:0);positions.push(x*radius,y+(row>0&&row<3?.014*Math.sin(i*2.1):0),z*radius);colors.push(k,k*(1+.025*grain),k*.94);}}
  for(let row=0;row<rings.length-1;row++)for(let i=0;i<n;i++){const a=row*n+i,b=row*n+(i+1)%n;indices.push(a,b,a+n,b,b+n,a+n);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();parent.add(new T.Mesh(geo,shellMat));
  for(const side of [-1,1]){
    // Five small lateral teeth, flush with the shell instead of large horns.
    for(let i=0;i<5;i++){const z=.30-i*.085,x=side*(.47+Math.sin((i+.4)/5*Math.PI)*.16);rod(parent,[x,.277,z],[x+side*.065,.278,z+.025],.031,.003,edgeMat);}
    curve(parent,[[side*.12,.449,-.22],[side*.24,.431,-.06],[side*.30,.40,.12]],.008,.004,edgeMat);
    curve(parent,[[side*.13,.405,.34],[side*.23,.40,.36],[side*.32,.35,.34]],.024,.013,edgeMat);
    for(let i=0;i<5;i++)oval(parent,jointMat,[side*(.11+i*.065),.43-i*.009,-.23+i*.012],[.012,.007,.01]);
  }
  // Flat overlapping underside plates and small folded mouthparts.
  for(let i=0;i<4;i++){const plate=new T.Mesh(new T.BoxGeometry(.31-i*.045,.025,.11),bellyMat);plate.position.set(0,.183,-.20+i*.10);parent.add(plate);}
}
function makeLeg(parent,side,pair){const hip=new T.Vector3(side*[.50,.57,.57,.50][pair],.238,[-.285,-.095,.095,.285][pair]);
  const lengths=[.48,.55,Math.hypot(.035,.105)],root=new T.Group(),lower=new T.Group(),toe=new T.Group(),tip=new T.Object3D();root.position.copy(hip);parent.add(root);lower.position.x=lengths[0];root.add(lower);toe.position.x=lengths[1];lower.add(toe);tip.position.x=lengths[2];toe.add(tip);
  rod(root,[0,0,0],[lengths[0],0,0],.047,.032,limbMat);oval(root,jointMat,[0,0,0],[.045,.038,.039]);
  rod(lower,[0,0,0],[lengths[1],0,0],.032,.017,limbMat);oval(lower,jointMat,[0,0,0],[.034,.031,.030]);
  rod(toe,[0,0,0],[lengths[2],0,0],.018,.002,tipMat);oval(toe,jointMat,[0,0,0],[.020,.018,.018]);
  // Child pivots remain live; their positions are authored once and never translated.
  const leg={root,lower,toe,tip,hip,lengths,side,pair,rest:new T.Vector3(side*[1.10,1.18,1.18,1.10][pair],.02,hip.z),stance:true,anchor:new T.Vector3(),from:new T.Vector3(),to:new T.Vector3(),progress:0,group:(pair+(side>0?1:0))%2};
  return leg;
}
function solveLeg(leg,foot){
  // A leg is a vertical hinged chain, not a free 3D elbow. Its plan-view
  // projection stays a single line from the fixed hip through all three sections.
  const horizontal=foot.clone().sub(leg.hip);horizontal.y=0;
  if(horizontal.lengthSq()<1e-10)horizontal.set(leg.side,0,0);else horizontal.normalize();
  const ankle=foot.clone().addScaledVector(horizontal,-.035).addScaledVector(UP,.105),delta=ankle.clone().sub(leg.hip),actual=delta.length(),d=clamp(actual,.09,leg.lengths[0]+leg.lengths[1]-.0001),direction=delta.normalize();
  const pole=UP.clone().addScaledVector(direction,-UP.dot(direction)).normalize(),a=(leg.lengths[0]**2-leg.lengths[1]**2+d*d)/(2*d),height=Math.sqrt(Math.max(0,leg.lengths[0]**2-a*a));
  const knee=leg.hip.clone().addScaledVector(direction,a).addScaledVector(pole,height),reachable=leg.hip.clone().addScaledVector(direction,d);
  const angle=v=>Math.atan2(v.y,v.dot(horizontal)),upper=angle(knee.clone().sub(leg.hip)),lower=angle(reachable.clone().sub(knee)),toe=angle(foot.clone().sub(ankle));
  const yaw=Math.atan2(-horizontal.z,horizontal.x),yawQ=new T.Quaternion().setFromAxisAngle(UP,yaw),hinge=new T.Vector3(0,0,1);
  leg.root.quaternion.copy(yawQ).multiply(new T.Quaternion().setFromAxisAngle(hinge,upper));
  leg.lower.rotation.set(0,0,lower-upper);leg.toe.rotation.set(0,0,toe-lower);
  leg.localFoot=foot.clone();leg.reachError=Math.max(0,actual-d);
}
function makeArm(parent,side){const shoulder=new T.Group(),elbow=new T.Group(),wrist=new T.Group(),jaw=new T.Group();shoulder.position.set(side*.43,.255,.25);parent.add(shoulder);elbow.position.z=.25;shoulder.add(elbow);wrist.position.z=.20;elbow.add(wrist);
  rod(shoulder,[0,0,0],[0,0,.25],.068,.055,limbMat);oval(shoulder,jointMat,[0,0,0],[.06,.045,.05]);
  rod(elbow,[0,0,0],[0,0,.20],.056,.074,limbMat);oval(elbow,jointMat,[0,0,0],[.06,.05,.05]);
  oval(wrist,limbMat,[0,0,.115],[.122,.095,.19]);curve(wrist,[[.065,0,.22],[.10,0,.35],[.045,0,.46],[.015,0,.48]],.045,.008,limbMat);curve(wrist,[[.045,0,.46],[.015,0,.48]],.012,.002,tipMat);
  jaw.position.set(-.075,0,.22);wrist.add(jaw);curve(jaw,[[0,0,0],[-.055,0,.12],[.035,0,.24],[.09,0,.255]],.034,.006,limbMat);curve(jaw,[[.035,0,.24],[.09,0,.255]],.010,.002,tipMat);
  // A few blunt inner teeth, placed on the rigid palm finger.
  for(let i=0;i<3;i++)oval(wrist,jointMat,[.055,.0,.30+i*.043],[.016,.018,.012]);
  const fixedTip=new T.Object3D(),movingTip=new T.Object3D();fixedTip.position.set(.015,0,.48);wrist.add(fixedTip);movingTip.position.set(.09,0,.255);jaw.add(movingTip);wrist.scale.setScalar(side>0?.96:.85);return {shoulder,elbow,wrist,jaw,side,fixedTip,movingTip};
}
function createModel(){const g=new T.Group(),body=new T.Group();g.add(body);g.userData.species='tide-crab';g.userData.tendrils=[];
  carapace(body);const rig={legs:[],arms:[],eyes:[],mouth:[],body,feetReady:false};
  for(const side of [-1,1]){for(let pair=0;pair<4;pair++)rig.legs.push(makeLeg(g,side,pair));rig.arms.push(makeArm(g,side));
    const eye=new T.Group();eye.position.set(side*.245,.337,.343);g.add(eye);rod(eye,[0,0,0],[side*.013,.071,.043],.020,.018,limbMat);oval(eye,eyeMat,[side*.013,.077,.048],[.031,.026,.028]);oval(eye,jointMat,[side*.018,.087,.066],[.006,.005,.003]);rig.eyes.push(eye);
    const mouth=new T.Group();mouth.position.set(side*.05,.245,.383);g.add(mouth);oval(mouth,edgeMat,[0,0,0],[.052,.040,.022]);curve(mouth,[[0,.01,.01],[side*.018,.04,.057],[side*.032,.055,.075]],.008,.003,jointMat);rig.mouth.push(mouth);
  }
  merge(body);g.userData.crab=rig;g.userData.legs=rig.legs.map(l=>l.root);for(const leg of rig.legs)solveLeg(leg,leg.rest);animate(g,0);return g;
}
function animate(g,t){const rig=g.userData.crab;if(!rig)return;const moving=clamp((g.userData.walkSpeed||0)/.36,0,1);
  rig.eyes.forEach((eye,i)=>{eye.rotation.y=Math.sin(t*.55+i*1.8)*.22;eye.rotation.x=-.08+Math.sin(t*.38+i*2.3)*.12;});
  rig.arms.forEach((arm,i)=>{const phase=t*.72+i*2.7,pulse=Math.pow(Math.max(0,Math.sin(phase)),5);arm.shoulder.rotation.set(-.15-pulse*.24+moving*.08,arm.side*(.93+.09*Math.sin(t*.4+i)),arm.side*.05);
    arm.elbow.rotation.set(.10+pulse*.20,-arm.side*(.72+.13*Math.sin(t*.48+i*2)),0);arm.wrist.rotation.z=arm.side*(.12+Math.sin(t*.6+i)*.07);arm.jaw.rotation.y=-.045-pulse*.55;
  });
  rig.mouth.forEach((mouth,i)=>{mouth.rotation.y=Math.sin(t*2+i*Math.PI)*.09;});
  // The guide gets the same articulated gait in model space, without moving its camera framing.
  if(!rig.worldControlled){const phase=t*2.4;for(const leg of rig.legs){const a=phase+leg.group*Math.PI,swing=Math.max(0,Math.sin(a)),foot=leg.rest.clone();foot.x+=Math.cos(a)*.09;foot.y+=swing*.10;solveLeg(leg,foot);}}
}
function toWorld(g,local){return local.clone().multiplyScalar(g.scale.x).applyAxisAngle(UP,g.rotation.y).add(g.position);}
function toLocal(g,world){return world.clone().sub(g.position).applyAxisAngle(UP,-g.rotation.y).divideScalar(g.scale.x);}
function makeController(g,ground){const rig=g.userData.crab;rig.worldControlled=true;let group=0,pivot=null,pivotYaw=0;
  const groundPoint=p=>{p.y=ground(p.x,p.z)+.018;return p;};
  function restWorld(leg){return groundPoint(toWorld(g,leg.rest));}
  for(const leg of rig.legs){leg.anchor.copy(restWorld(leg));solveLeg(leg,toLocal(g,leg.anchor));}rig.feetReady=true;
  return {
    update({dt,t,turn,speed,direction}){
      const turning=Math.abs(turn)>.00001&&speed<.03;
      if(turning&&!pivot){const side=turn>0?1:-1;pivot=rig.legs.find(l=>l.side===side&&l.pair===1&&l.stance)||rig.legs.find(l=>l.stance);pivotYaw=g.rotation.y;}
      if(!turning||pivot&&Math.abs(g.rotation.y-pivotYaw)>.30)pivot=null;
      const before=g.position.clone(),oldYaw=g.rotation.y;
      if(turning&&pivot){g.position.sub(pivot.anchor).applyAxisAngle(UP,turn).add(pivot.anchor);g.rotation.y+=turn;}
      const distance=speed*dt;g.position.x+=Math.cos(g.rotation.y)*distance*direction;g.position.z-=Math.sin(g.rotation.y)*distance*direction;g.position.y=ground(g.position.x,g.position.z)+.04;
      rig.pivot=pivot;rig.turning=turning;rig.bodyDisplacement=g.position.clone().sub(before);rig.yawStep=g.rotation.y-oldYaw;
      const active=rig.legs.some(l=>!l.stance);
      let candidate=rig.legs.filter(l=>l.group===group&&l!==pivot);
      if(!candidate.some(l=>restWorld(l).distanceTo(l.anchor)>.10*g.scale.x)){group=1-group;candidate=rig.legs.filter(l=>l.group===group&&l!==pivot);}
      const needsStep=candidate.some(l=>restWorld(l).distanceTo(l.anchor)>.10*g.scale.x);
      if(!active&&needsStep){for(const leg of candidate){leg.stance=false;leg.progress=0;leg.from.copy(leg.anchor);leg.to.copy(restWorld(leg));if(!turning){leg.to.x+=Math.cos(g.rotation.y)*speed*.16*direction;leg.to.z-=Math.sin(g.rotation.y)*speed*.16*direction;groundPoint(leg.to);}}group=1-group;}
      for(const leg of rig.legs){if(!leg.stance){leg.progress=Math.min(1,leg.progress+dt/.24);const a=leg.progress,k=a*a*(3-2*a);leg.anchor.lerpVectors(leg.from,leg.to,k);leg.anchor.y+=Math.sin(a*Math.PI)*.10*g.scale.x;if(a===1){leg.anchor.copy(leg.to);leg.stance=true;}}
        solveLeg(leg,toLocal(g,leg.anchor));
      }
      g.userData.walkSpeed=speed;animate(g,t);
    },
    rig
  };
}
globalThis.AQUARIUM_CRAB=Object.freeze({createModel,animate,makeController});
})();
