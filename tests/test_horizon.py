"""ATMOS Horizon contracts. All weather responses are synthetic test fixtures.
Run: python tests/test_horizon.py [--baseline]. No credentials or live weather.
"""
import json,sys,math,time,re,os
from datetime import datetime,timedelta
from pathlib import Path
from playwright.sync_api import sync_playwright
from test_motion import fixture,PROBE
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidence/v4';OUT.mkdir(parents=True,exist_ok=True)
def data():
 d=fixture(2); h=d['hourly']; start=datetime(2026,10,11)
 h['time']=[(start+timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(240)]
 for k in list(h):
  if k!='time':h[k]=(h[k]*2)[:240]
 h['dew_point_2m']=[12.0]*240;h['pressure_msl']=[1011+math.sin(i/8)*3 for i in range(240)];h['cloud_cover']=[40]*240
 for k in d['daily']:
  if k not in ('time','sunrise','sunset'):d['daily'][k]=(d['daily'][k]*2)[:10]
 d['daily']['time']=[(start+timedelta(days=i)).strftime('%Y-%m-%d') for i in range(10)]
 for k,t in [('sunrise','06:17'),('sunset','19:08')]:d['daily'][k]=[x+'T'+t for x in d['daily']['time']]
 d['utc_offset_seconds']=-10800;d['current']['cloud_cover']=40
 return d
def inline():
 s=(ROOT/'index.html').read_text()
 for path in ['horizon.css','horizon.js']:
  p=ROOT/path
  if p.exists():
   if path.endswith('.css'):s=s.replace('<link rel="stylesheet" href="./horizon.css">','<style>'+p.read_text()+'</style>')
   else:s=s.replace('<script src="./horizon.js"></script>','<script>'+p.read_text()+'</script>')
 return s

def run():
 results=[];errors=[]
 def ck(name,fn):
  try:r=fn();results.append(dict(name=name,passed=True,observed=r))
  except Exception as e:results.append(dict(name=name,passed=False,error=str(e)[:700]))
 def need(c,s='contract failed'):
  if not c:raise AssertionError(s)
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  ctx=b.new_context(viewport=dict(width=1440,height=1000),service_workers='block')
  p=ctx.new_page();p.set_default_timeout(4000);p.on('pageerror',lambda e:errors.append(str(e)))
  p.evaluate(PROBE)
  p.evaluate('''d=>{window.__fetches=[];window.__weather=d;const mem={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>mem[k]??null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k]}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){super(...(a.length?a:['2026-10-11T23:00:00Z']))}static now(){return 1791759600000;}};window.fetch=async (u,o)=>{__fetches.push(String(u));if(o?.signal?.aborted)throw new DOMException('Aborted','AbortError');const r=String(u).includes('air-quality')?{current:{time:'2026-10-11T20:00',us_aqi:52,pm2_5:9.2,pm10:18.4},utc_offset_seconds:-10800}:String(u).includes('geocoding')?{results:[{name:'Córdoba',latitude:-31.4135,longitude:-64.1811,country:'Argentina'}]}:__weather;return new Response(JSON.stringify(r),{status:200,headers:{'Content-Type':'application/json'}})}}''',data())
  p.set_content(inline(),wait_until='load');p.wait_for_selector('.hour-tile')
  ck('10 day forecast requested and displayed',lambda:need(p.evaluate('new URL(buildWeatherURL(state.location)).searchParams.get("forecast_days")==="10"') and p.locator('[data-day]').count()==10))
  ck('New meteorological series requested',lambda:need(p.evaluate('new URL(buildWeatherURL(state.location)).searchParams.get("hourly").includes("dew_point_2m")')))
  ck('Cards open real detailed metric view',lambda:need(p.locator('[data-metric]').count()>=8))
  ck('48 hour switch exists',lambda:need(p.locator('[data-range="48"]').count()==1))
  ck('3D scene exists with real WebGL context',lambda:need(p.evaluate('typeof Horizon!=="undefined" && Horizon.snapshot().renderer==="webgl2"')))
  ck('Air quality explicit real-data request control',lambda:need(p.locator('#loadAir').count()==1))
  if '--baseline' not in sys.argv:
   def range_case():
    p.locator('[data-range="48"]').click();need(p.locator('[data-hour]').count()==48);p.locator('[data-hour="47"]').click();need(p.evaluate('state.selectedHour===47'))
    p.locator('[data-range="24"]').click();need(p.locator('[data-hour]').count()==24 and p.evaluate('state.selectedHour<24'))
   ck('48h selects last hour and returns to 24h coherently',range_case)
   def modal_case():
    for i in range(20):
     p.locator('[data-metric="humidity"]').click();need(p.locator('#detailDialog').is_visible());p.keyboard.press('Escape');need(p.locator('[data-metric="humidity"]').evaluate('e=>e===document.activeElement'))
    need(not p.evaluate('document.querySelector(".shell").inert'));need(p.locator('#detailDialog').count()==1)
   ck('20 detail dialog cycles preserve focus and release background',modal_case)
   def series_case():
    p.locator('[data-metric="pressure"]').click();p.locator('#metricHour').fill('5');p.locator('#metricHour').dispatch_event('input');v=p.locator('#metricReading').inner_text();need('hPa' in v);p.locator('#metricDay').select_option('1');need(p.locator('#metricHour').get_attribute('max')=='23');p.keyboard.press('Escape');return v
   ck('Detailed pressure reads exact hourly data and date switch',series_case)
   def air_case():
    p.locator('#loadAir').click();p.wait_for_function('document.querySelector("#airContent").textContent.includes("52")');need('CAMS' in p.locator('#airContent').inner_text());need(p.evaluate('__fetches.some(u=>u.includes("air-quality"))'))
   ck('AQI fetched independently and attributed',air_case)
   def backup_air():
    p.evaluate("window.__backupText=null;downloadBlob=(name,content)=>window.__backupText=content;exportBackup();localStorage.removeItem('atmos.air.v1')")
    p.evaluate("async()=>{await importBackup(new File([window.__backupText],'backup.json',{type:'application/json'}));}")
    need('52' in p.locator('#airContent').inner_text(),'AQI cache did not survive backup restore')
   ck('Air-quality cache survives export and restore',backup_air)
   def parallax_case():
    p.evaluate('window.scrollTo(0,0)');p.wait_for_timeout(600)
    snap=p.evaluate('Horizon.snapshot()');need(snap['renderer']=='webgl2',snap)
    box=p.locator('#skyCanvas').bounding_box();p.mouse.move(box['x']+box['width']*.8,box['y']+box['height']*.5);p.wait_for_timeout(500)
    after=p.evaluate('Horizon.snapshot()');need(abs(after['camera'][0])>.01,after)
    p.mouse.move(2,2);p.wait_for_timeout(600);need(not p.evaluate('Horizon.snapshot().raf'))
    return {'before':snap,'after':after}
   ck('Parallax changes perspective camera and reaches rest',parallax_case)
   def off_case():
    p.emulate_media(reduced_motion='reduce');p.wait_for_timeout(100);s=p.evaluate('Horizon.snapshot()');need(not s['raf'] and abs(s['camera'][0])<.001,s);p.locator('[data-metric="uv"]').click();p.keyboard.press('Escape');p.emulate_media(reduced_motion='no-preference')
   ck('Reduced motion resets parallax without losing weather functions',off_case)
   def fallback_case():
    p.locator('#sceneMode').click();need(p.locator('#skyFallback').is_visible());need(p.locator('[data-hour]').count()==24);need(p.locator('#sceneMode').get_attribute('aria-pressed')=='false');p.locator('#sceneMode').click();p.wait_for_timeout(200);need(p.evaluate('Horizon.snapshot().renderer==="webgl2"'))
   ck('2D mode works and GPU can be re-enabled',fallback_case)
   def viewport_case():
    observations=[]
    for w in [320,390,768,1440]:
     p.set_viewport_size(dict(width=w,height=900));p.wait_for_timeout(120);need(p.evaluate('document.documentElement.scrollWidth<=innerWidth'),str(w));observations.append(w)
    p.set_viewport_size(dict(width=390,height=844));p.screenshot(path=str(OUT/'mobile.png'),full_page=True)
    p.set_viewport_size(dict(width=1440,height=1000));p.evaluate('window.scrollTo(0,0)');p.wait_for_timeout(500);p.screenshot(path=str(OUT/'desktop.png'),full_page=True)
    return observations
   ck('Responsive 320/390/768/1440 without overflow',viewport_case)
   def missing_case():
    p.evaluate('state.data.hourly.dew_point_2m=null;render()');need('—' in p.locator('[data-metric="dew"]').inner_text());p.locator('[data-metric="dew"]').click();need('Sin datos' in p.locator('#metricReading').inner_text());p.keyboard.press('Escape')
   ck('Missing dew point remains unavailable, never zero',missing_case)
   def stale_case():
    r=p.evaluate('''()=>{const before=state.data.hourly.time;state.data.hourly.time=before.map(t=>t.replace('2026-10','2020-10'));const n=nextHours().length;state.data.hourly.time=before;return n}''');need(r==0,r)
   ck('Expired forecast hours are not relabeled as future',stale_case)
   def malformed_case():
    need(p.evaluate("()=>{const d=structuredClone(state.data);d.hourly.time[1]={bad:true};return !validWeather(d)}"),'Non-string time accepted')
   ck('Malformed imported hourly timestamps are rejected',malformed_case)
   def context_loss_case():
    p.evaluate('window.scrollTo(0,0)');p.wait_for_timeout(300)
    p.evaluate("document.querySelector('#skyCanvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    p.wait_for_function("Horizon.snapshot().renderer==='2d'");need(p.locator('#skyFallback').is_visible());need(p.locator('[data-hour]').count()==24)
    p.locator('#sceneMode').click();p.wait_for_function("Horizon.snapshot().renderer==='webgl2'");return p.evaluate('Horizon.snapshot().objects')
   ck('Real WebGL context loss degrades to 2D and recovers',context_loss_case)
   def pixel_case():
    import io
    from PIL import Image,ImageChops,ImageStat
    p.evaluate('window.scrollTo(0,0)');p.locator('#sceneReset').click();p.wait_for_timeout(700)
    a=p.locator('#skyView').screenshot();box=p.locator('#skyView').bounding_box()
    p.mouse.move(box['x']+box['width']*.88,box['y']+box['height']*.35);p.wait_for_timeout(650)
    z=p.locator('#skyView').screenshot();diff=ImageChops.difference(Image.open(io.BytesIO(a)).convert('RGB'),Image.open(io.BytesIO(z)).convert('RGB'));mean=sum(ImageStat.Stat(diff).mean)/3
    need(mean>.1,f'No rendered image change: {mean}');(OUT/'scene-neutral.png').write_bytes(a);(OUT/'scene-parallax.png').write_bytes(z)
    p.mouse.move(1,1);p.wait_for_timeout(600);return {'meanPixelDifference':mean,'graphics':p.evaluate('Horizon.snapshot()')}
   ck('Rendered WebGL pixels change with perspective, not just state',pixel_case)
   p.wait_for_timeout(3800)
   ck('Presentation has no orphaned RAF or duplicate dialog',lambda:need(p.evaluate('!Horizon.snapshot().raf && !window.__pendingRAF.size && document.querySelectorAll("#detailDialog").length===1')))
  result=dict(browser=b.version,platform='Linux headless; inline HTML; synthetic fixtures; software WebGL',results=results,pageErrors=errors,unhandled=p.evaluate('window.__unhandled'),bytes=(ROOT/'index.html').stat().st_size)
  b.close()
 (OUT/('baseline-red.json' if '--baseline' in sys.argv else 'horizon-tests.json')).write_text(json.dumps(result,indent=2,ensure_ascii=False))
 print(json.dumps({'passed':sum(x['passed'] for x in results),'total':len(results),'failures':[x for x in results if not x['passed']],'errors':errors},ensure_ascii=False,indent=2));return result
if __name__=='__main__':
 r=run();sys.exit(0 if all(t['passed'] for t in r['results']) and not r['pageErrors'] else 1)
