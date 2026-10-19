/* +X forward, +Y dorsal. References and comparison notes: tests/manta.html.
 * Continuous closed disc: the wing root is part of the body, never a hinged paddle.
 */
(() => {
'use strict';
const T=THREE,TAU=Math.PI*2,clamp=T.MathUtils.clamp;
const stations=[[0,.77,-1.06,.17],[.30,.79,-.94,.16],[.53,.68,-.77,.11],[.85,.47,-.57,.060],[1.25,.17,-.55,.032],[1.65,-.16,-.55,.015],[2,-.43,-.46,.0015]];
function section(z){z=Math.abs(z);let i=0;while(i<stations.length-2&&z>stations[i+1][0])i++;const a=stations[i],b=stations[i+1],f=clamp((z-a[0])/(b[0]-a[0]),0,1);const prev=stations[Math.max(0,i-1)],next=stations[Math.min(stations.length-1,i+2)],h=b[0]-a[0];return a.slice(1).map((v,j)=>{const k=j+1,m0=i===0?0:(b[k]-prev[k])/(b[0]-prev[0]),m1=i===stations.length-2?(b[k]-a[k])/h:(next[k]-a[k])/(next[0]-a[0]);return (2*f**3-3*f*f+1)*v+(f**3-2*f*f+f)*h*m0+(-2*f**3+3*f*f)*b[k]+(f**3-f*f)*h*m1;});}
function point(z,a){const [front,back,h]=section(z),u=(1+Math.cos(a))*.5;return new T.Vector3(back+(front-back)*u,Math.sin(a)*h*(.78+.22*u),z);}
let shared;
function assets(){if(shared)return shared;const p=[],colors=[],idx=[],rows=96,sides=40;
  const charcoal=new T.Color('#293d46'),cream=new T.Color('#e6e7df'),patch=new T.Color('#aebfbe'),edge=new T.Color('#40525a');
  for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){const z=-2+j/rows*4,a=i/sides*TAU,v=point(z,a),u=(1+Math.cos(a))*.5,top=Math.sin(a)>=0;p.push(...v);
    let c=(top?charcoal:cream).clone();const s=Math.abs(z);
    if(top){const shoulder=Math.exp(-Math.pow((s-.43-.17*(u-.6))/.20,2)-Math.pow((u-.72)/.18,2));c.lerp(patch,shoulder*.67);c.multiplyScalar(.96+.04*Math.sin(v.x*37+z*53));}
    else{if(u<.13||s>1.88)c.lerp(edge,.84);if(s<.5&&v.x<.2){let spot=0;for(const [cx,cz,r] of [[.04,.04,.034],[-.12,-.03,.04],[-.26,.09,.045],[-.39,-.12,.047],[-.44,.22,.055],[-.52,.06,.04],[-.62,-.23,.055],[-.71,.19,.04],[-.76,-.09,.045],[-.30,-.29,.04]]){const d=Math.hypot((v.x-cx)/r,(z-cz)/r);spot=Math.max(spot,1-T.MathUtils.smoothstep(d,.4,1.2));}c.lerp(charcoal,spot*.85);}}
    colors.push(c.r,c.g,c.b);if(j<rows&&i<sides){const k=j*(sides+1)+i;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}}
  // Close tiny wing tips; the longitudinal seam is duplicated for smooth normal matching.
  for(const j of [0,rows])for(let i=1;i<sides-1;i++){const k=j*(sides+1),tri=[k,k+i,k+i+1];if(j===0)tri.reverse();idx.push(...tri);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];geo.setIndex(idx);geo.computeVertexNormals();
  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.58,...extra});
  shared={geo,skin:mat('#ffffff',{vertexColors:true}),dark:mat('#293d46'),belly:mat('#dddcd1'),mouth:mat('#080f14',{roughness:.95}),eye:mat('#09151b',{roughness:.2}),iris:mat('#637e80'),gill:mat('#455759')};return shared;
}
const sphere=new T.SphereGeometry(1,20,12);
function blob(g,m,p,s){const mesh=new T.Mesh(sphere,m);mesh.position.fromArray(p);mesh.scale.fromArray(s);g.add(mesh);return mesh;}
function tube(g,points,r,m,name){const mesh=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),32,r,6,false),m);mesh.name=name;g.add(mesh);return mesh;}
function createModel(){const m=assets(),g=new T.Group();g.userData.species='manta-ray';
  const disc=new T.Mesh(m.geo.clone(),m.skin);disc.name='continuous-disc';g.add(disc);
  blob(g,m.dark,[.68,.052,0],[.13,.068,.335]);blob(g,m.belly,[.68,-.085,0],[.13,.042,.315]);
  // Recessed forward-facing mouth with a continuous oval lip, rather than an underside stingray mouth.
  const mouth=new T.Group();mouth.position.set(.785,-.018,0);g.add(mouth);blob(mouth,m.mouth,[0,0,0],[.025,.078,.285]);
  tube(mouth,Array.from({length:49},(_,i)=>{const a=i/48*TAU;return [.014,.080*Math.sin(a),.291*Math.cos(a)];}),.008,m.belly,'mouth-lip');
  for(const side of [-1,1]){
    const lobe=new T.Group();lobe.position.set(.69,-.015,side*.34);g.add(lobe);
    // Broad, rolled sheet with a pale inner face; open edges distinguish it from a solid horn.
    const pp=[],ii=[],cc=[];for(let j=0;j<=24;j++)for(let k=0;k<=10;k++){const t=j/24,w=k/10,angle=-1.1+w*3.7+t*.65,rad=(.073+.046*Math.sin(t*Math.PI))*(1-.30*t);pp.push(.40*t, -.025-.10*t+rad*Math.sin(angle),side*(.035*t+rad*Math.cos(angle)));const c=new T.Color(w>.58?'#b7c8c7':'#2d424c');cc.push(c.r,c.g,c.b);if(j<24&&k<10){const a=j*11+k;ii.push(a,a+1,a+11,a+1,a+12,a+11);}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pp,3));geo.setAttribute('color',new T.Float32BufferAttribute(cc,3));geo.setIndex(ii);geo.computeVertexNormals();const lm=m.skin.clone();lm.side=T.DoubleSide;lobe.add(new T.Mesh(geo,lm));lobe.name='cephalic-fin-'+side;
    blob(g,m.dark,[.62,.018,side*.452],[.078,.070,.057]);blob(g,m.iris,[.641,.028,side*.494],[.037,.036,.016]);blob(g,m.eye,[.649,.030,side*.503],[.023,.026,.010]);
    tube(g,[[.53,.075,side*.44],[.49,.077,side*.46],[.45,.067,side*.47]],.010,m.gill,'spiracle-'+side);
    for(let j=0;j<5;j++){const x=.40-j*.155,pts=[];for(let i=0;i<=16;i++){const z=side*(.15+i/16*(.26-j*.018)),[front,back,h]=section(z),u=(x-back)/(front-back),y=-h*Math.sqrt(Math.max(0,1-(u*2-1)**2))*(.78+.22*u)-.004;pts.push([x-.045*Math.sin(i/16*Math.PI),y,z]);}tube(g,pts,.009,m.gill,'gill-'+side+'-'+j);}
    const pelvic=blob(g,m.dark,[-.94,-.015,side*.20],[.22,.025,.13]);pelvic.rotation.y=side*-.35;
  }
  const finGeo=new T.BufferGeometry();finGeo.setAttribute('position',new T.Float32BufferAttribute([-.73,.10,0,-1.07,.04,0,-.94,.34,0],3));finGeo.computeVertexNormals();const finMat=m.dark.clone();finMat.side=T.DoubleSide;g.add(new T.Mesh(finGeo,finMat));
  const tail=tube(g,Array.from({length:25},(_,i)=>[-.96-i/24*1.75,.015-i/24*.055,.025*Math.sin(i/24*Math.PI)]),.018,m.dark,'whip-tail');const tp=tail.geometry.attributes.position;for(let i=0;i<tp.count;i++){const f=clamp((-tp.getX(i)-.96)/1.75,0,1);tp.setY(i,(tp.getY(i)+.04*f)*(1-.82*f)-.04*f);tp.setZ(i,tp.getZ(i)*(1-.82*f));}tail.geometry.computeVertexNormals();
  g.userData.manta={disc,base:disc.geometry.attributes.position.array.slice(),tail,tailBase:tp.array.slice(),mouth,lobes:g.children.filter(o=>o.name.startsWith('cephalic-fin')),worldControlled:false,phase:0,glide:0};animate(g,0);return g;
}
function animate(g,t,glide=0,clearance=10,feeding=0){const r=g.userData.manta;if(!r)return;const p=r.disc.geometry.attributes.position,base=r.base,phase=t*TAU/3.8,amp=1-.83*glide;
  for(let i=0;i<p.count;i++){const x=base[i*3],y=base[i*3+1],z=base[i*3+2],span=clamp((Math.abs(z)-.30)/1.7,0,1),wave=Math.sin(phase-span*.85+(x+.3)*.45);let lift=wave*.62*amp;if(lift>0)lift*=clamp((clearance-.35)/.9,.12,1);p.setXYZ(i,x,y+span**1.65*(lift+.07*span),z);}
  p.needsUpdate=true;r.disc.geometry.computeVertexNormals();
  const tp=r.tail.geometry.attributes.position;for(let i=0;i<tp.count;i++){const x=r.tailBase[i*3],f=clamp((-x-.96)/1.75,0,1);tp.setZ(i,r.tailBase[i*3+2]+.075*f*f*Math.sin(phase*.65-f*1.7));}tp.needsUpdate=true;r.tail.geometry.computeVertexNormals();
  r.mouth.scale.y=1+feeding*.52;for(const l of r.lobes){const side=Math.sign(l.position.z);l.rotation.y=-side*feeding*.32;l.rotation.x=side*.07*Math.sin(phase*.4);}
  r.phase=t;r.glide=glide;r.feeding=feeding;
}
function makeController(g,obstacles=[]){const r=g.userData.manta;r.worldControlled=true;let yaw=g.rotation.y,pitch=0,bank=0,rate=0,speed=.55,clock=0;
  // A drifting broad circuit keeps turns continuous, without waypoint U-turns or stops.
  return {update({dt}){let remaining=Math.min(dt,.5);while(remaining>1e-7){const h=Math.min(remaining,1/60);remaining-=h;clock+=h;
    const a=clock*.056,target=new T.Vector3(8.8*Math.cos(a),8.15+.45*Math.sin(a*1.7),3.9*Math.sin(a));
    let sx=target.x-g.position.x,sz=target.z-g.position.z,dy=target.y-g.position.y;
    const fx=g.position.x+Math.cos(yaw)*speed*4,fz=g.position.z-Math.sin(yaw)*speed*4;
    sx-=Math.sign(fx)*Math.max(0,Math.abs(fx)-9)*12;sz-=Math.sign(fz)*Math.max(0,Math.abs(fz)-4.2)*12;
    const ahead=new T.Vector3(g.position.x+Math.cos(yaw)*2.5,g.position.y,g.position.z-Math.sin(yaw)*2.5);
    for(const o of obstacles){if(o.owner===g||o.center===g.position)continue;const c=o.center,rr=o.radii||new T.Vector3(o.radius,o.radius,o.radius),pad=o.kind==='jellyfish'?2.5:1.6;const yy=Math.abs(ahead.y-c.y);if(yy>rr.y+.65)continue;const dx=ahead.x-c.x,dz=ahead.z-c.z,d=Math.hypot(dx/(rr.x+pad),dz/(rr.z+pad));if(d<1.5){const w=(1.5-d)*9;sx+=dx/Math.max(.1,Math.hypot(dx,dz))*w;sz+=dz/Math.max(.1,Math.hypot(dx,dz))*w;}}
    const error=Math.atan2(Math.sin(Math.atan2(-sz,sx)-yaw),Math.cos(Math.atan2(-sz,sx)-yaw));rate+=clamp(clamp(error*.8,-.27,.27)-rate,-.16*h,.16*h);yaw+=rate*h;
    const desiredPitch=clamp(Math.atan2(dy,Math.max(2,Math.hypot(sx,sz))),-.20,.20);pitch+=(desiredPitch-pitch)*(1-Math.exp(-h*1.4));
    const glide=.5+.5*Math.sin(clock*.24),cruise=(.66-.10*glide)*(1-.25*Math.abs(rate));speed+=(cruise-speed)*(1-Math.exp(-h*.8));
    g.position.x+=Math.cos(yaw)*Math.cos(pitch)*speed*h;g.position.z-=Math.sin(yaw)*Math.cos(pitch)*speed*h;g.position.y+=Math.sin(pitch)*speed*h;
    bank+=(-rate*.9-bank)*(1-Math.exp(-h*1.7));g.rotation.set(bank,yaw,pitch,'YZX');
  }
  const glide=clamp((Math.sin(clock*.24)-.25)/.65,0,1),feeding=.5+.5*Math.sin(clock*.15);animate(g,clock,glide,(10-g.position.y)/g.scale.x-.4,feeding);}};
}
globalThis.AQUARIUM_MANTA=Object.freeze({createModel,animate,makeController});
})();
