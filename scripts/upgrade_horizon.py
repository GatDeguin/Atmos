"""Reproducible upgrade of the verified Atmos v3 document; no network or secrets.
Refuses a different source rather than overwriting concurrent changes.
Run in repository root: python scripts/upgrade_horizon.py
"""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
p=root/'index.html';s=p.read_text();blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
BASE='bb416944cfb9f33432263e4eb3785aedbae1bc60'
if '<!-- ATMOS-HORIZON-4 -->' in s:
 print('Horizon already assembled.');raise SystemExit(0)
if blob(p.read_bytes())!=BASE:raise SystemExit('Source changed: review current index.html before applying the upgrade.')
def once(a,b):
 global s
 if s.count(a)!=1:raise ValueError('Expected exactly one matching source fragment: '+a[:100])
 s=s.replace(a,b,1)
once('<title>ATMÓS — El clima, con otra perspectiva</title>','<title>ATMÓS — Horizon · El clima en perspectiva</title>\n  <!-- ATMOS-HORIZON-4 -->')
once('  </style>','  </style>\n  <link rel="stylesheet" href="./horizon.css">')
once('wire();syncMotionUI();updateHeader();updateFavorites();loadLocation(state.location);','</script>\n<script src="./horizon.js"></script>\n<script>\nwire();syncMotionUI();updateHeader();updateFavorites();loadLocation(state.location);')
once("data:null,fetchedAt:0,source:'none',loading:false,activeChart:'temp',selectedHour:0,openDay:0,","data:null,fetchedAt:0,source:'none',loading:false,activeChart:'temp',selectedHour:0,openDay:0,horizonHours:24,")
once("timezone:'auto',forecast_days:'8'","timezone:'auto',forecast_days:'10'")
once("hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,visibility,relative_humidity_2m'","hourly:'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,visibility,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover'")
start=s.index('function startHourIndex(){');end=s.index('function nextHours(',start)
s=s[:start]+"function startHourIndex(){return Horizon.firstFuture();}\n"+s[end:]
once('function drawHourTiles(){\n  const hours=nextHours(24);','function drawHourTiles(){\n  const hours=nextHours(state.horizonHours);')
once("${i===0?'Ahora*':esc(h.time.slice(11,16))}","${esc(h.time.slice(11,16))}<span class=\"hour-date\">${esc(dayFormat(h.time,{weekday:'short'}))}</span>")
once('* Primera hora disponible del modelo. Probabilidades horarias, no acumuladas.','Horas disponibles desde la hora actual. Probabilidades horarias, no acumuladas. Deslizá para explorar.')
once('const d=state.data.daily,t=d.time.slice(0,7),','const d=state.data.daily,t=d.time.slice(0,10),')
once('const min=Math.min(...lows,0),max=Math.max(...highs,0),span=Math.max(1,max-min);','const min=lows.length?Math.min(...lows):0,max=highs.length?Math.max(...highs):1,span=Math.max(1,max-min);')
once("<strong>${isNum(take(d,'daylight_duration',i))?format(take(d,'daylight_duration',i)/3600,1)+' h':'—'}</strong></div>\n    </div></div></div>","<strong>${isNum(take(d,'daylight_duration',i))?format(take(d,'daylight_duration',i)/3600,1)+' h':'—'}</strong></div>\n      <button class=\"day-detail-link\" type=\"button\" data-detail-day=\"${i}\">Explorar la temperatura hora por hora ↗</button>\n    </div></div></div>")
once('${drawHero()}','${Horizon.hero()}')
once('${drawStats()}','${Horizon.stats()}')
once('${drawAtmosphere()}','${Horizon.atmosphere()}')
once('renderChart();attachDynamicEvents();activateAtmosphericScene();','renderChart();attachDynamicEvents();Horizon.mount();')
once('function clearPresentation(){cancelMotionWithin','function clearPresentation(){Horizon.dispose();cancelMotionWithin')
once("function openCityDialog(){\n  if(motionRuntime.modalOpen)","function openCityDialog(){\n  Horizon.closeDetails(false);\n  if(motionRuntime.modalOpen)")
once('function syncMotionUI(){\n  const enabled=','function syncMotionUI(){\n  Horizon.policy();\n  const enabled=')
once('const hours=nextHours(24),n=hours.length;','const hours=nextHours(state.horizonHours),n=hours.length;')
once('i%4===0||i===n-1','i%Math.ceil(n/6)===0||i===n-1')
once('<h3 class="panel-name">Tendencia de 24 horas</h3>','<h3 class="panel-name">Tendencia de ${state.horizonHours} horas</h3>')
once('<div class="section-sub">Deslizá para explorar las próximas 24 horas.</div></div></div>','<div class="section-sub">Hora local de la ubicación.</div></div>${Horizon.rangeControl()}</div>')
once("${stale?'Pronóstico guardado · 7 días':'Pronóstico extendido · 7 días'}","${stale?'Pronóstico guardado':'Pronóstico extendido'} · ${Math.min(10,state.data.daily.time.length)} días")
once('    </div>`;\n  renderChart();','      ${Horizon.airPanel()}\n    </div>`;\n  renderChart();')
# Position the air panel in the existing aside-column, not as an unintended third grid item.
s=s.replace('      </div>\n      ${Horizon.airPanel()}\n    </div>`;','        ${Horizon.airPanel()}\n      </div>\n    </div>`;')
once("function weatherDetails(code,day=true){\n  const c=Number(code);","function weatherDetails(code,day=true){\n  if(!isNum(code))return {title:'Condición no disponible',short:'Sin condición',icon:'cloud',scene:'unknown'};\n  const c=Number(code);")
once("function isHourDay(h){\n  const dates=state.data.daily.time","function isHourDay(h){\n  if(!h)return true;\n  const dates=state.data.daily.time")
once("theme:state.theme,forecast:state.data?","theme:state.theme,airQualityCache:Horizon.exportAir(),forecast:state.data?")
s=s.replace('Próximos 7 días','Próximos 10 días')
once("    state.location=normalizeLocation(parsed.location);", "    Horizon.importAir(parsed.airQualityCache);\n    state.location=normalizeLocation(parsed.location);")
once('d.daily.temperature_2m_max.length===d.daily.time.length;','d.daily.temperature_2m_max.length===d.daily.time.length && Horizon.validSeries(d);')
p.write_text(s)
sw=root/'sw.js';w=sw.read_text();w=w.replace("const NAME='atmos-app-shell-semantic-v4';","const NAME='atmos-app-shell-horizon-v4-1';").replace("const ASSETS=['./','./index.html'","const ASSETS=['./horizon.css','./horizon.js','./','./index.html'")
sw.write_text(w)
print('Upgraded index.html',len(p.read_bytes()),blob(p.read_bytes()))

# Keep existing assertions; adapt only the fixture loader, GL test backend and moved city label.
for name,expected in [('test_motion.py','dce7eb2949eb4417171f4f2c2be8b0e88e91925f'),('test_semantic_contracts.py','ca8f6db94c5780ef777a6139ea5e1833b2650f5b')]:
 t=root/'tests'/name
 if not t.exists() or blob(t.read_bytes())!=expected:raise SystemExit('Test source changed: '+name)
 v=t.read_text().replace('from pathlib import Path','from pathlib import Path\nfrom helpers import inline_html',1)
 v=v.replace("args=['--no-sandbox']","args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']")
 v=v.replace('Path(url[7:]).read_text()','inline_html(Path(url[7:]))').replace("(ROOT/'index.html').read_text()","inline_html(ROOT/'index.html')")
 v=v.replace("document.querySelector('.hero-kicker').textContent","document.querySelector('.horizon-city').textContent")
 t.write_text(v)
