import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const FEEDS = {
  current: 'https://xml.smg.gov.mo/c_actual_brief.xml',
  today: 'https://xml.smg.gov.mo/c_forecast.xml',
  sevenDays: 'https://rss.smg.gov.mo/c_WForecast7days_rss.xml',
  warnings: 'https://rss.smg.gov.mo/c_WSignal_rss.xml',
  hourly: 'https://api.open-meteo.com/v1/forecast?latitude=22.1987&longitude=113.5439&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Asia%2FMacau&forecast_days=2&timeformat=unixtime',
};
const parser = new XMLParser({ parseTagValue: false, trimValues: true });
const list = v => v == null ? [] : Array.isArray(v) ? v : [v];
const clean = v => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const number = v => v == null || String(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const bounded = (v, min, max) => { const n = number(v); return n !== null && n >= min && n <= max ? n : null; };
export const localTime = v => /^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(v || '') ? v.replace(' ', 'T') + '+08:00' : null;
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
  const channel = xml(text).rss?.channel;
  const description = clean(list(channel?.item)[0]?.description);
  const days = description.split('預測於').slice(1).map(s => {
    const m = s.match(/^\s*(\d{4}-\d\d-\d\d)\s*溫度:\s*(-?\d+(?:\.\d+)?)至(-?\d+(?:\.\d+)?)度\s*濕度:\s*(\d+)至(\d+)\s*%\s*(.*)$/);
    return m ? { date: m[1], low: Number(m[2]), high: Number(m[3]), humidity: `${m[4]}–${m[5]}%`, description: m[6] } : null;
  }).filter(Boolean);
  if (!days.length) throw Error('No structured daily forecasts');
  return { days: days.slice(0, 7), text: description, publishedAt: localTime(channel.pubDate) };
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
  return { source: 'Open-Meteo', kind: 'model_forecast', timezone: 'Asia/Macau', hours };
}
const parsers = { current: parseCurrent, today: parseToday, sevenDays: parseSevenDays, warnings: parseWarnings, hourly: parseHourly };
export async function loadWeather(fetcher = fetch, now = new Date()) {
  const entries = await Promise.allSettled(Object.entries(FEEDS).map(async ([name, url]) => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000), headers: { Accept: name === 'hourly' ? 'application/json' : 'application/xml,text/xml,application/rss+xml' } });
    if (!response.ok) throw Error(`Upstream ${response.status}`);
    const text = await response.text();
    if (text.length > 600000) throw Error('Feed too large');
    return parsers[name](name === 'hourly' ? JSON.parse(text) : text, now);
  }));
  const payload = { source: '澳門地球物理氣象局', sourceUrls: FEEDS, fetchedAt: now.toISOString(), unavailable: [] };
  Object.keys(FEEDS).forEach((name, i) => {
    const result = entries[i];
    payload[name] = result.status === 'fulfilled' ? result.value : null;
    if (result.status === 'rejected') payload.unavailable.push(name);
  });
  return payload;
}
