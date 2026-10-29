// CI-only browser smoke. The shipped game has no dependency on Playwright.
const {chromium}=require('playwright');
const {createServer}=require('node:http');
const {readFile,mkdir}=require('node:fs/promises');
const {resolve,extname,sep}=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const root=resolve('dist'),base='/QUICKSCOPER/';
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  const server=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(!path.startsWith(base)){res.writeHead(404);res.end();return;}
      const file=resolve(root,decodeURIComponent(path.slice(base.length)||'index.html'));
      if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
      const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}${base}`;
  let browser,page;
  try{
    browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:1440,height:900}});page=await context.newPage();
    await page.addInitScript(()=>{window.__inputTrace=[];window.addEventListener('mousemove',e=>{if((e.movementX||e.movementY)&&window.__inputTrace.length<15)window.__inputTrace.push({dx:e.movementX,dy:e.movementY,locked:!!document.pointerLockElement});});});
    const errors=[],badResponses=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)badResponses.push(response.url());});
    await page.goto(url);await page.waitForFunction(()=>!document.getElementById('start').disabled);
    await page.waitForFunction(()=>document.getElementById('offline-status').textContent.includes('OFFLINE READY'));
    await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/quickscoper-menu.png'});
    // Verify nonuniform world pixels, not merely successful context construction.
    const rendered=await page.evaluate(()=>{
      const canvas=document.getElementById('world'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
      return new Promise(resolve=>requestAnimationFrame(()=>{
        const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        const colors=new Set();for(let i=0;i<pixels.length;i+=400)colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        resolve({colors:colors.size,error:gl.getError()});
      }));
    });
    assert.ok(rendered.colors>15,`Scene must render varied world pixels, got ${rendered.colors}`);assert.equal(rendered.error,0);
    console.log('Scene rendering and offline install: PASS');
    await page.locator('#mode-practice').click();await page.locator('#start').click();
    await page.waitForFunction(()=>document.pointerLockElement?.id==='world'&&document.getElementById('pause').hidden);
    await page.waitForFunction(()=>document.getElementById('pause').hidden);
    await page.screenshot({path:'artifacts/quickscoper-entry.png'});
    console.log('Entry input trace:',await page.evaluate(()=>window.__inputTrace));
    // CDP's absolute mouse-button coordinates can generate phantom movement under
    // Pointer Lock. Deliver button events without moving the captured pointer;
    // actual capture, keyboard input and movement remain browser-driven.
    const button=async(type,which=0)=>page.evaluate(({type,which})=>window.dispatchEvent(new MouseEvent(type,{button:which,bubbles:true,cancelable:true})),{type,which});
    await button('mousedown');await button('mouseup');await page.waitForFunction(()=>document.getElementById('ammo').textContent==='04');
    await button('mousedown',2);await page.waitForFunction(()=>document.getElementById('scope-tip').textContent.includes('AIM'));
    await page.screenshot({path:'artifacts/quickscoper-scope.png'});await button('mouseup',2);
    await page.keyboard.press('r');await page.waitForFunction(()=>document.getElementById('ammo').textContent==='05');
    await page.screenshot({path:'artifacts/quickscoper-game.png'});
    console.log('Firing, scope and reload: PASS');console.log('Input trace:',await page.evaluate(()=>window.__inputTrace));
    await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
    await page.keyboard.press('p');await page.locator('#pause').waitFor({state:'visible'});
    const before=await page.locator('#time').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#time').textContent(),before);
    console.log('Initial pause: PASS');
    await page.locator('#restart').click();await page.waitForFunction(()=>document.pointerLockElement?.id==='world'&&document.getElementById('pause').hidden);
    assert.equal(await page.locator('#ammo').textContent(),'05');assert.equal(await page.locator('#score').textContent(),'000000');
    await page.keyboard.press('p');await page.locator('#pause').waitFor({state:'visible'});await page.locator('#quit').click();
    console.log('Restart, pause and menu return: PASS');
    await page.locator('#settings-open').click();await page.locator('#reduced').check();await page.getByRole('button',{name:'ALL SET'}).click();
    // Cached repository-subpath navigation must still boot with networking disabled.
    await context.setOffline(true);await page.reload();await page.locator('#start').waitFor({state:'visible'});
    assert.equal(await page.locator('#start').isEnabled(),true);
    await page.locator('#settings-open').click();assert.equal(await page.locator('#reduced').isChecked(),true);await page.getByRole('button',{name:'ALL SET'}).click();
    await page.locator('#start').click();await page.waitForFunction(()=>document.pointerLockElement?.id==='world'&&document.getElementById('pause').hidden);
    await page.keyboard.press('p');await page.locator('#pause').waitFor({state:'visible'});
    assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
    console.log('Chromium: rendered world pixels; mouse capture; firing; scope; reload; movement; pause; restart; persisted settings; offline subpath reload: PASS');
    await context.setOffline(false);
    // Instrument only this test context; the distributed modules have no debug
    // globals. Feed standard Gamepad samples through the real app input loop.
    const controllerContext=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
    page=await controllerContext.newPage();page.on('pageerror',error=>errors.push(error.message));
    const appSource=await readFile(resolve(root,'src/app.js'),'utf8');
    await page.route('**/src/app.js',route=>route.fulfill({contentType:'text/javascript',body:appSource+'\nglobalThis.__qa={get game(){return game},effects,sound};'}));
    await page.addInitScript(()=>{
      window.__pad={index:0,id:'Xbox standard smoke fixture',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>window.__pad.connected?[window.__pad]:[]});
    });
    await page.goto(url);await page.waitForFunction(()=>window.__qa&&document.getElementById('controller-status').textContent.includes('READY'));
    await page.locator('#profile').selectOption('xbox');await page.locator('#mode-practice').click();await page.locator('#start').click();
    await page.waitForFunction(()=>document.getElementById('menu').hidden&&document.getElementById('pause').hidden);
    assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
    const padButton=async(index,value)=>page.evaluate(({index,value})=>{window.__pad.buttons[index]={value,pressed:value>0.5};},{index,value});
    const release=async()=>{await page.evaluate(()=>{window.__pad.axes.fill(0);for(const b of window.__pad.buttons){b.value=0;b.pressed=false;}});await page.waitForTimeout(80);};
    await release();
    await page.evaluate(()=>{
      const g=window.__qa.game;g.player.pitch=Math.atan2(1.2-1.68,10);
      g.bots=[8,3].map((z,id)=>({...g.bots[id],id,x:0,y:0,z,hp:100,alive:true,yaw:0,think:99,moveX:0,moveZ:0}));
    });
    // LT and RT together exercise the buffered 150 ms settle through actual input.
    await padButton(6,1);await padButton(7,1);
    await page.waitForFunction(()=>window.__qa.game.stats.collaterals===1);
    const collateral=await page.evaluate(()=>({stats:window.__qa.game.stats,particles:window.__qa.effects.particles.length,music:window.__qa.sound.musicActive,context:window.__qa.sound.context.state}));
    assert.equal(collateral.stats.kills,2);assert.equal(collateral.stats.hits,1);assert.equal(collateral.stats.quick,2);assert.ok(collateral.particles>=64);assert.equal(collateral.music,true);assert.equal(collateral.context,'running');
    await padButton(9,1);await page.locator('#pause').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.__qa.sound.musicVoices.size),0);
    // Freeze the impact for visual inspection; hide only the pause panel.
    await page.evaluate(()=>document.getElementById('pause').hidden=true);
    await page.screenshot({path:'artifacts/quickscoper-collateral-dust.png'});
    const glStatus=await page.evaluate(()=>{const c=document.getElementById('world');return (c.getContext('webgl2')||c.getContext('webgl')).getError();});assert.equal(glStatus,0);
    await page.evaluate(()=>document.getElementById('pause').hidden=false);
    await page.locator('#resume').click();await page.waitForTimeout(1000);assert.equal(await page.locator('#ammo').textContent(),'04','held trigger must not refire on resume');
    await page.waitForFunction(()=>window.__qa.game.weapon.bolt===0);
    await release();await padButton(7,1);await page.waitForFunction(()=>document.getElementById('ammo').textContent==='03');await release();
    await padButton(2,1);await release();await page.waitForFunction(()=>document.getElementById('ammo').textContent==='05');
    const position=await page.evaluate(()=>({x:window.__qa.game.player.x,yaw:window.__qa.game.player.yaw}));
    await page.evaluate(()=>{window.__pad.axes=[0.7,0,0.6,0];});await page.waitForTimeout(250);await release();
    const moved=await page.evaluate(()=>({x:window.__qa.game.player.x,yaw:window.__qa.game.player.yaw}));assert.ok(moved.x>position.x);assert.ok(moved.yaw>position.yaw);
    await page.evaluate(()=>window.__pad.connected=false);await page.locator('#pause').waitFor({state:'visible'});assert.match(await page.locator('#lock-message').textContent(),/disconnected/i);
    const frozen=await page.evaluate(()=>window.__qa.game.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__qa.game.time),frozen);
    await page.evaluate(()=>window.__pad.connected=true);await release();await padButton(0,1);
    await page.waitForFunction(()=>document.getElementById('pause').hidden);await release();
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.locator('#pause').waitFor({state:'visible'});
    await page.locator('#pause-settings').click();await page.locator('#music-volume').focus();await release();await padButton(14,1);await release();assert.equal(await page.locator('#music-volume').inputValue(),'0.25');
    await padButton(1,1);await page.waitForFunction(()=>!document.getElementById('settings').open);await release();
    await page.locator('#quit').click();await release();await padButton(0,1);await page.waitForFunction(()=>document.getElementById('menu').hidden&&document.getElementById('pause').hidden);await release();
    assert.equal(await page.locator('#ammo').textContent(),'05');assert.equal(await page.locator('#score').textContent(),'000000');
    assert.deepEqual(errors,[]);
    console.log('Xbox emulation: buffered collateral, data dust, music, one shot per trigger, analog movement/look, reload, neutral resume, disconnect pause, focus pause, menus and sliders: PASS');
    // Exercise the WebGL 1 fallback, including the point-sprite shader.
    const webgl1=await browser.newContext();const legacy=await webgl1.newPage();
    await legacy.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type==='webgl2'?null:original.call(this,type,...rest);};});
    await legacy.goto(url);await legacy.waitForFunction(()=>!document.getElementById('start').disabled);
    assert.equal(await legacy.evaluate(()=>document.getElementById('world').getContext('webgl').getError()),0);
    console.log('WebGL 1 shader fallback: PASS');
    // Also exercise the explicit unsupported-WebGL branch, without masking failures above.
    const unsupported=await browser.newContext();const fallback=await unsupported.newPage();
    await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...rest){return type.startsWith('webgl')?null:original.call(this,type,...rest);};});
    await fallback.goto(url);await fallback.locator('#error').waitFor({state:'visible'});assert.equal(await fallback.locator('#start').isDisabled(),true);
    console.log('Unsupported graphics: actionable error and disabled launch: PASS');
  }catch(error){
    if(page){await page.screenshot({path:'artifacts/failure.png'}).catch(()=>{});console.error('Visible state:',await page.locator('body').innerText().catch(()=>''));console.error('Pointer lock:',await page.evaluate(()=>document.pointerLockElement?.id).catch(()=>''));}
    throw error;
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
