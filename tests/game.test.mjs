import test from 'node:test';
import assert from 'node:assert/strict';
import {forward,view,perspective,multiply,transform,rayBox,boxAt,seededRandom} from '../src/math.js';
import {Game,RULES,trace,moveBody} from '../src/game.js';
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);
function advance(game,seconds,input={}){for(let i=0;i<Math.round(seconds*120);i++)game.step(1/120,input);}
function targetGame(mode='practice'){
 const game=new Game(mode,1);game.world.solids=[];
 game.bots=[{id:0,x:0,y:0,z:8,alive:true,hp:100,yaw:0,phase:0,homeX:0,homeZ:8,wait:999,charge:0,flash:0}];
 game.player.pitch=Math.atan2(1.2-1.68,10);
 return game;
}
test('view matrix maps eye to origin and forward to camera -Z for arbitrary rotations',()=>{
 for(const [yaw,pitch]of [[0,0],[1.1,0.5],[-2,-0.8]]){
  const eye=[7,3,-4],f=forward(yaw,pitch),v=view(eye,yaw,pitch);
  transform(v,eye).slice(0,3).forEach(x=>near(x,0));
  const p=transform(v,eye.map((x,i)=>x+f[i]*10));near(p[0],0);near(p[1],0);near(p[2],-10);
 }
});
test('projection and column-major multiplication preserve central aim',()=>{
 const eye=[3,2,10],f=forward(0.3,0.1),vp=multiply(perspective(Math.PI/2,16/9),view(eye,0.3,0.1));
 const clip=transform(vp,eye.map((x,i)=>x+f[i]*20));near(clip[0],0);near(clip[1],0);assert.ok(clip[3]>0);
});
test('ray slabs handle parallel axes, inside origins, behind targets and finite distance',()=>{
 const b=boxAt(0,0,-5,2,2,2);near(rayBox([0,0,0],[0,0,-1],b),4);
 assert.equal(rayBox([2,0,0],[0,0,-1],b),null);assert.equal(rayBox([0,0,0],[0,0,1],b),null);
 assert.equal(rayBox([0,0,0],[0,0,-1],b,3),null);assert.equal(rayBox([0,0,-5],[0,0,-1],b),0);
});
test('ray trace selects nearest bot and exact head/body/leg regions',()=>{
 const bots=[{x:0,y:0,z:-10,alive:true},{x:0,y:0,z:-5,alive:true}];
 for(const [height,part] of [[1.93,'head'],[1.2,'body'],[0.3,'legs']]){
 const hit=trace([0,height,0],[0,0,-1],[],bots);assert.equal(hit.bot,bots[1]);assert.equal(hit.part,part);}
});
test('solid cover occludes targets and a dead bot never intercepts a ray',()=>{
 const bots=[{x:0,y:0,z:-10,alive:true}],wall=boxAt(0,1,-5,3,3,1);
 assert.equal(trace([0,1,0],[0,0,-1],[wall],bots).kind,'wall');bots[0].alive=false;
 assert.equal(trace([0,1,0],[0,0,-1],[],bots).kind,'miss');
});
test('scoped chest kill consumes one round and awards quickscope points',()=>{
 const g=targetGame();g.weapon.aiming=true;g.weapon.adsTime=0.2;
 assert.equal(g.shoot().part,'body');assert.equal(g.stats.score,200);assert.equal(g.stats.quick,1);assert.equal(g.weapon.ammo,4);assert.equal(g.stats.kills,1);
});
test('quickscope bonus uses both timing boundaries; holding scope is still accurate',()=>{
 for(const [time,quick]of [[RULES.quickStart,1],[RULES.quickEnd,1],[0.56,0]]){const g=targetGame();g.weapon.aiming=true;g.weapon.adsTime=time;g.shoot();assert.equal(g.stats.quick,quick);assert.equal(g.stats.hits,1);}
});
test('headshot bonus stacks with quickscope and leg hits require two shots',()=>{
 const g=targetGame();g.player.pitch=Math.atan2(1.93-1.68,10);g.weapon.aiming=true;g.weapon.adsTime=0.2;g.shoot();assert.equal(g.stats.score,250);assert.equal(g.stats.heads,1);
 const h=targetGame();h.player.pitch=Math.atan2(0.36-1.68,10);h.weapon.aiming=true;h.weapon.adsTime=1;h.shoot();assert.equal(h.stats.kills,0);assert.equal(h.bots[0].hp,40);
 h.weapon.bolt=0;h.weapon.aiming=true;h.weapon.adsTime=1;h.shoot();assert.equal(h.stats.kills,1);
});
test('bolt cycle blocks click spam and reload blocks shooting',()=>{
 const g=targetGame();g.shoot();assert.equal(g.shoot(),null);assert.equal(g.stats.shots,1);assert.equal(g.weapon.ammo,4);
 assert.equal(g.reload(),true);assert.equal(g.shoot(),null);advance(g,RULES.reload+0.03);assert.equal(g.weapon.ammo,5);assert.equal(g.reload(),false);
});
test('empty magazine starts a reload without counting a phantom shot',()=>{
 const g=targetGame();g.weapon.ammo=0;assert.equal(g.shoot(),null);assert.equal(g.stats.shots,0);assert.equal(g.weapon.reload,RULES.reload);
});
test('ADS resets on release and during bolt/reload; scope becomes ready after settle time',()=>{
 const g=targetGame();advance(g,0.2,{aim:true});assert.equal(g.weapon.ads,1);assert.ok(g.weapon.adsTime>=0.16);
 g.step(1/120,{});assert.equal(g.weapon.adsTime,0);g.weapon.bolt=0.5;advance(g,0.2,{aim:true});assert.equal(g.weapon.aiming,false);
});
test('diagonal movement matches cardinal speed, and right strafe is camera-right',()=>{
 const a=targetGame(),b=targetGame();advance(a,1,{forward:true});advance(b,1,{forward:true,right:true});
 near(Math.hypot(a.player.x,a.player.z-18),Math.hypot(b.player.x,b.player.z-18));assert.ok(b.player.x>0);
});
test('collision substeps prevent tunnelling and allow sliding',()=>{
 const b={x:0,y:0,z:0};moveBody(b,20,4,[boxAt(3,1,0,1,2,20)]);assert.ok(b.x<2.21);assert.ok(b.z>3.9);
});
test('jump lands back on ground and can land on low cover',()=>{
 const g=targetGame();advance(g,1/120,{jump:true});assert.ok(g.player.vy>0);advance(g,1);near(g.player.y,0);assert.equal(g.player.grounded,true);
 g.world.solids=[boxAt(0,0.6,18,4,1.2,4)];g.player.y=2;g.player.vy=-2;advance(g,0.5);near(g.player.y,1.2);assert.equal(g.player.grounded,true);
});
test('timer ends once at 90 simulated seconds and finished games cannot shoot',()=>{
 const g=targetGame('run');g.bots=[];advance(g,90.1);assert.equal(g.finished,true);assert.equal(g.remaining,0);assert.equal(g.drainEvents().filter(x=>x.type==='end').length,1);
 advance(g,1);assert.equal(g.shoot(),null);assert.equal(g.drainEvents().length,0);
});
test('practice is untimed, has no incoming damage and does not finish',()=>{
 const g=targetGame();g.player.invulnerable=0;g.damage(500);advance(g,100);assert.equal(g.player.health,100);assert.equal(g.finished,false);
});
test('death applies penalty, resets rifle and grants spawn protection',()=>{
 const g=targetGame('run');g.player.invulnerable=0;g.stats.score=500;g.weapon.ammo=0;g.damage(100);
 assert.equal(g.stats.deaths,1);assert.equal(g.stats.score,300);assert.equal(g.weapon.ammo,5);assert.equal(g.player.health,100);g.damage(100);assert.equal(g.stats.deaths,1);
});
test('healing begins only after the damage delay',()=>{
 const g=targetGame('run');g.bots=[];g.player.invulnerable=0;g.damage(30);advance(g,3);assert.equal(g.player.health,70);advance(g,1);assert.ok(g.player.health>70);
});
test('enemy attacks require line of sight and practice never charges attacks',()=>{
 const g=targetGame('run');g.player.invulnerable=0;g.bots[0].wait=0;g.world.solids=[boxAt(0,2,13,10,4,2)];advance(g,3);assert.equal(g.player.health,100);assert.equal(g.bots[0].charge,0);
 const p=targetGame();p.bots[0].wait=0;advance(p,3);assert.equal(p.bots[0].charge,0);
});
test('chains expire and score multiplier caps at five',()=>{
 const g=targetGame();g.combo=7;g.lastKill=0;g.time=1;g.weapon.aiming=true;g.weapon.adsTime=0.2;g.shoot();assert.equal(g.stats.score,1000);
 g.bots=[];advance(g,3.2);assert.equal(g.combo,0);
});
test('fresh game clears all old run state; seeded runs match',()=>{
 const a=new Game('run',42),b=new Game('run',42);advance(a,2,{forward:true});advance(b,2,{forward:true});assert.deepEqual(a.bots,b.bots);assert.deepEqual(a.player,b.player);
 a.stats.score=999;a.weapon.ammo=0;const fresh=new Game('run',42);assert.equal(fresh.stats.score,0);assert.equal(fresh.weapon.ammo,5);assert.equal(fresh.time,0);
 const r=seededRandom(1),s=seededRandom(1);for(let i=0;i<10;i++)assert.equal(r(),s());
});
test('nonfinite and oversized frame deltas do not corrupt the simulation',()=>{
 const g=targetGame();g.step(NaN);g.step(-1);assert.equal(g.time,0);g.step(100,{forward:true});near(g.time,1/30);assert.ok(Number.isFinite(g.player.z));
});
test('bot hitboxes rotate with the rendered torso and arms register as limb hits',()=>{
 const bot={x:0,y:0,z:-5,yaw:Math.PI/2,alive:true};
 // Turning 90 degrees narrows the torso's projected width from .76 to .52.
 assert.notEqual(trace([0.35,1.6,0],[0,0,-1],[],[bot]).part,'body');
 bot.yaw=0;assert.equal(trace([0.49,1.17,0],[0,0,-1],[],[bot]).part,'limb');
});
test('bots turn their rendered forward axis toward the player in every quadrant',()=>{
 const g=targetGame();const bot=g.bots[0];
 for(const [x,z] of [[10,0],[-10,0],[0,10],[0,-10],[7,-4]]){
  g.player.x=bot.x+x;g.player.z=bot.z+z;g.updateBot(bot,0);
  near(-Math.sin(bot.yaw),x/Math.hypot(x,z));near(-Math.cos(bot.yaw),z/Math.hypot(x,z));
 }
});
test('low cover blocks a bot muzzle even when its head can see over it',()=>{
 const g=targetGame('run');g.player.invulnerable=0;g.bots[0].wait=0;g.world.solids=[boxAt(0,0.625,13,10,1.25,1)];
 advance(g,3);assert.equal(g.player.health,100);assert.equal(g.drainEvents().some(e=>e.type==='enemyShot'),false);
});
