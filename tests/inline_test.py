"""Real Chromium DOM/motion tests. No page navigation: network and Storage are explicit test doubles.
Used when environment browser navigation policy blocks localhost. Does NOT prove PWA/offline installation.
"""
import json, pathlib, re
from playwright.sync_api import sync_playwright
from fixtures import fixture
ROOT=pathlib.Path(__file__).resolve().parents[1]
NOW=1791759600000
from datetime import datetime
NOW=int(datetime.fromisoformat('2026-10-11T23:00:00+00:00').timestamp()*1000)
results=[]
def check(name,fn):
 try:fn();results.append({'name':name,'pass':True});print('PASS',name,flush=True)
 except Exception as e:results.append({'name':name,'pass':False,'error':str(e)[:1500]});print('FAIL',name,str(e)[:500],flush=True)
def expect(ok,msg='Assertion failed'):assert ok,msg
html=ROOT.joinpath('index.html').read_text()
html=re.sub(r'<script[^>]*src=[^>]+></script>','',html)
html=re.sub(r'<link[^>]+>','',html)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def make(width=1440,reduced='no-preference',stored=None,failed=False,code=2):
  ctx=b.new_context(viewport={'width':width,'height':1080 if width>600 else 844},reduced_motion=reduced)
  p=ctx.new_page();p.set_default_timeout(4000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.set_content(html,wait_until='domcontentloaded');p.add_style_tag(content=ROOT.joinpath('app.css').read_text())
  p.evaluate('''({now,payload,saved,fail})=>{
   const D=Date;globalThis.Date=class extends D{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
   window.__store=saved||{};window.__failed=fail;window.__payload=payload;
   Object.defineProperty(window,'localStorage',{value:{getItem:k=>__store[k]??null,setItem:(k,v)=>{__store[k]=String(v)},removeItem:k=>delete __store[k]}});
   window.fetch=async(url)=>{if(window.__failed)throw new TypeError('Fixture: network failure');return new Response(JSON.stringify(String(url).includes('geocoding')?{results:[{name:'Córdoba',latitude:-31.4135,longitude:-64.1811,admin1:'Córdoba',country:'Argentina'}]}:window.__payload),{status:200,headers:{'Content-Type':'application/json'}});};
  }''',{'now':NOW,'payload':fixture(code),'saved':stored,'fail':failed})
  for file in ['model.js','motion.js','app.js']:p.add_script_tag(content=ROOT.joinpath(file).read_text())
  return ctx,p,errors
 ctx,p,errors=make();p.wait_for_selector('#currentTemp')
 check('Clima renderizado: temperatura 22°C y ciudad',lambda:expect('22' in p.locator('#currentTemp').inner_text() and p.locator('#cityName').inner_text()=='Buenos Aires'))
 check('Escena del modelo nocturna y parcialmente nublada',lambda:expect(p.locator('.sky-scene').get_attribute('data-scene')=='partly' and p.locator('.sky-scene').get_attribute('data-night')=='true'))
 def moving():
  a=p.locator('.celestial-body').evaluate('(e)=>getComputedStyle(e).transform');p.wait_for_timeout(350);z=p.locator('.celestial-body').evaluate('(e)=>getComputedStyle(e).transform');expect(a!=z)
 check('Motion real: el cuerpo celeste cambia de transformación con el tiempo',moving)
 def unit():
  p.locator('#unitsBtn').click();expect('72' in p.locator('#currentTemp').inner_text());p.locator('#unitsBtn').click()
 check('Conversión °C / °F desde el control real',unit)
 def chart():
  p.locator('[data-metric=rain]').click();expect('Precipitación' in p.locator('#chartSummary').inner_text());p.locator('#weatherChart').focus();p.keyboard.press('ArrowRight');expect(p.locator('[data-hour="1"]').get_attribute('aria-pressed')=='true');p.locator('[data-range="48"]').click();expect(p.locator('[data-hour]').count()==48)
 check('Selector, gráfico de precipitación, teclado y 48 horas',chart)
 def favs():
  p.locator('#favoriteBtn').click();p.locator('#cityBtn').click();p.locator('#citySearch').fill('Córdoba');p.wait_for_timeout(400);p.locator('[data-place]').first.click();expect(p.locator('#cityName').inner_text()=='Córdoba');expect(len(json.loads(p.evaluate('__store["atmos.state.v2"]'))['preferences']['favorites'])==1)
 check('Buscar, seleccionar y guardar favoritas en Storage simulado',favs)
 def theme():
  p.locator('#settingsBtn').click();p.locator('#themeBtn').click();expect(p.locator('html').get_attribute('data-theme')=='light');p.locator('#themeBtn').click();p.locator('#settingsDialog [data-close]').click()
 check('Tema claro y oscuro',theme)
 def reduced():
  p.locator('#settingsBtn').click();p.locator('#motionBtn').click();p.locator('#settingsDialog [data-close]').click();p.wait_for_timeout(600);expect(p.locator('html').get_attribute('data-motion')=='reduced');expect(p.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0)
 check('Control reducido: cero animaciones en ejecución',reduced)
 def expand():
  p.locator('#dailyList details').nth(1).locator('summary').click();expect(p.locator('#dailyList details').nth(1).get_attribute('open') is not None);expect('UV máximo' in p.locator('#dailyList details').nth(1).inner_text())
 check('Acordeón diario y métricas reales',expand)
 def backup():
  p.locator('#settingsBtn').click()
  with p.expect_download() as info:p.locator('#exportBtn').click()
  data=json.loads(pathlib.Path(info.value.path()).read_text());expect(data['version']==2 and data['preferences']['location']['name']=='Córdoba');p.locator('#settingsDialog [data-close]').click()
 check('Descarga de respaldo JSON válido',backup)
 def import_valid():
  current=json.loads(p.evaluate('__store["atmos.state.v2"]'))
  payload={'format':'atmos-weather-backup','version':2,'preferences':current['preferences'],'forecasts':list(current['forecasts'].values())}
  payload['preferences']['units']='F'
  p.locator('#settingsBtn').click();p.once('dialog',lambda d:d.accept());p.locator('#importFile').set_input_files({'name':'respaldo.json','mimeType':'application/json','buffer':json.dumps(payload).encode()});p.wait_for_function('document.getElementById("unitsBtn").textContent==="°F"');expect('72' in p.locator('#currentTemp').inner_text());p.locator('#unitsBtn').click()
 check('Importación validada con confirmación explícita',import_valid)

 # Restore a second document from explicitly simulated storage, without claiming real browser persistence.
 saved=p.evaluate('__store');rc,rp,re=make(stored=saved);rp.wait_for_selector('#cityName')
 check('Recuperación desde datos guardados simulados',lambda:expect(rp.locator('#cityName').inner_text()=='Córdoba'))
 rc.close()
 check('Sin errores JavaScript',lambda:expect(not errors,str(errors)))
 # Return screenshots to initial city and temperature chart; no fake visual added to application source.
 p.locator('#cityBtn').click();p.locator('#citySearch').fill('');p.locator('[data-place]').first.click();p.locator('[data-metric=temp]').click();p.locator('[data-range="24"]').click()
 p.locator('#settingsBtn').click();p.locator('#motionBtn').click();p.locator('#settingsDialog [data-close]').click();p.evaluate('scrollTo(0,0)');p.wait_for_timeout(900)
 p.wait_for_timeout(4700);p.screenshot(path=str(ROOT.parent/'atmos-v2-desktop.png'),full_page=True)
 for width in [390,320,768]:
  p.set_viewport_size({'width':width,'height':844});p.wait_for_timeout(250)
  check(f'Responsive sin overflow {width}px',lambda:expect(p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
 p.set_viewport_size({'width':390,'height':844});p.evaluate('scrollTo(0,0)');p.wait_for_timeout(300)
 check('Escala del gráfico móvil preserva legibilidad del texto',lambda:expect(p.evaluate('Math.abs(document.getElementById("weatherChart").viewBox.baseVal.width-document.getElementById("weatherChart").getBoundingClientRect().width)<2')))
 p.screenshot(path=str(ROOT.parent/'atmos-v2-mobile.png'),full_page=True)
 sc,sp,se=make(width=390,code=95);sp.wait_for_selector('.sky-scene')
 check('Tormenta genera partículas sin relámpagos intermitentes',lambda:expect(sp.locator('.sky-scene').get_attribute('data-scene')=='storm' and sp.locator('.sky-particle').count()==18))
 sp.screenshot(path=str(ROOT.parent/'atmos-v2-storm.png'),full_page=False);sc.close()
 ac,ap,ae=make(width=390,reduced='reduce');ap.wait_for_selector('#currentTemp');ap.wait_for_timeout(300)
 check('Preferencia reducida del sistema prevalece',lambda:expect(ap.locator('html').get_attribute('data-motion')=='reduced' and ap.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0));ac.close()
 ec,ep,ee=make(width=390,failed=True);ep.wait_for_selector('#retryBtn')
 check('Error de conexión conserva búsqueda y reintento',lambda:expect(ep.locator('#retryBtn').is_visible() and ep.locator('.error-card [data-action=cities]').is_visible()));ec.close()
 # Data validity tests in a complete rendered document.
 stale=fixture();stale['current']['time']='2026-09-01T20:00';stale['hourly']['time']=[t.replace('2026-10','2026-09') for t in stale['hourly']['time']];stale['daily']['time']=[t.replace('2026-10','2026-09') for t in stale['daily']['time']]
 for k in ['sunrise','sunset']:stale['daily'][k]=[t.replace('2026-10','2026-09') for t in stale['daily'][k]]
 savedStale={'atmos.state.v2':json.dumps({'version':2,'preferences':{'location':{'name':'Buenos Aires','latitude':-34.6,'longitude':-58.4}},'forecasts':{'x':{'location':{'name':'Buenos Aires','latitude':-34.6,'longitude':-58.4},'fetchedAt':NOW-40*86400000,'data':stale}}})}
 fc,fp,fe=make(width=390,stored=savedStale,failed=True);fp.wait_for_selector('#cacheNotice')
 check('Pronóstico vencido no reaparece como futuro',lambda:expect(fp.locator('[data-hour]').count()==0 and 'Pronóstico vencido' in fp.locator('.quick-outlook').inner_text()));fc.close()
 ctx.close();b.close()
(ROOT.parent/'atmos-inline-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
assert all(r['pass'] for r in results),'Revisar resultados'
