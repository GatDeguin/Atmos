const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'../model.js');
const load=()=>{assert.ok(fs.existsSync(file),'model.js debe existir'); return require(file);};
const NOW=Date.parse('2026-10-11T23:00:00Z');
function fixture(){
 const times=Array.from({length:72},(_,i)=>new Date(Date.UTC(2026,9,11,i)).toISOString().slice(0,16));
 return {latitude:-34.6,longitude:-58.4,timezone:'America/Argentina/Buenos_Aires',current:{time:'2026-10-11T20:00',temperature_2m:22,weather_code:2,is_day:0},hourly:{time:times,temperature_2m:times.map(()=>22),precipitation:times.map(()=>0),precipitation_probability:times.map(()=>5),wind_gusts_10m:times.map(()=>24)},daily:{time:['2026-10-11','2026-10-12','2026-10-13'],temperature_2m_max:[24,25,23],temperature_2m_min:[15,16,14]}};
}
test('valida un pronóstico real en estructura y rechaza arrays desalineados',()=>{const M=load();const d=fixture();assert.ok(M.validWeather(d));d.hourly.precipitation.pop();assert.equal(M.validWeather(d),false);});
test('rechaza fechas inválidas sin lanzar excepciones de render',()=>{const M=load(),d=fixture();d.daily.time[0]='2026-99-77';assert.equal(M.validWeather(d),false);});
test('acepta opcionales ausentes pero rechaza tipos maliciosos',()=>{const M=load(),d=fixture();delete d.hourly.precipitation;assert.ok(M.validWeather(d));d.hourly.wind_gusts_10m[0]='<script>';assert.equal(M.validWeather(d),false);});
test('las próximas horas se calculan por hora de ciudad, no del dato guardado',()=>{const M=load(),d=fixture();d.current.time='2026-10-11T01:00';assert.equal(M.hours(d,6,NOW)[0].time,'2026-10-11T20:00');});
test('un horizonte vencido no vuelve silenciosamente a horas pasadas',()=>{const M=load();assert.deepEqual(M.hours(fixture(),24,NOW+7*86400000),[]);});
test('variables incompletas no se convierten en cero ni en ausencia de riesgo',()=>{const M=load();const h=M.hours(fixture(),6,NOW);delete h[2].precipitation;const a=M.summarize(h);assert.equal(a.rain,null);assert.equal(a.partial,true);});
test('analiza realmente acumulados, probabilidad y ráfagas',()=>{const M=load();const h=M.hours(fixture(),6,NOW);h[2].precipitation=.7;h[3].precipitation=1.3;h[3].precipitation_probability=80;const a=M.summarize(h);assert.equal(a.rain,2);assert.equal(a.probability,80);assert.equal(a.gust,24);});
test('no interpreta código WMO null como cielo despejado',()=>{const M=load();assert.equal(M.weather(null,true).scene,'unknown');assert.equal(M.weather(95,true).scene,'storm');assert.equal(M.weather(75,true).scene,'snow');});
test('conversiones conservan nulos y son precisas',()=>{const M=load();assert.equal(M.temp(0,'F'),32);assert.equal(M.temp(null,'F'),null);assert.ok(Math.abs(M.speed(16.09344,'F')-10)<1e-8);});
test('normaliza ubicaciones sin conservar campos importados inesperados',()=>{const M=load();const p=M.location({name:' Buenos Aires ',latitude:-34.6,longitude:-58.4,secret:'no'});assert.equal(p.name,'Buenos Aires');assert.ok(!('secret' in p));assert.equal(M.location({name:'X',latitude:NaN,longitude:0}),null);});
test('parámetros de enlace vacíos nunca se convierten a coordenadas cero',()=>{const M=load();assert.equal(M.fromQuery('?lat=&lon=&city=X'),null);assert.equal(M.fromQuery('?lat=0&lon=0&city=Origen').latitude,0);});
test('caché exige origen válido y rechaza fechas futuras o tipo incorrecto',()=>{const M=load(),r={location:{name:'BA',latitude:-34.6,longitude:-58.4},data:fixture(),fetchedAt:NOW};assert.ok(M.record(r,NOW));assert.equal(M.record({...r,fetchedAt:NOW+3600000},NOW),null);});
test('dirección del viento y zona horaria son consistentes',()=>{const M=load();assert.equal(M.direction(270),'O');assert.equal(M.localISO('America/Argentina/Buenos_Aires',NOW),'2026-10-11T20:00');});
module.exports={fixture,NOW};
