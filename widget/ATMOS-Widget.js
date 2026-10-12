// ATMÓS · Widget para Scriptable (iOS)
// Scriptable → Nuevo script → pegar este archivo → añadir widget de Scriptable.
// Parámetro opcional del widget: -34.6037,-58.3816|Buenos Aires
// Tamaños: small, medium, large, accessoryInline, accessoryCircular, accessoryRectangular.
// Datos REALES de Open-Meteo. El estado offline siempre muestra antigüedad de los datos.
// https://gatdeguin.github.io/Atmos/

const APP_URL = 'https://gatdeguin.github.io/Atmos/';
const DEFAULT_PLACE = { lat: -34.6037, lon: -58.3816, name: 'Buenos Aires' };
const P = {
  bg: '#101c2b', bg2: '#173d50', mint: '#a8f4e4', white: '#f5faff', secondary: '#b2c7d5',
  golden: '#ffd08c', muted: '#89a8b9', rain: '#91ccff'
};

function placeFromParameter(raw) {
  if (!raw || !String(raw).trim()) return DEFAULT_PLACE;
  const match = String(raw).trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*(?:\|\s*(.+))?$/);
  if (!match) return DEFAULT_PLACE;
  const lat = Number(match[1]), lon = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return DEFAULT_PLACE;
  return { lat, lon, name: String(match[3] || 'Mi ubicación').trim().slice(0, 50) || 'Mi ubicación' };
}
const place = placeFromParameter(args.widgetParameter);

function weatherType(code, day) {
  const c = Number(code);
  if (c === 0) return { label: day ? 'Despejado' : 'Cielo despejado', icon: day ? 'sun.max.fill' : 'moon.stars.fill', emoji: day ? '☀️' : '🌙' };
  if (c <= 3) return { label: c === 1 ? 'Mayormente despejado' : c === 2 ? 'Parcialmente nublado' : 'Nublado', icon: day ? 'cloud.sun.fill' : 'cloud.moon.fill', emoji: '⛅' };
  if (c === 45 || c === 48) return { label: 'Niebla', icon: 'cloud.fog.fill', emoji: '🌫️' };
  if ([51,53,55,56,57].includes(c)) return { label: 'Llovizna', icon: 'cloud.drizzle.fill', emoji: '🌦️' };
  if ([61,63,65,66,67,80,81,82].includes(c)) return { label: 'Lluvia', icon: 'cloud.rain.fill', emoji: '🌧️' };
  if ([71,73,75,77,85,86].includes(c)) return { label: 'Nieve', icon: 'cloud.snow.fill', emoji: '❄️' };
  if (c >= 95) return { label: 'Tormenta', icon: 'cloud.bolt.rain.fill', emoji: '⛈️' };
  return { label: 'Variable', icon: 'cloud.fill', emoji: '☁️' };
}
const n = value => typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
const textN = value => n(value) === null ? '—' : String(n(value));
const degree = value => `${textN(value)}°`;
function addTxt(target, s, size, color = P.white, weight = 'regular') {
  const t = target.addText(String(s));
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : weight === 'medium' ? Font.mediumSystemFont(size) : Font.systemFont(size);
  t.textColor = new Color(color);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.67;
  return t;
}
function addIcon(target, symbol, size, color = P.mint) {
  const image = SFSymbol.named(symbol);
  if (!image) return null;
  image.applyFont(Font.systemFont(size));
  const v = target.addImage(image.image);
  v.tintColor = new Color(color);
  v.imageSize = new Size(size, size);
  return v;
}
function row(target, gap = 6) { const r = target.addStack(); r.layoutHorizontally(); r.centerAlignContent(); r.spacing = gap; return r; }
function col(target, gap = 0) { const r = target.addStack(); r.layoutVertically(); r.spacing = gap; return r; }

function validForecast(json) {
  const c = json && json.current;
  return !!(c && typeof c.time === 'string' && typeof c.temperature_2m === 'number' &&
    typeof c.weather_code === 'number' && typeof json.latitude === 'number' &&
    json.hourly && Array.isArray(json.hourly.time) &&
    json.daily && Array.isArray(json.daily.time));
}

const cacheManager = FileManager.local();
const folder = cacheManager.joinPath(cacheManager.documentsDirectory(), 'atmos-widgets-v1');
if (!cacheManager.fileExists(folder)) cacheManager.createDirectory(folder);
const id = `${place.lat.toFixed(4)}_${place.lon.toFixed(4)}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
const cacheFile = cacheManager.joinPath(folder, `${id}.json`);
function cachedForecast() {
  try {
    if (!cacheManager.fileExists(cacheFile)) return null;
    const raw = JSON.parse(cacheManager.readString(cacheFile));
    return validForecast(raw.forecast) && typeof raw.fetchedAt === 'number' ? raw : null;
  } catch (e) { return null; }
}
async function fetchForecast() {
  const parts = [
    ['latitude', place.lat], ['longitude', place.lon],
    ['current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m'],
    ['hourly', 'temperature_2m,precipitation_probability,weather_code'],
    ['daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'],
    ['timezone', 'auto'], ['forecast_days', 2]
  ];
  const url = 'https://api.open-meteo.com/v1/forecast?' + parts.map(([k,v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  const req = new Request(url);
  req.timeoutInterval = 12;
  const result = await req.loadJSON();
  if (req.response && req.response.statusCode !== 200) throw new Error('API HTTP ' + req.response.statusCode);
  if (!validForecast(result)) throw new Error('Pronóstico incompleto');
  const saved = {forecast:result, fetchedAt:Date.now()};
  try { cacheManager.writeString(cacheFile, JSON.stringify(saved)); } catch (e) { /* sin espacio: conservar pronóstico en memoria */ }
  return saved;
}

let record = null, stale = false;
try { record = await fetchForecast(); }
catch (error) { record = cachedForecast(); stale = true; console.warn('ATMÓS, conexión:', String(error)); }

const w = new ListWidget();
const family = config.widgetFamily || 'medium';
const accessory = family.startsWith('accessory');
const urlParams = `?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&city=${encodeURIComponent(place.name)}`;
w.url = APP_URL + urlParams;
w.refreshAfterDate = new Date(Date.now() + 35 * 60 * 1000); // iOS decide cuándo ejecutarlo.
if (!accessory) {
  const grad = new LinearGradient();
  grad.colors = [new Color(P.bg), new Color(P.bg2)];
  grad.locations = [0, 1];
  w.backgroundGradient = grad;
  w.setPadding(14, 15, 13, 15);
}

const days = record && record.forecast.daily;
const current = record && record.forecast.current;
const weather = current ? weatherType(current.weather_code, !!current.is_day) : weatherType(-1, true);
const stamp = record ? new Date(record.fetchedAt) : null;
const ageMins = stamp ? Math.max(0, Math.floor((Date.now() - stamp.getTime()) / 60000)) : null;
const age = ageMins == null ? 'sin datos' : ageMins < 2 ? 'recién' : ageMins < 60 ? `${ageMins} min` : ageMins < 1440 ? `${Math.floor(ageMins/60)} h` : `${Math.floor(ageMins/1440)} d`;
const dataDay = current ? current.time.slice(0,10) : '';
const dayIndex = days && days.time.indexOf(dataDay);
const iDay = dayIndex >= 0 ? dayIndex : 0;
const hi = days && days.temperature_2m_max && days.temperature_2m_max[iDay];
const low = days && days.temperature_2m_min && days.temperature_2m_min[iDay];
const rain = days && days.precipitation_probability_max && days.precipitation_probability_max[iDay];
const hourly = record && record.forecast.hourly;
let next = [];
if (hourly && hourly.time && current) {
  const pivot = current.time.slice(0,13);
  let from = hourly.time.findIndex(t => typeof t === 'string' && t.slice(0,13) >= pivot);
  if (from < 0) from = 0;
  next = hourly.time.slice(from, from+6).map((t,i) => ({
    hh: t.slice(11,13) + 'h',
    temp: hourly.temperature_2m && hourly.temperature_2m[from+i],
    pop: hourly.precipitation_probability && hourly.precipitation_probability[from+i],
    code: hourly.weather_code && hourly.weather_code[from+i]
  }));
}
function statusLine() { return stale ? `CACHÉ SIN CONEXIÓN · ${age}` : `ACTUALIZADO · ${age} · OPEN-METEO`; }

if (!record) {
  if (accessory) {
    addTxt(w, 'ATMÓS · Sin datos', 12);
  } else {
    addTxt(w, 'atmós.', 18, P.mint, 'bold');
    w.addSpacer(8);
    addIcon(w, 'wifi.slash', 25, P.golden);
    w.addSpacer(7);
    addTxt(w, 'Sin conexión', 20, P.white, 'bold');
    addTxt(w, 'Abrí la app con Internet', 10, P.secondary);
  }
} else if (accessory) {
  if (family === 'accessoryInline') {
    addTxt(w, `${weather.emoji} ${degree(current.temperature_2m)} · ${place.name}${stale ? ' · antiguos' : ''}`, 12);
  } else if (family === 'accessoryCircular') {
    const c = col(w, 0);
    c.centerAlignContent();
    addIcon(c, weather.icon, 21);
    addTxt(c, degree(current.temperature_2m), 20, P.white, 'bold').centerAlignText();
    if (stale) addTxt(c, 'OFF', 8).centerAlignText();
  } else {
    const c = col(w, 1);
    addTxt(c, `ATMÓS · ${place.name}`, 10, P.white, 'bold');
    const r = row(c, 5);
    addIcon(r, weather.icon, 18);
    addTxt(r, `${degree(current.temperature_2m)}  ${weather.label}`, 13, P.white, 'medium');
    addTxt(c, stale ? `Sin conexión · ${age}` : `↑ ${degree(hi)}  ↓ ${degree(low)}`, 10, P.white);
  }
} else {
  const header = row(w, 3);
  addTxt(header, 'atmós.', 14, P.mint, 'bold');
  header.addSpacer();
  addTxt(header, place.name, family === 'small' ? 9 : 11, P.secondary, 'medium');
  w.addSpacer(family === 'small' ? 12 : 15);

  if (family === 'small') {
    const line = row(w, 6);
    addIcon(line, weather.icon, 24, P.golden);
    addTxt(line, degree(current.temperature_2m), 36, P.white, 'bold');
    w.addSpacer(5);
    addTxt(w, weather.label, 12, P.secondary);
    w.addSpacer();
    addTxt(w, `↑ ${degree(hi)}   ↓ ${degree(low)}`, 11, P.white, 'medium');
    addTxt(w, statusLine(), 8, stale ? P.golden : P.muted);
  } else {
    const main = row(w, 15);
    const left = col(main, 3);
    const tline = row(left, 7);
    addIcon(tline, weather.icon, 31, P.golden);
    addTxt(tline, degree(current.temperature_2m), 40, P.white, 'bold');
    addTxt(left, weather.label, 11, P.secondary);
    addTxt(left, `↑ ${degree(hi)}   ↓ ${degree(low)}`, 12, P.white, 'medium');
    main.addSpacer();
    if (family === 'medium') {
      const right = col(main, 8);
      addTxt(right, `Lluvia  ${textN(rain)}%`, 11, P.rain, 'medium');
      addTxt(right, `Viento  ${textN(current.wind_speed_10m)} km/h`, 11, P.secondary);
      addTxt(right, `Humedad  ${textN(current.relative_humidity_2m)}%`, 11, P.secondary);
    }
    if (family === 'large' || family === 'extraLarge') {
      w.addSpacer(15);
      const detail = row(w, 13);
      addTxt(detail, `LLUVIA ${textN(rain)}%`, 11, P.rain, 'medium');
      addTxt(detail, `HUM ${textN(current.relative_humidity_2m)}%`, 11, P.secondary, 'medium');
      addTxt(detail, `VIENTO ${textN(current.wind_speed_10m)} km/h`, 11, P.secondary, 'medium');
      w.addSpacer(17);
      addTxt(w, 'PRÓXIMAS HORAS', 10, P.muted, 'bold');
      w.addSpacer(10);
      const hours = row(w, 6);
      for (const h of next.slice(0,5)) {
        const block = col(hours, 7);
        block.centerAlignContent();
        addTxt(block, h.hh, 10, P.secondary).centerAlignText();
        addIcon(block, weatherType(h.code,true).icon, 19, P.mint);
        addTxt(block, degree(h.temp), 14, P.white, 'bold').centerAlignText();
        addTxt(block, `${textN(h.pop)}%`, 9, P.rain).centerAlignText();
        hours.addSpacer();
      }
    }
    w.addSpacer();
    addTxt(w, statusLine(), 9, stale ? P.golden : P.muted);
  }
}

Script.setWidget(w);
if (!config.runsInWidget) {
  if (family === 'small') await w.presentSmall();
  else if (family === 'large' || family === 'extraLarge') await w.presentLarge();
  else if (family === 'accessoryInline') await w.presentAccessoryInline();
  else if (family === 'accessoryCircular') await w.presentAccessoryCircular();
  else if (family === 'accessoryRectangular') await w.presentAccessoryRectangular();
  else await w.presentMedium();
}
Script.complete();