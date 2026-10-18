/* Stillwater — buildless, offline, procedural Three.js aquarium. */
(() => {
'use strict';
const $ = s => document.querySelector(s), T = window.THREE;
if (!T) { $('#loading p').textContent = 'Three.js 加载失败，请检查 vendor 文件夹'; return; }
let renderer;
try { renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'}); }
catch(e) { $('#loading p').textContent='当前浏览器无法启用 WebGL，请开启硬件加速后重试'; return; }
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
let elapsed=0,paused=false,flow=.8,visibleCount=32,feeding=false,theme='day',quality='auto',pixelScale=Math.min(devicePixelRatio,maxDpr),audioCtx=null,audioGain=null;
const v1=new T.Vector3(),v2=new T.Vector3(),targetQ=new T.Quaternion(),rollQ=new T.Quaternion(), forward=new T.Vector3(1,0,0);
const state={yaw:0,pitch:0,zoom:26};
// The seabed is a single displaced mesh. Its caustics and grain are analytical shaders.
const sandGeo=new T.PlaneGeometry(90,70,100,70);sandGeo.rotateX(-Math.PI/2);
const sp=sandGeo.attributes.position;for(let i=0;i<sp.count;i++){let x=sp.getX(i),z=sp.getZ(i);sp.setY(i,-4.7+.13*Math.sin(x*.6+z*.25)+.17*Math.cos(z*.4)+.1*Math.sin(x*1.8+z*.7));}sandGeo.computeVertexNormals();
const sandMat=new T.MeshStandardMaterial({color:'#b3b49a',roughness:.94});
sandMat.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='varying vec3 vWorld;\n'+s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWorld=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='uniform float uTime; varying vec3 vWorld;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
vec2 p=vWorld.xz; float grain=fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
float a=sin(p.x*1.7+sin(p.y*1.9+uTime*.24)*1.5+uTime*.2);
float b=sin(p.y*2.1+sin(p.x*1.3-uTime*.2)*1.4);
float caustic=pow(1.-abs((a+b)*.5),18.);
float ripples=sin(p.x*.8+p.y*7.+sin(p.x*.5)*2.);
diffuseColor.rgb*=.87+grain*.13+ripples*.035;diffuseColor.rgb+=vec3(.18,.28,.20)*caustic;`);};
scene.add(new T.Mesh(sandGeo,sandMat));
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
// Hand-drawn procedural skins: overlapping scales, lateral shimmer, stripes.
function skin(kind){let c=document.createElement('canvas');c.width=512;c.height=256;let g=c.getContext('2d');let palettes=[['#bc4b0e','#ffb72e','#ffe4a0'],['#125b83','#56cbd1','#b5e7d4'],['#87783e','#e6deb3','#fff3d2'],['#0c5771','#38b6c1','#d1edce']];let p=palettes[kind],gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,p[0]);gr.addColorStop(.43,p[1]);gr.addColorStop(1,p[2]);g.fillStyle=gr;g.fillRect(0,0,512,256);
for(let row=0;row<20;row++)for(let col=0;col<38;col++){let x=col*15+(row%2)*7.5,y=row*13;g.strokeStyle='rgba(18,64,66,.19)';g.lineWidth=.8;g.beginPath();g.arc(x,y,7,-.2,Math.PI+.2);g.stroke();g.strokeStyle='rgba(255,255,225,.25)';g.beginPath();g.arc(x,y+1,6,.1,Math.PI-.1);g.stroke();}
if(kind===1||kind===2){for(let i=0;i<(kind===2?5:3);i++){g.fillStyle=kind===2?'rgba(26,47,44,.76)':'rgba(15,72,94,.6)';g.fillRect(45+i*(kind===2?100:155),0,kind===2?30:22,256);}}
if(kind===3){g.fillStyle='#83f2e3';g.fillRect(0,114,512,15);g.fillStyle='#ce5c38';g.fillRect(0,139,512,35);}
const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;}
const bodyMats=[0,1,2,3].map(k=>new T.MeshStandardMaterial({map:skin(k),roughness:.34,metalness:k===3?.25:.08}));
for(const material of bodyMats){material.onBeforeCompile=s=>{s.uniforms.uTime=time;s.vertexShader='uniform float uTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
float bend=pow(clamp(-position.x,0.,1.),1.5);transformed.z+=sin(uTime*4.8+position.x*3.+modelMatrix[3].x*.4)*bend*.075;`);};}
const bodyGeo=new T.SphereGeometry(1,32,20);const bp=bodyGeo.attributes.position;for(let i=0;i<bp.count;i++){const x=bp.getX(i),taper=x<0?1.+x*.22:1.;bp.setY(i,bp.getY(i)*taper);bp.setZ(i,bp.getZ(i)*taper);}bodyGeo.computeVertexNormals();
const eyeGeo=new T.SphereGeometry(1,12,10),eyeMat=new T.MeshStandardMaterial({color:'#eddfad',roughness:.25,metalness:.3}),pupilMat=new T.MeshStandardMaterial({color:'#061c22',roughness:.12}),shineMat=new T.MeshBasicMaterial({color:'#ecffff'});
const finColors=['#ffc057','#50bbc9','#e2cc98','#4ed2ce'];
const finMaterials=new Map(),ribMaterials=new Map();
function finMaterial(color){if(!finMaterials.has(color))finMaterials.set(color,new T.MeshStandardMaterial({color,transparent:true,opacity:.73,side:T.DoubleSide,roughness:.5,depthWrite:false}));return finMaterials.get(color);}
function ribMaterial(color){if(!ribMaterials.has(color))ribMaterials.set(color,new T.LineBasicMaterial({color,transparent:true,opacity:.4}));return ribMaterials.get(color);}
// Fins are translucent fans with individually modelled ribs, rather than flat triangles.
function fin(points,color){let verts=[...points[0]],inds=[],ribs=[];const center=points[0];for(let i=1;i<points.length;i++)verts.push(...points[i]);for(let i=1;i<points.length-1;i++)inds.push(0,i,i+1);
let geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();let group=new T.Group();group.add(new T.Mesh(geo,finMaterial(color)));
for(let i=1;i<points.length;i++)ribs.push(...center,...points[i]);let rg=new T.BufferGeometry();rg.setAttribute('position',new T.Float32BufferAttribute(ribs,3));group.add(new T.LineSegments(rg,ribMaterial(color)));return group;}
// Merge stationary details within a fish while keeping its moving fins separate.
function mergeDetails(group,animated){group.updateMatrixWorld(true);const buckets=new Map();group.traverse(o=>{if(!o.isMesh&&!o.isLineSegments)return;let parent=o;while(parent&&parent!==group){if(animated.includes(parent))return;parent=parent.parent;}const key=o.material.uuid+(o.isLineSegments?'line':'mesh');if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);});
for(const list of buckets.values()){if(list.length<2)continue;const first=list[0],attributes=['position','normal','uv'].filter(a=>list.every(o=>o.geometry.getAttribute(a)));const arrays={};for(const a of attributes)arrays[a]=[];
for(const o of list){let geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);for(const a of attributes)arrays[a].push(...geo.getAttribute(a).array);geo.dispose();o.parent.remove(o);}const geo=new T.BufferGeometry();for(const a of attributes)geo.setAttribute(a,new T.Float32BufferAttribute(arrays[a],a==='uv'?2:3));group.add(first.isLineSegments?new T.LineSegments(geo,first.material):new T.Mesh(geo,first.material));}}
function makeFish(i){let kind=i<7?0:i<14?1:i<20?2:3;let g=new T.Group(),size=kind===3?range(.32,.46):kind===2?range(.65,.9):range(.63,1.04),depth=kind===2?.21:.3,h=kind===2?.94:kind===0?.53:.57;
let body=new T.Mesh(bodyGeo,bodyMats[kind]);body.scale.set(1,h,depth);g.add(body);
const tail=fin([[-.82,0,0],[-1.12,.15,0],[-1.8,.65,.025],[-1.66,.28,.01],[-1.55,0,0],[-1.66,-.28,.01],[-1.8,-.65,.025],[-1.12,-.15,0]],finColors[kind]);tail.children.forEach(o=>o.geometry.translate(.82,0,0));tail.position.x=-.82;g.add(tail);
let dorsal=fin([[.55,h*.65,0],[.3,h*1.55,0],[-.12,h*(kind===2?1.9:1.65),0],[-.6,h*1.3,0],[-.84,h*.25,0]],finColors[kind]);g.add(dorsal);
let ventral=fin([[.2,-h*.7,0],[-.2,-h*(kind===2?1.7:1.3),0],[-.75,-h*1.1,0],[-.8,-h*.25,0]],finColors[kind]);g.add(ventral);
let fins=[];for(let side of [-1,1]){let p=fin([[.25,-.08,0],[-.05,-.43,side*.53],[-.48,-.3,side*.62],[-.25,-.03,side*.1]],finColors[kind]);p.position.z=side*depth*.7;g.add(p);fins.push(p);
let eye=new T.Mesh(eyeGeo,eyeMat);eye.position.set(.66,h*.22,side*depth*.83);eye.scale.set(.12,.125,.045);g.add(eye);let pupil=new T.Mesh(eyeGeo,pupilMat);pupil.position.copy(eye.position);pupil.position.x+=.025;pupil.position.z+=side*.037;pupil.scale.set(.069,.083,.023);g.add(pupil);let shine=new T.Mesh(eyeGeo,shineMat);shine.position.copy(pupil.position);shine.position.add(new T.Vector3(.012,.03,side*.019));shine.scale.setScalar(.021);g.add(shine);}
if(kind===2){for(let side of [-1,1]){const curve=new T.CatmullRomCurve3([new T.Vector3(.27,-.6,side*.1),new T.Vector3(.13,-1.3,side*.15),new T.Vector3(-.25,-1.85,side*.18)]);g.add(new T.Mesh(new T.TubeGeometry(curve,10,.014,4,false),eyeMat));}}
// Gill line and a tiny pursed mouth.
let linePoints=[];for(let s of [-1,1])for(let j=0;j<13;j++){let a=-1.15+j/12*2.3;linePoints.push(new T.Vector3(.43-.13*Math.cos(a),Math.sin(a)*h*.72,s*depth*.95));}let lg=new T.BufferGeometry().setFromPoints(linePoints);g.add(new T.Line(lg,new T.LineBasicMaterial({color:kind===0?'#bf782b':'#316b6d',transparent:true,opacity:.5})));
mergeDetails(g,[tail,...fins]);g.scale.setScalar(size);g.position.set(range(-14,14),range(-2.7,4.4),range(-7,6));scene.add(g);
let phase=range(0,Math.PI*2),direction=random()>.5?1:-1;let f={g,kind,size,tail,fins,phase,velocity:new T.Vector3(direction*range(.4,.8),0,0),baseY:g.position.y,baseZ:g.position.z,turn:0};g.quaternion.setFromUnitVectors(forward,f.velocity.clone().normalize());fish.push(f);}
for(let i=0;i<52;i++)makeFish(i);
function setCount(n){visibleCount=n;fish.forEach((f,i)=>f.g.visible=i<n);$('#fish-count').textContent=n;$('#population-value').textContent=n;}
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
const foodGeo=new T.SphereGeometry(.045,6,5),foodMat=new T.MeshStandardMaterial({color:'#e6b873',roughness:1});
function addFood(point){if(foods.length>65)return;for(let i=0;i<12;i++){let m=new T.Mesh(foodGeo,foodMat);m.position.copy(point);m.position.add(new T.Vector3(range(-.7,.7),range(-.2,.2),range(-.4,.4)));scene.add(m);foods.push({mesh:m,life:0,speed:range(.15,.28)});}toast('开饭啦，等它们慢慢游过来');}
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function setTheme(value){theme=value;let themes={day:{bg:'#073542',sky:0xb8f2e5,sun:0xffefd1,power:3.4,exposure:1.2,ray:'#82cabc',name:'日光浅湾'},night:{bg:'#07172e',sky:0x527fc4,sun:0x9cbcff,power:1.1,exposure:.95,ray:'#557dcc',name:'蓝色夜曲'},sunset:{bg:'#233f43',sky:0xa6c3b4,sun:0xffbd78,power:3.2,exposure:1.25,ray:'#edba7d',name:'落日余温'}};let p=themes[value];themeTarget=p;$('#scene-name').textContent=p.name;document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('selected',b.dataset.theme===value));}
let themeTarget=null;const colorTemp=new T.Color();setTheme('day');
function setPaused(){paused=!paused;$('#pause').setAttribute('aria-pressed',paused);$('#pause').setAttribute('aria-label',paused?'继续动画':'暂停动画');$('#pause span').textContent=paused?'继续':'暂停';$('#pause svg').innerHTML=paused?'<path d="m8 4 12 8-12 8z"/>':'<path d="M8 5v14M16 5v14"/>';}
$('#pause').onclick=setPaused;
$('#feed').onclick=()=>{feeding=!feeding;document.body.classList.toggle('feeding',feeding);$('#feed').setAttribute('aria-pressed',feeding);if(feeding)addFood(new T.Vector3(0,3.5,3));};
function panelOpen(open){$('#panel').hidden=!open;$('#settings').setAttribute('aria-expanded',open);}
$('#settings').onclick=()=>panelOpen($('#panel').hidden);$('#close-panel').onclick=()=>panelOpen(false);
document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>setTheme(b.dataset.theme));
$('#population').oninput=e=>setCount(+e.target.value);$('#speed').oninput=e=>{flow=+e.target.value;$('#speed-value').textContent=flow<.7?'悠慢':flow>1.1?'轻快':'舒缓';};
$('#quality').onchange=e=>{quality=e.target.value;pixelScale=quality==='low'?1:Math.min(devicePixelRatio,quality==='high'?2:maxDpr);renderer.setPixelRatio(pixelScale);};
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){toast('当前浏览器不支持全屏，可使用浏览器全屏功能');}}
$('#fullscreen').onclick=fullscreen;
// Synthesised, softly filtered water ambience. No media downloads or autoplay.
$('#sound').onclick=async()=>{try{if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();let len=audioCtx.sampleRate*5,buffer=audioCtx.createBuffer(2,len,audioCtx.sampleRate);for(let c=0;c<2;c++){let a=buffer.getChannelData(c),last=0;for(let i=0;i<len;i++){last=(last+.018*(Math.random()*2-1))/1.018;a[i]=last*5;}}let source=audioCtx.createBufferSource();source.buffer=buffer;source.loop=true;let filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;audioGain=audioCtx.createGain();audioGain.gain.value=.0;source.connect(filter).connect(audioGain).connect(audioCtx.destination);source.start();}await audioCtx.resume();let on=$('#sound').getAttribute('aria-pressed')!=='true';audioGain.gain.setTargetAtTime(on?.3:0,audioCtx.currentTime,.7);$('#sound').setAttribute('aria-pressed',on);$('#sound').setAttribute('aria-label',on?'关闭环境音':'开启环境音');}catch(e){toast('当前浏览器无法开启环境音');}};
let down=null,lastPointer=null;const raycaster=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,0,1),-3);
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,moved:false};lastPointer={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;let dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;if(down.moved){state.yaw=T.MathUtils.clamp(state.yaw-dx*.002,-.32,.32);state.pitch=T.MathUtils.clamp(state.pitch+dy*.0015,-.12,.2);}lastPointer={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{if(down&&!down.moved&&feeding){raycaster.setFromCamera(new T.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);let hit=new T.Vector3();if(raycaster.ray.intersectPlane(plane,hit)){hit.x=T.MathUtils.clamp(hit.x,-13,13);hit.y=T.MathUtils.clamp(hit.y,-2,7);addFood(hit);}}down=null;});
renderer.domElement.addEventListener('pointercancel',()=>down=null);
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();state.zoom=T.MathUtils.clamp(state.zoom+e.deltaY*.009,18,34);},{passive:false});
window.addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();setPaused();}if(e.key.toLowerCase()==='h'){document.body.classList.toggle('hidden-ui');if(document.body.classList.contains('hidden-ui'))toast('按 H 恢复界面');}if(e.key.toLowerCase()==='f')fullscreen();if(e.key==='Escape'){panelOpen(false);feeding=false;document.body.classList.remove('feeding');$('#feed').setAttribute('aria-pressed','false');}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
let tabActive=true;document.addEventListener('visibilitychange',()=>{tabActive=!document.hidden;clock.getDelta();if(audioCtx&&audioGain){const on=$('#sound').getAttribute('aria-pressed')==='true';audioGain.gain.setTargetAtTime(tabActive&&on?.3:0,audioCtx.currentTime,.4);}});
function updateFish(dt,t){for(let i=0;i<visibleCount;i++){let f=fish[i],p=f.g.position,vel=f.velocity;let vx=0,vy=0,vz=0;
let nearest=null,nd=100;for(let food of foods){let d=p.distanceToSquared(food.mesh.position);if(d<nd){nd=d;nearest=food;}}
if(nearest){v1.copy(nearest.mesh.position).sub(p);if(nd<.18){scene.remove(nearest.mesh);foods.splice(foods.indexOf(nearest),1);}v1.normalize().multiplyScalar(1.35);vx=v1.x;vy=v1.y;vz=v1.z;}
else {let dir=Math.sign(vel.x)||1;vx=dir*(f.kind===3?.85:.62);vy=(f.baseY+Math.sin(t*.22+f.phase)*.8-p.y)*.22;vz=(f.baseZ+Math.sin(t*.13+f.phase)*1.4-p.z)*.16;
if(p.x>13)vx=-1.1;if(p.x< -13)vx=1.1;
// A gentle coherent current keeps small tetras together without rigid paths.
if(f.kind===3){let tx=Math.sin(t*.095)*8,ty=.5+Math.sin(t*.16)*1.4,tz=-2+Math.cos(t*.11)*2;vx+=(tx-p.x)*.035;vy+=(ty-p.y)*.045;vz+=(tz-p.z)*.04;}}
for(let j=0;j<visibleCount;j++){if(i===j)continue;let other=fish[j].g.position,d=p.distanceToSquared(other);if(d<1.3&&d>.001){let k=(1.3-d)*.35/d;vx+=(p.x-other.x)*k;vy+=(p.y-other.y)*k;vz+=(p.z-other.z)*k;}}
if(p.y< -3)vy+=(-3-p.y)*.9;if(p.y>6)vy-=(p.y-6)*.8;
v1.set(vx,vy,vz).clampLength(.05,1.8);vel.lerp(v1,1-Math.exp(-dt*.9));p.addScaledVector(vel,dt);if(p.x>17)p.x=17;if(p.x< -17)p.x=-17;
let beat=t*(3.5+vel.length()*2.6)+f.phase;v2.copy(vel).normalize();targetQ.setFromUnitVectors(forward,v2);targetQ.multiply(rollQ.setFromAxisAngle(forward,Math.sin(beat*.5)*.055));f.g.quaternion.slerp(targetQ,1-Math.exp(-dt*3));f.tail.rotation.y=Math.sin(beat)*.25;f.tail.rotation.z=Math.sin(beat*.5)*.025;f.fins.forEach((fin,k)=>fin.rotation.x=Math.sin(beat*.7+k)*.23);}}
let frameCount=0,frameTime=0,perfFrames=0,perfTime=0,first=true;
function animate(){requestAnimationFrame(animate);let rawDt=Math.min(clock.getDelta(),.05);if(!tabActive)return;let dt=paused?0:rawDt*flow;elapsed+=dt;time.value=elapsed;
if(themeTarget){let a=1-Math.exp(-rawDt*2);scene.background.lerp(colorTemp.set(themeTarget.bg),a);scene.fog.color.copy(scene.background);ambient.color.lerp(colorTemp.set(themeTarget.sky),a);sun.color.lerp(colorTemp.set(themeTarget.sun),a);sun.intensity=T.MathUtils.lerp(sun.intensity,themeTarget.power,a);renderer.toneMappingExposure=T.MathUtils.lerp(renderer.toneMappingExposure,themeTarget.exposure,a);rayMat.uniforms.uColor.value.lerp(colorTemp.set(themeTarget.ray),a);}
if(dt){updateFish(dt,elapsed);dust.rotation.y=elapsed*.003;for(let i=0;i<bubbles.length;i++){let b=bubbles[i];b.y+=dt*b.speed;if(b.y>10)b.y=-4.5;bubArray[i*3]=b.x+Math.sin(elapsed*.7+b.phase)*.16;bubArray[i*3+1]=b.y;bubArray[i*3+2]=b.z+Math.cos(elapsed*.5+b.phase)*.12;}bubGeo.attributes.position.needsUpdate=true;
for(let i=foods.length-1;i>=0;i--){let f=foods[i];f.life+=dt;f.mesh.position.y-=f.speed*dt;f.mesh.position.x+=Math.sin(elapsed+f.life)*dt*.025;if(f.life>24||f.mesh.position.y< -4.4){scene.remove(f.mesh);foods.splice(i,1);}}}
let framing=innerWidth<800?1.26:1;let camX=Math.sin(state.yaw)*state.zoom,camY=2.5+state.pitch*22,camZ=Math.cos(state.yaw)*state.zoom*framing;camera.position.lerp(v1.set(camX,camY,camZ),1-Math.exp(-rawDt*3));camera.lookAt(0,.25,0);renderer.render(scene,camera);
if(first){first=false;$('#loading').style.opacity=0;setTimeout(()=>$('#loading').remove(),1100);}
// Lower resolution after sustained slow frames; no oscillating quality loop.
perfFrames++;perfTime+=rawDt;if(perfTime>5){if(quality==='auto'&&perfFrames/perfTime<38&&pixelScale>1){pixelScale=Math.max(1,pixelScale-.2);renderer.setPixelRatio(pixelScale);}perfFrames=0;perfTime=0;}
frameCount++;frameTime+=rawDt;if(frameTime>=1){window.aquariumStats={fps:Math.round(frameCount/frameTime),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fish:visibleCount,pixelRatio:renderer.getPixelRatio(),paused,theme,food:foods.length};frameCount=0;frameTime=0;}}
function updateClock(){$('#clock').textContent=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});}updateClock();setInterval(updateClock,10000);animate();
})();
