"""Reproducible Chromium UI tests. Weather payloads are SYNTHETIC TEST FIXTURES, never production data."""
import json, math, threading, functools, tempfile, pathlib, re, os
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
NOW=1791759600000 # overwritten below from explicit ISO, independent of host date
NOW=int(datetime.fromisoformat('2026-10-11T23:00:00+00:00').timestamp()*1000)
from fixtures import fixture
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',8877),functools.partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
results=[]
def check(name,fn):
    try:fn();results.append({'name':name,'pass':True});print('PASS',name)
    except Exception as e:results.append({'name':name,'pass':False,'error':str(e)[:1200]});print('FAIL',name,str(e)[:250])
def expect(cond,msg='Assertion failed'):
    assert cond,msg
with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM_PATH')
    browser=pw.chromium.launch(**({'executable_path':exe} if exe else {}),headless=True,args=['--no-sandbox'])
    def context(**kw):
        c=browser.new_context(**kw)
        c.add_init_script('''{const NativeDate=Date;const now=%d;globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};}'''%NOW)
        c.route('https://api.open-meteo.com/**',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps(fixture())))
        c.route('https://geocoding-api.open-meteo.com/**',lambda r:r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body=json.dumps({'results':[{'name':'Córdoba','latitude':-31.4135,'longitude':-64.1811,'country':'Argentina','admin1':'Córdoba'}]})))
        return c
    ctx=context(viewport={'width':1440,'height':1080})
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def load(p=page):
        p.goto('http://127.0.0.1:8877/',wait_until='networkidle');p.wait_for_selector('#currentTemp',timeout=8000)
    check('Cargar clima e interfaz real',load)
    if results[-1]['pass']:
        check('Temperatura calculada sin valores de demostración',lambda:expect('22' in page.locator('#currentTemp').inner_text()))
        check('Escena basada en condición del modelo',lambda:expect(page.locator('.sky-scene').get_attribute('data-scene')=='partly'))
        def units():
            page.locator('#unitsBtn').click();expect('72' in page.locator('#currentTemp').inner_text());page.locator('#unitsBtn').click()
        check('Celsius ↔ Fahrenheit',units)
        def chart():
            page.locator('[data-metric="rain"]').click();expect('Precipitación' in page.locator('#chartSummary').inner_text());page.locator('#weatherChart').focus();page.keyboard.press('ArrowRight');expect(page.locator('[data-hour="1"]').get_attribute('aria-pressed')=='true');page.locator('[data-range="48"]').click();expect(page.locator('[data-hour]').count()==48)
        check('Gráfico de lluvia, teclado y 48 horas',chart)
        def favorites():
            page.locator('#favoriteBtn').click();page.locator('#cityBtn').click();expect(page.locator('#cityDialog').is_visible());page.locator('#citySearch').fill('Córdoba');page.wait_for_timeout(550);page.locator('#cityResults [data-place]').first.click();expect(page.locator('#cityName').inner_text()=='Córdoba');page.reload(wait_until='networkidle');expect(page.locator('#cityName').inner_text()=='Córdoba')
        check('Búsqueda, favoritos y persistencia',favorites)
        def motions():
            page.locator('#settingsBtn').click();page.locator('#motionBtn').click();page.locator('#settingsDialog [data-close]').click();page.wait_for_timeout(500);expect(page.locator('html').get_attribute('data-motion')=='reduced');expect(page.evaluate('document.getAnimations().filter(a=>a.playState==="running").length')==0)
        check('Movimiento reducido detiene animaciones',motions)
        def details():
            page.locator('#dailyList details').nth(1).locator('summary').click();expect(page.locator('#dailyList details').nth(1).get_attribute('open') is not None)
        check('Detalle diario accesible',details)
        def backup():
            page.locator('#settingsBtn').click()
            with page.expect_download() as info:page.locator('#exportBtn').click()
            data=json.loads(pathlib.Path(info.value.path()).read_text());expect(data['version']==2);expect(data['preferences']['location']['name']=='Córdoba');page.locator('#settingsDialog [data-close]').click()
        check('Exportación JSON válida',backup)
        def pwa():
            page.evaluate('navigator.serviceWorker.ready');page.reload(wait_until='networkidle');expect(page.evaluate('!!navigator.serviceWorker.controller'));ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.wait_for_selector('#currentTemp');expect('Sin conexión' in page.locator('#dataStatus').inner_text());ctx.set_offline(False)
        check('PWA abre offline con caché explícito',pwa)
        check('Sin excepciones JavaScript',lambda:expect(not errors,repr(errors)))
        ctx.set_offline(False);load()
        page.screenshot(path=str(ROOT.parent/'atmos-v2-desktop.png'),full_page=True)
        for width in [390,320,768]:
            page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(200)
            check(f'Sin desbordamiento horizontal {width}px',lambda:expect(page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')))
        page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT.parent/'atmos-v2-mobile.png'),full_page=True)
        mobile=context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce');mp=mobile.new_page();load(mp)
        check('Respeta prefers-reduced-motion del sistema',lambda:expect(mp.locator('html').get_attribute('data-motion')=='reduced'))
        mobile.close()
        offline=context(viewport={'width':390,'height':844});offline.unroute('https://api.open-meteo.com/**');offline.route('https://api.open-meteo.com/**',lambda r:r.abort());op=offline.new_page();op.goto('http://127.0.0.1:8877/',wait_until='networkidle')
        check('Error inicial con recuperación real',lambda:expect(op.locator('#retryBtn').is_visible()))
        offline.close()
    browser.close()
server.shutdown()
(ROOT.parent/'atmos-browser-results.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
assert all(r['pass'] for r in results), 'Ver detalles en atmos-browser-results.json'
