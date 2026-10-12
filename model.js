/* ATMÓS 2.0 — deterministic data contracts; no UI, network or generated weather. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AtmosModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const HOURLY=['temperature_2m','apparent_temperature','relative_humidity_2m','precipitation_probability','precipitation','weather_code','wind_speed_10m','wind_gusts_10m','wind_direction_10m','uv_index','visibility','is_day'];
 const DAILY=['temperature_2m_max','temperature_2m_min','precipitation_sum','precipitation_probability_max','wind_gusts_10m_max','uv_index_max','weather_code'];
 const CURRENT=['temperature_2m','apparent_temperature','relative_humidity_2m','weather_code','is_day','wind_speed_10m','wind_gusts_10m','wind_direction_10m','surface_pressure','cloud_cover'];
 function date(s,timed=false){
  if(typeof s!=='string'||!(timed?/^\d{4}-\d\d-\d\dT\d\d:\d\d$/:/^\d{4}-\d\d-\d\d$/).test(s))return false;
  const d=new Date(s+(timed?':00Z':'T00:00:00Z'));return Number.isFinite(d.getTime())&&d.toISOString().slice(0,timed?16:10)===s;
 }
 function zone(z){try{if(typeof z!=='string'||z.length>100)return false;new Intl.DateTimeFormat('en',{timeZone:z});return true;}catch{return false;}}
 function location(v){
  if(!v||typeof v!=='object'||typeof v.name!=='string'||!v.name.trim()||v.name.length>120||!num(v.latitude)||Math.abs(v.latitude)>90||!num(v.longitude)||Math.abs(v.longitude)>180)return null;
  return {name:v.name.trim().slice(0,120),latitude:v.latitude,longitude:v.longitude,admin1:typeof v.admin1==='string'?v.admin1.slice(0,120):'',country:typeof v.country==='string'?v.country.slice(0,100):'',...(zone(v.timezone)?{timezone:v.timezone}:{})};
 }
 function fromQuery(search){
  const p=new URLSearchParams(search),a=p.get('lat'),b=p.get('lon');
  if(!a?.trim()||!b?.trim())return null;
  return location({name:p.get('city')||'Ubicación compartida',latitude:Number(a),longitude:Number(b)});
 }
 function validWeather(d){
  if(!d||typeof d!=='object'||d.error||!zone(d.timezone)||!d.current||!num(d.current.temperature_2m)||!date(d.current.time,true))return false;
  if(!CURRENT.every(k=>d.current[k]==null||num(d.current[k])))return false;
  for(const [part,keys,max,timed,required]of [[d.hourly,HOURLY,400,true,['temperature_2m']],[d.daily,DAILY,16,false,['temperature_2m_max','temperature_2m_min']]]){
   if(!part||!Array.isArray(part.time)||part.time.length<1||part.time.length>max||!part.time.every(t=>date(t,timed)))return false;
   if(!part.time.every((t,i)=>i===0||t>part.time[i-1]))return false;
   if(!required.every(k=>Array.isArray(part[k])))return false;
   if(!keys.every(k=>part[k]===undefined||(Array.isArray(part[k])&&part[k].length===part.time.length&&part[k].every(v=>v===null||num(v)))))return false;
  }
  for(const k of ['sunrise','sunset'])if(d.daily[k]!==undefined&&(!Array.isArray(d.daily[k])||d.daily[k].length!==d.daily.time.length||!d.daily[k].every(v=>v===null||date(v,true))))return false;
  return true;
 }
 function localISO(tz,now=Date.now()){
  const parts={};new Intl.DateTimeFormat('en-GB',{timeZone:zone(tz)?tz:'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).forEach(p=>{parts[p.type]=p.value;});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
 }
 function hours(d,limit=48,now=Date.now()){
  if(!d?.hourly?.time)return [];
  const pivot=localISO(d.timezone,now).slice(0,13),start=d.hourly.time.findIndex(t=>t.slice(0,13)>=pivot);
  if(start<0)return [];
  return d.hourly.time.slice(start,start+clamp(limit,1,192)).map((time,j)=>{const row={time,index:start+j};HOURLY.forEach(k=>{row[k]=d.hourly[k]?.[start+j]??null;});return row;});
 }
 function summarize(h){
  const complete=k=>h.length>0&&h.every(r=>num(r[k]));
  const full=['precipitation','precipitation_probability','wind_gusts_10m'].every(complete);
  return {count:h.length,partial:!full,rain:complete('precipitation')?h.reduce((s,r)=>s+r.precipitation,0):null,probability:complete('precipitation_probability')?Math.max(...h.map(r=>r.precipitation_probability)):null,gust:complete('wind_gusts_10m')?Math.max(...h.map(r=>r.wind_gusts_10m)):null,thunder:h.some(r=>[95,96,99].includes(r.weather_code))};
 }
 function weather(code,day=true){
  if(!num(code))return {label:'Sin condición disponible',scene:'unknown',icon:'cloud'};
  if(code===0||code===1)return {label:code===0?'Despejado':'Mayormente despejado',scene:'clear',icon:day?'sun':'moon'};
  if(code===2)return {label:'Parcialmente nublado',scene:'partly',icon:day?'partly':'cloud'};
  if(code===3)return {label:'Cielo cubierto',scene:'cloud',icon:'cloud'};
  if([45,48].includes(code))return {label:'Niebla',scene:'fog',icon:'fog'};
  if([51,53,55,56,57].includes(code))return {label:'Llovizna',scene:'rain',icon:'rain'};
  if([61,63,65,66,67,80,81,82].includes(code))return {label:[65,67,82].includes(code)?'Lluvia intensa':'Lluvia',scene:'rain',icon:'rain'};
  if([71,73,75,77,85,86].includes(code))return {label:'Nieve',scene:'snow',icon:'snow'};
  if([95,96,99].includes(code))return {label:'Tormentas',scene:'storm',icon:'storm'};
  return {label:'Condiciones variables',scene:'unknown',icon:'cloud'};
 }
 const temp=(v,u='C')=>num(v)?u==='F'?v*9/5+32:v:null;
 const speed=(v,u='C')=>num(v)?u==='F'?v/1.609344:v:null;
 const key=p=>`${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;
 function record(r,now=Date.now()){
  const p=location(r?.location);
  if(!p||!num(r?.fetchedAt)||r.fetchedAt<=0||r.fetchedAt>now+300000||!validWeather(r.data))return null;
  return {location:p,data:r.data,fetchedAt:r.fetchedAt};
 }
 function direction(v){return num(v)?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'][Math.round(((v%360)+360)%360/22.5)%16]:'—';}
 function age(at,now=Date.now()) {const m=Math.max(0,Math.floor((now-at)/60000));return m<1?'hace un instante':m<60?`hace ${m} min`:m<1440?`hace ${Math.floor(m/60)} h`:`hace ${Math.floor(m/1440)} d`;}
 function forecastURL(p){
  const q=new URLSearchParams({latitude:String(p.latitude),longitude:String(p.longitude),current:CURRENT.join(','),hourly:HOURLY.join(','),daily:[...DAILY,'sunrise','sunset'].join(','),timezone:'auto',forecast_days:'7',temperature_unit:'celsius',wind_speed_unit:'kmh',precipitation_unit:'mm'});
  return 'https://api.open-meteo.com/v1/forecast?'+q;
 }
 return Object.freeze({num,clamp,date,zone,location,fromQuery,validWeather,localISO,hours,summarize,weather,temp,speed,key,record,direction,age,forecastURL});
});
