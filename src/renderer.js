import {mix, smooth, perspective, view, multiply, transform} from './math.js';
import {RIFLE_SKINS, BOT_SKINS, DEFAULT_SKINS, normalizeSkins, weaponPattern} from './skins.js';
const VS=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uVP; uniform vec3 uEye; uniform float uDust; uniform float uPointScale;
varying vec3 vColor; varying float vDepth; varying float vAlpha; varying float vGlow;
void main(){
  float sunlight=max(dot(aNormal,normalize(vec3(-0.5,0.85,0.35))),0.0);
  float sky=max(aNormal.y,0.0)*0.13;
  // RGB sums above 2.6 are emissive (glowing inlays, skin optics).
  float emissive=step(2.6,aColor.r+aColor.g+aColor.b);
  vColor=mix(aColor*(0.57+sunlight*0.48+sky),min(aColor,vec3(1.0)),emissive);vGlow=emissive;
  vDepth=length(aPosition-uEye);
  gl_Position=uVP*vec4(aPosition,1.0);
  vAlpha=1.0;gl_PointSize=1.0;
  if(uDust>1.5){vColor=aColor;vGlow=1.0;}
  else if(uDust>0.5){vColor=aColor;vGlow=1.0;vAlpha=aNormal.y;gl_PointSize=clamp(aNormal.x*uPointScale/max(0.01,gl_Position.w),1.0,18.0);}
}`;
const FS=`precision mediump float;
varying vec3 vColor; varying float vDepth; varying float vAlpha; varying float vGlow; uniform float uFog; uniform float uOpacity; uniform float uSlow;
void main(){float fog=1.0-exp(-vDepth*vDepth*0.00012*uFog);
 // Slow-motion kill moments: warm, desaturated grade (glow stays vivid).
 float lum=dot(vColor,vec3(0.299,0.587,0.114));vec3 graded=(vec3(lum)*vec3(1.1,0.98,0.8)-0.45)*1.15+0.45;
 vec3 c=mix(vColor,graded,uSlow*0.7*(1.0-vGlow*0.8));
 gl_FragColor=vec4(mix(c,vec3(0.54,0.64,0.64),min(fog,0.88)*(1.0-vGlow*0.5)),vAlpha*uOpacity);}`;
// Unit cube triangles, expanded once. Dynamic boxes write directly into a reused
// typed array, avoiding per-face position/normal arrays and Float32Array copies.
const CUBE=[];
for(const [normal,corners] of [
 [[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],
 [[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]],
 [[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
 [[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
 [[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],
 [[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]]
])for(const i of [0,1,2,0,2,3])CUBE.push(...corners[i],...normal);
// Orthonormal basis whose third column follows dir (row-major 3x3).
function basis(f){
  const up=Math.abs(f[1])>0.95?[1,0,0]:[0,1,0];
  let r=[up[1]*f[2]-up[2]*f[1],up[2]*f[0]-up[0]*f[2],up[0]*f[1]-up[1]*f[0]];const l=Math.hypot(...r)||1;r=r.map(v=>v/l);
  const u=[f[1]*r[2]-f[2]*r[1],f[2]*r[0]-f[0]*r[2],f[0]*r[1]-f[1]*r[0]];return {r,u};
}
export class Mesh {
  constructor(capacity=32768){this.data=new Float32Array(capacity);this.length=0;}
  clear(){this.length=0;return this;}
  reserve(count){if(this.length+count<=this.data.length)return;let size=this.data.length;while(size<this.length+count)size*=2;const next=new Float32Array(size);next.set(this.data);this.data=next;}
  vertex(p,n,c){this.reserve(9);const d=this.data;let i=this.length;d[i++]=p[0];d[i++]=p[1];d[i++]=p[2];d[i++]=n[0];d[i++]=n[1];d[i++]=n[2];d[i++]=c[0];d[i++]=c[1];d[i++]=c[2];this.length=i;}
  quad(a,b,c,d,n,color){this.vertex(a,n,color);this.vertex(b,n,color);this.vertex(c,n,color);this.vertex(a,n,color);this.vertex(c,n,color);this.vertex(d,n,color);}
  box(x,y,z,w,h,depth,color,angle=0){
    this.reserve(324);const sn=Math.sin(angle),cs=Math.cos(angle),data=this.data;let j=this.length;
    for(let i=0;i<CUBE.length;i+=6){
      const a=CUBE[i]*w/2,b=CUBE[i+1]*h/2,c=CUBE[i+2]*depth/2,nx=CUBE[i+3],ny=CUBE[i+4],nz=CUBE[i+5];
      data[j++]=x+a*cs+c*sn;data[j++]=y+b;data[j++]=z-a*sn+c*cs;
      data[j++]=nx*cs+nz*sn;data[j++]=ny;data[j++]=-nx*sn+nz*cs;
      data[j++]=color[0];data[j++]=color[1];data[j++]=color[2];
    }
    this.length=j;
  }
  cylinder(x,y,z,r,length,color,segments=12){
    // Along Z; used for the barrel, optic housing and muzzle.
    for(let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const pa=[x+Math.cos(a)*r,y+Math.sin(a)*r],pb=[x+Math.cos(b)*r,y+Math.sin(b)*r];
      this.quad([...pa,z-length/2],[...pb,z-length/2],[...pb,z+length/2],[...pa,z+length/2],[Math.cos((a+b)/2),Math.sin((a+b)/2),0],color);
      for(const [end,n] of [[z-length/2,-1],[z+length/2,1]]) {
        for(const p of [[x,y,end],[...pa,end],[...pb,end]])this.vertex(p,[0,0,n],color);
      }
    }
  }
  // Air ripple perpendicular to a bullet path (adapted from Bullet-Time).
  ring(center,dir,radius,width,color,segments=14){
    const {r,u}=basis(dir);
    const p=(angle,rad)=>[0,1,2].map(k=>center[k]+(r[k]*Math.cos(angle)+u[k]*Math.sin(angle))*rad);
    for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;this.quad(p(a,radius-width),p(b,radius-width),p(b,radius+width),p(a,radius+width),[0,1,0],color);}
  }
  line(a,b,width,color){
    // Camera-independent crossed ribbons for short-lived bullet tracers.
    for(const offset of [[width,0,0],[0,width,0]]) {
      const p=(v,s)=>v.map((n,i)=>n+offset[i]*s);
      this.quad(p(a,-1),p(b,-1),p(b,1),p(a,1),[0,1,0],color);
    }
  }
}
function shader(gl,type,source){
  const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(`Shader compilation failed: ${log}`);}return s;
}
export class Renderer {
  constructor(canvas,world){
    this.canvas=canvas;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:false})||canvas.getContext('webgl',{antialias:true,alpha:false});
    if(!gl)throw new Error('WebGL is unavailable. Enable hardware acceleration or try a desktop browser with WebGL support.');
    this.gl=gl;
    // WebGL 1 GLSL also works in a WebGL 2 context when no version directive is used.
    const vs=shader(gl,gl.VERTEX_SHADER,VS),fs=shader(gl,gl.FRAGMENT_SHADER,FS),program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);this.program=program;
    this.attributes=['aPosition','aNormal','aColor'].map(n=>gl.getAttribLocation(program,n));
    this.vp=gl.getUniformLocation(program,'uVP');this.eye=gl.getUniformLocation(program,'uEye');this.fog=gl.getUniformLocation(program,'uFog');
    this.dust=gl.getUniformLocation(program,'uDust');this.pointScale=gl.getUniformLocation(program,'uPointScale');
    this.opacity=gl.getUniformLocation(program,'uOpacity');this.slow=gl.getUniformLocation(program,'uSlow');this.skins={...DEFAULT_SKINS};
    this.dynamicMesh=new Mesh(65536);this.glowMesh=new Mesh(16384);this.weaponMesh=new Mesh();this.dustMesh=new Mesh(4096);
    const mesh=new Mesh();
    for(const b of world.geometry)mesh.box(b.x,b.y,b.z,b.w,b.h,b.d,b.color);
    for(const b of world.solids)if(b.h<5){
      mesh.box(b.x+0.65,0.022,b.z-0.45,b.w+0.8,0.012,b.d+0.8,[0.17,0.21,0.21]);
    }
    this.staticBuffer=gl.createBuffer();this.staticCount=mesh.length/9;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.data.subarray(0,mesh.length),gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.width=0;this.height=0;this.lastVP=null;
  }
  setSkins(skins){this.skins=normalizeSkins(skins);}
  resize(quality=1){
    const c=this.canvas,dpr=Math.min(devicePixelRatio||1,quality===0?1:1.6);
    const w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);
    if(c.width!==w||c.height!==h){c.width=w;c.height=h;this.gl.viewport(0,0,w,h);}
    this.width=w;this.height=h;
  }
  bind(buffer){
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    this.attributes.forEach((a,i)=>{gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12);});
  }
  drawMesh(mesh,points=false){
    if(!mesh.length)return;
    const gl=this.gl;mesh.buffer??=gl.createBuffer();this.bind(mesh.buffer);
    if(!mesh.gpuCapacity||mesh.gpuCapacity<mesh.data.byteLength){mesh.gpuCapacity=mesh.data.byteLength;gl.bufferData(gl.ARRAY_BUFFER,mesh.gpuCapacity,gl.DYNAMIC_DRAW);}
    gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.data.subarray(0,mesh.length));gl.drawArrays(points?gl.POINTS:gl.TRIANGLES,0,mesh.length/9);
  }
  render(game,effects,{menu=false,time=0,quality=1,reduced=false,slow=0}={}){
    this.resize(quality);const gl=this.gl,p=game.player,w=game.weapon;
    let eye,yaw,pitch,fov;
    if(menu){
      const angle=0.66+Math.sin(time*0.045)*0.17;
      eye=[Math.sin(angle)*35,19,Math.cos(angle)*35-6];yaw=-angle;pitch=-0.45;fov=56;
    }else{
      const bob=game.moving&&p.grounded&&!reduced?Math.sin(game.time*(game.sprinting?15:11))*0.025*(1-w.ads):0;
      eye=[p.x,p.y+(p.crouch?1.08:1.68)+bob,p.z];yaw=p.yaw;pitch=p.pitch+(reduced?0:w.recoil*0.018);
      fov=mix(82+(game.sprinting?4:0),27,smooth(w.ads));
    }
    gl.clearColor(0.54,0.64,0.64,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const vp=multiply(perspective(fov*Math.PI/180,this.width/this.height),view(eye,yaw,pitch));this.lastVP=vp;
    gl.uniformMatrix4fv(this.vp,false,vp);gl.uniform3fv(this.eye,eye);gl.uniform1f(this.fog,1);gl.uniform1f(this.dust,0);gl.uniform1f(this.opacity,1);gl.uniform1f(this.slow,menu?0:slow);
    this.bind(this.staticBuffer);gl.drawArrays(gl.TRIANGLES,0,this.staticCount);
    const dynamic=this.dynamicMesh.clear();
    for(const b of game.bots)if(b.alive)this.bot(dynamic,b,game.time);
    this.drawMesh(dynamic);
    // Additive glow: tracers and slow-motion air ripples.
    const glow=this.glowMesh.clear();
    for(const t of effects.tracers){const k=Math.min(1,t.life/0.05);glow.line(t.origin,t.point,t.enemy?0.014:0.006,t.enemy?[1*k,0.35*k,0.16*k]:[1*k,0.9*k,0.6*k]);}
    for(const r of effects.rings||[]){const k=Math.max(0,r.life/r.max);glow.ring(r.pos,r.dir,r.radius,0.006+r.radius*0.05,[0.4*k,0.38*k,0.3*k]);}
    if(glow.length){
      gl.uniform1f(this.dust,2);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
      this.drawMesh(glow);gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(this.dust,0);
    }
    if(effects.particles.length){
      const dust=this.dustMesh.clear();
      for(const p of effects.particles)dust.vertex([p.x,p.y,p.z],[p.size,Math.min(1,p.life*2.5),0],p.color);
      gl.uniform1f(this.dust,1);gl.uniform1f(this.pointScale,this.height/(2*Math.tan(fov*Math.PI/360)));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);this.drawMesh(dust,true);
      gl.depthMask(true);gl.disable(gl.BLEND);gl.uniform1f(this.dust,0);
    }
    if(!menu&&w.ads<0.7){
      gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.vp,false,perspective(64*Math.PI/180,this.width/this.height));
      gl.uniform3fv(this.eye,[0,0,0]);gl.uniform1f(this.fog,0);
      gl.uniform1f(this.opacity,Math.max(0,1-smooth(w.ads/0.7)));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      this.drawMesh(this.weapon(game,reduced));gl.disable(gl.BLEND);
    }
  }
  bot(mesh,b,time){
    const skin=BOT_SKINS[this.skins.bots]||BOT_SKINS.training,flash=b.flash>0,body=flash?[0.95,0.98,0.82]:skin.roles[b.role||0]||skin.roles[0],metal=skin.metal,sand=skin.sand;
    const sn=Math.sin(b.yaw),cs=Math.cos(b.yaw);
    const box=(x,y,z,w,h,d,c)=>mesh.box(b.x+x*cs+z*sn,b.y+y,b.z-x*sn+z*cs,w,h,d,c,b.yaw);
    mesh.box(b.x,0.035,b.z,1.05,0.025,0.8,[0.14,0.18,0.18]);
    const gait=Math.sin(b.phase*9)*0.1;
    box(-0.22,0.36,gait,0.27,0.7,0.38,metal);box(0.22,0.36,-gait,0.27,0.7,0.38,metal);
    box(-0.22,0.08,gait-0.08,0.32,0.16,0.5,sand);box(0.22,0.08,-gait-0.08,0.32,0.16,0.5,sand);
    box(0,1.19,0,0.76,0.96,0.52,body);box(0,1.3,-0.285,0.58,0.44,0.08,sand);
    box(0,1.32,-0.34,0.25,0.08,0.035,skin.stripe);this.botDetail(box,skin,body);
    box(-0.49,1.17,0,0.23,0.7,0.35,body);box(0.49,1.17,-0.18,0.23,0.7,0.35,body);
    box(0,1.93,0,0.52,0.5,0.52,body);box(0,2.2,0.02,0.58,0.08,0.59,metal);
    box(0,1.96,-0.275,0.45,0.12,0.045,b.charge>0?[1.6,0.3,0.1]:skin.visor);
    // Weapon at the right hand, visibly outside the torso.
    box(0.49,1.12,-0.51,0.16,0.2,0.72,metal);
    if(b.charge>0){
      const size=0.07+b.charge*0.06;box(0.49,1.16,-0.9,size,size,0.04,[1,0.35,0.1]);
      mesh.box(b.x,b.y+2.48,b.z,0.8*b.charge/1.15,0.055,0.055,[1,0.35,0.1]);
    }
  }
  botDetail(box,skin,body){
    if(skin.detail==='plates'){for(const y of [0.9,1.05,1.55])box(0,y,-0.268,0.7,0.05,0.02,skin.metal);box(0,2.26,0.02,0.36,0.03,0.36,skin.visor);}
    else if(skin.detail==='armor'){box(-0.49,1.52,0,0.32,0.16,0.42,skin.metal);box(0.49,1.52,-0.18,0.32,0.16,0.42,skin.metal);box(-0.22,0.46,-0.2,0.24,0.16,0.05,skin.metal);box(0.22,0.46,-0.2,0.24,0.16,0.05,skin.metal);box(0,2.14,0.02,0.6,0.2,0.6,skin.metal);}
    else if(skin.detail==='chevrons'){for(let i=0;i<4;i++){const x=-0.27+i*0.18;box(x,0.86,-0.268,0.08,0.18,0.02,skin.stripe);}box(0,1.6,-0.268,0.7,0.06,0.02,skin.stripe);}
  }
  weapon(game,reduced){
    const mesh=this.weaponMesh.clear(),w=game.weapon;
    const walk=game.moving&&!reduced?Math.sin(game.time*11)*0.014:0;
    const reload=w.reload>0?Math.sin((1-w.reload/1.85)*Math.PI):0;
    const x=mix(0.29,0,smooth(w.ads)),y=-0.26-walk-reload*0.35-w.ads*0.025,z=-0.55+w.recoil*0.1;
    const finish=RIFLE_SKINS[this.skins.rifle]||RIFLE_SKINS.yard,{metal,edge,stock}=finish,stripe=finish.accent;
    const box=(a,b,c,d,e,f,color)=>mesh.box(x+a,y+b,z+c,d,e,f,color);
    const panel=(a,b,c,d,e,f,color)=>{box(a,b,c,d,e,f,color);weaponPattern(finish.pattern,[a,b,c,d,e,f],finish.accent,box);};
    const tube=(a,b,c,r,l,color)=>mesh.cylinder(x+a,y+b,z+c,r,l,color);
    panel(0,-0.025,0.24,0.14,0.14,0.43,stock);box(0,-0.04,0.43,0.16,0.18,0.08,metal);
    panel(0,0,0,0.13,0.11,0.4,metal);panel(0,-0.035,-0.21,0.11,0.095,0.26,stock);
    tube(0,0.025,-0.53,0.025,0.61,metal);tube(0,0.025,-0.83,0.034,0.1,edge);
    box(0,-0.14,0.14,0.075,0.19,0.09,stock);box(0,-0.15,-0.04,0.07,0.18,0.11,metal);
    box(0,0.08,-0.02,0.065,0.045,0.27,edge);box(0,0.12,0.06,0.06,0.09,0.045,metal);box(0,0.12,-0.17,0.06,0.09,0.045,metal);
    tube(0,0.17,-0.07,0.048,0.36,metal);tube(0,0.17,0.135,0.065,0.12,edge);tube(0,0.17,0.197,0.053,0.006,finish.lens);
    tube(0,0.17,-0.27,0.062,0.09,edge);box(0,0.23,-0.075,0.04,0.03,0.045,metal);
    const bolt=w.bolt>0?Math.sin((1-w.bolt/0.82)*Math.PI)*0.13:0;
    box(0.105,0.015,0.07+bolt,0.12,0.025,0.025,edge);box(0.16,0.005,0.07+bolt,0.04,0.05,0.045,metal);
    box(0,-0.036,-0.28,0.115,0.1,0.045,stripe);
    // Gloves and sleeves.
    box(0.055,-0.15,0.18,0.105,0.11,0.13,[0.23,0.29,0.23]);box(0.12,-0.27,0.35,0.16,0.19,0.38,[0.32,0.38,0.30]);
    box(-0.06,-0.1,-0.2,0.11,0.1,0.15,[0.23,0.29,0.23]);box(-0.15,-0.22,-0.09,0.14,0.14,0.3,[0.32,0.38,0.30]);
    if(w.recoil>0.72&&!reduced){box(0,0.025,-0.97,0.09*w.recoil,0.09*w.recoil,0.2,[1,0.83,0.39]);}
    return mesh;
  }
  project(point){
    if(!this.lastVP)return null;const p=transform(this.lastVP,point);
    if(p[3]<=0)return null;return [(p[0]/p[3]*0.5+0.5)*this.canvas.clientWidth,(-p[1]/p[3]*0.5+0.5)*this.canvas.clientHeight];
  }
}
