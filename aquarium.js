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
const camera=new T.PerspectiveCamera(43,innerWidth/innerHeight,.1,100); camera.position.set(0,2.5,26);
const ambient=new T.HemisphereLight(0xb8f2e5,0x344e4b,2.3);scene.add(ambient);
const sun=new T.DirectionalLight(0xffefd1,3.4); sun.position.set(-6,14,8);scene.add(sun);
const rim=new T.DirectionalLight(0x4dd8e5,2.3);rim.position.set(6,4,-8);scene.add(rim);
let seed=11042;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296},range=(a,b)=>a+(b-a)*random();
const clock=new T.Clock(), time={value:0}, fish=[],bubbles=[],foods=[];
let elapsed=0,paused=false,flow=.8,visibleCount=32,theme='day',quality='auto',pixelScale=Math.min(devicePixelRatio,maxDpr);
const v1=new T.Vector3();
const state={yaw:0,pitch:0,zoom:26};
// The seabed is a single displaced mesh. Its caustics and grain are analytical shaders.
const sandGeo=new T.PlaneGeometry(90,70,100,70);sandGeo.rotateX(-Math.PI/2);
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
const rockGeo=new T.IcosahedronGeometry(1,2);const rp=rockGeo.attributes.position;
for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i);let k=1+.1*Math.sin(x*8+y*5)*Math.cos(z*6);rp.setXYZ(i,x*k,y*k,z*k);}rockGeo.computeVertexNormals();
const rockInstances=[];
const rockMats=['#365b58','#54736a','#6d8070','#314e4e'].map(c=>new T.MeshStandardMaterial({color:c,roughness:.98,flatShading:true}));
function rock(x,y,z,sx,sy,sz){let m=new T.Mesh(rockGeo,rockMats[Math.floor(random()*4)]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(range(-.3,.3),range(0,6),range(-.3,.3));rockInstances.push(m);return m;}
rock(10,-3.7,-3,4,2.5,2.6);rock(13,-2.8,-5,3.3,4.2,3);rock(7.8,-4,-1,2,1.5,2);rock(-11,-4,-3,4,2,3);rock(-13,-2.8,-6,2.9,3.4,2.2);rock(11,-4.1,2,2.4,1.1,1.8);
for(let i=0;i<65;i++){let x=range(-19,19),z=range(-10,10),s=range(.08,.38);rock(x,-4.53,z,s,s*.55,s*.8);}
// Batch all stones by material: four draw calls for the entire rock garden.
for(const mat of rockMats){const stones=rockInstances.filter(m=>m.material===mat);const batch=new T.InstancedMesh(rockGeo,mat,stones.length);stones.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);});batch.instanceMatrix.needsUpdate=true;scene.add(batch);}
// Organic driftwood, with softly tapered limbs.
const woodMat=new T.MeshStandardMaterial({color:'#505447',roughness:1});
function branch(points,r){let curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));let geo=new T.TubeGeometry(curve,16,r,7,false);scene.add(new T.Mesh(geo,woodMat));}
branch([[6,-4.5,-2],[7,-3.7,-3],[9,-3,-4],[11,-2.9,-5]],.24);branch([[8,-3.3,-3.5],[7.2,-2.5,-3.8],[7,-1.5,-4]],.12);branch([[-12,-4.3,-2],[-10,-3.7,-3],[-9,-2.7,-4],[-9.5,-1.8,-5]],.2);
// Each meadow is merged into one geometry; the GPU bends every blade in the current.
function meadow(color,count,xmin,xmax,zmin,zmax,height,broad=false){const pos=[],norm=[],uv=[],idx=[];let n=0;
for(let k=0;k<count;k++){let x=range(xmin,xmax),z=range(zmin,zmax),h=range(height*.45,height),w=range(.1,broad?.6:.25),ang=range(0,Math.PI*2),bend=range(-.5,.5);
for(let j=0;j<=12;j++){let t=j/12,xx=x+Math.sin(t*2.3)*bend,yy=-4.6+t*h,zz=z+.25*Math.sin(t*2);let width=w*Math.pow(Math.sin(Math.PI*t),.7)+.006;
for(let s of [-1,1]){pos.push(xx+s*width*Math.cos(ang),yy,zz+s*width*Math.sin(ang));norm.push(Math.sin(ang),.15,Math.cos(ang));uv.push((s+1)/2,t);}
if(j<12){let a=n+j*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}}n+=26;}
let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);
let mat=new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.7,metalness:.08});mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime; varying vec2 vPlantUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vPlantUv=uv;float h=uv.y; transformed.x+=sin(uTime*.65+position.z*.6+position.x*.35+h*2.)*h*h*.48;transformed.z+=cos(uTime*.42+position.x*.3+h*2.)*h*h*.24;`);s.fragmentShader='varying vec2 vPlantUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=.64+vPlantUv.y*.5;diffuseColor.rgb+=pow(1.-abs(vPlantUv.x-.5)*2.,20.)*.09;`);};let m=new T.Mesh(geo,mat);scene.add(m);}
meadow('#438e72',95,-16,-9,-7,0,7,true);meadow('#267b66',90,8,17,-8,-1,8,true);meadow('#6b9d67',65,9,16,0,3,4.2);meadow('#397e63',65,-16,-9,0,4,3.7);meadow('#346d63',85,-18,18,-13,-9,5);meadow('#8aaf76',45,3.5,7.5,-4,0,2.1,true);
// Rosette leaves on the foreground stones.
for(let c=0;c<11;c++){let x=c<5?range(-13,-9):range(8,13),z=range(-1,3);meadow(c%2?'#7da67d':'#41816c',9,x-.2,x+.2,z-.2,z+.2,range(1,2.4),true);}
// Feather-leaf stems add a second silhouette and a warm accent to the gardens.
function fernGarden(){const positions=[],indices=[],colors=[];let offset=0;
for(let k=0;k<24;k++){const side=k<12?-1:1,x=side*range(8.1,11.6),z=range(.2,3.2),height=range(1.7,3.6),lean=range(-.6,.6);const color=new T.Color(k%3===0?'#9d9561':'#6eab80');
for(let row=0;row<12;row++){let t=row/12,y=-4.55+t*height,cx=x+lean*t*t,span=(.22+Math.sin(t*Math.PI)*.38)*(1.-t*.4);
for(let side of [-1,1]){const points=[[cx,y,z],[cx+span*side*.45,y+.13,z+.11],[cx+span*side,y+.25,z],[cx+span*side*.53,y+.015,z-.08]];for(const p of points){positions.push(...p);colors.push(color.r,color.g,color.b);}indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);offset+=4;}}}
let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();let mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.72});mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float h=max(0.,position.y+4.55);transformed.x+=sin(uTime*.6+position.x*.4+position.z)*h*h*.025;`);};scene.add(new T.Mesh(geo,mat));}fernGarden();
// One immutable record per fish species drives the tank, thumbnails and live field guide.
const speciesCatalog=window.AQUARIUM_SPECIES;
function profile(species){return {height:species.height,depth:species.depth};}
function bodyRing(species,u){const rounded=species.heritage,x=rounded?-Math.cos(u*Math.PI):u*2-1;
  const taper=.57+.43*T.MathUtils.smoothstep(x,-.92,.15);
  return {x,r:rounded?Math.max(.012,Math.sin(u*Math.PI)):Math.pow(Math.max(0,Math.sin(u*Math.PI)),.63)*taper+.018};
}
function bodyRim(species,x,bottom=false){
  const rings=species.heritage?16:20,sides=species.heritage?12:14;
  const polygonTop=sides%4===0?1:Math.cos(Math.PI/sides);
  let previous=bodyRing(species,0);
  for(let i=1;i<=rings;i++){const next=bodyRing(species,i/rings);if(x<=next.x){const t=T.MathUtils.clamp((x-previous.x)/(next.x-previous.x),0,1);return T.MathUtils.lerp(previous.r,next.r,t)*species.height*polygonTop*(bottom&&!species.heritage?.93:1);}previous=next;}
  return previous.r*species.height*polygonTop;
}
function skin(species){
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;
  const ctx=canvas.getContext('2d'),[back,flank,belly]=species.palette.map(c=>new T.Color(c));
  for(let y=0;y<384;y++){const dorsal=(Math.sin(y/384*Math.PI*2)+1)*.5,c=dorsal>.5?flank.clone().lerp(back,(dorsal-.5)*1.5):flank.clone().lerp(belly,(.5-dorsal)*1.6);ctx.fillStyle='#'+c.getHexString();ctx.fillRect(0,y,768,1);}
  for(let row=0;row<30;row++)for(let col=0;col<48;col++){const x=col*17+(row%2)*8.5,y=row*13;ctx.strokeStyle='rgba(15,58,61,.17)';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,7.8,-.35,Math.PI+.35);ctx.stroke();ctx.strokeStyle='rgba(255,244,203,.24)';ctx.beginPath();ctx.arc(x,y+1.5,6.8,.1,Math.PI-.1);ctx.stroke();}
  if(species.pattern==='celadon'||species.pattern==='moon'||species.pattern==='tidal'){
    const moon=species.pattern==='moon',tidal=species.pattern==='tidal';
    for(let i=0;i<(moon?4:3);i++){const x=(moon?120:145)+i*(moon?166:211);ctx.fillStyle=moon?'rgba(26,44,43,.7)':tidal?'rgba(8,67,95,.56)':'rgba(25,88,104,.42)';ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x-28,120,x+(tidal?128:35),260,x+(tidal?100:-10),384);ctx.lineTo(x+(tidal?130:23),384);ctx.bezierCurveTo(x+(tidal?150:65),240,x+8,120,x+30,0);ctx.fill();}
  }
  if(species.pattern==='amber'){ctx.fillStyle='rgba(225,113,30,.24)';ctx.beginPath();ctx.ellipse(560,80,115,55,-.25,0,Math.PI*2);ctx.fill();}
  if(species.pattern==='coral'){for(const [x,y,r] of [[420,35,110],[580,145,65],[350,235,85]]){ctx.fillStyle='rgba(255,222,168,.24)';ctx.beginPath();ctx.ellipse(x,y,r,39,-.3,0,Math.PI*2);ctx.fill();}}
  if(species.pattern==='neon'){for(const y of [0,192]){ctx.fillStyle='#98ebe2';ctx.fillRect(30,y,680,9);}for(const y of [210,368]){ctx.fillStyle='#ce593c';ctx.fillRect(130,y,570,14);}}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
}
const swimShader=`
float phase=uBeat;
float rear=pow(clamp(-position.x,0.,1.),1.65);
transformed.z+=sin(phase+position.x*2.5)*rear*.055*uEffort;
`;
const bodyMats=speciesCatalog.map(species=>{
  const mat=new T.MeshStandardMaterial({map:skin(species),roughness:.35,metalness:.05,flatShading:true,transparent:false,opacity:1,depthWrite:true,emissive:species.finColor,emissiveIntensity:species.heritage?.10:.06});
  mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.uniforms.uBeat={value:0};s.uniforms.uEffort={value:.6};s.uniforms.uAura={value:new T.Color(species.finColor)};s.vertexShader='uniform float uTime; uniform float uBeat; uniform float uEffort;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+swimShader);s.fragmentShader='uniform vec3 uAura;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float aura=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.2);totalEmissiveRadiance+=uAura*aura*.18;
`);};return mat;
});
function bodyGeometry(species){const {height,depth}=profile(species),positions=[],uvs=[],indices=[],rings=species.heritage?16:20,sides=species.heritage?12:14;
  for(let i=0;i<=rings;i++){const {x,r}=bodyRing(species,i/rings);
    for(let j=0;j<=sides;j++){const v=j/sides,theta=v*Math.PI*2,belly=!species.heritage&&Math.sin(theta)<0?.93:1;
      positions.push(x,height*r*Math.sin(theta)*belly,depth*r*Math.cos(theta));uvs.push((x+1)*.5,v);
      if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1);}
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
const bodyGeometries=speciesCatalog.map(bodyGeometry);
const eyeGeo=new T.SphereGeometry(1,14,10),eyeMat=new T.MeshStandardMaterial({color:'#d0bd83',roughness:.3,metalness:.18,transparent:true}),pupilMat=new T.MeshStandardMaterial({color:'#071e24',roughness:.2,transparent:true}),shineMat=new T.MeshBasicMaterial({color:'#dff6ee',transparent:true});
const gillMaterials=speciesCatalog.map(s=>new T.LineBasicMaterial({color:new T.Color(s.palette[0]).multiplyScalar(.8),transparent:true,opacity:.65}));
const finMats=speciesCatalog.map(species=>{
  const mat=new T.MeshStandardMaterial({color:species.finColor,vertexColors:true,transparent:true,opacity:species.heritage?.95:.92,side:T.DoubleSide,depthWrite:false,roughness:.38,metalness:.04,emissive:species.finColor,emissiveIntensity:.17});mat.forceSinglePass=true;
  mat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.uniforms.uBeat={value:0};s.uniforms.uEffort={value:.6};s.uniforms.uClassic={value:species.heritage?1:0};s.vertexShader='uniform float uTime; uniform float uClassic; uniform float uBeat; uniform float uEffort; attribute float aFin; varying vec2 vFinUv;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
${swimShader}
vFinUv=uv;
float freeEdge=uv.y*uv.y;
float flutter=sin(phase-position.x*3.-uv.y*2.4);
if(aFin<.5){transformed.z+=flutter*pow(max(0.,-position.x+mix(-.96,-.82,uClassic)),1.2)*.24*uEffort;}
else if(aFin<2.5){transformed.z+=flutter*freeEdge*.09*uEffort;}
else {float side=aFin<3.5?1.:-1.;transformed.z+=side*freeEdge*sin(phase*.65-uv.y*2.)*.13*uEffort;transformed.y+=freeEdge*cos(phase*.65)*.065*uEffort;}
`);s.fragmentShader='uniform float uClassic; varying vec2 vFinUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float ribs=pow(.5+.5*cos(vFinUv.x*18.*6.2831853),14.);float edge=1.-smoothstep(.7,1.,vFinUv.y);
diffuseColor.rgb*=.86+ribs*.26;diffuseColor.a*=mix(mix(.80,.84,uClassic),1.,edge)*(.94+ribs*.06);
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
  if(species.tail==='classic-fork'||species.tail==='moon-fan'){
    const points=species.tail==='moon-fan'?[[-1.12,.13,0],[-1.69,.53,0],[-1.61,.23,0],[-1.5,0,0],[-1.61,-.23,0],[-1.69,-.53,0],[-1.12,-.13,0]]:[[-1.12,.15,0],[-1.8,.65,.025],[-1.66,.28,.01],[-1.55,0,0],[-1.66,-.28,.01],[-1.8,-.65,.025],[-1.12,-.15,0]];
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'catmullrom',.12);patch(()=>[-.82,0,0],t=>curve.getPoint(t).toArray(),0,28,7);
  }else if(species.tail==='round-fan'){
    patch(t=>[-.96,.1*Math.cos(t*Math.PI),0],t=>{const a=(t*2-1)*1.12;return [-1.06-.94*Math.cos(a),.72*Math.sin(a),.025*Math.sin(t*Math.PI*2)];},0,24,7);
  }else{
    patch(t=>[-.96,.1*Math.cos(t*Math.PI),0],t=>{const q=t*2-1;return [-1.4-(species.tail==='swallow'?.64:.4)*Math.pow(Math.abs(q),.72),q*(species.tail==='swallow'?.62:.38),.02*Math.sin(t*Math.PI*2)];},0,24,7);
  }
  for(const side of [-1,1]){
    if(species.heritage){const z=side*depth*.7,curve=new T.CatmullRomCurve3([[-.02,-.37,z+side*.43],[-.24,-.4,z+side*.56],[-.48,-.3,z+side*.54],[-.37,-.09,z+side*.28],[-.25,-.03,z+side*.1]].map(p=>new T.Vector3(...p)),false,'catmullrom',.12);patch(()=>[.25,-.08,z],t=>curve.getPoint(t).toArray(),side>0?3:4,20,7);}
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
function createFishModel(species){const index=speciesCatalog.indexOf(species),h=species.height,depth=species.depth,rounded=species.heritage,g=new T.Group();g.userData.species=species.id;g.userData.finStyle=rounded?'classic':'flowing';
  // Per-fish uniforms keep stroke timing tied to its actual speed while textures/programs stay shared.
  const swim={phase:{value:0},effort:{value:.6}};g.userData.swim=swim;
  function swimmingMesh(geometry,base){const material=base.clone(),compile=base.onBeforeCompile;
    material.onBeforeCompile=shader=>{compile(shader);shader.uniforms.uBeat=swim.phase;shader.uniforms.uEffort=swim.effort;};material.customProgramCacheKey=()=>base.customProgramCacheKey();
    const mesh=new T.Mesh(geometry,material);mesh.userData.swimmingSurface=true;return mesh;
  }
  g.add(swimmingMesh(bodyGeometries[index],bodyMats[index]),swimmingMesh(finGeometries[index],finMats[index]));
  for(const side of [-1,1]){
    const eye=new T.Mesh(eyeGeo,eyeMat);eye.renderOrder=1;eye.position.set(.64,h*.24,side*depth*.81);eye.scale.set(rounded?.109:.088,rounded?.115:.093,.035);g.add(eye);
    const pupil=new T.Mesh(eyeGeo,pupilMat);pupil.renderOrder=1;pupil.position.copy(eye.position);pupil.position.x+=.009;pupil.position.z+=side*.027;pupil.scale.set(rounded?.068:.052,rounded?.077:.061,.019);g.add(pupil);
    const shine=new T.Mesh(eyeGeo,shineMat);shine.renderOrder=1;shine.position.copy(pupil.position);shine.position.add(new T.Vector3(.009,.023,side*.016));shine.scale.setScalar(.013);g.add(shine);
    const gill=[];for(let j=0;j<=20;j++){const a=-1.1+j/20*2.2;gill.push(new T.Vector3(.35-.10*Math.cos(a),Math.sin(a)*h*.68,side*depth*(.93-.14*Math.abs(Math.sin(a)))));}g.add(new T.Line(new T.BufferGeometry().setFromPoints(gill),gillMaterials[index]));
    if(species.id==='moon-angelfish'){const curve=new T.CatmullRomCurve3([[.27,-.6,side*.1],[.13,-1.3,side*.15],[-.25,-1.85,side*.18]].map(p=>new T.Vector3(...p)));g.add(new T.Mesh(new T.TubeGeometry(curve,18,.009,4,false),eyeMat));}
  }
  const mouth=new T.Mesh(new T.TorusGeometry(.028,.009,5,12),gillMaterials[index]);mouth.rotation.y=Math.PI/2;mouth.position.set(1.014,-.012,0);g.add(mouth);mergeDetails(g);return g;
}
const motion=new AquariumMotion(fish,random),populationPlan=[0,5,1,5,2,5,3,5,4,5];
for(let i=0;i<52;i++){const species=speciesCatalog[populationPlan[i%populationPlan.length]],g=createFishModel(species),size=species.size*range(.94,1.06);g.scale.setScalar(size);scene.add(g);motion.register({g,species,kind:species.kind,rounded:species.heritage,size,phase:range(0,Math.PI*2),direction:random()>.5?1:-1});}
function setCount(n){visibleCount=n;motion.setCount(n);fish.forEach((f,i)=>f.g.visible=i<n);}
setCount(32);
// Tiny suspended particles and pearl-like bubbles, each in a single draw call.
function particleTexture(ring=false){let c=document.createElement('canvas');c.width=c.height=64;let g=c.getContext('2d'),gr=g.createRadialGradient(27,24,1,32,32,31);if(ring){gr.addColorStop(0,'rgba(190,240,236,0)');gr.addColorStop(.65,'rgba(180,235,233,.02)');gr.addColorStop(.87,'rgba(180,235,233,.28)');gr.addColorStop(.94,'rgba(218,255,243,.65)');gr.addColorStop(1,'rgba(130,215,225,0)');}else{gr.addColorStop(0,'rgba(211,241,220,.7)');gr.addColorStop(.2,'rgba(201,235,215,.4)');gr.addColorStop(1,'rgba(200,240,230,0)');}g.fillStyle=gr;g.fillRect(0,0,64,64);if(ring){g.fillStyle='#e4fff7';g.beginPath();g.ellipse(22,18,4,2,-.7,0,7);g.fill();}return new T.CanvasTexture(c);}
const dustGeo=new T.BufferGeometry(),dustArray=new Float32Array(550*3);for(let i=0;i<550;i++){dustArray[i*3]=range(-24,24);dustArray[i*3+1]=range(-4,12);dustArray[i*3+2]=range(-15,12);}dustGeo.setAttribute('position',new T.BufferAttribute(dustArray,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({color:'#b0d8c1',size:.07,map:particleTexture(),transparent:true,opacity:.5,depthWrite:false,blending:T.AdditiveBlending}));scene.add(dust);
const bubGeo=new T.BufferGeometry(),bubArray=new Float32Array(85*3);for(let i=0;i<85;i++){let b={x:(i%3===0?-10:10)+range(-.7,.7),y:range(-4.5,10),z:range(-3,1),speed:range(.3,.9),phase:range(0,6)};bubbles.push(b);}bubGeo.setAttribute('position',new T.BufferAttribute(bubArray,3));const bubblePoints=new T.Points(bubGeo,new T.PointsMaterial({map:particleTexture(true),size:.15,transparent:true,opacity:.5,depthWrite:false,color:'#bdede0'}));scene.add(bubblePoints);
// Broad, feathered light shafts. A cheap transparent pass instead of post-processing.
const rayMat=new T.ShaderMaterial({uniforms:{uTime:time,uColor:{value:new T.Color('#82cabc')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;uniform vec3 uColor;varying vec2 vUv;void main(){float edge=pow(sin(vUv.x*3.14159),2.);float fade=pow(vUv.y,1.6)*(1.-smoothstep(.87,1.,vUv.y));float pulse=.7+.3*sin(uTime*.25+vUv.x*8.);gl_FragColor=vec4(uColor,edge*fade*pulse*.085);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide});
for(let i=0;i<7;i++){let m=new T.Mesh(new T.PlaneGeometry(range(1,3),21),rayMat);m.position.set(-10+i*4,4,-7-i%3);m.rotation.z=-.27;scene.add(m);}
// A subtle animated surface overhead.
const surface=new T.Mesh(new T.PlaneGeometry(85,65),new T.ShaderMaterial({uniforms:{uTime:time},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;varying vec2 vUv;void main(){float v=sin(vUv.x*120.+sin(vUv.y*90.+uTime*.3)*2.+uTime*.5)*sin(vUv.y*100.-uTime*.3);gl_FragColor=vec4(.35,.7,.66,.04+pow(abs(v),8.)*.11);}',transparent:true,depthWrite:false,side:T.DoubleSide}));surface.rotation.x=Math.PI/2;surface.position.y=10;scene.add(surface);
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
function setTheme(value){theme=value;const themes={day:{bg:'#073542',sky:0xb8f2e5,sun:0xffefd1,power:3.4,exposure:1.2,ray:'#82cabc'},night:{bg:'#07172e',sky:0x527fc4,sun:0x9cbcff,power:1.1,exposure:.95,ray:'#557dcc'},sunset:{bg:'#233f43',sky:0xa6c3b4,sun:0xffbd78,power:3.2,exposure:1.25,ray:'#edba7d'}};themeTarget=themes[value];}
let themeTarget=null;const colorTemp=new T.Color();setTheme('day');
function setPaused(){paused=!paused;$('#pause').setAttribute('aria-pressed',paused);$('#pause').setAttribute('aria-label',paused?'继续动画':'暂停动画');$('#pause svg').innerHTML=paused?'<path d="m8 4 12 8-12 8z"/>':'<path d="M8 5v14M16 5v14"/>';}
$('#pause').onclick=setPaused;
$('#theme').onclick=()=>{const themes=['day','sunset','night'];setTheme(themes[(themes.indexOf(theme)+1)%themes.length]);};
$('#density').onclick=()=>{const counts=[12,24,32,40,52];setCount(counts[(counts.indexOf(visibleCount)+1)%counts.length]);};
$('#quality').onclick=()=>{quality=quality==='low'?'auto':'low';pixelScale=quality==='low'?1:Math.min(devicePixelRatio,maxDpr);renderer.setPixelRatio(pixelScale);$('#quality').setAttribute('aria-pressed',quality==='low');};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){/* Fullscreen may be unavailable in an embedded browser. */}}
$('#fullscreen').onclick=fullscreen;
// The guide uses the same model factory and cached geometry/materials as the actual residents.
const catalog=$('#catalog'),previewHost=$('#catalog-preview'),speciesList=$('#species-list');
let guideRenderer=null,guideScene=null,guideCamera=null,guideModels=[],selectedSpecies=0,guideYaw=0,guidePitch=0,guideDown=null;
function resizeGuide(){if(!guideRenderer)return;const rect=previewHost.getBoundingClientRect();if(rect.width<1)return;guideRenderer.setSize(rect.width,rect.height,false);guideCamera.aspect=rect.width/rect.height;guideCamera.updateProjectionMatrix();}
function selectSpecies(index){selectedSpecies=index;guideYaw=0;guidePitch=0;const species=speciesCatalog[index];guideModels.forEach((g,i)=>g.visible=i===index);
  $('#species-family').textContent=species.family;$('#species-name').textContent=species.name;$('#species-subtitle').textContent=species.subtitle;$('#species-description').textContent=species.description;$('#species-behavior').textContent=species.temperament;
  $('#species-features').replaceChildren(...species.features.map(text=>{const tag=document.createElement('span');tag.textContent=text;return tag;}));
  speciesList.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-current',i===index));
}
function initGuide(){if(guideRenderer)return;
  guideRenderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});guideRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));guideRenderer.outputColorSpace=T.SRGBColorSpace;guideRenderer.toneMapping=T.ACESFilmicToneMapping;guideRenderer.toneMappingExposure=1.12;previewHost.prepend(guideRenderer.domElement);
  guideScene=new T.Scene();guideCamera=new T.PerspectiveCamera(43,1,.1,30);guideCamera.position.set(0,.15,5);guideCamera.lookAt(-.35,0,0);
  guideScene.add(new T.HemisphereLight(0xd4f1e4,0x34484c,2));const key=new T.DirectionalLight(0xffefcf,3.2);key.position.set(-2,5,6);guideScene.add(key);const edge=new T.DirectionalLight(0x79d7e6,1.7);edge.position.set(4,2,-3);guideScene.add(edge);
  guideModels=speciesCatalog.map(species=>{const model=createFishModel(species);model.scale.setScalar(species.id==='moon-angelfish'?.92:1.7);model.visible=false;guideScene.add(model);return model;});
  guideRenderer.setSize(240,128,false);guideCamera.aspect=240/128;guideCamera.updateProjectionMatrix();
  speciesCatalog.forEach((species,index)=>{
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
  const counts=Object.fromEntries(speciesCatalog.map(s=>[s.id,0]));for(const f of fish.slice(0,visibleCount))counts[f.species.id]++;
  for(const node of speciesList.querySelectorAll('[data-count]'))node.textContent=`水族馆中 ${counts[node.dataset.count]} 尾`;
  $('#species-count').textContent=`当前 ${visibleCount} 尾居民`;
}
$('#field-guide').onclick=openGuide;$('#close-catalog').onclick=()=>catalog.close();
catalog.addEventListener('click',e=>{if(e.target===catalog)catalog.close();});
catalog.addEventListener('close',()=>{$('#field-guide').setAttribute('aria-expanded','false');guideDown=null;$('#field-guide').focus({preventScroll:true});});
function renderGuide(dt){if(!guideRenderer||!catalog.open)return;const model=guideModels[selectedSpecies];model.userData.swim.phase.value=(model.userData.swim.phase.value+dt*4.2)%(Math.PI*40);model.rotation.set(0,guideYaw+Math.sin(elapsed*.2)*.08,guidePitch,'YZX');guideRenderer.render(guideScene,guideCamera);}

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
window.addEventListener('keydown',e=>{if(catalog.open){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();selectSpecies((selectedSpecies+(e.key==='ArrowRight'?1:-1)+speciesCatalog.length)%speciesCatalog.length);}return;}if(e.key.toLowerCase()==='g'){e.preventDefault();openGuide();return;}if(e.code==='Space'){e.preventDefault();setPaused();}if(e.key.toLowerCase()==='h')document.body.classList.toggle('hidden-ui');if(e.key.toLowerCase()==='f')fullscreen();if(e.key==='Escape'){document.body.classList.remove('hidden-ui');document.activeElement.blur();}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let tabActive=true;document.addEventListener('visibilitychange',()=>{tabActive=!document.hidden;clock.getDelta();});
let frameCount=0,frameTime=0,perfFrames=0,perfTime=0,first=true;
function animate(){requestAnimationFrame(animate);let rawDt=Math.min(clock.getDelta(),.05);if(!tabActive)return;let dt=paused?0:rawDt*flow;elapsed+=dt;time.value=elapsed;
if(themeTarget){let a=1-Math.exp(-rawDt*2);scene.background.lerp(colorTemp.set(themeTarget.bg),a);scene.fog.color.copy(scene.background);ambient.color.lerp(colorTemp.set(themeTarget.sky),a);sun.color.lerp(colorTemp.set(themeTarget.sun),a);sun.intensity=T.MathUtils.lerp(sun.intensity,themeTarget.power,a);renderer.toneMappingExposure=T.MathUtils.lerp(renderer.toneMappingExposure,themeTarget.exposure,a);rayMat.uniforms.uColor.value.lerp(colorTemp.set(themeTarget.ray),a);}
if(dt){motion.update(dt,foods);dust.rotation.y=elapsed*.003;for(let i=0;i<bubbles.length;i++){let b=bubbles[i];b.y+=dt*b.speed;if(b.y>10)b.y=-4.5;bubArray[i*3]=b.x+Math.sin(elapsed*.7+b.phase)*.16;bubArray[i*3+1]=b.y;bubArray[i*3+2]=b.z+Math.cos(elapsed*.5+b.phase)*.12;}bubGeo.attributes.position.needsUpdate=true;
for(let i=foods.length-1;i>=0;i--){let f=foods[i];f.life+=dt;f.mesh.position.y-=f.speed*dt;f.mesh.position.x+=Math.sin(elapsed+f.life)*dt*.025;const x=f.mesh.position.x,z=f.mesh.position.z,ground=AquariumMotion.floorHeight(x,z);if(f.mesh.position.y<ground+.06)f.mesh.position.y=ground+.06;if(f.eaten||f.life>24){scene.remove(f.mesh);foods.splice(i,1);}}}
let framing=innerWidth<800?1.26:1;let camX=Math.sin(state.yaw)*state.zoom,camY=2.5+state.pitch*22,camZ=Math.cos(state.yaw)*state.zoom*framing;camera.position.lerp(v1.set(camX,camY,camZ),1-Math.exp(-rawDt*3));camera.lookAt(0,.25,0);renderer.render(scene,camera);renderGuide(rawDt);
if(first){first=false;$('#loading').style.opacity=0;setTimeout(()=>$('#loading').remove(),1100);}
// Lower resolution after sustained slow frames; no oscillating quality loop.
perfFrames++;perfTime+=rawDt;if(perfTime>5){if(quality==='auto'&&perfFrames/perfTime<38&&pixelScale>1){pixelScale=Math.max(1,pixelScale-.2);renderer.setPixelRatio(pixelScale);}perfFrames=0;perfTime=0;}
frameCount++;frameTime+=rawDt;if(frameTime>=1){window.aquariumStats={fps:Math.round(frameCount/frameTime),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fish:visibleCount,pixelRatio:renderer.getPixelRatio(),paused,theme,food:foods.length,rounded:fish.slice(0,visibleCount).filter(f=>f.rounded).length};frameCount=0;frameTime=0;}}
window.aquariumAudit=()=>({...motion.audit(),guide:{open:catalog.open,selected:speciesCatalog[selectedSpecies].id,yaw:guideYaw},species:speciesCatalog.map((s,i)=>({id:s.id,name:s.name,count:fish.slice(0,visibleCount).filter(f=>f.species.id===s.id).length,attachment:finGeometries[i].userData.attachment,opaque:bodyMats[i].opacity===1&&!bodyMats[i].transparent})),finStyles:{classic:fish.slice(0,visibleCount).filter(f=>f.g.userData.finStyle==='classic').length,flowing:fish.slice(0,visibleCount).filter(f=>f.g.userData.finStyle==='flowing').length},foodScreen:foods.map(f=>{const p=f.mesh.position.clone().project(camera);return {x:(p.x+1)*innerWidth*.5,y:(1-p.y)*innerHeight*.5,batch:f.batch};})});animate();
})();
