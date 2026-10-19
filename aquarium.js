/* Stillwater — buildless, offline, procedural Three.js aquarium. */
(() => {
'use strict';
const $ = s => document.querySelector(s), T = window.THREE;
if (!T) { $('#loading').classList.add('failed'); $('#loading').setAttribute('aria-label','Three.js 加载失败'); return; }
let renderer;
try { renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'}); }
catch(e) { $('#loading').classList.add('failed'); $('#loading').setAttribute('aria-label','无法启用 WebGL'); return; }
const mobile = innerWidth < 800, maxDpr = mobile ? 1.5 : 1.8;
renderer.setPixelRatio(Math.min(devicePixelRatio,maxDpr)); renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=T.SRGBColorSpace; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.2;
$('#aquarium').appendChild(renderer.domElement);
const scene=new T.Scene(); scene.background=new T.Color('#073542'); scene.fog=new T.FogExp2('#073542',.024);
const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,220); camera.position.set(0,2.5,26);
const ambient=new T.HemisphereLight(0xb8f2e5,0x344e4b,2.3);scene.add(ambient);
const sun=new T.DirectionalLight(0xffefd1,3.4); sun.position.set(-6,14,8);scene.add(sun);
const rim=new T.DirectionalLight(0x4dd8e5,2.3);rim.position.set(6,4,-8);scene.add(rim);
let seed=11042;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},range=(a,b)=>a+(b-a)*random();
const clock=new T.Clock(), time={value:0}, fish=[],bubbles=[],foods=[];
let elapsed=0,paused=false,flow=.8,visibleCount=32,theme='classic',quality='auto',pixelScale=Math.min(devicePixelRatio,maxDpr);
const v1=new T.Vector3();
const state={yaw:0,pitch:0,zoom:26};
// The seabed is a single displaced mesh. Its caustics and grain are analytical shaders.
const sandGeo=new T.PlaneGeometry(400,400,200,200);sandGeo.rotateX(-Math.PI/2);
const sp=sandGeo.attributes.position;for(let i=0;i<sp.count;i++){let x=sp.getX(i),z=sp.getZ(i);sp.setY(i,AquariumMotion.floorHeight(x,z));}sandGeo.computeVertexNormals();
const sandMat=new T.MeshStandardMaterial({color:'#b3b49a',roughness:.94});
sandMat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='varying vec3 vWorld;\n'+s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='uniform float uTime; varying vec3 vWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=vWorld.xz; float grain=fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
float a=sin(p.x*1.7+sin(p.y*1.9+uTime*.24)*1.5+uTime*.2);
float b=sin(p.y*2.1+sin(p.x*1.3-uTime*.2)*1.4);
float caustic=pow(1.-abs((a+b)*.5),18.);
float ripples=sin(p.x*.8+p.y*7.+sin(p.x*.5)*2.);
diffuseColor.rgb*=.87+grain*.13+ripples*.035;diffuseColor.rgb+=vec3(.18,.28,.20)*caustic;`);};
const sandMesh=new T.Mesh(sandGeo,sandMat);scene.add(sandMesh);
// Large sloping rock gardens frame a deliberately open swimming space.
const rockMats=['#365b58','#54736a','#6d8070','#314e4e'].map(c=>new T.MeshStandardMaterial({color:c,roughness:.98,flatShading:true}));
const {geometry:rockGeo,meshes:rockInstances,obstacles:rockObstacles}=AQUARIUM_REEF.makeRockGarden(rockMats,random);
// Batch all stones by material: four draw calls for the entire rock garden.
for(const mat of rockMats){const stones=rockInstances.filter(m=>m.material===mat);const batch=new T.InstancedMesh(rockGeo,mat,stones.length);stones.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);});batch.instanceMatrix.needsUpdate=true;scene.add(batch);}
// Each meadow is merged into one geometry; the GPU bends every blade in the current.
const grazingSites=[];
function meadow(color,count,xmin,xmax,zmin,zmax,height,broad=false){const pos=[],norm=[],uv=[],idx=[];let n=0;
for(let k=0;k<count;k++){let x=range(xmin,xmax),z=range(zmin,zmax),h=range(height*.45,height),w=range(.1,broad?.6:.25),ang=range(0,Math.PI*2),bend=range(-.5,.5);
for(let j=0;j<=12;j++){let t=j/12,xx=x+Math.sin(t*2.3)*bend,yy=-4.6+t*h,zz=z+.25*Math.sin(t*2);let width=w*Math.pow(Math.sin(Math.PI*t),.7)+.006;
if(j===8&&k%3===0)grazingSites.push({kind:'grass',point:new T.Vector3(xx,yy,zz),height:t});
for(let s of [-1,1]){pos.push(xx+s*width*Math.cos(ang),yy,zz+s*width*Math.sin(ang));norm.push(Math.sin(ang),.15,Math.cos(ang));uv.push((s+1)/2,t);}
if(j<12){let a=n+j*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}n+=26;}
let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);
let mat=new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.7,metalness:.08});mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime; varying vec2 vPlantUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vPlantUv=uv;float h=uv.y; transformed.x+=sin(uTime*.65+position.z*.6+position.x*.35+h*2.)*h*h*.48;transformed.z+=cos(uTime*.42+position.x*.3+h*2.)*h*h*.24;`);s.fragmentShader='varying vec2 vPlantUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=.64+vPlantUv.y*.5;diffuseColor.rgb+=pow(1.-abs(vPlantUv.x-.5)*2.,20.)*.09;`);};let m=new T.Mesh(geo,mat);scene.add(m);}
meadow('#438e72',65,-17,-13,-7,0,6,true);meadow('#267b66',90,8,17,-8,-1,8,true);meadow('#6b9d67',65,9,16,0,3,4.2);meadow('#397e63',35,-16,-13,0,4,2.7);meadow('#346d63',85,-18,18,-13,-9,5);meadow('#8aaf76',45,3.5,7.5,-4,0,2.1,true);
// Rosette leaves on the foreground stones.
for(let c=0;c<11;c++){let x=c<5?range(-13,-9):range(8,13),z=range(-1,3);meadow(c%2?'#7da67d':'#41816c',9,x-.2,x+.2,z-.2,z+.2,range(1,2.4),true);}
// Feather-leaf stems add a second silhouette and a warm accent to the gardens.
function fernGarden(){const positions=[],indices=[],colors=[];let offset=0;
for(let k=0;k<24;k++){const side=k<12?-1:1,x=side*(side<0?range(13.4,15.4):range(8.1,11.6)),z=range(.2,3.2),height=range(1.7,3.6),lean=range(-.6,.6);const color=new T.Color(k%3===0?'#9d9561':'#6eab80');
for(let row=0;row<12;row++){let t=row/12,y=-4.55+t*height,cx=x+lean*t*t,span=(.22+Math.sin(t*Math.PI)*.38)*(1.-t*.4);
for(let side of [-1,1]){const points=[[cx,y,z],[cx+span*side*.45,y+.13,z+.11],[cx+span*side,y+.25,z],[cx+span*side*.53,y+.015,z-.08]];for(const p of points){positions.push(...p);colors.push(color.r,color.g,color.b);}indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);offset+=4;}}}
let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();let mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.72});mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float h=max(0.,position.y+4.55);transformed.x+=sin(uTime*.6+position.x*.4+position.z)*h*h*.025;`);};scene.add(new T.Mesh(geo,mat));}fernGarden();
// One immutable record per fish species drives the tank, thumbnails and live field guide.
const speciesCatalog=window.AQUARIUM_SPECIES,reef=window.AQUARIUM_REEF;
const environment=reef.decorate(scene);
environment.obstacles.push(...rockObstacles);
// Small natural morsels on the open sand remain available without a feeding click.
const morselGeo=new T.SphereGeometry(1,5,4),morselMat=new T.MeshStandardMaterial({color:'#827852',roughness:1});
const sandSites=[];let detritusSeed=32147;const detritusRandom=()=>{detritusSeed=(detritusSeed*1664525+1013904223)>>>0;return detritusSeed/4294967296;};
for(let i=0;i<70;i++){const x=-8+detritusRandom()*16,z=-3+detritusRandom()*12;sandSites.push({kind:'sand',point:new T.Vector3(x,AquariumMotion.floorHeight(x,z)+.07,z)});}
const morsels=new T.InstancedMesh(morselGeo,morselMat,sandSites.length),morselTransform=new T.Object3D();
sandSites.forEach((site,i)=>{const size=.025+(i%4)*.007;morselTransform.position.copy(site.point);morselTransform.scale.set(size,size*.55,size*1.3);morselTransform.updateMatrix();morsels.setMatrixAt(i,morselTransform.matrix);});scene.add(morsels);
environment.grazingSites=[...grazingSites,...sandSites];
const reefLife=reef.populate(scene,environment.obstacles),guideCatalog=[...speciesCatalog,...reef.species.filter(s=>s.id!=='cleaner-shrimp')];
function profile(species){return {height:species.height,depth:species.depth};}
// Reef-shark proportions: https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/blacktip-reef-shark/
// Joined cubic sections separate the slender shoulders, flat rostrum and narrow caudal peduncle.
const sharkProfile=new T.CurvePath();
for(const controls of [
  [[-1.32,0,0],[-1.16,.11,.10],[-.65,.65,.55],[-.16,.97,.88]],
  [[-.16,.97,.88],[.08,1.12,1.04],[.32,.89,.94],[.56,.72,.90]],
  [[.56,.72,.90],[.78,.54,1.02],[1.04,.15,.83],[1.04,0,0]]
])sharkProfile.add(new T.CubicBezierCurve3(...controls.map(p=>new T.Vector3(...p))));
const sharkCenter=x=>.035*T.MathUtils.smoothstep(x,.45,1.04);
const bodyResolution=species=>species.predator?{rings:40,sides:20}:species.heritage?{rings:16,sides:12}:{rings:20,sides:14};
function bodyRing(species,u){const rounded=species.heritage,x=rounded?-Math.cos(u*Math.PI):u*2-1;
  if(species.predator){const p=sharkProfile.getPoint(u);return {x:p.x,r:p.y,w:p.z};}
  if(species.locomotion==='burst-rest')return {x,r:.008+Math.pow(Math.max(0,Math.sin(u*Math.PI)),.85)*(.32+.68*T.MathUtils.smoothstep(x,-.95,-.05))};
  const taper=.57+.43*T.MathUtils.smoothstep(x,-.92,.15);
  return {x,r:rounded?Math.max(.012,Math.sin(u*Math.PI)):Math.pow(Math.max(0,Math.sin(u*Math.PI)),.63)*taper+.018};
}
function bodyRim(species,x,bottom=false){
  const {rings,sides}=bodyResolution(species),polygonTop=species.predator?Math.cos(Math.PI/sides):sides%4===0?1:Math.cos(Math.PI/sides);
  let previous=bodyRing(species,0),radius=previous.r;
  for(let i=1;i<=rings;i++){const next=bodyRing(species,i/rings);if(x<=next.x){const t=T.MathUtils.clamp((x-previous.x)/(next.x-previous.x),0,1);radius=T.MathUtils.lerp(previous.r,next.r,t);break;}previous=next;radius=next.r;}
  if(species.predator)return radius*species.height*(polygonTop+(bottom?-1:1)*.1*polygonTop*polygonTop)+(bottom?-1:1)*sharkCenter(x);
  return radius*species.height*polygonTop*(bottom&&!species.heritage?.93:1);
}
function skin(species){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;
  const ctx=canvas.getContext('2d'),[back,flank,belly]=species.palette.map(c=>new T.Color(c));
  for(let y=0;y<384;y++){if(species.predator){const side=Math.sin(y/384*Math.PI*2),white=T.MathUtils.smoothstep(side,-.05,.42),c=back.clone().lerp(flank,.35+.30*(1-Math.abs(side)));c.lerp(belly,white);ctx.fillStyle='#'+c.getHexString();ctx.fillRect(0,y,768,1);continue;}const dorsal=(Math.sin(y/384*Math.PI*2)*(species.predator?-1:1)+1)*.5,c=dorsal>.5?flank.clone().lerp(back,(dorsal-.5)*1.5):flank.clone().lerp(belly,(.5-dorsal)*1.6);ctx.fillStyle='#'+c.getHexString();ctx.fillRect(0,y,768,1);}
  if(!species.predator)for(let row=0;row<30;row++)for(let col=0;col<48;col++){const x=col*17+(row%2)*8.5,y=row*13;ctx.strokeStyle='rgba(15,58,61,.17)';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,7.8,-.35,Math.PI+.35);ctx.stroke();ctx.strokeStyle='rgba(255,244,203,.24)';ctx.beginPath();ctx.arc(x,y+1.5,6.8,.1,Math.PI-.1);ctx.stroke();}
  if(species.pattern==='celadon'||species.pattern==='moon'||species.pattern==='tidal'){
    const moon=species.pattern==='moon',tidal=species.pattern==='tidal';
    for(let i=0;i<(moon?4:3);i++){const x=(moon?120:145)+i*(moon?166:211);ctx.fillStyle=moon?'rgba(26,44,43,.7)':tidal?'rgba(8,67,95,.56)':'rgba(25,88,104,.42)';ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x-28,120,x+(tidal?128:35),260,x+(tidal?100:-10),384);ctx.lineTo(x+(tidal?130:23),384);ctx.bezierCurveTo(x+(tidal?150:65),240,x+8,120,x+30,0);ctx.fill();}
  }
  if(species.pattern==='amber'){ctx.fillStyle='rgba(225,113,30,.24)';ctx.beginPath();ctx.ellipse(560,80,115,55,-.25,0,Math.PI*2);ctx.fill();}
  if(species.pattern==='coral'){for(const [x,y,r] of [[420,35,110],[580,145,65],[350,235,85]]){ctx.fillStyle='rgba(255,222,168,.24)';ctx.beginPath();ctx.ellipse(x,y,r,39,-.3,0,Math.PI*2);ctx.fill();}}
  if(species.pattern==='neon'){for(const y of [0,192]){ctx.fillStyle='#98ebe2';ctx.fillRect(30,y,680,9);}for(const y of [210,368]){ctx.fillStyle='#ce593c';ctx.fillRect(130,y,570,14);}}
  if(species.pattern==='silver-dart'){
    for(const y of [32,160,224,352]){const line=ctx.createLinearGradient(55,0,716,0);line.addColorStop(0,'rgba(43,136,183,.1)');line.addColorStop(.3,'#e5dfc4');line.addColorStop(1,'#f1eddf');ctx.fillStyle=line;ctx.beginPath();ctx.moveTo(30,y+4);ctx.lineTo(708,y-3);ctx.lineTo(708,y+3);ctx.lineTo(30,y+7);ctx.fill();}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
}
// A shared spine carries every surface, including attached details. The head stays
// fixed so the visible mouth continues to match the feeding/collision coordinates.
const spineShader=`
uniform float uBeat;
uniform float uEffort;
uniform float uBodyWave;
uniform float uTailFold;
uniform vec2 uBend;
float fishSinc(float a){if(abs(a)<.05){float a2=a*a;return 1.-a2/6.+a2*a2/120.;}return sin(a)/a;}
vec3 fishCenter(float x){
  float d=max(0.,.45-x),k=length(uBend),angle=d*k;
  float along=d*fishSinc(angle),halfSinc=fishSinc(angle*.5);
  float across=.5*d*d*halfSinc*halfSinc;
  vec3 center=vec3(x+d-along,uBend.x*across,uBend.y*across);
  float rear=max(0.,.25-x);
  center.z+=sin(uBeat+x*2.5)*rear*rear*uBodyWave*uEffort;
  return center;
}
vec4 fishRotation(float x){
  vec3 tangent=normalize(fishCenter(x+.002)-fishCenter(x-.002));
  return normalize(vec4(0.,-tangent.z,tangent.y,1.+tangent.x));
}
vec3 fishRotate(vec3 v,vec4 q){return v+2.*cross(q.xyz,cross(q.xyz,v)+q.w*v);}
vec3 fishDeform(vec3 p){return fishCenter(p.x)+fishRotate(vec3(0.,p.yz),fishRotation(p.x));}
`;
function attachSpine(shader,swim){
  shader.uniforms.uBeat=swim.phase;shader.uniforms.uEffort=swim.effort;
  shader.uniforms.uBend=swim.bend;shader.uniforms.uBodyWave=swim.wave;shader.uniforms.uTailFold=swim.tailFold;
  shader.vertexShader=spineShader+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=fishRotate(objectNormal,fishRotation(position.x));');
  // Run after the material's local fin flutter, before projection/world transforms.
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','transformed=fishDeform(transformed);\n#include <project_vertex>');
}
const bodyMats=speciesCatalog.map(species=>{
  const mat=new T.MeshStandardMaterial({map:skin(species),roughness:species.predator?.48:species.locomotion==='burst-rest'?.28:.35,metalness:species.predator?.18:species.locomotion==='burst-rest'?.22:.05,flatShading:true,transparent:false,opacity:1,depthWrite:true,emissive:species.finColor,emissiveIntensity:species.predator?.01:species.heritage?.10:.06});
  mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.uniforms.uAura={value:new T.Color(species.finColor)};s.fragmentShader='uniform vec3 uAura;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float aura=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.2);totalEmissiveRadiance+=uAura*aura*.18;
`);};return mat;
});
function bodyGeometry(species){const {height,depth}=profile(species),positions=[],uvs=[],indices=[],{rings,sides}=bodyResolution(species);
  for(let i=0;i<=rings;i++){const {x,r,w=r}=bodyRing(species,i/rings);
    for(let j=0;j<=sides;j++){const theta=(j/sides+(species.predator?.5/sides:0))*Math.PI*2,v=theta/(Math.PI*2),belly=!species.heritage&&!species.predator&&Math.sin(theta)<0?.93:1;
      const sy=Math.sin(theta),y=species.predator?sharkCenter(x)+height*r*(sy+.10*sy*sy):height*r*sy*belly;
      positions.push(x,y,depth*w*Math.cos(theta));uvs.push((x+1)*.5,v);
      if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}
const bodyGeometries=speciesCatalog.map(bodyGeometry);
const sharkEyeMat=new T.MeshStandardMaterial({color:'#879084',roughness:.43});
const eyeMat=new T.MeshStandardMaterial({color:'#d0bd83',roughness:.3,metalness:.18}),pupilMat=new T.MeshStandardMaterial({color:'#2b4d56',roughness:.35}),shineMat=new T.MeshBasicMaterial({color:'#dff6ee'});
const gillMaterials=speciesCatalog.map(s=>new T.LineBasicMaterial({color:new T.Color(s.palette[0]).multiplyScalar(.8),transparent:true,opacity:.65}));
const finMats=speciesCatalog.map(species=>{
  const mat=new T.MeshStandardMaterial({color:species.finColor,vertexColors:true,transparent:!species.predator,opacity:species.predator?1:species.heritage?.95:.92,side:T.DoubleSide,depthWrite:!!species.predator,roughness:.38,metalness:.04,emissive:species.finColor,emissiveIntensity:.17});mat.forceSinglePass=true;
  mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.uniforms.uBeat={value:0};s.uniforms.uEffort={value:.6};s.uniforms.uClassic={value:species.heritage?1:0};s.uniforms.uShark={value:species.predator?1:0};s.vertexShader='uniform float uTime; uniform float uClassic; uniform float uShark; attribute float aFin; varying vec2 vFinUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float phase=uBeat;
vFinUv=uv;
float freeEdge=uv.y*uv.y;
float flutter=sin(phase-position.x*3.-uv.y*2.4);
if(aFin<.5){float tailRoot=mix(mix(-.96,-.82,uClassic),-1.29,uShark);transformed.z+=flutter*pow(max(0.,-position.x+tailRoot),1.2)*.24*uEffort;transformed.y*=1.-uTailFold*.3*smoothstep(1.02,1.65,-position.x);}
else if(aFin<2.5){transformed.z+=flutter*freeEdge*mix(.09,.025,uShark)*uEffort;}
else {float side=aFin<3.5?1.:-1.;transformed.z+=side*freeEdge*sin(phase*.65-uv.y*2.)*mix(.13,.035,uShark)*uEffort;transformed.y+=freeEdge*cos(phase*.65)*mix(.065,.018,uShark)*uEffort;}
`);s.fragmentShader='uniform float uClassic; uniform float uShark; varying vec2 vFinUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float ribs=pow(.5+.5*cos(vFinUv.x*18.*6.2831853),14.);float edge=1.-smoothstep(.7,1.,vFinUv.y);
diffuseColor.rgb*=mix(.86+ribs*.26,.97+ribs*.03,uShark);diffuseColor.a*=mix(mix(.80,.84,uClassic),1.,edge)*(.94+ribs*.06);
`);};return mat;
});
function finGeometry(species){const {height:h,depth}=profile(species),positions=[],uvs=[],types=[],colors=[],indices=[];
  function patch(root,edge,type,rays=20,rows=7){const start=positions.length/3;
    for(let i=0;i<=rays;i++){const t=i/rays,a=root(t),b=edge(t);
      for(let j=0;j<=rows;j++){const v=j/rows,arch=Math.sin(v*Math.PI)*Math.sin(t*Math.PI)*.04;
        positions.push(T.MathUtils.lerp(a[0],b[0],v),T.MathUtils.lerp(a[1],b[1],v),T.MathUtils.lerp(a[2],b[2],v)+arch);uvs.push(t,v);types.push(type);const shade=.83+.17*Math.sin(t*Math.PI);colors.push(shade,shade,shade);
        if(i<rays&&j<rows){const k=start+i*(rows+1)+j,n=k+rows+1;indices.push(k,k+1,n,k+1,n+1,n);}
      }
    }
  }
  // The entire attachment edge follows the actual low-poly body's cross-section.
  // The root sits 0.018 units inside the torso; the shader has zero independent motion there.
  function attachedFin(outline,type){const curve=new T.CatmullRomCurve3(outline.map(([x,lift])=>new T.Vector3(x,lift,0)),false,'catmullrom',.12),sign=type===1?1:-1;
    const root=t=>{const p=curve.getPoint(t);return [p.x,sign*Math.max(.005,bodyRim(species,p.x,type===2)-.018),0];};
    patch(root,t=>{const p=curve.getPoint(t),a=root(t);return [p.x,a[1]+sign*Math.max(0,p.y),0];},type,28,8);
  }
  attachedFin(species.dorsal,1);attachedFin(species.anal,2);
  if(species.predator){
    // Compact caudal fin, with a curved upper leading edge and a distinct fork notch.
    const curve=new T.CatmullRomCurve3([[-1.28,.025,0],[-1.48,.16,0],[-1.91,.51,0],[-1.98,.55,0],[-1.90,.37,0],[-1.81,.33,0],[-1.85,.31,0],[-1.63,.06,0],[-1.57,-.025,0],[-1.85,-.30,0],[-1.65,-.25,0],[-1.38,-.055,0],[-1.28,-.025,0]].map(p=>new T.Vector3(...p)),false,'catmullrom',.08);
    patch(()=>[-1.29,0,0],t=>curve.getPoint(t).toArray(),0,32,7);
    attachedFin([[-.76,0],[-.87,.12],[-.98,.05],[-1.08,0]],1);
  }else if(species.tail==='racing-sickle'){
    const curve=new T.CatmullRomCurve3([[-.98,.04,0],[-1.36,.19,0],[-1.91,.53,0],[-1.76,.28,0],[-1.38,0,0],[-1.76,-.28,0],[-1.91,-.53,0],[-.98,-.04,0]].map(p=>new T.Vector3(...p)),false,'catmullrom',.05);
    patch(()=>[-.98,0,0],t=>curve.getPoint(t).toArray(),0,32,6);
    attachedFin([[-.76,0],[-.82,.065],[-.94,0]],1);
  }else if(species.tail==='classic-fork'||species.tail==='moon-fan'){
    const points=species.tail==='moon-fan'?[[-1.12,.13,0],[-1.69,.53,0],[-1.61,.23,0],[-1.5,0,0],[-1.61,-.23,0],[-1.69,-.53,0],[-1.12,-.13,0]]:[[-1.12,.15,0],[-1.8,.65,.025],[-1.66,.28,.01],[-1.55,0,0],[-1.66,-.28,.01],[-1.8,-.65,.025],[-1.12,-.15,0]];
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'catmullrom',.12);patch(()=>[-.82,0,0],t=>curve.getPoint(t).toArray(),0,28,7);
  }else if(species.tail==='round-fan'){
    patch(t=>[-.96,.1*Math.cos(t*Math.PI),0],t=>{const a=(t*2-1)*1.12;return [-1.06-.94*Math.cos(a),.72*Math.sin(a),.025*Math.sin(t*Math.PI*2)];},0,24,7);
  }else{
    patch(t=>[-.96,.1*Math.cos(t*Math.PI),0],t=>{const q=t*2-1;return [-1.4-(species.tail==='swallow'?.64:.4)*Math.pow(Math.abs(q),.72),q*(species.tail==='swallow'?.62:.38),.02*Math.sin(t*Math.PI*2)];},0,24,7);
  }
  for(const side of [-1,1]){
    if(species.predator){
      const probe=new T.Mesh(bodyGeometries[speciesCatalog.indexOf(species)],bodyMats[speciesCatalog.indexOf(species)]);probe.updateMatrixWorld(true);const ray=new T.Raycaster();
      const root=t=>{const x=.25-.41*t,y=-.065;ray.set(new T.Vector3(x,y,side*2),new T.Vector3(0,0,-side));const hit=ray.intersectObject(probe,false)[0];return [x,y,hit?hit.point.z-side*.012:side*depth*.75];};
      const edge=new T.CatmullRomCurve3([[.25,-.065,side*.18],[.02,-.09,side*.39],[-.43,-.14,side*.66],[-.53,-.145,side*.69],[-.38,-.10,side*.41],[-.16,-.065,side*.18]].map(p=>new T.Vector3(...p)),false,'catmullrom',.05);
      patch(root,t=>edge.getPoint(t).toArray(),side>0?3:4,20,6);
    }else if(species.locomotion==='burst-rest'){
      const probe=new T.Mesh(bodyGeometries[speciesCatalog.indexOf(species)],bodyMats[speciesCatalog.indexOf(species)]),ray=new T.Raycaster();probe.updateMatrixWorld(true);
      const root=t=>{const x=.33-.24*t,y=-.045;ray.set(new T.Vector3(x,y,side),new T.Vector3(0,0,-side));const hit=ray.intersectObject(probe,false)[0];return [x,y,hit?hit.point.z-side*.012:side*depth*.7];};
      const edge=new T.CatmullRomCurve3([[.33,-.045,side*.10],[-.13,-.09,side*.34],[-.40,-.105,side*.38],[-.17,-.055,side*.19],[.09,-.045,side*.11]].map(p=>new T.Vector3(...p)),false,'catmullrom',.05);
      patch(root,t=>edge.getPoint(t).toArray(),side>0?3:4,20,6);
    }else if(species.heritage){const z=side*depth*.7,curve=new T.CatmullRomCurve3([[-.02,-.37,z+side*.43],[-.24,-.4,z+side*.56],[-.48,-.3,z+side*.54],[-.37,-.09,z+side*.28],[-.25,-.03,z+side*.1]].map(p=>new T.Vector3(...p)),false,'catmullrom',.12);patch(()=>[.25,-.08,z],t=>curve.getPoint(t).toArray(),side>0?3:4,20,7);}
    else patch(t=>[.34-.16*t,-.08-t*.08,side*depth*.86],t=>[.34-.16*t-.64*Math.sin(t*Math.PI),-.08-t*.08-.26*Math.sin(t*Math.PI),side*(depth*.86+.47*Math.pow(Math.sin(t*Math.PI),.8))],side>0?3:4,16,6);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('aFin',new T.Float32BufferAttribute(types,1));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const probe=new T.Mesh(bodyGeometries[speciesCatalog.indexOf(species)],bodyMats[speciesCatalog.indexOf(species)]);probe.updateMatrixWorld(true);
  const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(),p=geo.attributes.position,uv=geo.attributes.uv,fin=geo.attributes.aFin;let maxGap=-Infinity,maxInset=0,rootCount=0,missing=0;
  for(let i=0;i<p.count;i++){const type=fin.getX(i);if((type!==1&&type!==2)||uv.getY(i)!==0)continue;const sign=type===1?1:-1;ray.set(origin.set(p.getX(i),sign*4,p.getZ(i)),direction.set(0,-sign,0));const hit=ray.intersectObject(probe,false)[0];rootCount++;if(!hit){missing++;continue;}const gap=sign*(p.getY(i)-hit.point.y);maxGap=Math.max(maxGap,gap);maxInset=Math.max(maxInset,-gap);}
  geo.userData.attachment={maxGap,maxInset,rootCount,missing};return geo;
}
const finGeometries=speciesCatalog.map(finGeometry);
function mergeDetails(group){group.updateMatrixWorld(true);const buckets=new Map();group.traverse(o=>{if(!o.isMesh||o.userData.swimmingSurface)return;const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);});
  for(const list of buckets.values()){if(list.length<2)continue;const attributes=['position','normal','uv'].filter(a=>list.every(o=>o.geometry.getAttribute(a))),arrays={};for(const a of attributes)arrays[a]=[];
    for(const o of list){const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);for(const a of attributes)arrays[a].push(...geo.getAttribute(a).array);geo.dispose();o.parent.remove(o);}const geo=new T.BufferGeometry();for(const a of attributes)geo.setAttribute(a,new T.Float32BufferAttribute(arrays[a],a==='uv'?2:3));const merged=new T.Mesh(geo,list[0].material);merged.renderOrder=list[0].renderOrder;group.add(merged);
  }
}
// Shallow eye patches are projected onto the actual mesh, never onto an estimated ellipsoid.
// Iris, pupil and highlight share the skin curvature, with only a tiny surface clearance.
const eyeDetails=speciesCatalog.map((species,index)=>{
  const probe=new T.Mesh(bodyGeometries[index],bodyMats[index]);probe.updateMatrixWorld(true);
  const ray=new T.Raycaster(),parts=[],attachment={samples:0,missing:0,maxGap:0};
  const x=species.predator?.80:.62,y=species.predator?sharkCenter(x)+species.height*.14:species.height*.24,rx=species.predator?.033:species.locomotion==='burst-rest'?.043:species.heritage?.077:.063,ry=species.predator?.023:species.locomotion==='burst-rest'?.035:species.heritage?.082:.070;
  function patch(side,cx,cy,sx,sy,lift,material,rings=4,sides=24){const points=[],indices=[];
    for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
      const r=i/rings,angle=j/sides*Math.PI*2,px=cx+Math.cos(angle)*r*sx,py=cy+Math.sin(angle)*r*sy;
      ray.set(new T.Vector3(px,py,side*2),new T.Vector3(0,0,-side));const hit=ray.intersectObject(probe,false)[0];attachment.samples++;
      if(!hit){attachment.missing++;points.push(px,py,0);}else{const gap=lift+.002*(1-r*r);attachment.maxGap=Math.max(attachment.maxGap,gap);points.push(px,py,hit.point.z+side*gap);}
      if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;if(side>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();parts.push({geometry,material});
  }
  for(const side of [-1,1]){patch(side,x,y,rx,ry,.0012,species.predator?sharkEyeMat:eyeMat);patch(side,x+.007,y-.002,rx*.58,ry*.62,.0028,pupilMat);patch(side,x+.013,y+ry*.29,rx*.13,ry*.12,.0048,shineMat,2,12);}
  return {parts,attachment,probe};
});
const gillDetails=speciesCatalog.map((species,index)=>{
  const geometries=[],ray=new T.Raycaster();
  for(const side of [-1,1])for(let slit=0;slit<(species.predator?5:1);slit++){
    const points=[];for(let j=0;j<=24;j++){
      const a=-1.1+j/24*2.2,x=species.predator?.31-slit*.075-.025*Math.cos(j/24*Math.PI):.35-.10*Math.cos(a),y=species.predator?(j/24-.5)*species.height*1.25:Math.sin(a)*species.height*.68;
      ray.set(new T.Vector3(x,y,side*2),new T.Vector3(0,0,-side));const hit=ray.intersectObject(eyeDetails[index].probe,false)[0];if(hit)points.push(hit.point.clone().add(new T.Vector3(0,0,side*.0015)));
    }
    geometries.push(new T.BufferGeometry().setFromPoints(points));
  }return geometries;
});
const sharkLipMat=new T.LineBasicMaterial({color:'#606b6b',transparent:true,opacity:.65});
function addSharkMouth(g,species){
  // Closed lips: one restrained crescent on the smooth underside, without a painted cavity or teeth.
  const probe=new T.Mesh(bodyGeometries[speciesCatalog.indexOf(species)],bodyMats[speciesCatalog.indexOf(species)]);probe.updateMatrixWorld(true);
  const ray=new T.Raycaster(),points=[];
  for(let i=0;i<=64;i++){const t=i/64,x=.56+.36*Math.sin(t*Math.PI),z=.15*Math.cos(t*Math.PI);ray.set(new T.Vector3(x,-2,z),new T.Vector3(0,1,0));const hit=ray.intersectObject(probe,false)[0];if(hit)points.push(hit.point.clone().add(new T.Vector3(0,-.0018,0)));}
  g.add(new T.Line(new T.BufferGeometry().setFromPoints(points),sharkLipMat));
}
function createFishModel(species){const index=speciesCatalog.indexOf(species),h=species.height,depth=species.depth,rounded=species.heritage,g=new T.Group();g.userData.species=species.id;g.userData.finStyle=rounded?'classic':'flowing';
  // Per-fish uniforms keep stroke timing tied to its actual speed while textures/programs stay shared.
  const swim={phase:{value:0},effort:{value:.6},tailFold:{value:0},bend:{value:new T.Vector2()},wave:{value:species.predator?.065:species.locomotion==='burst-rest'?.022:.035}};g.userData.swim=swim;
  function swimmingMesh(geometry,base){const material=base.clone(),compile=base.onBeforeCompile;
    material.onBeforeCompile=shader=>{compile(shader);attachSpine(shader,swim);};material.customProgramCacheKey=()=>base.customProgramCacheKey();
    const mesh=new T.Mesh(geometry,material);mesh.userData.swimmingSurface=true;return mesh;
  }
  g.add(swimmingMesh(bodyGeometries[index],bodyMats[index]),swimmingMesh(finGeometries[index],finMats[index]));
  g.userData.eyeAttachment=eyeDetails[index].attachment;
  for(const part of eyeDetails[index].parts)g.add(new T.Mesh(part.geometry,part.material));
  for(const geometry of gillDetails[index])g.add(new T.Line(geometry,gillMaterials[index]));
  for(const side of [-1,1]){
    if(species.id==='moon-angelfish'){const curve=new T.CatmullRomCurve3([[.27,-.6,side*.1],[.13,-1.3,side*.15],[-.25,-1.85,side*.18]].map(p=>new T.Vector3(...p)));g.add(new T.Mesh(new T.TubeGeometry(curve,18,.009,4,false),eyeMat));}
  }
  if(species.predator)addSharkMouth(g,species);
  mergeDetails(g);
  // Bake detail transforms into fish-local space before applying the same spine.
  g.traverse(part=>{if(!part.geometry||part.userData.swimmingSurface)return;part.updateMatrix();const geometry=part.geometry.clone();geometry.applyMatrix4(part.matrix);part.geometry=geometry;part.position.set(0,0,0);part.rotation.set(0,0,0);part.scale.set(1,1,1);const base=part.material,compile=base.onBeforeCompile;part.material=base.clone();part.material.onBeforeCompile=shader=>{compile(shader);attachSpine(shader,swim);};part.material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-spine';});
  if(!species.predator){
    // A shallow, narrow mouth sits inside the snout silhouette; lips blend into the skin.
    const geometry=new T.SphereGeometry(1,10,8),lipMat=new T.MeshStandardMaterial({color:species.palette[1],roughness:.9});
    const mouthColor=new T.Color(species.palette[0]).lerp(new T.Color(species.palette[1]),.22);
    const cavity=new T.Mesh(geometry,new T.MeshStandardMaterial({color:mouthColor,roughness:1}));cavity.position.set(1.001,0,0);cavity.scale.set(.007,.004,.03);
    const upper=new T.Mesh(geometry,lipMat),lower=new T.Mesh(geometry,lipMat);
    upper.scale.set(.013,.005,.032);lower.scale.copy(upper.scale);upper.position.set(.992,.006,0);lower.position.set(.992,-.006,0);g.add(cavity,upper,lower);
    g.userData.mouth={cavity,upper,lower,open:0};
  }
  return g;
}
// The orbiting camera is a live sphere obstacle: fish may swim all around it, but never into the lens.
environment.obstacles.push({center:camera.position,radius:1.7});
const motion=new AquariumMotion(fish,random,environment),populationPlan=window.AQUARIUM_FISH_PLAN,sharkScales=window.AQUARIUM_SHARK_SCALES;
// The cruising turtle is a live obstacle: smaller fish glide around its shell just like the rocks.
const turtleResident=reefLife.residents.find(r=>r.species.id==='sea-turtle');
if(turtleResident)environment.obstacles.push({center:turtleResident.g.position,radius:1.35});
for(let i=0;i<populationPlan.length+sharkScales.length;i++){const species=speciesCatalog[i<sharkScales.length?6:populationPlan[(i-sharkScales.length)%populationPlan.length]],g=createFishModel(species),size=species.size*range(.94,1.06)*(sharkScales[i]??1);g.scale.setScalar(size);scene.add(g);motion.register({g,species,kind:species.kind,rounded:species.heritage,size,phase:range(0,Math.PI*2),direction:random()>.5?1:-1});}
function setCount(n){visibleCount=n;motion.setCount(n);fish.forEach((f,i)=>f.model.visible=i<n);}
setCount(32+sharkScales.length);
// Tiny suspended particles and pearl-like bubbles, each in a single draw call.
function particleTexture(ring=false){let c=document.createElement('canvas');c.width=c.height=64;let g=c.getContext('2d'),gr=g.createRadialGradient(27,24,1,32,32,31);if(ring){gr.addColorStop(0,'rgba(190,240,236,0)');gr.addColorStop(.65,'rgba(180,235,233,.02)');gr.addColorStop(.87,'rgba(180,235,233,.28)');gr.addColorStop(.94,'rgba(218,255,243,.65)');gr.addColorStop(1,'rgba(130,215,225,0)');}else{gr.addColorStop(0,'rgba(211,241,220,.7)');gr.addColorStop(.2,'rgba(201,235,215,.4)');gr.addColorStop(1,'rgba(200,240,230,0)');}g.fillStyle=gr;g.fillRect(0,0,64,64);if(ring){g.fillStyle='#e4fff7';g.beginPath();g.ellipse(22,18,4,2,-.7,0,7);g.fill();}return new T.CanvasTexture(c);}
const dustGeo=new T.BufferGeometry(),dustArray=new Float32Array(550*3);for(let i=0;i<550;i++){dustArray[i*3]=range(-24,24);dustArray[i*3+1]=range(-4,12);dustArray[i*3+2]=range(-15,12);}dustGeo.setAttribute('position',new T.BufferAttribute(dustArray,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({color:'#b0d8c1',size:.07,map:particleTexture(),transparent:true,opacity:.22,depthWrite:false,blending:T.AdditiveBlending}));scene.add(dust);
const bubGeo=new T.BufferGeometry(),bubArray=new Float32Array(85*3);for(let i=0;i<85;i++){let b={x:(i%3===0?-10:10)+range(-.7,.7),y:range(-4.5,10),z:range(-3,1),speed:range(.3,.9),phase:range(0,6)};bubbles.push(b);}bubGeo.setAttribute('position',new T.BufferAttribute(bubArray,3));const bubblePoints=new T.Points(bubGeo,new T.PointsMaterial({map:particleTexture(true),size:.15,transparent:true,opacity:.5,depthWrite:false,color:'#bdede0'}));scene.add(bubblePoints);
// Broad, feathered light shafts. A cheap transparent pass instead of post-processing.
const rayMat=new T.ShaderMaterial({uniforms:{uTime:time,uColor:{value:new T.Color('#82cabc')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;uniform vec3 uColor;varying vec2 vUv;void main(){float edge=pow(sin(vUv.x*3.14159),2.);float fade=pow(vUv.y,1.6)*(1.-smoothstep(.87,1.,vUv.y));float pulse=.7+.3*sin(uTime*.25+vUv.x*8.);gl_FragColor=vec4(uColor,edge*fade*pulse*.085);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
for(let i=0;i<7;i++){let m=new T.Mesh(new T.PlaneGeometry(range(1,3),21),rayMat);m.position.set(-10+i*4,4,-7-i%3);m.rotation.z=-.27;scene.add(m);}
// Clear, sheltered shallows: a small swell gently refracts blue sky and faint clouds.
// No painted wave bands, bright flecks or sharp total-reflection boundary.
const waterWaves=`
  uniform float uTime;
  vec3 waterField(vec2 p){
    vec3 field=vec3(0.);
    vec2 d=vec2(.28,.96);
    float phase=dot(p,d)*.42-uTime*.40;
    field+=vec3(.065*sin(phase),d*(.065*.42*cos(phase)));
    d=vec2(-.6,.8);
    phase=dot(p,d)*.68-uTime*.56+1.7;
    field+=vec3(.025*sin(phase),d*(.025*.68*cos(phase)));
    return field;
  }
`;
const surfaceGeo=new T.PlaneGeometry(180,150,120,100);surfaceGeo.rotateX(-Math.PI/2);
const surfaceMat=new T.ShaderMaterial({
  uniforms:{uTime:time,uSkyTop:{value:new T.Color('#275969')},uSkyHorizon:{value:new T.Color('#63918c')},uSunColor:{value:sun.color},uSunPower:{value:sun.intensity},uFogColor:{value:scene.fog.color}},
  vertexShader:waterWaves+`
    varying vec3 vWaterPosition;
    void main(){
      vec3 p=position;p.y+=waterField(p.xz).x;
      vWaterPosition=(modelMatrix*vec4(p,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(vWaterPosition,1.);
    }`,
  fragmentShader:waterWaves+`
    uniform vec3 uSkyTop;
    uniform vec3 uSkyHorizon;
    uniform vec3 uSunColor;
    uniform float uSunPower;
    uniform vec3 uFogColor;
    varying vec3 vWaterPosition;
    float hash(vec2 p){
      vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);
      return fract((q.x+q.y)*q.z);
    }
    float noise(vec2 p){
      vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),
                 mix(hash(cell+vec2(0.,1.)),hash(cell+vec2(1.)),f.x),f.y);
    }
    void main(){
      vec3 field=waterField(vWaterPosition.xz);
      vec3 normal=normalize(vec3(-field.y,1.,-field.z));
      vec3 view=normalize(cameraPosition-vWaterPosition);
      float facing=abs(dot(normal,view));
      // A soft view through the water, warped only slightly by the gentle swell.
      vec3 skyDirection=normalize(vec3(-view.x*.75,abs(view.y)+.20,-view.z*.75)
        +vec3(field.y*.8,0.,field.z*.8));
      vec2 skyUV=skyDirection.xz/(skyDirection.y+.45);
      float cloudNoise=noise(skyUV*3.+vec2(uTime*.008,4.))*.7
        +noise(skyUV*6.+vec2(uTime*.010,7.))*.3;
      vec2 cloudUV=skyUV-vec2(-.28+uTime*.001,-.88);
      vec2 cloudShape=cloudUV*vec2(4.,18.);
      float cloudBody=exp(-dot(cloudShape,cloudShape));
      cloudShape=(cloudUV-vec2(.14,-.015))*vec2(6.,24.);
      cloudBody=max(cloudBody,exp(-dot(cloudShape,cloudShape))*.8);
      float clouds=clamp(smoothstep(.53,.79,cloudNoise)*.35+cloudBody*.85,0.,1.);
      float daylight=clamp(uSunPower/3.4,0.,1.);
      vec3 sky=mix(uSkyHorizon,uSkyTop,smoothstep(.12,.85,skyDirection.y));
      // Clouds stay faint and blue-tinted rather than forming white surface marks.
      sky=mix(sky,mix(uSkyHorizon,uSunColor,.20),clouds*.45*daylight);
      float light=pow(max(dot(skyDirection,normalize(vec3(-.35,.85,-.3))),0.),16.);
      sky+=uSunColor*light*.065*daylight;
      vec3 color=mix(uFogColor,sky,.78);
      float distanceToCamera=length(cameraPosition-vWaterPosition);
      float distanceFade=1.-exp(-distanceToCamera*distanceToCamera*.00010);
      color=mix(color,uFogColor,distanceFade);
      float horizon=smoothstep(.025,.28,facing);
      float edgeDistance=min(90.-abs(vWaterPosition.x),75.-abs(vWaterPosition.z));
      float edgeFade=smoothstep(0.,18.,edgeDistance);
      gl_FragColor=vec4(color,(.58+.12*facing)*horizon*edgeFade);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  transparent:true,depthWrite:false,side:T.DoubleSide
});
const surface=new T.Mesh(surfaceGeo,surfaceMat);surface.position.y=10;
surfaceGeo.computeBoundingSphere();surfaceGeo.boundingSphere.radius+=.10;scene.add(surface);
const foodGeo=new T.SphereGeometry(.05,6,5),foodMat=new T.MeshStandardMaterial({color:'#e6bd7b',emissive:'#d29b42',emissiveIntensity:.5,roughness:.7});
const feedRay=new T.Raycaster(),feedPlane=new T.Plane(),feedNormal=new T.Vector3(),feedAnchor=new T.Vector3(),feedPoint=new T.Vector3();
let feedBatch=0;
function addFood(clientX,clientY){
  const rect=renderer.domElement.getBoundingClientRect();
  feedRay.setFromCamera(new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
  camera.getWorldDirection(feedNormal);feedPlane.setFromNormalAndCoplanarPoint(feedNormal,feedAnchor.set(0,.5,2));
  if(!feedRay.ray.intersectPlane(feedPlane,feedPoint))return;
  // At the bottom of the picture, drop onto the visible sand rather than behind it.
  const sandHit=feedRay.intersectObject(sandMesh,false)[0];
  if(sandHit&&sandHit.distance<feedRay.ray.origin.distanceTo(feedPoint)){feedPoint.copy(sandHit.point).addScaledVector(feedRay.ray.direction,-.12);}
  // Keep a bounded population while every accepted click still creates exactly three pellets.
  while(foods.length>57){const old=foods.shift();old.mesh.visible=false;old.mesh.removeFromParent();}
  const meal={},batch=++feedBatch;
  for(let i=0;i<3;i++){const m=new T.Mesh(foodGeo,foodMat);m.position.copy(feedPoint);
    if(i>0)m.position.add(new T.Vector3(range(-.3,.3),range(-.08,.08),range(-.22,.22)));
    scene.add(m);foods.push({mesh:m,meal,batch,life:0,speed:range(.13,.22)});
  }
}
// Keep the clear-water look as its own preset; the original darker palette is default.
const themes={
  classic:{name:'幽蓝',bg:'#073542',sky:0xb8f2e5,ground:0x344e4b,sand:'#b3b49a',sun:0xffefd1,power:3.4,exposure:1.2,ray:'#82cabc',fog:.024,skyTop:'#275969',skyHorizon:'#63918c'},
  day:{name:'清澈日光',bg:'#187eb4',sky:0xe1f4ff,ground:0x657f8b,sand:'#cfccb0',sun:0xfff4de,power:3.4,exposure:1.2,ray:'#a3dfff',fog:.010,skyTop:'#3799e8',skyHorizon:'#b1e1f7'},
  sunset:{name:'落日',bg:'#233f43',sky:0xa6c3b4,ground:0x657f8b,sand:'#cfccb0',sun:0xffbd78,power:3.2,exposure:1.25,ray:'#edba7d',fog:.014,skyTop:'#749dc8',skyHorizon:'#efd0af'},
  night:{name:'夜色',bg:'#07172e',sky:0x527fc4,ground:0x657f8b,sand:'#cfccb0',sun:0x9cbcff,power:1.1,exposure:.95,ray:'#557dcc',fog:.022,skyTop:'#101e40',skyHorizon:'#29466e'}
};
const themeOrder=['classic','day','sunset','night'];
let themeTarget=null;const colorTemp=new T.Color();
function setTheme(value){
  theme=value;themeTarget=themes[value];
  $('#theme').setAttribute('aria-label',`切换光照氛围，当前：${themeTarget.name}`);
}
setTheme('classic');
function setPaused(){paused=!paused;$('#pause').setAttribute('aria-pressed',paused);$('#pause').setAttribute('aria-label',paused?'继续动画':'暂停动画');$('#pause svg').innerHTML=paused?'<path d="m8 4 12 8-12 8z"/>':'<path d="M8 5v14M16 5v14"/>';}
$('#pause').onclick=setPaused;
$('#theme').onclick=()=>setTheme(themeOrder[(themeOrder.indexOf(theme)+1)%themeOrder.length]);
let toastTimer=0;function showToast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800);}
$('#quality').onclick=()=>{quality=quality==='low'?'auto':'low';pixelScale=quality==='low'?1:Math.min(devicePixelRatio,maxDpr);renderer.setPixelRatio(pixelScale);$('#quality').setAttribute('aria-pressed',quality==='low');showToast(quality==='low'?'省电画质已开启':'已恢复高清画质');};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){/* Fullscreen may be unavailable in an embedded browser. */}}
$('#fullscreen').onclick=fullscreen;
// The guide uses the same model factory and cached geometry/materials as the actual residents.
const catalog=$('#catalog'),previewHost=$('#catalog-preview'),speciesList=$('#species-list');
let guideRenderer=null,guideScene=null,guideCamera=null,guideModels=[],selectedSpecies=0,guideYaw=0,guidePitch=0,guideDown=null;
function resizeGuide(){if(!guideRenderer)return;const rect=previewHost.getBoundingClientRect();if(rect.width<1)return;guideRenderer.setSize(rect.width,rect.height,false);guideCamera.aspect=rect.width/rect.height;guideCamera.updateProjectionMatrix();}
function selectSpecies(index){selectedSpecies=index;guideYaw=0;guidePitch=0;const species=guideCatalog[index];if(species.id==='sea-turtle')guideYaw=-.4;guideModels.forEach((g,i)=>g.visible=i===index);
  $('#species-family').textContent=species.family;$('#species-name').textContent=species.name;$('#species-subtitle').textContent=species.subtitle;$('#species-description').textContent=species.description;$('#species-behavior').textContent='习性：'+species.habitat.habit;$('#species-habitat').textContent='偏爱环境：'+species.habitat.environment;$('#species-diet').textContent='食性：'+species.habitat.diet;
  $('#species-features').replaceChildren(...species.features.map(text=>{const tag=document.createElement('span');tag.textContent=text;return tag;}));
  const attributes=[['size','大小',['微小','小型','中型','大型','巨型']],['schooling','聚集',['独处','较低','适中','较高','最高']],['danger','危险',['温和','较低','适中','较高','最高']],['activity','活跃',['安静','较低','适中','活跃','好动']],['speed','速度',['缓慢','较慢','适中','较快','最快']]];
  $('#species-attributes').replaceChildren(...attributes.map(([key,label,levels])=>{
    const level=species.traits[key],row=document.createElement('div'),term=document.createElement('dt'),value=document.createElement('dd'),text=document.createElement('span'),meter=document.createElement('span');
    term.textContent=label;text.textContent=levels[level-1];meter.className='attribute-meter';meter.setAttribute('aria-hidden','true');
    for(let i=0;i<5;i++){const mark=document.createElement('i');if(i<level)mark.className='filled';meter.append(mark);}
    value.append(text,meter);row.dataset.attribute=key;row.setAttribute('role','group');row.setAttribute('aria-label',`${label}：${levels[level-1]}，${level}/5`);row.append(term,value);return row;
  }));
  speciesList.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',i===index));
}
function initGuide(){if(guideRenderer)return;
  guideRenderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});guideRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));guideRenderer.outputColorSpace=T.SRGBColorSpace;guideRenderer.toneMapping=T.ACESFilmicToneMapping;guideRenderer.toneMappingExposure=1.12;previewHost.prepend(guideRenderer.domElement);
  guideScene=new T.Scene();guideCamera=new T.PerspectiveCamera(43,1,.1,30);guideCamera.position.set(0,.15,5);guideCamera.lookAt(-.35,0,0);
  guideScene.add(new T.HemisphereLight(0xd4f1e4,0x34484c,2));const key=new T.DirectionalLight(0xffefcf,3.2);key.position.set(-2,5,6);guideScene.add(key);const edge=new T.DirectionalLight(0x79d7e6,1.7);edge.position.set(4,2,-3);guideScene.add(edge);
  guideModels=guideCatalog.map(species=>{const model=species.resident?reef.createModel(species):createFishModel(species);model.scale.setScalar(species.id==='moon-angelfish'?.92:species.id==='sea-turtle'?1.85:species.resident?1.5:1.7);if(species.resident){model.position.y=species.id==='moon-jelly'?.5:species.id==='sea-turtle'?.48:-.3;model.rotation.x=guideTilt(species);if(species.id==='sea-turtle')model.rotation.y=-.4;}model.visible=false;guideScene.add(model);return model;});
  guideRenderer.setSize(240,128,false);guideCamera.aspect=240/128;guideCamera.updateProjectionMatrix();
  guideCatalog.forEach((species,index)=>{
    guideModels.forEach((model,i)=>model.visible=i===index);guideRenderer.render(guideScene,guideCamera);
    const button=document.createElement('button');button.type='button';button.className='species-option';button.dataset.species=species.id;button.setAttribute('aria-label',species.name);button.setAttribute('aria-current','false');
    const img=document.createElement('img');img.src=guideRenderer.domElement.toDataURL('image/png');img.alt='';const label=document.createElement('span'),name=document.createElement('strong'),count=document.createElement('small');name.textContent=species.name;count.dataset.count=species.id;label.append(name,count);button.append(img,label);button.onclick=()=>selectSpecies(index);speciesList.append(button);
  });
  const canvas=guideRenderer.domElement;
  canvas.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;guideDown={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!guideDown)return;guideYaw-=(e.clientX-guideDown.x)*.009;guidePitch=T.MathUtils.clamp(guidePitch+(e.clientY-guideDown.y)*.003,-.2,.2);guideDown={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',()=>guideDown=null);canvas.addEventListener('pointercancel',()=>guideDown=null);
  new ResizeObserver(()=>{if(catalog.open)resizeGuide();}).observe(previewHost);
}
function openGuide(){initGuide();catalog.showModal();$('#field-guide').setAttribute('aria-expanded','true');selectSpecies(selectedSpecies);resizeGuide();
  const counts=Object.fromEntries(guideCatalog.map(s=>[s.id,0]));for(const f of [...fish.slice(0,visibleCount),...reefLife.residents])counts[f.species.id]++;
  for(const node of speciesList.querySelectorAll('[data-count]'))node.textContent=`水族馆中 ${counts[node.dataset.count]} 只`;
  $('#species-count').textContent=`当前 ${visibleCount+reefLife.residents.length} 位居民`;
}
$('#field-guide').onclick=openGuide;$('#close-catalog').onclick=()=>catalog.close();
catalog.addEventListener('click',e=>{if(e.target===catalog)catalog.close();});
catalog.addEventListener('close',()=>{$('#field-guide').setAttribute('aria-expanded','false');guideDown=null;$('#field-guide').focus({preventScroll:true});});
function guideTilt(species){return species.id==='ochre-star'||species.id==='pearl-clam'?1:species.id==='sea-turtle'?.55:species.resident?.4:0;}
function renderGuide(dt){if(!guideRenderer||!catalog.open)return;const model=guideModels[selectedSpecies];if(model.userData.swim)model.userData.swim.phase.value=(model.userData.swim.phase.value+dt*4.2)%(Math.PI*40);else reef.animateModel(model,elapsed);model.rotation.set(guideTilt(guideCatalog[selectedSpecies]),guideYaw+Math.sin(elapsed*.2)*.08,guidePitch,'YZX');guideRenderer.render(guideScene,guideCamera);}

let down=null,lastPointer=null;
renderer.domElement.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0)return;down={x:e.clientX,y:e.clientY,moved:false};lastPointer={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;if(down.moved){state.yaw=T.MathUtils.clamp(state.yaw-dx*.002,-.32,.32);state.pitch=T.MathUtils.clamp(state.pitch+dy*.0015,-.12,.2);}lastPointer={x:e.clientX,y:e.clientY};});
// Touch users can reveal controls by tapping the bottom control region.
let revealTimer;function revealControls(){const controls=$('.controls');controls.classList.add('revealed');clearTimeout(revealTimer);revealTimer=setTimeout(()=>{controls.classList.remove('revealed');if(matchMedia('(hover:none)').matches&&controls.contains(document.activeElement))document.activeElement.blur();},2600);}
renderer.domElement.addEventListener('pointerup',e=>{if(down&&!down.moved&&e.isPrimary){addFood(e.clientX,e.clientY);if(e.pointerType!=='mouse'&&e.clientY>innerHeight-104)revealControls();}down=null;});
window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse')return;$('.controls').classList.toggle('hovering',e.clientY>=innerHeight-104&&Math.abs(e.clientX-innerWidth*.5)<200);});
document.documentElement.addEventListener('pointerleave',()=>$('.controls').classList.remove('hovering'));
$('.controls').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')revealControls();});
renderer.domElement.addEventListener('pointercancel',()=>down=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();state.zoom=T.MathUtils.clamp(state.zoom+e.deltaY*.009,18,34);},{passive:false});
window.addEventListener('keydown',e=>{if(catalog.open){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectSpecies((selectedSpecies+(e.key==='ArrowRight'?1:-1)+guideCatalog.length)%guideCatalog.length);}return;}if(e.key.toLowerCase()==='g'){e.preventDefault();openGuide();return;}if(e.code==='Space'){e.preventDefault();setPaused();}if(e.key.toLowerCase()==='h')document.body.classList.toggle('hidden-ui');if(e.key.toLowerCase()==='f')fullscreen();if(e.key==='Escape'){document.body.classList.remove('hidden-ui');document.activeElement.blur();}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let tabActive=true;document.addEventListener('visibilitychange',()=>{tabActive=!document.hidden;clock.getDelta();});
let frameCount=0,frameTime=0,perfFrames=0,perfTime=0,first=true;
function animate(){requestAnimationFrame(animate);let rawDt=Math.min(clock.getDelta(),.05);if(!tabActive)return;let dt=paused?0:rawDt*flow;elapsed+=dt;time.value=elapsed;
if(themeTarget){let a=1-Math.exp(-rawDt*2);scene.background.lerp(colorTemp.set(themeTarget.bg),a);scene.fog.color.copy(scene.background);ambient.color.lerp(colorTemp.set(themeTarget.sky),a);ambient.groundColor.lerp(colorTemp.set(themeTarget.ground),a);sandMat.color.lerp(colorTemp.set(themeTarget.sand),a);sun.color.lerp(colorTemp.set(themeTarget.sun),a);sun.intensity=T.MathUtils.lerp(sun.intensity,themeTarget.power,a);renderer.toneMappingExposure=T.MathUtils.lerp(renderer.toneMappingExposure,themeTarget.exposure,a);rayMat.uniforms.uColor.value.lerp(colorTemp.set(themeTarget.ray),a);surfaceMat.uniforms.uSunPower.value=sun.intensity;scene.fog.density=T.MathUtils.lerp(scene.fog.density,themeTarget.fog,a);surfaceMat.uniforms.uSkyTop.value.lerp(colorTemp.set(themeTarget.skyTop),a);surfaceMat.uniforms.uSkyHorizon.value.lerp(colorTemp.set(themeTarget.skyHorizon),a);}
if(dt){reefLife.update(elapsed);motion.update(dt,foods);
for(let i=0;i<sandSites.length;i++){const site=sandSites[i],hidden=(site.availableAt||0)>motion.elapsed;if(hidden===!!site.hidden)continue;site.hidden=hidden;const size=hidden?0:.025+(i%4)*.007;morselTransform.position.copy(site.point);morselTransform.scale.set(size,size*.55,size*1.3);morselTransform.updateMatrix();morsels.setMatrixAt(i,morselTransform.matrix);morsels.instanceMatrix.needsUpdate=true;}
dust.rotation.y=elapsed*.003;for(let i=0;i<bubbles.length;i++){let b=bubbles[i];b.y+=dt*b.speed;if(b.y>10)b.y=-4.5;bubArray[i*3]=b.x+Math.sin(elapsed*.7+b.phase)*.16;bubArray[i*3+1]=b.y;bubArray[i*3+2]=b.z+Math.cos(elapsed*.5+b.phase)*.12;}bubGeo.attributes.position.needsUpdate=true;
for(let i=foods.length-1;i>=0;i--){let f=foods[i];f.life+=dt;f.mesh.position.y-=f.speed*dt;f.mesh.position.x+=Math.sin(elapsed+f.life)*dt*.025;const x=f.mesh.position.x,z=f.mesh.position.z,ground=AquariumMotion.floorHeight(x,z);if(f.mesh.position.y<ground+.06)f.mesh.position.y=ground+.06;if(f.eaten||f.life>24){scene.remove(f.mesh);foods.splice(i,1);}}}
let framing=innerWidth<800?1.26:1;let camX=Math.sin(state.yaw)*state.zoom,camY=2.5+state.pitch*22,camZ=Math.cos(state.yaw)*state.zoom*framing;camera.position.lerp(v1.set(camX,camY,camZ),1-Math.exp(-rawDt*3));camera.lookAt(0,.25,0);renderer.render(scene,camera);renderGuide(rawDt);
if(first){first=false;$('#loading').style.opacity=0;setTimeout(()=>$('#loading').remove(),1100);}
// Lower resolution after sustained slow frames; no oscillating quality loop.
perfFrames++;perfTime+=rawDt;if(perfTime>5){if(quality==='auto'&&perfFrames/perfTime<38&&pixelScale>1){pixelScale=Math.max(1,pixelScale-.2);renderer.setPixelRatio(pixelScale);}perfFrames=0;perfTime=0;}
frameCount++;frameTime+=rawDt;if(frameTime>=1){window.aquariumStats={fps:Math.round(frameCount/frameTime),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fish:visibleCount,pixelRatio:renderer.getPixelRatio(),paused,theme,food:foods.length,rounded:fish.slice(0,visibleCount).filter(f=>f.rounded).length};frameCount=0;frameTime=0;}}
window.aquariumAudit=()=>({...motion.audit(),elapsed:motion.elapsed,reef:{residents:reefLife.residents.map(r=>({id:r.species.id,position:r.g.position.toArray()})),obstacles:environment.obstacles.length},guide:{open:catalog.open,selected:guideCatalog[selectedSpecies].id,yaw:guideYaw},species:speciesCatalog.map((s,i)=>({id:s.id,name:s.name,count:fish.slice(0,visibleCount).filter(f=>f.species.id===s.id).length,attachment:finGeometries[i].userData.attachment,eyes:eyeDetails[i].attachment,bodyTriangles:bodyGeometries[i].index.count/3,opaque:bodyMats[i].opacity===1&&!bodyMats[i].transparent})),finStyles:{classic:fish.slice(0,visibleCount).filter(f=>f.g.userData.finStyle==='classic').length,flowing:fish.slice(0,visibleCount).filter(f=>f.g.userData.finStyle==='flowing').length},foodScreen:foods.map(f=>{const p=f.mesh.position.clone().project(camera);return {x:(p.x+1)*innerWidth*.5,y:(1-p.y)*innerHeight*.5,batch:f.batch};})});animate();
})();
