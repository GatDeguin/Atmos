const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..'),scope='https://example.test/Atmos/';
function environment(){
 const handlers={},deleted=[],resources=[],store=new Map(),skipped=[];
 const cache={addAll:async xs=>{for(const x of xs){resources.push(x.url);const u=new URL(x.url);const file=u.pathname.replace('/Atmos/','')||'index.html';assert.ok(fs.existsSync(path.join(root,file)),`Missing resource ${file}`);store.set(x.url,new Response(fs.readFileSync(path.join(root,file))));}},match:async r=>store.get(typeof r==='string'?r:r.url)?.clone()};
 const self={registration:{scope},clients:{claim:async()=>{}},addEventListener:(n,h)=>handlers[n]=h,skipWaiting:()=>skipped.push(true)};
 const env={self,caches:{open:async()=>cache,keys:async()=>['other-app-v1','atmos:/Atmos/:old','atmos:/Atmos/:2.0.0'],delete:async k=>deleted.push(k)},fetch:async()=>{throw Error('TEST OFFLINE');},URL,Request,Response,AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),env);
 return {handlers,deleted,resources,store,skipped};
}
async function run(e,name,event={}){let promise;e.handlers[name]({...event,waitUntil:p=>promise=p,respondWith:p=>promise=p});return await promise;}
test('PWA precache references all existing files inside /Atmos/',async()=>{const e=environment();await run(e,'install');assert.ok(e.resources.length>=12);assert.ok(e.resources.every(x=>x.startsWith(scope)));});
test('SW removes only old Atmos caches, not other applications',async()=>{const e=environment();await run(e,'activate');assert.deepEqual(e.deleted,['atmos:/Atmos/:old']);});
test('SW never intercepts or disguises cached meteorological API responses',async()=>{const e=environment();const r=await run(e,'fetch',{request:{method:'GET',mode:'cors',url:'https://api.open-meteo.com/v1/forecast'}});assert.equal(r,undefined);});
test('offline navigation restores the precached app shell including location query',async()=>{const e=environment();await run(e,'install');const r=await run(e,'fetch',{request:{method:'GET',mode:'navigate',url:scope+'?lat=-34&lon=-58'}});assert.equal(r.status,200);assert.match(await r.text(),/id="weatherContent"/);});
test('service worker update requires an explicit message',async()=>{const e=environment();await run(e,'install');assert.equal(e.skipped.length,0);await run(e,'message',{data:{type:'SKIP_WAITING'}});assert.equal(e.skipped.length,1);});
