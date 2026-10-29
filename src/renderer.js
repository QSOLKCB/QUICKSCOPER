import {clamp, mix, smooth, perspective, view, multiply, transform} from './math.js';
const VS=`attribute vec3 aPosition; attribute vec3 aNormal; attribute vec3 aColor;
uniform mat4 uVP; uniform vec3 uEye;
varying vec3 vColor; varying float vDepth;
void main(){
  float sunlight=max(dot(aNormal,normalize(vec3(-0.5,0.85,0.35))),0.0);
  float sky=max(aNormal.y,0.0)*0.13;
  vColor=aColor*(0.57+sunlight*0.48+sky);
  vDepth=length(aPosition-uEye);
  gl_Position=uVP*vec4(aPosition,1.0);
}`;
const FS=`precision mediump float;
varying vec3 vColor; varying float vDepth; uniform float uFog;
void main(){float fog=1.0-exp(-vDepth*vDepth*0.00012*uFog);
 gl_FragColor=vec4(mix(vColor,vec3(0.54,0.64,0.64),min(fog,0.88)),1.0);}`;
class Mesh {
  constructor(){this.data=[];}
  vertex(p,n,c){this.data.push(...p,...n,...c);}
  quad(a,b,c,d,n,color){for(const p of [a,b,c,a,c,d])this.vertex(p,n,color);}
  box(x,y,z,w,h,d,color,angle=0){
    const sn=Math.sin(angle),cs=Math.cos(angle);
    const pt=(a,b,c)=>[x+a*cs+c*sn,y+b,z-a*sn+c*cs];
    const norm=(a,b,c)=>[a*cs+c*sn,b,-a*sn+c*cs];
    const a=w/2,b=h/2,c=d/2;
    this.quad(pt(-a,b,c),pt(a,b,c),pt(a,b,-c),pt(-a,b,-c),norm(0,1,0),color);
    this.quad(pt(-a,-b,-c),pt(a,-b,-c),pt(a,-b,c),pt(-a,-b,c),norm(0,-1,0),color);
    this.quad(pt(-a,-b,c),pt(a,-b,c),pt(a,b,c),pt(-a,b,c),norm(0,0,1),color);
    this.quad(pt(a,-b,-c),pt(-a,-b,-c),pt(-a,b,-c),pt(a,b,-c),norm(0,0,-1),color);
    this.quad(pt(a,-b,c),pt(a,-b,-c),pt(a,b,-c),pt(a,b,c),norm(1,0,0),color);
    this.quad(pt(-a,-b,-c),pt(-a,-b,c),pt(-a,b,c),pt(-a,b,-c),norm(-1,0,0),color);
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
    const mesh=new Mesh();
    for(const b of world.geometry)mesh.box(b.x,b.y,b.z,b.w,b.h,b.d,b.color);
    for(const b of world.solids)if(b.h<5){
      mesh.box(b.x+0.65,0.022,b.z-0.45,b.w+0.8,0.012,b.d+0.8,[0.17,0.21,0.21]);
    }
    this.staticBuffer=gl.createBuffer();this.dynamicBuffer=gl.createBuffer();this.staticCount=mesh.data.length/9;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.width=0;this.height=0;this.lastVP=null;
  }
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
  drawMesh(mesh){
    if(!mesh.data.length)return;
    const gl=this.gl;this.bind(this.dynamicBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,mesh.data.length/9);
  }
  render(game,effects,{menu=false,time=0,quality=1,reduced=false}={}){
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
    gl.uniformMatrix4fv(this.vp,false,vp);gl.uniform3fv(this.eye,eye);gl.uniform1f(this.fog,1);
    this.bind(this.staticBuffer);gl.drawArrays(gl.TRIANGLES,0,this.staticCount);
    const dynamic=new Mesh();
    for(const b of game.bots)if(b.alive)this.bot(dynamic,b,game.time);
    for(const part of effects.particles){
      dynamic.box(part.x,part.y,part.z,part.size,part.size,part.size,part.color,part.life*5);
    }
    for(const t of effects.tracers)dynamic.line(t.origin,t.point,0.016,t.enemy?[1,0.35,0.16]:[1,0.91,0.62]);
    this.drawMesh(dynamic);
    if(!menu&&w.ads<0.94){
      gl.clear(gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.vp,false,perspective(64*Math.PI/180,this.width/this.height));
      gl.uniform3fv(this.eye,[0,0,0]);gl.uniform1f(this.fog,0);
      this.drawMesh(this.weapon(game,reduced));
    }
  }
  bot(mesh,b,time){
    const flash=b.flash>0,body=flash?[0.95,0.98,0.82]:[0.23,0.49,0.45],metal=[0.12,0.18,0.19],sand=[0.64,0.65,0.52];
    const sn=Math.sin(b.yaw),cs=Math.cos(b.yaw);
    const box=(x,y,z,w,h,d,c)=>mesh.box(b.x+x*cs+z*sn,b.y+y,b.z-x*sn+z*cs,w,h,d,c,b.yaw);
    mesh.box(b.x,0.035,b.z,1.05,0.025,0.8,[0.14,0.18,0.18]);
    const gait=Math.sin(b.phase*9)*0.1;
    box(-0.22,0.36,gait,0.27,0.7,0.38,metal);box(0.22,0.36,-gait,0.27,0.7,0.38,metal);
    box(-0.22,0.08,gait-0.08,0.32,0.16,0.5,sand);box(0.22,0.08,-gait-0.08,0.32,0.16,0.5,sand);
    box(0,1.19,0,0.76,0.96,0.52,body);box(0,1.3,-0.285,0.58,0.44,0.08,sand);
    box(0,1.32,-0.34,0.25,0.08,0.035,[0.89,0.87,0.42]);
    box(-0.49,1.17,0,0.23,0.7,0.35,body);box(0.49,1.17,-0.18,0.23,0.7,0.35,body);
    box(0,1.93,0,0.52,0.5,0.52,body);box(0,2.2,0.02,0.58,0.08,0.59,metal);
    box(0,1.96,-0.275,0.45,0.12,0.045,b.charge>0?[1,0.24,0.08]:[0.97,0.64,0.27]);
    // Weapon at the right hand, visibly outside the torso.
    box(0.49,1.12,-0.51,0.16,0.2,0.72,metal);
    if(b.charge>0){
      const size=0.07+b.charge*0.06;box(0.49,1.16,-0.9,size,size,0.04,[1,0.35,0.1]);
      mesh.box(b.x,b.y+2.48,b.z,0.8*b.charge/1.15,0.055,0.055,[1,0.35,0.1]);
    }
  }
  weapon(game,reduced){
    const mesh=new Mesh(),w=game.weapon;
    const walk=game.moving&&!reduced?Math.sin(game.time*11)*0.014:0;
    const reload=w.reload>0?Math.sin((1-w.reload/1.85)*Math.PI):0;
    const x=mix(0.29,0,smooth(w.ads)),y=-0.26-walk-reload*0.35-w.ads*0.025,z=-0.55+w.recoil*0.1;
    const metal=[0.15,0.20,0.21],edge=[0.27,0.32,0.31],stock=[0.47,0.44,0.30],stripe=[0.86,0.88,0.47];
    const box=(a,b,c,d,e,f,color)=>mesh.box(x+a,y+b,z+c,d,e,f,color);
    const tube=(a,b,c,r,l,color)=>mesh.cylinder(x+a,y+b,z+c,r,l,color);
    box(0,-0.025,0.24,0.14,0.14,0.43,stock);box(0,-0.04,0.43,0.16,0.18,0.08,metal);
    box(0,0,0,0.13,0.11,0.4,metal);box(0,-0.035,-0.21,0.11,0.095,0.26,stock);
    tube(0,0.025,-0.53,0.025,0.61,metal);tube(0,0.025,-0.83,0.034,0.1,edge);
    box(0,-0.14,0.14,0.075,0.19,0.09,stock);box(0,-0.15,-0.04,0.07,0.18,0.11,metal);
    box(0,0.08,-0.02,0.065,0.045,0.27,edge);box(0,0.12,0.06,0.06,0.09,0.045,metal);box(0,0.12,-0.17,0.06,0.09,0.045,metal);
    tube(0,0.17,-0.07,0.048,0.36,metal);tube(0,0.17,0.135,0.065,0.12,edge);tube(0,0.17,0.197,0.053,0.006,[0.15,0.39,0.42]);
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
