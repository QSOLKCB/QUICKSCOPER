import {Game,RULES} from './game.js';
import {Renderer} from './renderer.js';
import {Sound} from './audio.js';
import {clamp,smooth,seededRandom} from './math.js';
const $=id=>document.getElementById(id),canvas=$('world'),overlay=$('overlay'),ctx=overlay.getContext('2d');
const sound=new Sound(),fxRandom=seededRandom(783);
const storage={get(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private/quota-limited storage must not stop the game. */}}};
const stored=storage.get('quickscoper.settings',{});
const prefs={sensitivity:1,volume:0.45,invert:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,lowQuality:false};
if(stored&&typeof stored==='object'){
  for(const key of ['sensitivity','volume'])if(typeof stored[key]==='number'&&Number.isFinite(stored[key]))prefs[key]=clamp(stored[key],key==='volume'?0:0.3,key==='volume'?1:2.5);
  for(const key of ['invert','reduced','lowQuality'])if(typeof stored[key]==='boolean')prefs[key]=stored[key];
}
let best=storage.get('quickscoper.best',0);if(!Number.isFinite(best)||best<0)best=0;
let selectedMode='run',game=new Game('practice'),renderer=null,graphicsLost=false,state='menu',keys=new Set(),aim=false;
let last=0,accumulator=0,announcementUntil=0,hitTime=0,hitHead=false,hitKilled=false,damageTime=0,feed=[];
const effects={particles:[],tracers:[],labels:[]};
function showError(message){$('error').hidden=false;$('error').textContent=message;}
function clearInput(){keys.clear();aim=false;game.weapon.aiming=false;game.weapon.adsTime=0;}
function resetEffects(){effects.particles.length=0;effects.tracers.length=0;effects.labels.length=0;feed=[];hitTime=0;damageTime=0;announcementUntil=0;$('announcement').replaceChildren();$('kill-feed').replaceChildren();}
function updateBest(){$('best-score').textContent=`PERSONAL BEST ${best?best.toLocaleString():'—'}`;}
function chooseMode(mode){selectedMode=mode;for(const name of ['run','practice']){const b=$(`mode-${name}`);b.classList.toggle('active',mode===name);b.setAttribute('aria-pressed',String(mode===name));}}
$('mode-run').onclick=()=>chooseMode('run');$('mode-practice').onclick=()=>chooseMode('practice');
function syncPrefs(){
  $('sensitivity').value=prefs.sensitivity;$('sens-output').value=prefs.sensitivity.toFixed(2);
  $('volume').value=prefs.volume;$('volume-output').value=`${Math.round(prefs.volume*100)}%`;
  $('invert').checked=prefs.invert;$('reduced').checked=prefs.reduced;$('low-quality').checked=prefs.lowQuality;
  sound.setVolume(prefs.volume);storage.set('quickscoper.settings',prefs);
}
for(const [id,key] of [['sensitivity','sensitivity'],['volume','volume'],['invert','invert'],['reduced','reduced'],['low-quality','lowQuality']]){
  $(id).addEventListener('input',()=>{prefs[key]=$(id).type==='checkbox'?$(id).checked:Number($(id).value);syncPrefs();});
}
function openSettings(){sound.start();$('settings').showModal();}
$('settings-open').onclick=openSettings;$('pause-settings').onclick=openSettings;
$('help-open').onclick=()=>$('help').showModal();
function setScreen(next){
  state=next;$('menu').hidden=next!=='menu';$('pause').hidden=next!=='paused';$('results').hidden=next!=='results';$('hud').hidden=next==='menu'||next==='results';
}
function requestLock(){
  if(!renderer)return;
  $('lock-message').textContent='';sound.start();
  if(!canvas.requestPointerLock){$('lock-message').textContent='This browser needs Pointer Lock support. Try a desktop browser with a mouse.';return;}
  try{
    const result=canvas.requestPointerLock();
    result?.catch(()=>{$('lock-message').textContent='Mouse capture was blocked. Click Back to the yard to try again.';});
  }catch{$('lock-message').textContent='Mouse capture was blocked. Click Back to the yard to try again.';}
}
function startRun(){
  if(!renderer)return;
  game=new Game(selectedMode,Date.now()>>>0);clearInput();resetEffects();accumulator=0;
  $('hud-mode').textContent=selectedMode==='run'?'THE CIRCUIT / 90 SEC':'FREE RANGE / PRACTICE';
  $('timer-label').textContent=selectedMode==='run'?'TIME REMAINING':'NO TIME LIMIT';
  setScreen('paused');requestLock();sound.play('start');announce(selectedMode==='run'?'MAKE IT COUNT.':'FIND YOUR RHYTHM.',selectedMode==='run'?'90 seconds. Stack those quickscopes.':'No timer. No incoming fire.',2.3);updateHUD();
}
function pauseGame(){
  if(state!=='playing')return;
  clearInput();accumulator=0;setScreen('paused');
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  $('resume').focus();
}
function menu(){
  clearInput();setScreen('menu');if(document.pointerLockElement)document.exitPointerLock();
  resetEffects();game=new Game('practice');updateBest();$('start').focus();
}
$('start').onclick=startRun;$('restart').onclick=startRun;$('play-again').onclick=startRun;
$('resume').onclick=requestLock;$('quit').onclick=menu;$('results-menu').onclick=menu;
document.addEventListener('pointerlockchange',()=>{
  if(document.pointerLockElement===canvas){
    if(state==='paused'){setScreen('playing');clearInput();last=performance.now();accumulator=0;}
    else if(state!=='playing')document.exitPointerLock();
  }else if(state==='playing')pauseGame();
});
document.addEventListener('pointerlockerror',()=>{if(state==='paused')$('lock-message').textContent='Click Back to the yard to capture the mouse. If blocked, open this page directly in a desktop browser.';});
window.addEventListener('blur',pauseGame);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});
window.addEventListener('keydown',e=>{
  if(state!=='playing')return;
  if(['KeyP','Escape','Tab'].includes(e.code)){e.preventDefault();pauseGame();return;}
  const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ControlLeft','ControlRight','ShiftLeft','ShiftRight','KeyC','KeyR','KeyM'];
  if(handled.includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(!e.repeat&&e.code==='KeyR'){game.reload();consumeEvents();}
  if(!e.repeat&&e.code==='KeyM')announce(sound.toggle()?'SOUND OFF':'SOUND ON','',0.8);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('mousemove',e=>{
  if(state!=='playing'||document.pointerLockElement!==canvas)return;
  const scale=0.0021*prefs.sensitivity*(1-game.weapon.ads*0.66);
  game.player.yaw+=e.movementX*scale;game.player.pitch=clamp(game.player.pitch-e.movementY*scale*(prefs.invert?-1:1),-1.48,1.48);
});
window.addEventListener('mousedown',e=>{
  if(state!=='playing'||document.pointerLockElement!==canvas)return;
  e.preventDefault();
  if(e.button===2){if(!aim)sound.play('scope');aim=true;}
  if(e.button===0){game.shoot();consumeEvents();updateHUD();}
});
window.addEventListener('mouseup',e=>{if(e.button===2)aim=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('contextmenu',e=>{if(state==='playing')e.preventDefault();});
const down=(...codes)=>codes.some(c=>keys.has(c));
function input(){return {forward:down('KeyW','ArrowUp'),back:down('KeyS','ArrowDown'),left:down('KeyA','ArrowLeft'),right:down('KeyD','ArrowRight'),sprint:down('ShiftLeft','ShiftRight'),crouch:down('KeyC','ControlLeft','ControlRight'),jump:down('Space'),aim};}
function announce(title,subtitle='',seconds=1){
  const node=$('announcement');node.replaceChildren(document.createTextNode(title));
  if(subtitle){const sub=document.createElement('small');sub.textContent=subtitle;node.append(sub);}
  announcementUntil=game.time+seconds;
}
function consumeEvents(){
  for(const event of game.drainEvents()){
    sound.play(event.type);
    if(event.type==='shot'){
      effects.tracers.push({origin:event.origin.map((v,i)=>v+(i===1?-0.12:0)),point:event.hit.point,life:0.075});
      if(event.hit.kind==='wall')particles(event.hit.point,7,[0.85,0.78,0.52]);
    }
    if(event.type==='enemyShot')effects.tracers.push({...event,enemy:true,life:0.12});
    if(event.type==='hit'){hitTime=0.2;hitHead=event.head;hitKilled=event.killed;particles(event.point,event.killed?20:6,event.head?[0.96,0.78,0.34]:[0.31,0.69,0.61]);}
    if(event.type==='kill'){
      effects.labels.push({point:[...event.point],text:`+${event.points}`,life:0.9});
      const name=event.quick?'QUICKSCOPE':event.head?'HEADSHOT':'ELIMINATION';
      feed.unshift({text:`${name} ${event.head&&event.quick?' / HEADSHOT':''}  +${event.points}`,until:game.time+3});feed=feed.slice(0,3);renderFeed();
      if(event.combo>=2)announce(`${Math.min(event.combo,5)}× ${event.combo>=5?'ON FIRE':event.combo>=3?'CHAIN REACTION':'DOUBLE UP'}`,event.quick?'QUICKSCOPE BONUS':'KEEP THE CHAIN ALIVE',0.8);
    }
    if(event.type==='damage')damageTime=0.35;
    if(event.type==='respawn'){clearInput();announce('BACK ON YOUR FEET.','−200 points · brief spawn protection',1.8);}
    if(event.type==='end')finish();
  }
}
function particles(point,count,color){
  if(prefs.reduced)count=Math.min(count,4);
  for(let i=0;i<count&&effects.particles.length<180;i++)effects.particles.push({x:point[0],y:point[1],z:point[2],vx:(fxRandom()-0.5)*5,vy:fxRandom()*4,vz:(fxRandom()-0.5)*5,size:0.035+fxRandom()*0.09,life:0.3+fxRandom()*0.6,color});
}
function renderFeed(){const node=$('kill-feed');node.replaceChildren();for(const f of feed){const row=document.createElement('div');row.textContent=f.text;node.append(row);}}
function updateEffects(dt){
  for(const p of effects.particles){p.life-=dt;p.vy-=12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<0.07){p.y=0.07;p.vy=Math.abs(p.vy)*0.2;}}
  effects.particles=effects.particles.filter(p=>p.life>0);
  for(const t of effects.tracers)t.life-=dt;effects.tracers=effects.tracers.filter(t=>t.life>0);
  for(const l of effects.labels){l.life-=dt;l.point[1]+=dt*0.45;}effects.labels=effects.labels.filter(l=>l.life>0);
  hitTime=Math.max(0,hitTime-dt);damageTime=Math.max(0,damageTime-dt);
  if(announcementUntil>0&&game.time>announcementUntil){$('announcement').replaceChildren();announcementUntil=0;}
  if(feed.some(f=>f.until<game.time)){feed=feed.filter(f=>f.until>=game.time);renderFeed();}
}
function updateHUD(){
  const w=game.weapon,s=game.stats,p=game.player;
  const t=Math.ceil(game.remaining);$('time').textContent=game.mode==='practice'?'∞':`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  $('time').parentElement.classList.toggle('urgent',game.mode==='run'&&t<=15);
  $('score').textContent=String(s.score).padStart(6,'0');$('ammo').textContent=String(w.ammo).padStart(2,'0');
  $('combo').textContent=game.combo>1?`${Math.min(game.combo,5)}× MULTIPLIER / ${game.combo} CHAIN`:'BUILD A STREAK';
  $('weapon-status').textContent=w.reload>0?`RELOADING ${Math.ceil((1-w.reload/RULES.reload)*100)}%`:w.bolt>0?'CYCLING BOLT':w.ammo===0?'R TO RELOAD':'READY';
  $('health-value').textContent=Math.ceil(p.health);$('health-bar').style.width=`${p.health}%`;$('health-bar').style.background=p.health<35?'#ff9b64':'#deef80';
  $('status-text').textContent=p.invulnerable>0?'SPAWN PROTECTION':game.mode==='practice'?'FREE RANGE · ESC FOR MENU':'SHIFT SPRINT · SPACE JUMP · C CROUCH';
  $('scope-tip').textContent=w.aiming?(w.adsTime<RULES.quickStart?'SETTLING…':w.adsTime<=RULES.quickEnd?'QUICKSCOPE WINDOW':'STEADY AIM'):(w.ammo===0&&w.reload===0?'PRESS R TO RELOAD':'');
}
function finish(){
  clearInput();const s=game.stats,newRecord=s.score>best;
  if(newRecord){best=s.score;storage.set('quickscoper.best',best);}updateBest();
  $('final-score').textContent=s.score.toLocaleString();$('record-label').textContent=newRecord?'NEW PERSONAL BEST':'FINAL SCORE';
  const stats=[['ELIMINATIONS',s.kills],['ACCURACY',`${s.shots?Math.round(s.hits/s.shots*100):0}%`],['QUICKSCOPES',s.quick],['HEADSHOTS',s.heads],['BEST CHAIN',s.bestCombo],['RESPAWNS',s.deaths]];
  $('results-grid').replaceChildren();for(const [label,value] of stats){const cell=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=value;small.textContent=label;cell.append(b,small);$('results-grid').append(cell);}
  $('rank').textContent=s.quick>=25?'S-RANK / BLINK AND THEY MISS YOU.':s.quick>=15?'A-RANK / YOU FOUND THE RHYTHM.':s.quick>=7?'B-RANK / CLEAN WORK. KEEP SNAPPING.':'RANGE REGULAR / EVERY SHOT IS PRACTICE.';
  setScreen('results');if(document.pointerLockElement)document.exitPointerLock();$('play-again').focus();
}
function drawOverlay(){
  const width=overlay.clientWidth,height=overlay.clientHeight,dpr=Math.min(devicePixelRatio||1,1.6);
  if(overlay.width!==Math.round(width*dpr)||overlay.height!==Math.round(height*dpr)){overlay.width=Math.round(width*dpr);overlay.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  if(state==='menu'||state==='results')return;
  const x=width/2,y=height/2,w=game.weapon,ads=smooth(w.ads);
  if(ads>0.15){
    const radius=Math.min(width,height)*0.43;
    ctx.save();ctx.globalAlpha=clamp((ads-0.15)/0.55,0,1);ctx.fillStyle='#050a08';ctx.beginPath();ctx.rect(0,0,width,height);ctx.arc(x,y,radius,0,Math.PI*2,true);ctx.fill('evenodd');
    ctx.strokeStyle='#161d18';ctx.lineWidth=9;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth=1;ctx.strokeStyle='#151d17';ctx.beginPath();ctx.moveTo(x-radius,y);ctx.lineTo(x-9,y);ctx.moveTo(x+9,y);ctx.lineTo(x+radius,y);ctx.moveTo(x,y-radius);ctx.lineTo(x,y-9);ctx.moveTo(x,y+9);ctx.lineTo(x,y+radius);ctx.stroke();
    ctx.fillStyle='#121c16';for(let i=-4;i<=4;i++)if(i){ctx.fillRect(x+i*radius/6-1.5,y-2,3,4);ctx.fillRect(x-2,y+i*radius/6-1.5,4,3);}
    ctx.fillStyle='#bd442b';ctx.fillRect(x-1,y-1,2,2);
    ctx.fillStyle='#243221';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('QS–01   /   3×',x,y+radius*0.7);
    // Timing arc records the same interval used by scoring.
    if(w.aiming&&w.adsTime<=RULES.quickEnd){ctx.strokeStyle=w.adsTime>=RULES.quickStart?'#deef80':'#ffffff66';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,radius+7,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(w.adsTime/RULES.quickEnd,0,1));ctx.stroke();}
    ctx.restore();
  }
  if(ads<0.85){
    ctx.globalAlpha=1-ads;const gap=5+w.recoil*18+(game.sprinting?6:0);
    ctx.strokeStyle='#f1f4d8';ctx.lineWidth=1.4;ctx.beginPath();for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(x+dx*gap,y+dy*gap);ctx.lineTo(x+dx*(gap+6),y+dy*(gap+6));}ctx.stroke();ctx.fillStyle='#f1f4d8';ctx.fillRect(x-1,y-1,2,2);ctx.globalAlpha=1;
  }
  if(hitTime>0){ctx.globalAlpha=Math.min(1,hitTime*8);ctx.strokeStyle=hitHead?'#ffb570':hitKilled?'#deef80':'white';ctx.lineWidth=2;ctx.beginPath();for(const [dx,dy]of [[1,1],[-1,1],[1,-1],[-1,-1]]){ctx.moveTo(x+dx*7,y+dy*7);ctx.lineTo(x+dx*14,y+dy*14);}ctx.stroke();ctx.globalAlpha=1;}
  ctx.font='bold 17px monospace';ctx.textAlign='center';
  for(const label of effects.labels){const p=renderer.project(label.point);if(p){ctx.globalAlpha=Math.min(1,label.life*2);ctx.fillStyle='#e9f4a8';ctx.shadowBlur=4;ctx.shadowColor='#102519';ctx.fillText(label.text,p[0],p[1]-25);}}
  ctx.shadowBlur=0;ctx.globalAlpha=1;
  if(damageTime>0){
    if(prefs.reduced){ctx.strokeStyle='#ff9b64';ctx.lineWidth=5;ctx.strokeRect(3,3,width-6,height-6);}
    else{const gradient=ctx.createRadialGradient(x,y,height*0.2,x,y,width*0.7);gradient.addColorStop(0,'#be402000');gradient.addColorStop(1,`rgba(170,45,20,${damageTime*1.8})`);ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);}
  }
  if(w.reload>0){const progress=1-w.reload/RULES.reload;ctx.fillStyle='#ffffff40';ctx.fillRect(x-55,y+48,110,2);ctx.fillStyle='#deef80';ctx.fillRect(x-55,y+48,110*progress,2);}
}
function frame(now){
  const delta=Math.min(0.1,Math.max(0,(now-last)/1000));last=now;
  if(state==='playing'){
    accumulator+=delta;
    while(accumulator>=1/120){game.step(1/120,input());updateEffects(1/120);consumeEvents();accumulator-=1/120;if(state!=='playing'){accumulator=0;break;}}
    updateHUD();
  }
  if(renderer&&!graphicsLost){renderer.render(game,effects,{menu:state==='menu',time:now/1000,quality:prefs.lowQuality?0:1,reduced:prefs.reduced});drawOverlay();}
  requestAnimationFrame(frame);
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();graphicsLost=true;pauseGame();$('lock-message').textContent='Graphics context lost. Reload this page to restore the renderer.';$('resume').disabled=true;});
canvas.addEventListener('webglcontextrestored',()=>{
  try{renderer=new Renderer(canvas,game.world);graphicsLost=false;$('resume').disabled=false;$('lock-message').textContent='Graphics restored. Resume when ready.';}catch(error){$('lock-message').textContent=error.message;}
});
async function offline(){
  if(!('serviceWorker' in navigator)||!isSecureContext){$('offline-status').textContent='LOCAL SERVER / ONLINE PLAY';return;}
  try{
    await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
    const registration=await navigator.serviceWorker.getRegistration();
    // A ready active worker has completed atomic caching of all runtime files.
    $('offline-status').textContent='● OFFLINE READY';
    registration?.addEventListener('updatefound',()=>{
      const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)$('offline-status').textContent='UPDATE READY · CLOSE ALL GAME TABS TO APPLY';});
    });
  }catch{$('offline-status').textContent='ONLINE PLAY / OFFLINE CACHE UNAVAILABLE';}
}
syncPrefs();updateBest();
try{renderer=new Renderer(canvas,game.world);requestAnimationFrame(frame);}catch(error){showError(error.message);$('start').disabled=true;}
if(matchMedia('(pointer: coarse)').matches)$('menu-note').textContent='Keyboard and mouse required. Touch controls are not supported.';
offline();
