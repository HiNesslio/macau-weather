import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const FEEDS = {
  current: 'https://xml.smg.gov.mo/c_actual_brief.xml',
  today: 'https://xml.smg.gov.mo/c_forecast.xml',
  sevenDays: 'https://xml.smg.gov.mo/c_7daysforecast.xml',
  warnings: 'https://rss.smg.gov.mo/c_WSignal_rss.xml',
  uv: 'https://xml.smg.gov.mo/c_actualUVI.xml',
  air: 'https://www.smg.gov.mo/smg/airQuality/latestAirConcentration.json',
  airForecast: 'https://xml.smg.gov.mo/c_foreiqa.xml',
  stations: 'https://xml.smg.gov.mo/c_actualweather.xml',
  hourly: 'https://api.open-meteo.com/v1/forecast?latitude=22.1987&longitude=113.5439&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Asia%2FMacau&daily=sunrise,sunset&forecast_days=2&timeformat=unixtime',
};
const parser = new XMLParser({ parseTagValue: false, trimValues: true, ignoreAttributes: false });
const list = v => v == null ? [] : Array.isArray(v) ? v : [v];
const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const number = v => v == null || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const bounded = (v, min, max) => { const n = number(v); return n !== null && n >= min && n <= max ? n : null; };
export const localTime = input => { const v = String(input || '').replaceAll('/', '-'); return /^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(v || '') ? v.replace(' ', 'T') + '+08:00' : null; };
function xml(text) {
  if (XMLValidator.validate(text) !== true) throw Error('Invalid XML');
  return parser.parse(text);
}
export function parseCurrent(text) {
  const root = xml(text).ActualWeatherBrief;
  if (!root?.Custom) throw Error('Missing observations');
  const c = root.Custom;
  const temp = type => bounded(list(c.Temperature).find(v => v.Type === type)?.Value, -50, 60);
  const result = {
    temperature: temp('3'), high: temp('8'), low: temp('9'),
    humidity: bounded(c.Humidity?.Value, 0, 100), windSpeed: bounded(c.WindSpeed?.Value, 0, 500),
    windDirection: clean(c.WindDirection?.WindDescription) || null,
    description: clean(c.Icon?.IconDescription) || null,
    weatherCode: clean(c.WeatherStatus) || null,
    feelsLikeDescription: clean(c.FeelsLikeDescription) || null,
    publishedAt: localTime(root.System?.SysPubdate), validFor: localTime(c.ValidFor),
  };
  if (result.temperature === null && result.humidity === null && result.windSpeed === null) throw Error('Empty observations');
  return result;
}
export function parseToday(text, now = new Date()) {
  const root = xml(text).ActualForecast;
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Macau', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const forecasts = list(root?.Custom?.WeatherForecast).map(f => ({ validFor: f.ValidFor, description: clean(f.WeatherDescription) }));
  const today = forecasts.find(f => f.validFor === date);
  if (!today?.description) throw Error('No forecast for today');
  return { ...today, situation: clean(root.Custom.TodaySituation), publishedAt: localTime(root.System?.SysPubdate), forecasts };
}
export function parseSevenDays(text) {
  const root=xml(text).SevenDaysForecast;
  const days=list(root?.Custom?.WeatherForecast).filter(f=>/^\d{4}-\d\d-\d\d$/.test(f.ValidFor||'')).map(f=>{
    const value=(tag,type,min,max)=>bounded(list(f[tag]).find(v=>v.Type===type)?.Value,min,max);
    const high=value('Temperature','1',-50,60),low=value('Temperature','2',-50,60);
    const humidityHigh=value('Humidity','1',0,100),humidityLow=value('Humidity','2',0,100);
    if(high!==null&&low!==null&&high<low)throw Error('Invalid forecast range');
    return {date:f.ValidFor,high,low,humidity:humidityLow!==null&&humidityHigh!==null?`${humidityLow}–${humidityHigh}%`:null,
      description:clean(f.WeatherDescription),weatherCode:clean(f.WeatherStatus)};
  });
  if(!days.length)throw Error('No structured daily forecasts');
  return {days:days.slice(0,7),publishedAt:localTime(root.System?.SysPubdate)||localTime(root.Custom?.IssuedTime)};
}
export function parseWarnings(text) {
  const channel = xml(text).rss?.channel;
  const description = list(channel?.item)[0]?.description;
  if (!description) throw Error('Missing warning bulletin');
  // RSS is a status table, not a list of active warnings. Keep unknown wording as unknown.
  const rows = [...description.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const entries = rows.map(row => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]));
    if (cells.length !== 3) return null;
    const absent = /現時(?:並)?沒有/.test(cells[2]);
    const active = absent ? false : /(?:現正|現時|現已|已經)?(?:發出|懸掛|生效)|(?:警告|信號).*生效/.test(cells[2]) ? true : null;
    return { type: cells[0], publishedAt: localTime(cells[1]), description: cells[2], active };
  }).filter(Boolean);
  if (!entries.length) throw Error('Unrecognized warning table');
  return { entries, publishedAt: channel.pubDate || null };
}
export function parseHourly(data, now = new Date()) {
  const h = data.hourly;
  if (!h || data.hourly_units?.temperature_2m !== '°C' || data.hourly_units?.precipitation_probability !== '%') throw Error('Invalid hourly units');
  const start = Math.floor(now.getTime() / 3600000) * 3600;
  const hours = list(h.time).map((time, i) => ({
    time: new Date(Number(time) * 1000).toISOString(),
    temperature: bounded(h.temperature_2m?.[i], -50, 60),
    rainChance: bounded(h.precipitation_probability?.[i], 0, 100),
    weatherCode: number(h.weather_code?.[i]),
  })).filter(v => Date.parse(v.time) >= start * 1000).slice(0, 12);
  if (!hours.length || !hours.some(h => h.temperature !== null)) throw Error('Empty hourly forecast');
  const solar = list(data.daily?.time).map((time, i) => ({ date: new Date(Number(time) * 1000).toISOString(), sunrise: number(data.daily.sunrise?.[i]), sunset: number(data.daily.sunset?.[i]) })).filter(s => s.sunrise !== null && s.sunset !== null && s.sunrise < s.sunset);
  return { source: 'Open-Meteo', kind: 'model_forecast', timezone: 'Asia/Macau', hours, solar };
}
export function parseUV(text) {
  const root = xml(text)['ActualUV-Index'];
  const report = root?.Custom?.ActualUVBReport;
  const index = bounded(report?.['UV-Index']?.Value, 0, 30);
  if (index === null) throw Error('Missing UV reading');
  return { index, level: index < 3 ? '低' : index < 6 ? '中等' : index < 8 ? '高' : index < 11 ? '甚高' : '極高',
    observedAt: localTime(report.RecordTime), publishedAt: localTime(root.System?.SysPubdate) };
}
export function parseAir(data) {
  const stations = Object.values(data).filter(s => s && typeof s === 'object' && s.CODE).map(s => {
    const stamp = /^(\d{4})(\d\d)(\d\d)(\d\d)$/.exec(s.DDTT || '');
    return { code: s.CODE, name: clean(s.Chinese),
      observedAt: stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:00+08:00` : null,
      pm25: bounded(s.HE_PM2_5, 0, 10000), pm10: bounded(s.HE_PM10, 0, 10000),
      no2: bounded(s.HE_NO2, 0, 10000), o3: bounded(s.HE_O3, 0, 10000),
      so2: bounded(s.HE_SO2, 0, 10000), co: bounded(s.HE_CO, 0, 1000) };
  });
  if (!stations.some(s => s.pm25 !== null)) throw Error('No air concentration data');
  return { publishedAt: localTime(data.datetime), stations, units: { pm25: 'µg/m³', pm10: 'µg/m³', no2: 'µg/m³', o3: 'µg/m³', so2: 'µg/m³', co: 'mg/m³' } };
}
export function parseAirForecast(text) {
  const root = xml(text).ForecastIQA;
  const areas = list(root?.Custom?.AQIForecastReport).flatMap(r => list(r.Station)).map(s => ({
    name: clean(s.Stationname), validFor: s.AQIForecast?.ValidFor || null,
    range: clean(s.AQIForecast?.Value), level: clean(s.AQIForecast?.AQIForecastDescription) }));
  if (!areas.length || !areas.every(a => /^\d+-\d+$/.test(a.range) && a.validFor)) throw Error('Invalid AQI forecast');
  return { description: clean(root.Custom.ReportDescription), publishedAt: localTime(root.System?.SysPubdate), areas };
}
export function parseStations(text) {
  const root = xml(text).ActualWeather;
  const stations = list(root?.Custom?.WeatherReport).flatMap(r => list(r.station)).map(s => {
    const value = (name, min, max) => bounded(s[name]?.dValue ?? s[name]?.Value, min, max);
    const rainfall = type => {
      const entry = list(s.Rainfall).find(record => Number(record.Type) === type && record.MeasureUnit === 'mm');
      return bounded(entry?.dValue ?? entry?.Value, 0, Infinity);
    };
    return { code: s['@_code'], name: clean(s.stationname), observedAt: localTime(s.RecordTime),
      temperature: value('Temperature', -50, 60), high: value('Temperature_daily_max', -50, 60), low: value('Temperature_daily_min', -50, 60), humidity: value('Humidity', 0, 100),
      windSpeed: value('WindSpeed', 0, 500), windGust: value('WindGust', 0, 500),
      windDirection: clean(s.WindDirection?.WindDescription), dewPoint: value('DewPoint', -70, 60),
      pressure: value('MeanSeaLevelPressure', 850, 1100), rainHour: rainfall(4), rainToday: rainfall(5) };
  });
  if (!stations.some(s => s.temperature !== null)) throw Error('No station observations');
  return { publishedAt: localTime(root.System?.SysPubdate), stations };
}
export function attachDailyForecast(payload, now = new Date()) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Macau',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const day=payload.sevenDays?.days?.find(d=>d.date===date);
  payload.dailyForecast=day?{...day,kind:'forecast_daily',sourceUrl:FEEDS.sevenDays,publishedAt:payload.sevenDays.publishedAt}:null;
  // Keep backwards-compatible high/low fields, with their forecast semantics explicit.
  // Observed daily extrema remain separate and are never substituted for forecasts.
  if(payload.current){
    const c=payload.current;c.observedHigh=c.high;c.observedLow=c.low;
    c.high=day?.high??null;c.low=day?.low??null;
    c.extrema={kind:'forecast_daily',validFor:date,sourceUrl:FEEDS.sevenDays,publishedAt:payload.sevenDays?.publishedAt||null};
  }
  return payload;
}
const parsers = { current: parseCurrent, today: parseToday, sevenDays: parseSevenDays, warnings: parseWarnings, hourly: parseHourly, uv: parseUV, air: parseAir, airForecast: parseAirForecast, stations: parseStations };
export async function loadWeather(fetcher = fetch, now = new Date()) {
  const entries = await Promise.allSettled(Object.entries(FEEDS).map(async ([name, url]) => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000), headers: { Accept: ['hourly', 'air'].includes(name) ? 'application/json' : 'application/xml,text/xml,application/rss+xml' } });
    if (!response.ok) throw Error(`Upstream ${response.status}`);
    const text = await response.text();
    if (text.length > 600000) throw Error('Feed too large');
    return parsers[name](['hourly', 'air'].includes(name) ? JSON.parse(text) : text, now);
  }));
  const payload = { source: '澳門地球物理氣象局', sourceUrls: FEEDS, fetchedAt: now.toISOString(), unavailable: [] };
  Object.keys(FEEDS).forEach((name, i) => {
    const result = entries[i];
    payload[name] = result.status === 'fulfilled' ? result.value : null;
    if (result.status === 'rejected') payload.unavailable.push(name);
  });
  return attachDailyForecast(payload,now);
}
