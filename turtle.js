/* Green sea turtle, authored in local +X forward / +Y dorsal coordinates.
 * Photo reference: https://wwf.org.au/blogs/9-incredible-facts-about-green-sea-turtles/
 * Geometry and seeded canvas textures are generated locally; no network assets required.
 */
(() => {
'use strict';
const T=globalThis.THREE,clamp=T.MathUtils.clamp,TAU=Math.PI*2;
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.78,flatShading:true,...extra});
const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v);};
// Moderate facet sizes: readable at aquarium scale, with enough segments for a rounded silhouette.
const ball=new T.SphereGeometry(1,12,8);
function blob(parent,material,position,scale){const m=new T.Mesh(ball,material);m.position.fromArray(position);m.scale.fromArray(scale);parent.add(m);return m;}
// Batch rigid details by material while keeping the animated head and paddles separate.
function batchRigid(group){group.updateMatrixWorld(true);const inv=group.matrixWorld.clone().invert(),buckets=new Map();group.traverse(o=>{if(!o.isMesh&&!o.isLine)return;const key=o.material;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);});
  for(const [material,objects] of buckets){if(objects.length<2)continue;const lines=objects[0].isLine,arrays={position:[],normal:[],uv:[]};
    for(const o of objects){const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      if(lines){const p=geo.attributes.position;for(let i=0;i<p.count-1;i++)arrays.position.push(p.getX(i),p.getY(i),p.getZ(i),p.getX(i+1),p.getY(i+1),p.getZ(i+1));}
      else for(const key of Object.keys(arrays)){const a=geo.attributes[key];if(a)arrays[key].push(...a.array);}
      geo.dispose();o.removeFromParent();}
    const geo=new T.BufferGeometry();for(const [key,array] of Object.entries(arrays))if(array.length)geo.setAttribute(key,new T.Float32BufferAttribute(array,key==='uv'?2:3));group.add(lines?new T.LineSegments(geo,material):new T.Mesh(geo,material));
  }
}
// Convex Voronoi clipping preserves the deliberate vertebral / costal layout.
function clip(poly,nx,ny,d){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny-d,db=b[0]*nx+b[1]*ny-d;if(da<=0)out.push(a);if((da<0&&db>0)||(da>0&&db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
function cells(seeds,boundary){return seeds.map((a,i)=>{let poly=boundary;for(let j=0;j<seeds.length&&poly.length;j++){if(i===j)continue;const b=seeds[j];poly=clip(poly,b[0]-a[0],b[1]-a[1],(b[0]*b[0]+b[1]*b[1]-a[0]*a[0]-a[1]*a[1])/2);}return poly;});}
function path(ctx,poly){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();}
function canvasTexture(canvas){const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
let materials;
function getMaterials(){if(materials)return materials;
  const shell=document.createElement('canvas');shell.width=shell.height=1024;const c=shell.getContext('2d'),N=shell.width;
  c.fillStyle='#3b4130';c.fillRect(0,0,N,N);
  const seeds=[];for(let i=0;i<5;i++)seeds.push([-.76+i*.38,0]);
  for(const side of [-1,1])for(let i=0;i<4;i++)seeds.push([-.61+i*.405,side*(.51-.07*Math.abs(-.61+i*.405))]);
  const outline=Array.from({length:96},(_,i)=>{const a=i/96*TAU;return [Math.cos(a)*.86,Math.sin(a)*.86];});
  const shields=cells(seeds,outline).map((poly,i)=>({poly,center:seeds[i],marginal:false}));
  for(let i=0;i<24;i++){const a=i/24*TAU,b=(i+1)/24*TAU,poly=[];for(let j=0;j<=4;j++){const q=a+(b-a)*j/4;poly.push([Math.cos(q),Math.sin(q)]);}for(let j=4;j>=0;j--){const q=a+(b-a)*j/4;poly.push([.86*Math.cos(q),.86*Math.sin(q)]);}shields.push({poly,center:[.93*Math.cos((a+b)/2),.93*Math.sin((a+b)/2)],marginal:true});}
  shields.forEach(({poly,center,marginal},i)=>{
    const pp=poly.map(p=>[(p[0]*.47+.5)*N,(p[1]*.47+.5)*N]),cx=(center[0]*.47+.5)*N,cy=(center[1]*.47+.5)*N,h=hash(i,3);
    c.save();path(c,pp);c.clip();
    // Restrained solid shield colours leave the larger planar faces clearly visible.
    c.fillStyle=h>.65?'#8d8450':h>.3?'#74804e':'#657446';c.fillRect(0,0,N,N);
    c.restore();path(c,pp);c.strokeStyle='#343e2c';c.lineWidth=marginal?3:4;c.lineJoin='round';c.stroke();c.strokeStyle='rgba(190,177,112,.6)';c.lineWidth=1.2;c.stroke();
  });
  function scales(cols,rows){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    ctx.fillStyle='#949b73';ctx.fillRect(0,0,w,h);const seeds=[];for(let y=-1;y<=rows;y++)for(let x=-1;x<=cols;x++)seeds.push([(x+.25+hash(x+29,y+19)*.5)*w/cols,(y+.25+hash(x+41,y+73)*.5)*h/rows]);
    // Only neighbouring seeds can cut these small cells.
    seeds.forEach((a,i)=>{let poly=[[a[0]-w/cols,a[1]-h/rows],[a[0]+w/cols,a[1]-h/rows],[a[0]+w/cols,a[1]+h/rows],[a[0]-w/cols,a[1]+h/rows]];seeds.forEach((b,j)=>{if(i===j||Math.abs(a[0]-b[0])>w/cols*2.1||Math.abs(a[1]-b[1])>h/rows*2.1)return;poly=clip(poly,b[0]-a[0],b[1]-a[1],(b[0]*b[0]+b[1]*b[1]-a[0]*a[0]-a[1]*a[1])/2);});
      const h0=hash(i,18);path(ctx,poly.map(p=>[a[0]+(p[0]-a[0])*.88,a[1]+(p[1]-a[1])*.88]));const grad=ctx.createLinearGradient(a[0],a[1]-20,a[0]+8,a[1]+35);grad.addColorStop(0,h0>.6?'#6f7750':'#596c48');grad.addColorStop(1,h0>.6?'#555d3c':'#3d5039');ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#a49a70';ctx.lineWidth=1.2;ctx.lineJoin='round';ctx.stroke();
    });return canvasTexture(canvas);
  }
  const shellMap=canvasTexture(shell),skinMap=scales(8,6),neckMap=scales(12,8),flipperMap=scales(6,10);
  materials={shell:mat('#ffffff',{map:shellMap,roughness:.8}),rim:mat('#8f9160'),skin:mat('#ffffff',{map:skinMap}),neck:mat('#b4b38d',{map:neckMap}),limb:mat('#ffffff',{map:flipperMap,side:T.DoubleSide}),belly:mat('#c5bd8d'),beak:mat('#a99e70'),eye:mat('#101c17',{roughness:.16,flatShading:false}),iris:mat('#8a8650',{roughness:.48,flatShading:false}),glint:new T.MeshBasicMaterial({color:'#e4ead4'}),seam:new T.LineBasicMaterial({color:'#3e4930'}),nostril:mat('#29392c')};return materials;
}
function shellPoint(r,a){const x=Math.cos(a)*r,z=Math.sin(a)*r;const width=.435*(1-.15*x);return new T.Vector3(x*.59,.018+.245*Math.pow(Math.max(0,1-r*r),.72),z*width);}
function carapace(parent,m){const positions=[],uv=[],indices=[],rings=6,sides=24;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){const r=j/rings,a=i/sides*TAU,p=shellPoint(r,a);positions.push(...p);uv.push(.5+Math.cos(a)*r*.47,.5-Math.sin(a)*r*.47);if(j<rings&&i<sides){const k=j*(sides+1)+i;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.userData={rings,sides};geo.computeVertexNormals();const shell=new T.Mesh(geo,m.shell);shell.name='carapace';parent.add(shell);
  // A closed rolled lip connects the dorsal shell to the broad, low plastron.
  const points=Array.from({length:sides+1},(_,i)=>shellPoint(.995,i/sides*TAU));const lip=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),sides,.012,6,false),m.rim);parent.add(lip);
  // Reuse the dorsal boundary exactly so the underside closes the entire shell.
  // A separate inset ellipsoid leaves visible gaps below the rolled lip.
  const underside=geo.clone(),p=underside.attributes.position;
  for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++)p.setY(j*(sides+1)+i,.018-.134*Math.sqrt(Math.max(0,1-(j/rings)**2)));
  const undersideIndices=underside.index.array;
  for(let i=0;i<undersideIndices.length;i+=3)[undersideIndices[i+1],undersideIndices[i+2]]=[undersideIndices[i+2],undersideIndices[i+1]];
  underside.computeVertexNormals();const plastron=new T.Mesh(underside,m.belly);plastron.name='plastron';parent.add(plastron);
  for(const side of [-1,1]){const points=[];for(let i=0;i<=30;i++){const x=-.44+i/30*.86;points.push(new T.Vector3(x,-.096+Math.pow(x/.55,2)*.025,side*(.13+.018*Math.sin(i/30*Math.PI))));}parent.add(new T.Line(new T.BufferGeometry().setFromPoints(points),m.seam));}
  for(let j=0;j<5;j++){const x=-.37+j*.18,points=[];for(let i=0;i<=16;i++){const z=-.25+i/16*.5;points.push(new T.Vector3(x+Math.abs(z)*.12,-.113+.046*Math.pow(z/.39,2)+.03*Math.pow(x/.55,2),z));}parent.add(new T.Line(new T.BufferGeometry().setFromPoints(points),m.seam));}
}
// Closed, foil-like flippers with a broad shoulder and a tapered, swept tip.
function paddle(parent,side,pair,m){const pivot=new T.Group();pivot.name=(pair?'hind':'fore')+'-flipper-'+side;pivot.position.fromArray(pair?[-.43,-.037,side*.25]:[.29,-.018,side*.30]);parent.add(pivot);
  const rows=8,sides=8,L=pair?.35:.86,positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++){const t=j/rows,z=side*L*t,xc=pair?-.13*t:-.085*t-.23*t*t;
    const half=pair?.123*Math.pow(1-t,.47)+.002:(.108+.055*Math.sin(Math.PI*t))*Math.pow(1-t,.6)+.001;
    const thickness=(pair?.023:.037)*Math.pow(1-t,.85)+.001;
    for(let i=0;i<=sides;i++){const a=i/sides*TAU;positions.push(xc+Math.cos(a)*half,-.015*Math.sin(t*Math.PI)+Math.sin(a)*thickness,z);uv.push(i/sides,t);
      if(j<rows&&i<sides){const k=j*(sides+1)+i;if(side>0)indices.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);else indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}
  }
  // End caps remove the open pipe-like ends of the old paddle.
  for(const j of [0,rows])for(let i=1;i<sides-1;i++){const k=j*(sides+1);const tri=[k,k+i,k+i+1];if((side>0)===(j===0))tri.reverse();indices.push(...tri);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geo.setIndex(indices);geo.userData={rows,sides};geo.computeVertexNormals();
  const cupped=geo.attributes.position.clone();for(let i=0;i<cupped.count;i++){const t=Math.abs(cupped.getZ(i))/L;cupped.setY(i,cupped.getY(i)-.09*t*t);}
  const bent=geo.clone();bent.setAttribute('position',cupped);bent.computeVertexNormals();geo.morphAttributes.position=[cupped];geo.morphAttributes.normal=[bent.attributes.normal.clone()];bent.dispose();const mesh=new T.Mesh(geo,m.limb);mesh.name=pivot.name+'-paddle';pivot.add(mesh);return {pivot,mesh,side,pair};
}
// Skull rings go from the neck into a broad cranium and a blunt, downturned beak.
function skullMesh(parent,m){const shape=new T.CatmullRomCurve3([[0,.059,.064],[.055,.078,.079],[.12,.104,.100],[.19,.099,.096],[.255,.079,.078],[.295,.055,.060],[.313,.033,.042],[.32,.008,.015]].map(p=>new T.Vector3(...p)));
  const rings=10,sides=12,positions=[],uv=[],indices=[];
  const surface=(t,a)=>{const p=shape.getPoint(t),cy=.018+.017*Math.sin(t*Math.PI)-.014*t;return new T.Vector3(p.x,cy+Math.sin(a)*p.y,Math.cos(a)*p.z);};
  for(let j=0;j<=rings;j++)for(let i=0;i<=sides;i++){const p=surface(j/rings,i/sides*TAU);positions.push(...p);uv.push(j/rings,i/sides);if(j<rings&&i<sides){const k=j*(sides+1)+i;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}}
  for(let i=1;i<sides-1;i++){const k=rings*(sides+1);indices.push(k,k+i,k+i+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geo.setIndex(indices);geo.computeVertexNormals();const skull=new T.Mesh(geo,m.skin);skull.name='skull';parent.add(skull);return surface;
}
function createModel(){const m=getMaterials(),g=new T.Group();g.userData.species='sea-turtle';const body=new T.Group();g.add(body);carapace(body,m);
  blob(body,m.neck,[.435,-.002,0],[.18,.078,.093]);blob(body,m.neck,[-.586,-.035,0],[.105,.025,.031]);
  const head=new T.Group();head.name='head';head.position.set(.49,.004,0);g.add(head);const surface=skullMesh(head,m);
  blob(head,m.beak,[.28,-.017,0],[.043,.040,.058]);
  for(const side of [-1,1]){const a=side>0?.20:Math.PI-.20,p=surface(.49,a),normal=new T.Vector3(.20,.20,side).normalize();
    const socket=new T.Group();socket.position.copy(p);socket.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);head.add(socket);
    blob(socket,m.beak,[0,0,0],[.032,.036,.009]);blob(socket,m.iris,[0,0,.006],[.025,.028,.008]);blob(socket,m.eye,[.003,0,.010],[.019,.024,.008]);blob(socket,m.glint,[.009,.009,.016],[.004,.004,.002]);
    const n=surface(.86,side>0?1.02:Math.PI-1.02);blob(head,m.nostril,[n.x,n.y+.001,n.z],[.006,.004,.005]);
    const seam=[];for(let i=0;i<=24;i++){const t=.52+.44*i/24,p=surface(t,side>0?-.33:Math.PI+.33);p.z+=side*.002;p.y-=.001;seam.push(p);}head.add(new T.Line(new T.BufferGeometry().setFromPoints(seam),m.seam));
  }
  batchRigid(body);batchRigid(head);
  const flippers=[];for(const pair of [0,1])for(const side of [-1,1])flippers.push(paddle(g,side,pair,m));
  g.userData.turtle={flippers,head,worldControlled:false};animate(g,0);return g;
}
// Slow paired wing strokes, with flexible tips and a feathered recovery.
function animate(g,t,glide=0){const rig=g.userData.turtle;if(!rig)return;const phase=t*TAU/4.6,stroke=Math.sin(phase),amp=1-clamp(glide,0,1)*.88;
  for(const f of rig.flippers){if(!f.pair){const angle=(.12+stroke*.58)*amp;
      f.pivot.rotation.set(f.side*angle,-f.side*(.14+.10*Math.cos(phase)*amp),-.04);
      f.mesh.morphTargetInfluences[0]=(.5+.5*Math.cos(phase))*amp;
    }else{f.pivot.rotation.set(f.side*(.08+.10*Math.sin(phase*.55+f.side*.4)),-f.side*(.38+.06*Math.sin(phase*.6)),0);}}
  rig.head.rotation.y=Math.sin(t*.37)*.055;rig.head.rotation.z=Math.sin(t*.44)*.025;
}
// A slow mid-water cruiser: waypoint wander, banking turns, stroke/glide rhythm and reef avoidance.
function makeController(g,obstacles=[],ground){
  const rig=g.userData.turtle;rig.worldControlled=true;
  let yaw=g.rotation.y,pitch=0,roll=0,yawRate=0,speed=.4,phase=7*Math.random(),gliding=false,glideBlend=0,until=2.5,nextPick=0,seed=(Math.floor(Math.random()*65521)+11)>>>0;
  const target=new T.Vector3(3,1.4,0);
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  function pick(t){
    for(let attempt=0;attempt<24;attempt++){
      const x=-9.5+rand()*19,z=-5.5+rand()*11,y=-.9+rand()*3.6;
      if(y<ground(x,z)+1.15)continue;
      let blocked=false;
      for(const o of obstacles){if(o.center===g.position)continue;const c=o.center,r=o.radii,padding=o.kind==='jellyfish'?5:1.4;
        const d=r?Math.hypot((x-c.x)/(r.x+padding),(y-c.y)/(r.y+padding),(z-c.z)/(r.z+padding)):Math.hypot(x-c.x,(y-c.y)*.8,z-c.z)/(o.radius+1.4);
        if(d<1){blocked=true;break;}
      }
      if(!blocked){target.set(x,y,z);break;}
    }
    nextPick=t+8+rand()*9;
  }
  return {update({dt,t}){
    if(t>nextPick||g.position.distanceToSquared(target)<1.3)pick(t);
    const dx=target.x-g.position.x,dy=target.y-g.position.y,dz=target.z-g.position.z;
    let sx=dx,sz=dz;
    // Gentle repulsion from the rock garden and the camera lens, tested ahead of the beak.
    const px=g.position.x+Math.cos(yaw)*speed*1.5,pz=g.position.z-Math.sin(yaw)*speed*1.5;
    for(const o of obstacles){if(o.center===g.position)continue;const c=o.center,r=o.radii,padding=o.kind==='jellyfish'?5:1.15;
      const d=r?Math.hypot((px-c.x)/(r.x+padding),(g.position.y-c.y)/(r.y+padding),(pz-c.z)/(r.z+padding)):Math.hypot(px-c.x,(g.position.y-c.y)*.8,pz-c.z)/(o.radius+1.15);
      if(d>=1)continue;
      let ax=px-c.x,az=pz-c.z;const h=Math.hypot(ax,az);
      if(h<.01){ax=Math.cos(yaw+Math.PI/2);az=-Math.sin(yaw+Math.PI/2);}else{ax/=h;az/=h;}
      const w=1-d,force=o.kind==='jellyfish'?24:7;sx+=ax*w*force;sz+=az*w*force;
    }
    yawRate+=(clamp(wrap(Math.atan2(-sz,sx)-yaw)*1.5,-.5,.5)-yawRate)*Math.min(1,dt*2);
    yaw+=yawRate*dt;
    pitch+=(clamp(Math.atan2(dy,Math.max(.9,Math.hypot(dx,dz))),-.42,.42)-pitch)*Math.min(1,dt*1.1);
    if(t>until){gliding=!gliding;until=t+(gliding?1.6+rand()*2.6:2.8+rand()*3.2);}
    glideBlend+=(Number(gliding)-glideBlend)*Math.min(1,dt*1.8);
    const cruise=(.52-.08*glideBlend)*(1-Math.min(.4,Math.abs(yawRate)*.7));
    speed+=(cruise-speed)*Math.min(1,dt*.9);
    const forward=Math.cos(pitch)*speed;
    g.position.x+=Math.cos(yaw)*forward*dt;
    g.position.z-=Math.sin(yaw)*forward*dt;
    g.position.y+=Math.sin(pitch)*speed*dt;
    g.position.y=clamp(g.position.y,ground(g.position.x,g.position.z)+.6,4.4);
    roll+=((-yawRate*.85)-roll)*Math.min(1,dt*2.5);
    g.rotation.set(roll,yaw,pitch,'YZX');
    phase+=dt;
    animate(g,phase,glideBlend);
  }};
}
globalThis.AQUARIUM_TURTLE=Object.freeze({createModel,animate,makeController});
})();
