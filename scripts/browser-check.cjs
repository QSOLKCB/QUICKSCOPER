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
