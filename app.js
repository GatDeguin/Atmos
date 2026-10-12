/* ATMÓS 2.0 · local-first weather interface. No runtime dependencies. */
(() => {
 'use strict';
 const M=window.AtmosModel,Motion=window.AtmosMotion,$=id=>document.getElementById(id);
 const icon=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=(v,d=0)=>M.num(v)?v.toLocaleString('es-AR',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
 const DEFAULT={name:'Buenos Aires',latitude:-34.6037,longitude:-58.3816,admin1:'Ciudad Autónoma de Buenos Aires',country:'Argentina',timezone:'America/Argentina/Buenos_Aires'};
 const PRESETS=[DEFAULT,{name:'Córdoba',latitude:-31.4135,longitude:-64.1811,country:'Argentina'},{name:'Rosario',latitude:-32.9468,longitude:-60.6393,country:'Argentina'},{name:'Mar del Plata',latitude:-38.0055,longitude:-57.5426,country:'Argentina'},{name:'Mendoza',latitude:-32.8895,longitude:-68.8458,country:'Argentina'},{name:'Bariloche',latitude:-41.1335,longitude:-71.3103,country:'Argentina'}];
 const STORE='atmos.state.v2';let storageOK=true,toastTimer,requestId=0,controller=null,searchId=0,searchController=null,searchTimer,searchPlaces=[],waitingSW=null,updateRequested=false,autoAttempt=0;
 function read(k){try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}}
 const stored=read(STORE)||{},oldPrefs=read('atmos.preferences.v1')||{},raw=stored.preferences||oldPrefs;
 function unique(list){const seen=new Set();return (Array.isArray(list)?list:[]).map(M.location).filter(p=>p&&!seen.has(M.key(p))&&seen.add(M.key(p))).slice(0,8);}
 const cache={};Object.values(stored.forecasts||read('atmos.forecasts.v1')||{}).slice(0,16).forEach(raw=>{const r=M.record(raw);if(r)cache[M.key(r.location)]=r;});
 const S={location:M.fromQuery(location.search)||M.location(raw.location)||DEFAULT,favorites:unique(raw.favorites),units:raw.units==='F'?'F':'C',theme:raw.theme==='light'?'light':'dark',motion:raw.motion==='reduced'?'reduced':'auto',record:null,source:'none',loading:false,error:'',metric:'temp',range:24,selected:0};
 const prefs=()=>({location:S.location,favorites:S.favorites,units:S.units,theme:S.theme,motion:S.motion});
 function save(){try{localStorage.setItem(STORE,JSON.stringify({version:2,preferences:prefs(),forecasts:cache}));storageOK=true;}catch{storageOK=false;}updateSettings();}
 function put(r){cache[M.key(r.location)]=r;Object.keys(cache).sort((a,b)=>cache[b].fetchedAt-cache[a].fetchedAt).slice(8).forEach(k=>delete cache[k]);save();}
 const degrees=v=>M.num(v)?`${fmt(M.temp(v,S.units))}°`:'—';
 const wind=v=>M.num(v)?`${fmt(M.speed(v,S.units))} ${S.units==='F'?'mph':'km/h'}`:'—';
 const rain=v=>M.num(v)?`${fmt(v,1)} mm`:'—';
 const favorite=p=>S.favorites.some(f=>M.key(f)===M.key(p));
 function dayLabel(d){const today=M.localISO(S.record?.data.timezone||S.location.timezone||'UTC').slice(0,10);if(d===today)return 'Hoy';return new Intl.DateTimeFormat('es-AR',{weekday:'long',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')).replace(/^./,c=>c.toUpperCase());}
 function hourLabel(t,full=false){return full?`${dayLabel(t.slice(0,10))} · ${t.slice(11,16)} h`:`${t.slice(11,13)} h`;}
 function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4600);}
 function updateSettings(){
  $('themeBtn').textContent=S.theme==='dark'?'Oscuro':'Claro';$('motionBtn').textContent=S.motion==='reduced'?'Reducido':'Auto';
  $('motionBtn').setAttribute('aria-pressed',String(S.motion==='reduced'));
  $('motionHint').textContent=matchMedia('(prefers-reduced-motion: reduce)').matches?'El sistema solicita movimiento reducido. Se respeta siempre.':'Auto respeta la preferencia del sistema. Podés detener el movimiento aquí.';
  $('storageStatus').textContent=storageOK?`${Object.keys(cache).length} ciudades con pronóstico guardado en este navegador.`:'Almacenamiento no disponible o lleno. Los cambios de esta sesión no se conservaron: exportá un respaldo.';
 }
 function header(){
  document.documentElement.dataset.theme=S.theme;document.querySelector('meta[name=theme-color]').content=S.theme==='dark'?'#0a121c':'#eff4f4';Motion.configure(S.motion);
  $('headerCity').textContent=S.location.name;$('unitsBtn').textContent='°'+S.units;
  const tz=S.record?.data.timezone||S.location.timezone||'America/Argentina/Buenos_Aires';
  $('localClock').textContent=new Intl.DateTimeFormat('es-AR',{timeZone:tz,weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())+' · hora local';
  const age=S.record?Date.now()-S.record.fetchedAt:Infinity;
  const kind=!navigator.onLine?'offline':S.loading?'loading':!S.record?'error':S.source!=='network'||age>1800000?'stale':'fresh';
  $('dataStatus').dataset.kind=kind;$('dataStatus').textContent=kind==='offline'?'Sin conexión':kind==='loading'?'Actualizando…':!S.record?'Sin datos':(kind==='fresh'?'Consultado ':'Guardado ')+M.age(S.record.fetchedAt);
  $('refreshBtn').disabled=S.loading;$('refreshBtn').dataset.loading=String(S.loading);$('weatherContent').setAttribute('aria-busy',String(S.loading));updateSettings();
 }
 function loading(){return `<section class="loading-card"><span class="loading-orbit" aria-hidden="true"></span><h1>Conectando con el cielo.</h1><p>Consultando ${esc(S.location.name)}.<br>No se muestran datos de ejemplo.</p><button class="text-button" id="cancelBtn">Cancelar consulta</button></section>`;}
 function errorView(){return `<section class="error-card">${icon('cloud')}<h1>El cielo puede esperar.</h1><p>${esc(S.error||'No hay un pronóstico guardado para esta ciudad.')} Conectate para consultar datos reales o elegí una ciudad que hayas guardado.</p><div class="button-row"><button class="primary-button" id="retryBtn">Reintentar</button><button class="soft-button" data-action="cities">Cambiar ciudad</button></div></section>`;}
 function render(){
  header();
  if(!S.record){Motion.cancel();$('weatherContent').innerHTML=S.loading?loading():errorView();return;}
  const d=S.record.data,c=d.current,wd=M.weather(c.weather_code,c.is_day!==0),night=c.is_day===0;
  const snapshotDate=c.time.slice(0,10),di=d.daily.time.indexOf(snapshotDate),daily=d.daily;
  const h=M.hours(d,48),six=M.summarize(h.slice(0,6)),outdated=Date.now()-S.record.fetchedAt>1800000;
  const numbers=fmt(M.temp(c.temperature_2m,S.units));
  const cacheNotice=(!navigator.onLine||S.source!=='network'||outdated||S.error)?`<div class="notice" id="cacheNotice"><strong>${!navigator.onLine?'Sin conexión.':S.error?'No se pudo actualizar.':'Pronóstico guardado.'}</strong> Consulta ${esc(M.age(S.record.fetchedAt))}. El estado del modelo corresponde al ${esc(c.time.replace('T',' a las '))} (hora local). ${S.loading?'Buscando una versión actualizada…':'No son observaciones en vivo.'}</div>`:'';
  $('weatherContent').innerHTML=`<section class="hero" data-scene="${wd.scene}" data-night="${night}" aria-labelledby="cityName"><div class="hero-content"><div class="hero-place"><h1 id="cityName">${esc(S.location.name)}</h1><button id="favoriteBtn" class="icon-button" aria-label="${favorite(S.location)?'Quitar de':'Agregar a'} favoritos" aria-pressed="${favorite(S.location)}">${icon('star')}</button></div><p class="hero-region">${esc([S.location.admin1,S.location.country].filter(Boolean).join(' · ')||'Ubicación seleccionada')}</p><div class="temp-lockup"><div class="current-temp" id="currentTemp" aria-label="${esc(numbers)} grados ${S.units==='C'?'Celsius':'Fahrenheit'}"><span class="temp-digits" aria-hidden="true">${[...numbers].map(n=>`<span>${esc(n)}</span>`).join('')}</span><sup aria-hidden="true">°</sup></div><div class="temp-caption"><strong>${wd.label}</strong><span>Sensación de ${degrees(c.apparent_temperature)}</span></div></div><div class="hero-meta"><span>Máx. <strong>${degrees(daily.temperature_2m_max[di])}</strong></span><span>Mín. <strong>${degrees(daily.temperature_2m_min[di])}</strong></span><span>${icon('wind','small')} <strong>${wind(c.wind_speed_10m)}</strong></span></div><p class="hero-model">ESTIMACIÓN DEL MODELO · ${esc(c.time.slice(11))} H · ${esc(snapshotDate)}</p></div><div class="hero-art">${Motion.sky(wd,night)}<span class="hero-art-caption">Atmósfera ilustrativa · no es un radar</span></div></section>${cacheNotice}
  <section class="quick-outlook" aria-label="Resumen del siguiente tramo horario"><div class="outlook-title">${icon(six.thunder?'storm':six.rain>.5?'rain':'clock')}<div><strong>${six.count?'El próximo tramo':'Pronóstico vencido'}</strong><small>${six.count?`${six.count} horas desde ${h[0].time.slice(11)} h`:'Actualizá para ver horas futuras'}</small></div></div><div class="outlook-value"><span>PROB. MÁXIMA HORARIA</span><strong>${fmt(six.probability)}<small> %</small></strong></div><div class="outlook-value"><span>LLUVIA ACUMULADA</span><strong>${fmt(six.rain,1)}<small> mm</small></strong></div><div class="outlook-value"><span>RÁFAGAS MÁXIMAS</span><strong>${fmt(M.speed(six.gust,S.units))}<small> ${S.units==='F'?'mph':'km/h'}</small></strong></div></section>${six.partial&&six.count?'<p class="hint">Hay variables ausentes en este tramo. Un guion no significa cero ni ausencia de riesgo.</p>':''}${six.thunder?'<div class="notice">El modelo señala tormentas en el próximo tramo. Esto no es una alerta oficial; consultá los avisos del SMN.</div>':''}
  <section id="hoursSection" aria-labelledby="hoursTitle"><div class="section-heading"><div><span class="eyebrow">CADA HORA CUENTA</span><h2 id="hoursTitle">El tiempo que viene.</h2><p>Explorá temperatura, lluvia y viento en hora local.</p></div></div><div class="panel chart-panel"><div class="chart-toolbar"><div class="segmented" id="metricTabs" aria-label="Variable del gráfico"><button data-metric="temp" aria-pressed="${S.metric==='temp'}">Temperatura</button><button data-metric="rain" aria-pressed="${S.metric==='rain'}">Lluvia</button><button data-metric="wind" aria-pressed="${S.metric==='wind'}">Viento</button></div><div class="range-switch" aria-label="Horizonte"><button data-range="24" aria-pressed="${S.range===24}">24 h</button><button data-range="48" aria-pressed="${S.range===48}">48 h</button></div></div><div id="chartSummary" class="chart-summary"></div><div class="chart-viewport" id="chartContainer"></div><div class="chart-reading" id="chartReading" aria-live="polite" aria-atomic="true"></div><p class="chart-hint" id="chartHelp">Tocá una hora o explorá el gráfico con las flechas del teclado. — = dato no disponible.</p></div><div class="hourly-strip" id="hourlyStrip" aria-label="Pronóstico por hora"></div></section>
  <section id="daysSection" aria-labelledby="daysTitle"><div class="section-heading"><div><span class="eyebrow">UNA MIRADA MÁS AMPLIA</span><h2 id="daysTitle">Tu semana, a la vista.</h2><p>Abrí cada día para explorar sus detalles.</p></div></div><div class="lower-grid"><div><div class="panel daily-panel" id="dailyList">${renderDays()}</div><p class="detail-source">Los días se muestran según la zona horaria ${esc(d.timezone)}. Las probabilidades son máximas horarias, no la probabilidad de que llueva en algún momento de todo el día.</p></div><div class="conditions">${conditions()}</div></div></section>`;
  Motion.enter($('weatherContent'));drawChart();Motion.tabs($('metricTabs'));
 }
 function renderDays(){
  const d=S.record.data.daily,today=M.localISO(S.record.data.timezone).slice(0,10),ids=d.time.map((t,i)=>i).filter(i=>d.time[i]>=today).slice(0,7);
  if(!ids.length)return '<p class="empty-inline">Este pronóstico ya no cubre días futuros. Actualizá la consulta.</p>';
  const values=[...d.temperature_2m_max,...d.temperature_2m_min].filter(M.num),lo=values.length?Math.min(...values):0,hi=values.length?Math.max(...values):1,span=Math.max(hi-lo,1);
  return ids.map(i=>{const a=d.temperature_2m_min[i],b=d.temperature_2m_max[i],w=M.weather(d.weather_code?.[i],true),fill=M.num(a)&&M.num(b)?`<i class="temperature-fill" style="left:${M.clamp((a-lo)/span*100,0,100)}%;width:${M.clamp((b-a)/span*100,1,100)}%"></i>`:'';
   const fields=[['Acumulado',rain(d.precipitation_sum?.[i])],['Ráfagas',wind(d.wind_gusts_10m_max?.[i])],['UV máximo',fmt(d.uv_index_max?.[i],1)],['Amanecer',d.sunrise?.[i]?.slice(11)||'—'],['Atardecer',d.sunset?.[i]?.slice(11)||'—'],['Condición',w.label]];
   return `<details class="day-row"><summary><strong>${esc(dayLabel(d.time[i]))}</strong>${icon(w.icon)}<span class="day-range"><span class="day-low">${degrees(a)}</span><span class="temperature-track" aria-hidden="true">${fill}</span><span>${degrees(b)}</span></span><span class="day-pop" aria-label="Probabilidad horaria máxima ${fmt(d.precipitation_probability_max?.[i])} por ciento">${fmt(d.precipitation_probability_max?.[i])}%</span><span class="chevron" aria-hidden="true">›</span></summary><div class="day-details">${fields.map(([label,value])=>`<div><small>${label}</small><strong>${esc(value)}</strong></div>`).join('')}</div></details>`;
  }).join('');
 }
 function conditions(){
  const d=S.record.data,c=d.current,iso=M.localISO(d.timezone),i=d.daily.time.indexOf(iso.slice(0,10));
  const card=(name,ico,value,unit,detail)=>`<article class="condition-card"><div class="condition-head"><span>${name}</span>${icon(ico)}</div><div class="condition-number">${value}<small> ${unit}</small></div><div class="condition-foot">${detail}</div></article>`;
  const rise=d.daily.sunrise?.[i],set=d.daily.sunset?.[i],minutes=s=>s?Number(s.slice(11,13))*60+Number(s.slice(14,16)):null;
  const a=minutes(rise),b=minutes(set),n=minutes(iso),valid=M.num(a)&&M.num(b)&&b>a,f=valid?M.clamp((n-a)/(b-a),0,1):null;
  const sx=f===null?0:25+250*f,sy=f===null?0:73-Math.sin(Math.PI*f)*56;
  const solar=`<article class="condition-card sun-card"><div class="condition-head"><span>El recorrido del sol</span>${icon('sunrise')}</div><svg class="sun-arc" viewBox="0 0 300 85" aria-hidden="true"><path d="M25 73Q150-39 275 73" fill="none" stroke="var(--line)" stroke-width="1.5" stroke-dasharray="3 5"/><path d="M15 74H285" stroke="var(--line)"/>${f!==null?`<circle cx="${sx}" cy="${sy}" r="6" fill="var(--warm)"/><circle cx="${sx}" cy="${sy}" r="13" fill="none" stroke="var(--warm)" opacity=".18"/>`:''}</svg><div class="sun-times"><span>Amanecer <strong>${rise?.slice(11)||'—'}</strong></span><span>Atardecer <strong>${set?.slice(11)||'—'}</strong></span></div><p class="condition-foot" style="grid-column:1/-1">${valid?`${Math.floor((b-a)/60)} h ${Math.round((b-a)%60)} min de luz prevista. Posición del marcador ilustrativa.`:'No hay horas solares disponibles para hoy en este pronóstico.'}</p></article>`;
  return card('Humedad','drop',fmt(c.relative_humidity_2m),'%','Estimación del modelo a '+c.time.slice(11)+' h')+card('Presión superficial','gauge',fmt(c.surface_pressure),'hPa','En la elevación del modelo; no al nivel del mar')+card('UV máximo de hoy','sun',fmt(d.daily.uv_index_max?.[i],1),'','Máximo diario previsto, no valor actual')+card('Dirección del viento','wind',M.direction(c.wind_direction_10m),'',`Desde ${fmt(c.wind_direction_10m)}° · ráfagas ${wind(c.wind_gusts_10m)}`)+solar;
 }
 let graph={rows:[],points:[],min:0,max:1,width:982,left:36,right:972};
 function drawChart(){
  const rows=M.hours(S.record.data,S.range);graph.rows=rows;S.selected=M.clamp(S.selected,0,Math.max(0,rows.length-1));
  const config=S.metric==='rain'?{key:'precipitation',name:'Precipitación',unit:'mm',dec:1,conv:v=>v}:S.metric==='wind'?{key:'wind_speed_10m',name:'Viento',unit:S.units==='F'?'mph':'km/h',dec:0,conv:v=>M.speed(v,S.units)}:{key:'temperature_2m',name:'Temperatura',unit:'°'+S.units,dec:0,conv:v=>M.temp(v,S.units)};
  const values=rows.map(r=>M.num(r[config.key])?config.conv(r[config.key]):null),valid=values.filter(M.num);
  const min=valid.length?(S.metric==='temp'?Math.floor(Math.min(...valid)-2):0):0,max=valid.length?Math.max(min+1,S.metric==='temp'?Math.ceil(Math.max(...valid)+2):Math.max(...valid)*1.2):1;graph.min=min;graph.max=max;
  const width=Math.max(260,$('chartContainer').clientWidth);graph.width=width;graph.right=width-10;
  const x=i=>graph.left+i*(graph.right-graph.left)/Math.max(rows.length-1,1),y=v=>178-(v-min)/(max-min)*145;
  graph.points=values.map((v,i)=>M.num(v)?{x:x(i),y:y(v)}:null);
  const segments=[];let segment=[];graph.points.forEach(p=>{if(p)segment.push(p);else if(segment.length){segments.push(segment);segment=[];}});if(segment.length)segments.push(segment);
  const paths=segments.map(seg=>{const line=seg.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');return `<path class="chart-fill" d="${line} L${seg.at(-1).x},178 L${seg[0].x},178 Z"/><path class="chart-trace" d="${line}"/>`;}).join('');
  const grid=Array.from({length:4},(_,i)=>{const v=min+(max-min)*i/3;return `<line class="chart-grid" x1="${graph.left}" x2="${graph.right}" y1="${y(v)}" y2="${y(v)}"/><text class="chart-axis" x="${graph.left-9}" y="${y(v)+4}" text-anchor="end">${fmt(v,config.dec)}</text>`;}).join('');
  const ticks=rows.filter((_,i)=>i===0||i===rows.length-1||i%Math.ceil(rows.length/(width<500?4:6))===0).map(r=>{const j=rows.indexOf(r);return `<text class="chart-axis" x="${x(j)}" y="205" text-anchor="middle">${r.time.slice(11,13)}h</text>`;}).join('');
  $('chartSummary').innerHTML=`<div>${config.name} <strong>${valid.length?fmt(values[S.selected],config.dec):'—'} <small>${config.unit}</small></strong></div><span>${rows.length} horas · modelo meteorológico</span>`;
  $('chartContainer').innerHTML=rows.length?`<svg id="weatherChart" class="weather-chart" viewBox="0 0 ${width} 220" preserveAspectRatio="none" role="group" tabindex="0" aria-label="Gráfico interactivo de ${config.name.toLowerCase()}" aria-describedby="chartHelp"><defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--mint)" stop-opacity=".17"/><stop offset="100%" stop-color="var(--mint)" stop-opacity="0"/></linearGradient></defs>${grid}${paths}${ticks}<g id="chartMarker"><line class="chart-cursor" y1="24" y2="178"/><circle class="chart-point" r="4.5"/></g></svg>`:'<p class="empty-inline">No quedan horas futuras en este pronóstico guardado. Actualizá los datos para continuar.</p>';
  $('hourlyStrip').innerHTML=rows.map((r,i)=>{const w=M.weather(r.weather_code,r.is_day!==0);return `<button class="hour-card" data-hour="${i}" aria-pressed="${i===S.selected}" aria-label="${esc(hourLabel(r.time,true))}, ${degrees(r.temperature_2m)}, ${w.label}, precipitación ${fmt(r.precipitation_probability)} por ciento"><time>${r.time.slice(11)==='00:00'?esc(dayLabel(r.time.slice(0,10)).slice(0,3))+' · ':''}${hourLabel(r.time)}</time>${icon(w.icon)}<strong>${degrees(r.temperature_2m)}</strong><small>${fmt(r.precipitation_probability)} %</small></button>`;}).join('');
  if(rows.length){const svg=$('weatherChart');svg.addEventListener('pointerdown',chartPointer,{passive:true});svg.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')chartPointer(e);},{passive:true});svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectHour(e.key==='Home'?0:e.key==='End'?rows.length-1:S.selected+(e.key==='ArrowRight'?1:-1),true);}});}
  selectHour(S.selected,false,true);Motion.chart($('chartContainer'));
 }
 function chartPointer(e){const box=e.currentTarget.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*graph.width;selectHour(Math.round((x-graph.left)/(graph.right-graph.left)*Math.max(0,graph.rows.length-1)));}
 function selectHour(i,scroll=false,force=false){
  if(!graph.rows.length){$('chartReading').textContent='Pronóstico vencido o sin datos horarios.';return;}
  const selected=M.clamp(i,0,graph.rows.length-1);if(selected===S.selected&&!force&&!scroll)return;S.selected=selected;const r=graph.rows[S.selected],p=graph.points[S.selected],marker=$('chartMarker');
  if(marker){marker.style.display=p?'':'none';if(p){marker.setAttribute('transform',`translate(${p.x},0)`);marker.querySelector('circle').setAttribute('cy',String(p.y));}}
  $('chartReading').innerHTML=`<time>${esc(hourLabel(r.time,true))}</time><span>Temperatura <strong>${degrees(r.temperature_2m)}</strong></span><span>Lluvia <strong>${rain(r.precipitation)} · ${fmt(r.precipitation_probability)}%</strong></span><span>Viento <strong>${wind(r.wind_speed_10m)}</strong></span>`;
  const v=S.metric==='rain'?rain(r.precipitation):S.metric==='wind'?wind(r.wind_speed_10m):degrees(r.temperature_2m)+' '+S.units;
  $('chartSummary').querySelector('strong').textContent=v;
  document.querySelectorAll('[data-hour]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.hour)===S.selected)));
  if(scroll){const b=document.querySelector(`[data-hour="${S.selected}"]`),strip=$('hourlyStrip');if(b&&strip){const left=b.offsetLeft-strip.offsetLeft-(strip.clientWidth-b.offsetWidth)/2;strip.scrollTo({left,behavior:Motion.enabled()?'smooth':'auto'});}}
 }
 async function json(url,signal){const res=await fetch(url,{signal,cache:'no-store',headers:{Accept:'application/json'}});if(!res.ok)throw new Error(res.status===429?'El proveedor limita temporalmente las consultas. Probá más tarde.':`El proveedor respondió HTTP ${res.status}.`);const d=await res.json();if(d?.error)throw new Error('El proveedor no pudo procesar esta consulta.');return d;}
 async function load(place,force=false){
  const p=M.location(place);if(!p){toast('La ubicación no es válida.');return;}
  controller?.abort();const seq=++requestId;controller=new AbortController();const ac=controller;
  const changed=M.key(p)!==M.key(S.location);S.location=p;S.error='';if(changed){S.selected=0;S.metric='temp';}
  S.record=M.record(cache[M.key(p)]);S.source=S.record?'cache':'none';S.loading=false;save();
  if(!navigator.onLine){S.error='No hay conexión con Internet.';render();return;}
  if(!force&&S.record&&Date.now()-S.record.fetchedAt<600000){render();return;}
  S.loading=true;render();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;ac.abort();},15000);
  try{const data=await json(M.forecastURL(p),ac.signal);if(seq!==requestId)return;if(!M.validWeather(data))throw new Error('El proveedor devolvió un pronóstico incompleto o inválido.');S.record={location:p,data,fetchedAt:Date.now()};S.source='network';put(S.record);}
  catch(e){if(seq!==requestId)return;S.error=e.name==='AbortError'?(timedOut?'La consulta tardó demasiado.':'Consulta cancelada.'):(e.message||'No fue posible conectar con el proveedor.');S.source=S.record?'cache':'none';if(S.record)toast(S.error+' Se conservan los datos guardados.');}
  finally{clearTimeout(timer);if(seq===requestId){S.loading=false;render();}}
 }
 function toggleFavorite(){if(favorite(S.location))S.favorites=S.favorites.filter(p=>M.key(p)!==M.key(S.location));else if(S.favorites.length<8)S.favorites.push({...S.location});else{toast('Podés guardar hasta 8 ciudades. Quitá una desde Ciudades.');return;}save();const b=$('favoriteBtn');if(b){b.setAttribute('aria-pressed',String(favorite(S.location)));b.setAttribute('aria-label',favorite(S.location)?'Quitar de favoritos':'Agregar a favoritos');}toast(favorite(S.location)?'Ciudad guardada en favoritas.':'Ciudad quitada de favoritas.');}
 function openDialog(id){const d=$(id);if(!d.open){d.showModal();Motion.dialog(d);}}
 function cityList(places){searchPlaces=unique(places);$('cityResults').innerHTML=searchPlaces.length?searchPlaces.map((p,i)=>`<div class="city-entry"><button class="city-open" data-place="${i}">${icon(favorite(p)?'star':'pin')}<div><strong>${esc(p.name)}</strong><small>${esc([p.admin1,p.country].filter(Boolean).join(' · ')||'Ubicación guardada')}</small></div>${icon('arrow','small')}</button>${favorite(p)?`<button class="city-remove" data-remove="${i}" aria-label="Quitar ${esc(p.name)} de favoritas">${icon('close')}</button>`:''}</div>`).join(''):'<p class="empty-inline">No encontramos coincidencias.</p>';}
 function openCities(){clearTimeout(searchTimer);searchController?.abort();searchId++;$('citySearch').value='';$('searchStatus').textContent='Tus favoritas y destinos sugeridos.';cityList([...S.favorites,...PRESETS]);openDialog('cityDialog');$('citySearch').focus();}
 function closeDialog(d){d.close();if(d.id==='cityDialog'){searchId++;clearTimeout(searchTimer);searchController?.abort();}}
 async function search(text,seq){
  const ac=new AbortController();searchController=ac;const timeout=setTimeout(()=>ac.abort(),10000);
  try{$('searchStatus').textContent='Buscando ciudades…';const q=new URLSearchParams({name:text,count:'8',language:'es',format:'json'});const d=await json('https://geocoding-api.open-meteo.com/v1/search?'+q,ac.signal);if(seq!==searchId)return;cityList(d.results||[]);$('searchStatus').textContent=searchPlaces.length?'Elegí la ciudad y región correctas.':'Probá con otra localidad.';}
  catch(e){if(seq!==searchId)return;$('searchStatus').textContent='No se pudo buscar en Internet. Se muestran tus ciudades locales.';cityList([...S.favorites,...PRESETS].filter(p=>p.name.toLocaleLowerCase().includes(text.toLocaleLowerCase())));}
  finally{clearTimeout(timeout);}
 }
 function locate(){
  if(!navigator.geolocation){toast('Este navegador no ofrece geolocalización. Buscá una ciudad.');return;}
  $('geoBtn').disabled=true;navigator.geolocation.getCurrentPosition(pos=>{$('geoBtn').disabled=false;closeDialog($('cityDialog'));load({name:'Mi ubicación',latitude:Math.round(pos.coords.latitude*10000)/10000,longitude:Math.round(pos.coords.longitude*10000)/10000},true);},e=>{$('geoBtn').disabled=false;$('searchStatus').textContent=e.code===1?'No se concedió el permiso. Podés buscar una ciudad manualmente.':'No se pudo determinar la ubicación. Probá con la búsqueda.';},{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
 }
 function download(name,text){const blob=new Blob([text],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
 function exportBackup(){download('atmos-respaldo-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'atmos-weather-backup',version:2,exportedAt:new Date().toISOString(),preferences:prefs(),forecasts:Object.values(cache)},null,2));toast('Respaldo exportado con preferencias y pronósticos.');}
 async function importBackup(file){
  if(!file)return;if(file.size>3*1024*1024){toast('El respaldo supera el límite de 3 MB.');return;}
  try{const b=JSON.parse(await file.text());if(b.format!=='atmos-weather-backup'||![1,2].includes(b.version))throw Error('No es un respaldo compatible de ATMÓS.');const pr=b.version===1?b:b.preferences;
   if(!M.location(pr?.location)||!Array.isArray(pr.favorites)||pr.favorites.length>8||pr.favorites.some(v=>!M.location(v)))throw Error('Las ciudades del respaldo no son válidas.');
   const list=b.version===1?(b.forecast?[b.forecast]:[]):b.forecasts;
   if(!Array.isArray(list)||list.length>8||list.some(r=>!M.record(r)))throw Error('El respaldo contiene pronósticos incompatibles o fechas inválidas.');
   const candidate={version:2,preferences:{location:M.location(pr.location),favorites:unique(pr.favorites),units:pr.units==='F'?'F':'C',theme:pr.theme==='light'?'light':'dark',motion:pr.motion==='reduced'?'reduced':'auto'},forecasts:{}};
   list.forEach(r=>{candidate.forecasts[M.key(r.location)]=M.record(r);});
   if(!confirm(`Restaurar ${candidate.preferences.favorites.length} favoritas y ${list.length} pronósticos. Se reemplazarán los datos locales actuales. Exportá un respaldo antes de continuar.`))return;
   try{localStorage.setItem(STORE,JSON.stringify(candidate));}catch{throw Error('No hay espacio para restaurar. No se modificaron los datos.');}
   Object.keys(cache).forEach(k=>delete cache[k]);Object.assign(cache,candidate.forecasts);Object.assign(S,candidate.preferences);S.record=null;S.selected=0;S.error='';storageOK=true;closeDialog($('settingsDialog'));toast('Respaldo restaurado.');load(S.location);
  }catch(e){toast(e.message||'No fue posible leer el respaldo.');}
 }
 async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copiado al portapapeles.');}catch{prompt('Copiá este texto:',text);}}
 async function share(){const url=new URL('./',location.href);url.search=new URLSearchParams({lat:S.location.latitude,lon:S.location.longitude,city:S.location.name}).toString();try{if(navigator.share)await navigator.share({title:'ATMÓS · '+S.location.name,url:String(url)});else await copy(String(url));}catch(e){if(e.name!=='AbortError')toast('No se pudo compartir el enlace.');}}
 function scrollToSection(id){const target=$(id);if(!target){toast('El pronóstico aún no está disponible.');return;}target.scrollIntoView({behavior:Motion.enabled()?'smooth':'auto',block:'start'});document.querySelectorAll('[data-goto]').forEach(b=>b.classList.toggle('active',b.dataset.goto===id));}
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-close')){closeDialog(b.closest('dialog'));return;}
  if(b.dataset.goto){scrollToSection(b.dataset.goto);return;}
  if(b.dataset.action==='cities'){openCities();return;}if(b.dataset.action==='settings'){updateSettings();openDialog('settingsDialog');return;}
  if(b.hasAttribute('data-place')){const p=searchPlaces[Number(b.dataset.place)];if(p){closeDialog($('cityDialog'));load(p);}return;}
  if(b.hasAttribute('data-remove')){const p=searchPlaces[Number(b.dataset.remove)];if(p){S.favorites=S.favorites.filter(f=>M.key(f)!==M.key(p));save();cityList(searchPlaces);if($('favoriteBtn'))$('favoriteBtn').setAttribute('aria-pressed',String(favorite(S.location)));}return;}
  if(b.dataset.metric){S.metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawChart();Motion.tabs($('metricTabs'));return;}
  if(b.dataset.range){S.range=Number(b.dataset.range);document.querySelectorAll('[data-range]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawChart();return;}
  if(b.hasAttribute('data-hour')){selectHour(Number(b.dataset.hour));return;}
  switch(b.id){
   case 'cityBtn':openCities();break;case 'settingsBtn':updateSettings();openDialog('settingsDialog');break;
   case 'refreshBtn':case 'retryBtn':load(S.location,true);break;case 'cancelBtn':controller?.abort();break;
   case 'favoriteBtn':toggleFavorite();break;
   case 'unitsBtn':S.units=S.units==='C'?'F':'C';save();render();break;
   case 'themeBtn':S.theme=S.theme==='dark'?'light':'dark';save();header();break;
   case 'motionBtn':S.motion=S.motion==='auto'?'reduced':'auto';save();header();break;
   case 'geoBtn':locate();break;case 'exportBtn':exportBackup();break;case 'importBtn':$('importFile').click();break;
   case 'widgetBtn':copy(`${S.location.latitude},${S.location.longitude}|${S.location.name.replace(/\|/g,' ')}`);break;
   case 'shareBtn':share();break;
   case 'updateBtn':if(waitingSW){updateRequested=true;waitingSW.postMessage({type:'SKIP_WAITING'});}else location.reload();break;
  }
 });
 $('citySearch').addEventListener('input',e=>{const text=e.target.value.trim();const seq=++searchId;clearTimeout(searchTimer);searchController?.abort();if(text.length<2){cityList([...S.favorites,...PRESETS]);$('searchStatus').textContent='Escribí al menos dos caracteres para buscar.';return;}searchTimer=setTimeout(()=>search(text,seq),300);});
 $('importFile').addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';importBackup(f);});
 $('cityDialog').addEventListener('cancel',()=>{searchId++;clearTimeout(searchTimer);searchController?.abort();});
 window.addEventListener('offline',()=>{if(S.record)render();else header();});window.addEventListener('online',()=>load(S.location,true));
 function resume(){if(document.hidden)return;header();if(navigator.onLine&&!S.loading&&S.record&&Date.now()-S.record.fetchedAt>1800000&&Date.now()-autoAttempt>300000){autoAttempt=Date.now();load(S.location,true);}}
 document.addEventListener('visibilitychange',resume);setInterval(resume,60000);
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(S.record&&$('chartContainer')&&Math.abs($('chartContainer').clientWidth-graph.width)>2)drawChart();Motion.tabs($('metricTabs'));},120);},{passive:true});
 async function install(){
  if(!('serviceWorker' in navigator)||!isSecureContext||!/^https?:$/.test(location.protocol))return;
  try{const reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});const ready=()=>{if(reg.waiting&&navigator.serviceWorker.controller){waitingSW=reg.waiting;$('updateNotice').hidden=false;}};ready();reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',ready);});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();});}
  catch{toast('No se activó la apertura offline. El pronóstico puede seguir funcionando online.');}
 }
 header();load(S.location);install();
})();
