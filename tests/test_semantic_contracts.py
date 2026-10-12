"""Semantic motion browser contracts. See test_motion.py for the deterministic fixture.
This suite uses inline DOM loading when navigation is restricted. Network and physical iOS
are explicitly not verified. Run from repository root: python tests/test_semantic_contracts.py.
"""
import json, os, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_motion import fixture, PROBE
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('ATMOS_EVIDENCE',ROOT/'test-results'));OUT.mkdir(exist_ok=True,parents=True)
results=[];errors=[]
def expect(value,msg):
    if not value:raise AssertionError(msg)
def test(name,fn):
    t=time.perf_counter()
    try:info=fn();results.append(dict(name=name,passed=True,seconds=round(time.perf_counter()-t,3),observed=info))
    except Exception as e:results.append(dict(name=name,passed=False,seconds=round(time.perf_counter()-t,3),error=str(e)[:1600]))

def run():
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  def create(width=1440,height=1000,reduced='no-preference',disable=False,code=61,touch=False):
    ctx=browser.new_context(viewport=dict(width=width,height=height),reduced_motion=reduced,has_touch=touch,is_mobile=touch,service_workers='block')
    p=ctx.new_page();p.set_default_timeout(3000);p.on('pageerror',lambda e:errors.append(str(e)))
    p.evaluate(PROBE)
    if disable:p.evaluate('Element.prototype.animate=undefined;window.IntersectionObserver=undefined;window.ResizeObserver=undefined')
    p.evaluate('''d=>{window.__fixture=d;window.__requests=0;window.fetch=async(url,options)=>{window.__requests++;if(options?.signal?.aborted)throw new DOMException('Aborted','AbortError');return new Response(JSON.stringify(String(url).includes('geocoding')?{results:[{name:'Córdoba',latitude:-31.4135,longitude:-64.1811,country:'Argentina'}]}:d),{status:200,headers:{'Content-Type':'application/json'}})}}''',fixture(code))
    p.set_content((ROOT/'index.html').read_text(),wait_until='load');p.wait_for_selector('.hour-tile');return p,ctx
  p,c=create()
  def settle():p.wait_for_function('motionSnapshot().active===0 && !motionSnapshot().spring',timeout=3000)
  def repeated_modal():
    p.evaluate("()=>{for(let i=0;i<20;i++){document.querySelector('#openCity').click();document.querySelector('#closeCity').click();}}")
    expect(p.evaluate("document.querySelector('#cityOverlay').hidden && !document.querySelector('.shell').inert"),'dialog/background invalid')
    expect(p.evaluate("!document.querySelector('#cityOverlay').contains(document.activeElement)"),'focus trapped in hidden dialog')
    expect(p.evaluate("[...motionRuntime.active.keys()].filter(e=>document.querySelector('#cityOverlay').contains(e)).length===0"),'modal animations leaked')
    return p.evaluate('motionSnapshot()')
  test('20 open/close cycles clean animations and focus',repeated_modal)
  def days():
    return p.evaluate('''async()=>{for(const fraction of [0,.5,.95]){for(let i=0;i<20;i++){document.querySelector(`[data-day="${i%7}"]`).click();for(const [el,record] of motionRuntime.active)if(el.classList.contains('day-detail-region'))record.animation.currentTime=record.animation.effect.getTiming().duration*fraction;}
      motionRuntime.choice=false;syncMotionUI();
      const open=[...document.querySelectorAll('.day-detail-region')].filter(x=>!x.hidden);if(open.length!==(state.openDay<0?0:1))throw Error('wrong final regions');if(open[0]?.id!==`day-detail-${state.openDay}`)throw Error('wrong selected identity');
      if([...document.querySelectorAll('.day-detail-region')].some(e=>e.style.height||e.style.overflow||e.style.transform))throw Error('inline geometry left behind');motionRuntime.choice=true;syncMotionUI();}return {openDay:state.openDay,regions:document.querySelectorAll('.day-detail-region').length};}''')
  test('Accordion: 60 redirected transitions at 0/50/95 percent',days)
  def graph_identity():
    r=p.evaluate('''()=>{const svg=document.querySelector('#weatherChart'),line=svg.querySelector('[data-motion-series]'),d=line.getAttribute('d');for(let i=0;i<100;i++)selectForecastHour(i%24);return {same:line===svg.querySelector('[data-motion-series]'),geometry:d===line.getAttribute('d'),selected:state.selectedHour,pressed:document.querySelectorAll('[data-hour][aria-pressed=true]').length,registrations:window.__chartAdds}}''')
    expect(r['same'] and r['geometry'] and r['selected']==3 and r['pressed']==1,str(r));return r
  test('100 hour selections preserve SVG series identity and exact values',graph_identity)
  def spring():
    p.evaluate("()=>{for(let i=0;i<30;i++){document.querySelector(`[data-chart='${['rain','wind','temp'][i%3]}']`).click();}}")
    settle();r=p.evaluate('''()=>{const m=document.querySelector('.selection-marker').getBoundingClientRect(),b=document.querySelector('[data-chart][aria-pressed=true]').getBoundingClientRect();return {delta:Math.abs(m.left-b.left),markers:document.querySelectorAll('.selection-marker').length,spring:motionSnapshot().spring}}''')
    expect(r['delta']<.6 and r['markers']==1 and not r['spring'],str(r));return r
  test('Spring: latest of 30 metric intentions settles on one selection',spring)
  def theme():
    p.evaluate("()=>{for(let i=0;i<20;i++)document.querySelector('#themeToggle').click()}");settle()
    expect(p.locator('[data-motion-ghost]').count()==0,'ghost SVGs leaked')
    expect(p.locator('#themeToggle svg').count()==1,'duplicate theme icons')
    return p.evaluate('motionSnapshot()')
  test('Crossfade: 20 theme reversals leave one non-duplicated icon',theme)
  def unchanged_refresh():
    r=p.evaluate('''()=>{const key=motionRuntime.sceneKey;render();return {sceneKeyUnchanged:motionRuntime.sceneKey===key,particles:motionSnapshot().particles,heroAnimations:document.querySelector('.hero').getAnimations().length,seenCharts:motionRuntime.seenCharts.size}}''')
    expect(r['sceneKeyUnchanged'] and r['particles']==0 and r['heroAnimations']==0,str(r));return r
  test('Rerender does not replay hero/particle introductions',unchanged_refresh)
  def missing():
    p.evaluate("state.data.hourly.temperature_2m[startHourIndex()+4]=null;renderChart()")
    r=p.evaluate("()=>({d:document.querySelector('[data-motion-series]').getAttribute('d'),area:!!document.querySelector('path[fill=\"url(#fillArea)\"]')})")
    expect(r['d'].count('M')==2 and not r['area'],str(r))
    p.evaluate('state.data=structuredClone(window.__fixture);render()');return r
  test('Missing measurements retain curve gaps and never become zero',missing)
  def favorites():
    return p.evaluate('''async()=>{state.favorites=PRESETS.slice(0,5);updateFavorites();const key=cacheIdentifier(state.favorites[2]);document.querySelector('[data-remove-fav="1"]').focus();document.querySelector('[data-remove-fav="1"]').click();
      const node=document.querySelector(`[data-place-key="${key}"]`);const effect=motionRuntime.active.get(node);if(!effect)throw Error('no FLIP for surviving favorite');
      await Promise.all([...motionRuntime.active.values()].map(x=>x.animation.finished.catch(()=>{})));
      if(!document.activeElement.matches('[data-remove-fav]'))throw Error('remove lost keyboard focus');if(node.style.transform)throw Error('residual transform');
      return {favorites:state.favorites.length,focused:document.activeElement.getAttribute('aria-label')};}''')
  test('Favorite removal FLIP preserves location identity and keyboard focus',favorites)
  def reduced_mid():
    p.locator('#openCity').click();p.locator('#citySearch').focus();p.emulate_media(reduced_motion='reduce');p.wait_for_function("document.documentElement.dataset.motion==='off'")
    r=p.evaluate('''()=>({snapshot:motionSnapshot(),running:document.getAnimations().filter(a=>a.playState==='running').length,focus:document.activeElement.id,search:document.querySelector('#cityOverlay').hidden})''')
    expect(r['running']==0 and r['snapshot']['active']==0 and not r['snapshot']['raf'] and r['focus']=='citySearch' and not r['search'],str(r))
    p.keyboard.press('Escape');p.emulate_media(reduced_motion='no-preference');return r
  test('System Reduce Motion during dialog transition settles without losing focus',reduced_mid)
  def resize():
    p.evaluate("document.querySelector('[data-day=\"3\"]').click();document.querySelector('[data-chart=\"wind\"]').click()")
    p.set_viewport_size({'width':390,'height':844});settle()
    expect(p.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'horizontal viewport overflow')
    expect(p.evaluate("Math.abs(document.querySelector('.selection-marker').getBoundingClientRect().left-document.querySelector('[data-chart][aria-pressed=true]').getBoundingClientRect().left)<1"),'selection alignment invalid')
    p.screenshot(path=str(OUT/'mobile-390.png'),full_page=True)
  test('Resize during accordion/spring settles correctly at 390 px',resize)
  def keyboard():
    p.locator('#openCity').click();p.locator('#closeCity').focus();p.keyboard.press('Shift+Tab');expect(p.locator('#geoBtn').evaluate('(e)=>e===document.activeElement'),'reverse trap failed')
    p.keyboard.press('Tab');expect(p.locator('#closeCity').evaluate('(e)=>e===document.activeElement'),'forward trap failed')
    p.keyboard.press('Escape');expect(p.locator('#openCity').evaluate('(e)=>e===document.activeElement'),'restore focus failed')
  test('Keyboard focus trap, Escape and origin restoration',keyboard)
  def search():
    p.locator('#openCity').click();p.locator('#citySearch').fill('Cordoba');p.wait_for_function("document.querySelector('#searchHelp').textContent.includes('resultado')")
    expect(p.locator('.place-item').count()==1,'results mismatch');p.locator('.place-item').click();p.wait_for_function("document.querySelector('#headerCity').textContent==='Córdoba' && !state.loading")
    expect(p.evaluate('state.location.latitude===-31.4135'), 'selected wrong coordinates');return {'city':p.locator('#headerCity').inner_text()}
  test('Real search/select flow against controlled API responses',search)
  def stale():
    r=p.evaluate('''async()=>{let resolve;window.fetch=()=>new Promise(r=>resolve=r);const slow=loadLocation(PRESETS[2]);window.fetch=async()=>new Response(JSON.stringify(window.__fixture),{status:200});await loadLocation(PRESETS[3]);resolve(new Response(JSON.stringify(window.__fixture),{status:200}));await slow;return {name:state.location.name,loading:state.loading,hero:document.querySelector('.hero-kicker').textContent}}''')
    expect(r['name']=='Mendoza' and not r['loading'] and 'Mendoza' in r['hero'],str(r));return r
  test('Late response cannot overwrite latest city during motion',stale)
  def error_case():
    p.evaluate("window.fetch=async()=>{throw Error('Fixture connection failure')};loadLocation(PRESETS[6])")
    p.wait_for_selector('#retryError');expect(p.evaluate("motionSnapshot().particles===0 && !motionSnapshot().raf && motionSnapshot().observers===0"),'error left scene resources')
    p.evaluate("window.fetch=async()=>new Response(JSON.stringify(window.__fixture),{status:200})")
    p.locator('#retryError').click();p.wait_for_selector('.hour-tile');expect(p.evaluate('!state.loading'),'loading not cleared')
  test('Network failure and retry clean the scene and recover domain',error_case)
  def visibility():
    p.evaluate("document.querySelector('[data-day=\"4\"]').click();window.dispatchEvent(new PageTransitionEvent('pagehide'))")
    r=p.evaluate('motionSnapshot()');expect(r['active']==0 and not r['spring'] and not r['raf'] and r['observers']==0,str(r));return r
  test('pagehide disposes temporary resources',visibility)
  def sparse():
    p.evaluate("state.data.hourly.time=state.data.hourly.time.slice(0,1);renderChart()")
    expect('Sin suficientes' in p.locator('#weatherChart').text_content(),'missing empty state')
    expect(p.evaluate('motionRuntime.chart===null'),'stale selection model after empty chart')
    p.evaluate('state.data=structuredClone(window.__fixture);render()')
  test('Empty chart has no stale interactive selection model',sparse)
  p.set_viewport_size(dict(width=1440,height=1000));p.evaluate('state.data=structuredClone(window.__fixture);render()');settle()
  def temporal():
    p.locator('#openCity').click();p.evaluate("const a=motionRuntime.active.get(document.querySelector('#cityModal'))?.animation;if(a){a.pause();a.currentTime=0;}")
    p.screenshot(path=str(OUT/'dialog-start.png'))
    p.evaluate("const a=motionRuntime.active.get(document.querySelector('#cityModal'))?.animation;if(a)a.currentTime=130")
    p.screenshot(path=str(OUT/'dialog-mid.png'))
    p.evaluate("const a=motionRuntime.active.get(document.querySelector('#cityModal'))?.animation;if(a)a.finish()")
    p.screenshot(path=str(OUT/'dialog-end.png'));p.keyboard.press('Escape')
    return 'start / 130 ms / final screenshots'
  test('Temporal snapshots at defined transition positions',temporal)
  for width,height in ((320,720),(390,844),(844,390),(768,1024),(1440,1000)):
    def viewport(w=width,h=height):
      p.set_viewport_size(dict(width=w,height=h));settle()
      expect(p.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow {w}')
      expect(p.locator('.hour-tile').count()==24,'hours lost')
      return {'width':w,'height':h}
    test(f'Responsive {width}×{height}',viewport)
  def city_anchor():
    p.set_viewport_size(dict(width=320,height=720));
    p.locator('#headerCity').evaluate("e=>e.textContent='Buenos Aires — Ciudad Autónoma de Buenos Aires'")
    r=p.locator('#headerCity').evaluate('(e)=>({width:e.getBoundingClientRect().width,text:e.textContent})')
    p.evaluate('updateHeader()')
    expect(r['width']>=50,f'City identity collapsed: {r}');return r
  test('320 px: city label remains a readable spatial anchor',city_anchor)
  def no_apis():
    q,cc=create(disable=True,code=0);q.evaluate("document.querySelector('[data-day=\"2\"]').click();document.querySelector('[data-chart=\"wind\"]').click();document.querySelector('#openCity').click();document.querySelector('#closeCity').click();")
    expect(q.evaluate('state.openDay===2 && state.activeChart==="wind" && !motionSnapshot().active'),'fallback lost functionality');cc.close()
  test('No WAAPI/observers: core flows remain functional',no_apis)
  def touch():
    q,cc=create(390,844,touch=True);q.locator('[data-hour="2"]').tap();q.locator('[data-day="2"]').tap();expect(q.evaluate('state.selectedHour===2 && state.openDay===2'),'touch selection mismatch');cc.close()
  test('Touch emulation selects hours and expands forecast days',touch)
  def reduced_initial():
    q,cc=create(reduced='reduce');q.locator('#openCity').click();q.keyboard.press('Escape');q.locator('[data-chart="wind"]').click();
    expect(q.evaluate('!motionSnapshot().enabled && motionSnapshot().active===0 && !motionSnapshot().spring && !motionSnapshot().raf'),'initial reduced motion invalid');cc.close()
  test('Reduced motion before startup keeps complete static flows',reduced_initial)
  def final():
    p.evaluate('window.scrollTo(0,0)');p.wait_for_function('motionSnapshot().active===0 && !motionSnapshot().spring && !motionSnapshot().raf',timeout=4000)
    r=p.evaluate('''()=>({snapshot:motionSnapshot(),unhandled:window.__unhandled,pendingRAF:window.__pendingRAF.size,running:document.getAnimations().filter(a=>a.playState==='running').length})''')
    expect(not r['unhandled'] and r['pendingRAF']==0 and r['running']==0,str(r));return r
  test('Global rest: zero transient RAF, ghosts, animations or rejected promises',final)
  result=dict(browser=browser.version,platform='Linux, headless Chromium; synthetic weather; inline DOM (navigation blocked by environment)',results=results,pageErrors=errors)
  browser.close();(OUT/'contracts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
  print(json.dumps({'passed':sum(x['passed'] for x in results),'total':len(results),'failed':[x for x in results if not x['passed']],'pageErrors':errors},ensure_ascii=False,indent=2))
  return result
if __name__=='__main__':
 r=run();sys.exit(0 if all(t['passed'] for t in r['results']) and not r['pageErrors'] else 1)
