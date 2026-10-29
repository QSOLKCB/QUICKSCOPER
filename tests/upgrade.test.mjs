import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,RULES,traceShot} from '../src/game.js';
import {boxAt} from '../src/math.js';
import {Navigation} from '../src/navigation.js';
import {XboxInput,stick} from '../src/controller.js';
import {noteHz,pulse,musicStep,MUSIC_STEP} from '../src/music.js';
import {Sound} from '../src/audio.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const advance=(g,n,input={})=>{for(let i=0;i<n;i++)g.step(1/120,input);};
function lane(){
  const g=new Game('practice',23);g.world.solids=[];g.player.y=-0.48;g.player.pitch=0;
  g.bots=[8,3,-2].map((z,id)=>({id,x:0,y:0,z,alive:true,hp:100,yaw:0,wait:999,charge:0,flash:0,phase:0,homeX:0,homeZ:z,think:99,moveX:0,moveZ:0}));
  g.weapon.aiming=true;g.weapon.adsTime=0.2;
  return g;
}
test('collaterals damage three distinct bots once, preserve accuracy, and score ordered kills',()=>{
  const g=lane();g.shoot();assert.equal(g.weapon.ammo,4);assert.equal(g.stats.kills,3);
  assert.equal(g.stats.hits,1);assert.equal(g.stats.targetsHit,3);assert.equal(g.stats.collaterals,1);assert.equal(g.stats.bestCollateral,3);
  assert.equal(g.stats.score,1500);assert.equal(g.stats.quick,3);assert.ok(g.bots.every(b=>b.hp===0));
  const events=g.drainEvents();assert.equal(events.filter(e=>e.type==='shot').length,1);assert.equal(events.filter(e=>e.type==='kill').length,3);
  assert.equal(events.find(e=>e.type==='collateral').bonus,300);assert.deepEqual(events.filter(e=>e.type==='kill').map(e=>e.position[2]),[8,3,-2]);
});
test('penetration stops at nearest hard cover, excludes dead bots and preserves shot endpoint',()=>{
  const g=lane();g.world.solids=[boxAt(0,1,5,4,3,1)];const hit=g.shoot();
  assert.equal(g.stats.kills,1);assert.equal(g.bots[1].hp,100);assert.equal(hit.end.kind,'wall');near(hit.end.point[2],5.5);
  const remaining=traceShot([0,1.2,18],[0,0,-1],[],g.bots);assert.deepEqual(remaining.hits.map(h=>h.bot.id),[1,2]);
});
test('rotated collateral hit regions can wound multiple bots without inventing kill bonuses',()=>{
  const g=lane();g.bots[1].yaw=Math.PI/2;g.player.y=-1.32;g.shoot();
  assert.equal(g.stats.targetsHit,3);assert.equal(g.stats.kills,0);assert.equal(g.stats.collaterals,0);assert.ok(g.bots.every(b=>b.hp===40));
});
test('simultaneous scope and fire settles in 150 ms and fires only once',()=>{
  const g=new Game('practice');g.bots=[];g.requestShot(true);advance(g,17,{aim:true});assert.equal(g.stats.shots,0);
  advance(g,1,{aim:true});assert.equal(g.stats.shots,1);assert.equal(g.drainEvents().find(e=>e.type==='shot').quick,true);
  advance(g,240,{aim:true});assert.equal(g.stats.shots,1);
});
test('late bolt press is buffered; early spam is discarded and never shortens the bolt',()=>{
  const g=new Game('practice');g.bots=[];g.requestShot();g.requestShot(true);advance(g,78,{aim:true});assert.equal(g.stats.shots,1);
  g.requestShot(true);advance(g,20,{aim:true});assert.equal(g.stats.shots,1);advance(g,1,{aim:true});assert.equal(g.stats.shots,2);
  assert.ok(g.time>=RULES.bolt);advance(g,120,{aim:true});assert.equal(g.stats.shots,2);
});
test('release, explicit cancellation, reload and death clear pending trigger input',()=>{
  for(const action of ['release','cancel','reload','death']){
    const g=new Game('run');g.bots=[];g.weapon.ammo=4;g.requestShot(true);
    if(action==='release')advance(g,1,{});
    if(action==='cancel')g.cancelShot();if(action==='reload')g.reload();
    if(action==='death'){g.player.invulnerable=0;g.damage(100);}
    advance(g,300,{aim:true});assert.equal(g.stats.shots,0,action);
  }
});
test('partial analog movement remains proportional and diagonals stay bounded',()=>{
  const a=new Game('practice'),b=new Game('practice');a.bots=[];b.bots=[];a.world.solids=[];b.world.solids=[];
  advance(a,120,{moveX:0.5});advance(b,120,{moveX:1});near(a.player.x*2,b.player.x);
  const c=new Game('practice');c.bots=[];c.world.solids=[];advance(c,120,{moveX:1,moveZ:1});near(Math.hypot(c.player.x,c.player.z-18),b.player.x);
});
test('flow field routes around cover and remains cached until the target cell changes',()=>{
  const nav=new Navigation([boxAt(0,1,0,6,3,12)]);let [x,z]=[-10,1];
  for(let i=0;i<30;i++){[x,z]=nav.toward(x,z,10,1);assert.equal(Math.abs(x)<3.48&&Math.abs(z)<6.48,false);}
  assert.ok(Math.hypot(x-10,z-1)<3);const target=nav.target;nav.toward(-10,1,10.1,1.1);assert.equal(nav.target,target);
});
test('bots close distant sightlines, retreat at close range and stagger perception checks',()=>{
  const g=new Game('run',3);g.world.solids=[];const b=g.bots[0];b.x=0;b.z=-12;b.think=0;b.charge=0;g.player.x=0;g.player.z=18;
  g.updateBot(b,1/120);assert.ok(b.moveZ>0);assert.ok(b.think>0);
  b.z=14;b.think=0;g.updateBot(b,1/120);assert.ok(b.moveZ<0);
});
test('cached enemy visibility never permits a shot after cover blocks the muzzle',()=>{
  const g=new Game('run',3);g.player.invulnerable=0;g.player.x=0;g.player.z=18;g.world.solids=[boxAt(0,1,13,20,3,1)];
  const b=g.bots[0];Object.assign(b,{x:0,z:8,wait:0,charge:RULES.charge-0.001,visible:true,think:0.2,moveX:0,moveZ:0});
  g.updateBot(b,1/120);assert.equal(g.player.health,100);assert.equal(g.drainEvents().some(e=>e.type==='enemyShot'),false);
});
function pad(){return {index:0,id:'Xbox test',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};}
const press=(p,i,v=1)=>{p.buttons[i]={value:v,pressed:v>0.5};};
test('radial deadzone rejects drift, preserves direction and bounds diagonal sticks',()=>{
  assert.deepEqual(stick(0.1,-0.1),[0,0]);near(Math.hypot(...stick(1,1)),1);near(stick(0.58,0)[0],0.5);
  assert.deepEqual(stick(NaN,1),[0,0]);assert.ok(stick(0.5,0,0.16,1.6)[0]<stick(0.5,0)[0]);
});
test('Xbox triggers use edge detection and hysteresis, with explicit standard mapping',()=>{
  const p=pad(),c=new XboxInput();c.sample([p]);press(p,6,0.3);press(p,7,0.7);let out=c.sample([p]);assert.equal(out.aim,true);assert.equal(out.fire,true);
  assert.equal(c.sample([p]).fire,false);press(p,7,0.4);assert.equal(c.sample([p]).fire,false);press(p,7,0.7);assert.equal(c.sample([p]).fire,false);
  press(p,7,0.1);c.sample([p]);press(p,7,0.7);assert.equal(c.sample([p]).fire,true);
  p.mapping='';assert.equal(c.sample([p]).connected,false);
});
test('controller resume, disconnect and replacement require neutral input before firing',()=>{
  const p=pad(),c=new XboxInput();c.sample([p]);press(p,7);assert.equal(c.sample([p]).fire,true);c.reset();assert.equal(c.sample([p]).fire,false);
  press(p,7,0);c.sample([p]);press(p,7);assert.equal(c.sample([p]).fire,true);c.sample([]);assert.equal(c.sample([p]).fire,false);
  press(p,7,0);c.sample([p]);p.id='Replacement';press(p,7);assert.equal(c.sample([p]).fire,false);
});
test('Xbox buttons and sticks map to gameplay and menu actions',()=>{
  const p=pad(),c=new XboxInput();c.sample([p]);p.axes=[0.58,-1,0.8,-0.8];for(const i of [0,1,2,9,10,12,15])press(p,i);
  const o=c.sample([p]);for(const name of ['jump','crouch','reload','pause','sprint','accept','up','right'])assert.equal(o[name],true,name);
  assert.ok(o.moveX>0&&o.moveZ>0&&o.lookX>0&&o.lookY<0);assert.equal(c.sample([p]).jump,false);
});
test('math soundtrack has exact pitches, Euclidean pulse counts and deterministic evolving bars',()=>{
  near(noteHz(69),440);near(noteHz(81),880);near(MUSIC_STEP*16,60/108*4);
  for(const count of [0,3,5,16])assert.equal(Array.from({length:16},(_,i)=>pulse(i,count)).filter(Boolean).length,count);
  assert.deepEqual(musicStep(47,3),musicStep(47,3));assert.notDeepEqual(musicStep(0),musicStep(32));
  for(let i=0;i<512;i++)for(const n of musicStep(i,5))assert.ok(noteHz(n.note)>20&&noteHz(n.note)<10000&&n.duration>0);
});
function fakeAudio(){
  const sources=[],param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
  const node=()=>({connect(){},disconnect(){}});
  const c={state:'running',currentTime:0,createGain:()=>({...node(),gain:param()}),createOscillator:()=>{const o={...node(),frequency:param(),start(t){this.startTime=t;},stop(t){this.stopTime=t;if(t===undefined)this.onended?.();}};sources.push(o);return o;}};
  const sound=new Sound();sound.context=c;sound.master=c.createGain();sound.musicGain=c.createGain();return {sound,c,sources};
}
test('music uses audio-clock lookahead, stops on pause, skips stalls and disconnects voices',()=>{
  const {sound,c,sources}=fakeAudio();sound.music(true,5);assert.ok(sources.length>0);assert.ok(sources.every(o=>o.startTime>=0&&o.startTime<=0.12));
  sound.music(false);assert.equal(sound.musicVoices.size,0);const before=sources.length;c.currentTime=100;sound.music(true,5);
  assert.ok(sources.length-before<=4);assert.ok(sources.slice(before).every(o=>o.startTime>=100));
  for(const o of [...sound.musicVoices])o.onended();assert.equal(sound.musicVoices.size,0);
  sound.setMusicVolume(0);assert.equal(sound.musicActive,false);
});
test('suspended audio never queues phantom effects or music for later resume',()=>{
  const {sound,c,sources}=fakeAudio();c.state='suspended';sound.play('kill');sound.music(true);assert.equal(sources.length,0);
  c.state='running';sound.play('kill');assert.equal(sources.length,2);
});
