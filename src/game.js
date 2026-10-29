import {clamp, forward, seededRandom, boxAt, rayBox} from './math.js';
import {makeWorld} from './world.js';
export const RULES = Object.freeze({duration:90, magazine:5, reload:1.85, bolt:0.82, adsIn:0.19, quickStart:0.16, quickEnd:0.55, comboWindow:3.1});
export function hitboxes(bot) {
  return [
    {part:'head',...boxAt(bot.x,bot.y+1.93,bot.z,0.52,0.5,0.52)},
    {part:'body',...boxAt(bot.x,bot.y+1.19,bot.z,0.76,0.96,0.52)},
    {part:'legs',...boxAt(bot.x,bot.y+0.36,bot.z,0.65,0.72,0.46)},
    {part:'limb',...boxAt(bot.x-0.49,bot.y+1.17,bot.z,0.23,0.7,0.35)},
    {part:'limb',...boxAt(bot.x+0.49,bot.y+1.17,bot.z-0.18,0.23,0.7,0.35)}
  ];
}
export function trace(origin, direction, solids, bots, max=130) {
  let result={distance:max,kind:'miss'};
  for(const box of solids) {
    const d=rayBox(origin,direction,box,max);
    if(d!==null && d<=result.distance) result={distance:d,kind:'wall'};
  }
  for(const bot of bots) if(bot.alive) {
    // Inverse rotate the ray into the voxel model's space. Hitboxes turn with bots.
    const angle=bot.yaw||0,cs=Math.cos(angle),sn=Math.sin(angle),dx=origin[0]-bot.x,dz=origin[2]-bot.z;
    const localOrigin=[bot.x+dx*cs-dz*sn,origin[1],bot.z+dx*sn+dz*cs];
    const localDirection=[direction[0]*cs-direction[2]*sn,direction[1],direction[0]*sn+direction[2]*cs];
    for(const box of hitboxes(bot)) {
    const d=rayBox(localOrigin,localDirection,box,max);
    // A surface at the same distance wins over a target: no shooting through cover.
    if(d!==null && d<result.distance) result={distance:d,kind:'bot',bot,part:box.part};
    }
  }
  return {...result,point:origin.map((v,i)=>v+direction[i]*result.distance)};
}
const occupied=(x,z,feet,height,r,b)=>
  feet+height>b.min[1]+0.001 && feet<b.max[1]-0.001 && x+r>b.min[0] && x-r<b.max[0] && z+r>b.min[2] && z-r<b.max[2];
export function moveBody(body,dx,dz,solids,r=0.3,height=1.7) {
  // Substeps prevent tunnelling and axis separation allows sliding along cover.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.15));
  for(let i=0;i<steps;i++) {
    const x=body.x+dx/steps,z=body.z+dz/steps;
    if(!solids.some(b=>occupied(x,body.z,body.y,height,r,b))) body.x=x;
    if(!solids.some(b=>occupied(body.x,z,body.y,height,r,b))) body.z=z;
  }
}
export class Game {
  constructor(mode='run',seed=23) {
    this.mode=mode;this.random=seededRandom(seed);this.world=makeWorld();
    this.time=0;this.remaining=RULES.duration;this.finished=false;this.events=[];
    this.player={x:0,y:0,z:18,yaw:0,pitch:0,vy:0,grounded:true,crouch:false,health:100,invulnerable:2};
    this.weapon={ammo:RULES.magazine,bolt:0,reload:0,ads:0,adsTime:0,aiming:false,recoil:0};
    this.stats={score:0,kills:0,shots:0,hits:0,heads:0,quick:0,deaths:0,bestCombo:0};
    this.combo=0;this.lastKill=-10;this.lastDamage=-10;this.bots=[];
    for(let i=0;i<6;i++) {const b={id:i};this.spawn(b,true);this.bots.push(b);}
  }
  emit(type,data={}) {this.events.push({type,...data});}
  drainEvents() {return this.events.splice(0);}
  spawn(bot,initial=false) {
    const spots=this.world.spawns,offset=initial?bot.id:Math.floor(this.random()*spots.length);
    let spot=spots[offset%spots.length];
    for(let i=0;i<spots.length;i++) {
      const s=spots[(offset+i)%spots.length];
      if(Math.hypot(s[0]-this.player.x,s[1]-this.player.z)>7 && !this.bots.some(b=>b!==bot&&b.alive&&Math.hypot(b.x-s[0],b.z-s[1])<2)) {spot=s;break;}
    }
    Object.assign(bot,{x:spot[0],y:0,z:spot[1],homeX:spot[0],homeZ:spot[1],hp:100,alive:true,
      phase:this.random()*Math.PI*2,respawn:0,charge:0,wait:2+this.random()*3,flash:0,yaw:0});
  }
  reload() {
    const w=this.weapon;
    if(this.finished||w.reload>0||w.ammo===RULES.magazine) return false;
    w.reload=RULES.reload;w.aiming=false;w.adsTime=0;this.emit('reload');return true;
  }
  shoot() {
    const w=this.weapon,p=this.player;
    if(this.finished||w.reload>0||w.bolt>0) return null;
    if(w.ammo===0) {this.reload();return null;}
    const accurate=w.aiming&&w.adsTime>=RULES.quickStart;
    const quick=accurate&&w.adsTime<=RULES.quickEnd;
    const spread=accurate?0:(p.grounded?0.035:0.065);
    const direction=forward(p.yaw+(this.random()-0.5)*spread*2,p.pitch+(this.random()-0.5)*spread*2);
    const origin=[p.x,p.y+(p.crouch?1.08:1.68),p.z];
    const hit=trace(origin,direction,this.world.solids,this.bots);
    w.ammo--;w.bolt=RULES.bolt;w.recoil=1;w.aiming=false;w.adsTime=0;
    this.stats.shots++;this.emit('shot',{hit,origin,quick});
    if(hit.kind==='bot') {
      this.stats.hits++;hit.bot.hp-=hit.part==='head'?150:hit.part==='body'?100:60;hit.bot.flash=0.16;
      const killed=hit.bot.hp<=0;
      this.emit('hit',{killed,head:hit.part==='head',quick,point:hit.point});
      if(killed) {
        hit.bot.alive=false;hit.bot.respawn=1.3+this.random();
        this.combo=this.time-this.lastKill<=RULES.comboWindow?this.combo+1:1;this.lastKill=this.time;
        const multiplier=Math.min(5,this.combo),head=hit.part==='head';
        const points=(100+(head?50:0)+(quick?100:0))*multiplier;
        this.stats.kills++;this.stats.score+=points;this.stats.quick+=Number(quick);this.stats.heads+=Number(head);
        this.stats.bestCombo=Math.max(this.stats.bestCombo,this.combo);
        this.emit('kill',{points,quick,head,combo:this.combo,point:hit.point});
      }
    }
    return hit;
  }
  damage(amount) {
    if(this.mode==='practice'||this.player.invulnerable>0||this.finished) return;
    const p=this.player;p.health=Math.max(0,p.health-amount);this.lastDamage=this.time;this.emit('damage');
    if(p.health===0) {
      this.stats.deaths++;this.stats.score=Math.max(0,this.stats.score-200);this.combo=0;
      Object.assign(p,{x:0,y:0,z:18,vy:0,grounded:true,yaw:0,pitch:0,health:100,invulnerable:2.5,crouch:false});
      Object.assign(this.weapon,{ammo:RULES.magazine,bolt:0,reload:0,aiming:false,ads:0,adsTime:0});
      this.emit('respawn');
    }
  }
  step(dt,input={}) {
    if(this.finished||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,1/30);this.time+=dt;
    if(this.mode==='run') {this.remaining=Math.max(0,RULES.duration-this.time);if(this.remaining<=0){this.finished=true;this.emit('end');return;}}
    const p=this.player,w=this.weapon;
    p.invulnerable=Math.max(0,p.invulnerable-dt);
    if(this.time-this.lastDamage>3.5) p.health=Math.min(100,p.health+dt*14);
    if(this.time-this.lastKill>RULES.comboWindow)this.combo=0;
    const hadReload=w.reload>0;
    w.bolt=Math.max(0,w.bolt-dt);w.reload=Math.max(0,w.reload-dt);w.recoil=Math.max(0,w.recoil-dt*5.5);
    if(hadReload&&w.reload===0) {w.ammo=RULES.magazine;this.emit('loaded');}
    const sprint=!!input.sprint&&!input.aim&&!p.crouch;
    w.aiming=!!input.aim&&!sprint&&w.reload===0&&w.bolt===0;
    w.adsTime=w.aiming?w.adsTime+dt:0;
    w.ads=clamp(w.ads+(w.aiming?dt/RULES.adsIn:-dt/0.12),0,1);
    const wantCrouch=!!input.crouch;
    if(wantCrouch||!this.world.solids.some(b=>occupied(p.x,p.z,p.y,1.75,0.3,b)))p.crouch=wantCrouch;
    let dx=Number(!!input.right)-Number(!!input.left),dz=Number(!!input.forward)-Number(!!input.back);
    const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
    const speed=p.crouch?2.6:w.aiming?3.2:sprint?8.2:5.1;
    this.moving=Math.hypot(dx,dz)>0;this.sprinting=sprint&&this.moving;
    moveBody(p,(Math.cos(p.yaw)*dx+Math.sin(p.yaw)*dz)*speed*dt,(Math.sin(p.yaw)*dx-Math.cos(p.yaw)*dz)*speed*dt,this.world.solids,0.3,p.crouch?1.12:1.75);
    if(input.jump&&p.grounded&&!p.crouch) {p.vy=7.2;p.grounded=false;}
    const oldY=p.y;p.vy-=20*dt;p.y+=p.vy*dt;p.grounded=false;
    let floor=0;
    for(const b of this.world.solids) if(p.x+0.28>b.min[0]&&p.x-0.28<b.max[0]&&p.z+0.28>b.min[2]&&p.z-0.28<b.max[2]) {
      if(oldY>=b.max[1]-0.01&&p.y<=b.max[1]&&p.vy<=0)floor=Math.max(floor,b.max[1]);
      const height=p.crouch?1.12:1.75;
      if(p.vy>0&&oldY+height<=b.min[1]&&p.y+height>b.min[1]){p.y=b.min[1]-height;p.vy=0;}
    }
    if(p.y<=floor){p.y=floor;p.vy=0;p.grounded=true;}
    for(const bot of this.bots) this.updateBot(bot,dt);
  }
  updateBot(b,dt) {
    if(!b.alive) {b.respawn-=dt;if(b.respawn<=0)this.spawn(b);return;}
    b.flash=Math.max(0,b.flash-dt);b.phase+=dt*(0.7+Math.min(this.time/150,0.5));
    const tx=b.homeX+Math.sin(b.phase)*2.2,tz=b.homeZ+Math.cos(b.phase*0.6)*1.6;
    const dx=tx-b.x,dz=tz-b.z,len=Math.hypot(dx,dz)||1;
    moveBody(b,dx/len*Math.min(len,1.8*dt),dz/len*Math.min(len,1.8*dt),this.world.solids,0.4,2.2);
    // Model local -Z rotates to [-sin(yaw), 0, -cos(yaw)].
    b.yaw=Math.atan2(-(this.player.x-b.x),-(this.player.z-b.z));
    if(this.mode==='practice')return;
    const cs=Math.cos(b.yaw),sn=Math.sin(b.yaw);
    const eye=[b.x+0.49*cs-0.9*sn,1.16,b.z-0.49*sn-0.9*cs],p=this.player,target=[p.x,p.y+(p.crouch?0.9:1.3),p.z];
    const delta=target.map((v,i)=>v-eye[i]),dist=Math.hypot(...delta),dir=delta.map(v=>v/(dist||1));
    const visible=dist<33&&!this.world.solids.some(box=>rayBox(eye,dir,box,dist)!==null);
    if(!visible||p.invulnerable>0){b.charge=0;b.wait=Math.max(b.wait,0.5);return;}
    b.wait-=dt;
    if(b.wait<=0) {
      b.charge+=dt;
      if(b.charge>=1.15) {
        this.emit('enemyShot',{origin:eye,point:target});
        // Dodging and sprinting reduce hits; no hidden attacks through geometry.
        if(this.random()<(this.sprinting?0.25:this.moving?0.48:0.82))this.damage(18);
        b.charge=0;b.wait=2.5+this.random()*2;
      }
    }
  }
}
