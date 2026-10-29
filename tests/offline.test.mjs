import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,stat} from 'node:fs/promises';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function harness(){
 const handlers={},removed=[],scope='https://example.test/QUICKSCOPER/',prefix=`quickscoper:${scope}:`;
 let files=[];
 const cache={addAll:async list=>{files=list;},match:async request=>request.includes?.('index.html')?'offline-document':undefined};
 const caches={open:async()=>cache,keys:async()=>[prefix+'old',prefix+'v0.1.0-2','another-game-cache','quickscoper:https://example.test/other/:old'],delete:async key=>removed.push(key)};
 vm.runInNewContext(source,{self:{registration:{scope},clients:{claim:async()=>{}},addEventListener:(n,fn)=>handlers[n]=fn},caches,URL,fetch:async request=>'network:'+request.url});
 return {handlers,removed,scope,prefix,files:()=>files};
}
test('offline install precaches every runtime import and local UI asset',async()=>{
 const h=harness();let pending;h.handlers.install({waitUntil:p=>pending=p});await pending;
 for(const file of h.files())if(file!=='./')await stat(new URL('../'+file,import.meta.url));
 for(const name of ['app','game','math','world','renderer','audio'])assert.ok(h.files().includes(`./src/${name}.js`));
 assert.ok(h.files().includes('./index.html'));assert.ok(h.files().includes('./style.css'));
});
test('activation only deletes obsolete caches belonging to this game and scope',async()=>{
 const h=harness();let pending;h.handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(h.removed,[h.prefix+'old']);
});
test('offline navigation works under the repository base path and with query strings',async()=>{
 const h=harness();let response;h.handlers.fetch({request:{method:'GET',url:h.scope+'?practice',mode:'navigate'},respondWith:p=>response=p});assert.equal(await response,'offline-document');
});
test('worker ignores unrelated games, external requests and non-GET requests',()=>{
 const h=harness();for(const request of [{method:'GET',url:'https://example.test/OTHER/game.js'},{method:'GET',url:'https://other.test/QUICKSCOPER/'},{method:'POST',url:h.scope}])h.handlers.fetch({request,respondWith:()=>assert.fail('must not intercept')});
});
