"""ATMÓS motion contracts. Controlled weather fixtures, never live measurements.
Run: python tests/test_motion.py --url http://localhost:8765/ --output results.json
Requires playwright and Chromium (CHROMIUM_PATH may override /usr/bin/chromium).
"""
import argparse, json, os, time, math, statistics, sys
from datetime import datetime, timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright

def fixture(code=61):
    start=datetime(2026,10,11)
    ts=[(start+timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(192)]
    h={'time':ts}
    fields={'temperature_2m':20,'apparent_temperature':19,'precipitation_probability':60,'precipitation':.6,'weather_code':code,'wind_speed_10m':14,'wind_gusts_10m':23,'wind_direction_10m':90,'uv_index':3,'visibility':10000,'relative_humidity_2m':65}
    for k,v in fields.items(): h[k]=[round(v+math.sin(i/7)*3,2) if k in ('temperature_2m','apparent_temperature','wind_speed_10m') else v for i in range(192)]
    days=[(start+timedelta(days=i)).strftime('%Y-%m-%d') for i in range(8)]
    d={'time':days}
    for k,v in {'weather_code':code,'temperature_2m_max':24,'temperature_2m_min':13,'precipitation_sum':3,'precipitation_probability_max':70,'wind_speed_10m_max':19,'wind_gusts_10m_max':30,'uv_index_max':6,'daylight_duration':46000}.items():d[k]=[v]*8
    d['sunrise']=[s+'T06:17' for s in days];d['sunset']=[s+'T19:08' for s in days]
    return {'latitude':-34.6037,'longitude':-58.3816,'timezone':'America/Argentina/Buenos_Aires','current':dict(temperature_2m=20,apparent_temperature=19,weather_code=code,is_day=1,time='2026-10-11T20:00',wind_speed_10m=14,wind_gusts_10m=24,wind_direction_10m=90,relative_humidity_2m=65,cloud_cover=75,pressure_msl=1011),'hourly':h,'daily':d}

PROBE=r'''(() => {
 if(window.__motionProbe)return;window.__motionProbe=true;
 const add=EventTarget.prototype.addEventListener;
 window.__chartAdds={};window.__unhandled=[];window.__frames=[];window.__long=[];
 EventTarget.prototype.addEventListener=function(t,f,o){if(this.id==='weatherChart')window.__chartAdds[t]=(window.__chartAdds[t]||0)+1;return add.call(this,t,f,o)};
 add.call(window,'unhandledrejection',e=>window.__unhandled.push(String(e.reason)));
 const raf=window.requestAnimationFrame.bind(window),caf=window.cancelAnimationFrame.bind(window);
 window.__pendingRAF=new Set();window.__rafCalls=0;
 window.requestAnimationFrame=f=>{let id=raf(t=>{window.__pendingRAF.delete(id);window.__rafCalls++;f(t)});window.__pendingRAF.add(id);return id};
 window.cancelAnimationFrame=id=>{window.__pendingRAF.delete(id);caf(id)};
 try{new PerformanceObserver(l=>window.__long.push(...l.getEntries().map(x=>x.duration))).observe({type:'longtask',buffered:true})}catch{}
})();'''

def run(url, output, baseline=False):
    results=[]; errors=[]
    def check(name,fn):
        t=time.perf_counter()
        try:
            info=fn();results.append({'name':name,'passed':True,'seconds':round(time.perf_counter()-t,3),'observed':info})
        except Exception as e:results.append({'name':name,'passed':False,'seconds':round(time.perf_counter()-t,3),'error':str(e)[:900]})
    def expect(cond,msg):
        if not cond:raise AssertionError(msg)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':1440,'height':1000},service_workers='block')
        ctx.add_init_script(PROBE)
        ctx.route('https://api.open-meteo.com/**',lambda r:r.fulfill(json=fixture()))
        ctx.route('https://geocoding-api.open-meteo.com/**',lambda r:r.fulfill(json={'results':[{'name':'Córdoba','latitude':-31.4135,'longitude':-64.1811,'country':'Argentina'}]}))
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        if url.startswith('inline:'):
            page.evaluate(PROBE)
            page.evaluate('''d=>{window.fetch=async (url,opts)=>{if(opts?.signal?.aborted)throw new DOMException('Aborted','AbortError');return new Response(JSON.stringify(String(url).includes('geocoding')?{results:[{name:'Córdoba',latitude:-31.4135,longitude:-64.1811,country:'Argentina'}]}:d),{status:200,headers:{'Content-Type':'application/json'}})}}''',fixture())
            page.set_content(Path(url[7:]).read_text(),wait_until='load')
        else: page.goto(url)
        page.wait_for_selector('.hour-tile')
        def listener_case():
            before=page.evaluate('({...window.__chartAdds})')
            page.evaluate("() => {for(let i=0;i<20;i++)document.querySelector(`[data-hour='${i%24}']`).click();}")
            after=page.evaluate('({...window.__chartAdds})')
            expect(after==before,f'chart listener registrations grew: {before} -> {after}')
            return after
        check('Chart listeners remain constant across 20 hour selections',listener_case)
        def focus_case():
            page.locator('#openCity').click();page.wait_for_selector('#citySearch:focus')
            inert=page.locator('.shell').evaluate('(e)=>e.inert')
            page.keyboard.press('Escape')
            expect(page.locator('#cityOverlay').is_hidden(),'dialog still visible')
            expect(page.locator('#openCity').evaluate('(e)=>e===document.activeElement'),'focus not restored')
            expect(inert,'background not inert while dialog open')
        check('Dialog isolates background and restores focus',focus_case)
        def off_case():
            page.locator('#motionToggle').click()
            page.evaluate("document.querySelector('[data-day=\"2\"]').click()")
            page.wait_for_timeout(30)
            animations=page.evaluate("document.getAnimations().filter(a=>a.playState==='running').map(a=>({name:a.animationName||'WAAPI',target:a.effect?.target?.className?.baseVal||a.effect?.target?.className}))")
            page.locator('#motionToggle').click()
            expect(not animations,f'Motion disabled but animations remain: {animations}')
        check('Manual motion off stops CSS and JavaScript immediately',off_case)
        def steady_case():
            page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(3800)
            pending=page.evaluate('window.__pendingRAF.size')
            expect(pending==0,f'{pending} requestAnimationFrame loops still scheduled after rest')
            return {'pendingRAF':pending}
        check('Atmosphere and transient effects reach rest',steady_case)
        page.screenshot(path=str(Path(output).with_name('baseline-desktop.png' if baseline else 'semantic-desktop.png')),full_page=True)
        # reproducible before/after interaction workload, not a device benchmark
        def performance_case():
            return page.evaluate('''async()=>{const samples=[];for(let j=0;j<30;j++){const t=performance.now();document.querySelector(`[data-hour="${j%24}"]`).click();samples.push(performance.now()-t);await new Promise(r=>setTimeout(r,0));}return {samples,rafCallbacks:window.__rafCalls,longTasks:window.__long,chartListenerRegistrations:window.__chartAdds}}''')
        check('Measured 30 hour selections',performance_case)
        result={'browser':browser.version,'viewport':[1440,1000],'fixture':'synthetic, deterministic, 192 hours / 8 days','load':url,'results':results,'pageErrors':errors,'unhandled':page.evaluate('window.__unhandled')}
        browser.close()
    Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps({'output':output,'passed':sum(r['passed'] for r in results),'total':len(results),'failures':[r for r in results if not r['passed']]},ensure_ascii=False,indent=2))
    return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--url',default='http://localhost:8765/');p.add_argument('--output',default='results.json');p.add_argument('--baseline',action='store_true');a=p.parse_args();r=run(a.url,a.output,a.baseline);sys.exit(0 if all(t['passed'] for t in r['results']) and not r['pageErrors'] and not r['unhandled'] else 1)
