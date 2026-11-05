import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { loadWeather, FEEDS, parseCurrent, parseSevenDays, parseToday, parseWarnings, parseHourly, parseUV, parseAir, parseAirForecast, parseStations } from '../lib/weather.js';
import handler from '../api/weather.js';
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const now = new Date('2026-11-05T21:05:00+08:00');

test('official snapshot: distinguish observed, maximum and minimum temperature; preserve Macau timezone', async () => {
 const c = parseCurrent(await fixture('current.xml'));
 assert.equal(c.temperature, 26); assert.equal(c.high, 30); assert.equal(c.low, 25);
 assert.equal(c.humidity, 90); assert.equal(c.windSpeed, 5); assert.equal(c.windDirection, '東南偏南');
 assert.equal(c.description, '多雲'); assert.equal(c.validFor, '2026-11-05T21:00+08:00');
});
test('choose forecast valid for Macau calendar date, not first available date', async () => {
 const xml = await fixture('today.xml');
 assert.equal(parseToday(xml, now).validFor, '2026-11-05');
 assert.equal(parseToday(xml, new Date('2026-11-05T16:05:00Z')).validFor, '2026-11-06');
 assert.throws(() => parseToday(xml, new Date('2027-01-01')));
});
test('parse seven real dates, humidity and forecast text from RSS CDATA', async () => {
 const data = parseSevenDays(await fixture('sevenDays.xml'));
 assert.equal(data.days.length, 7); assert.equal(data.days[0].date, '2026-11-06');
 assert.equal(data.days[0].low, 24); assert.equal(data.days[0].high, 30); assert.equal(data.days[0].humidity, '65–95%');
 assert.match(data.days[0].description, /早晚有微雨/);
});
test('warning RSS: no-warning rows are not active; unknown status stays unknown', async () => {
 const xml = await fixture('warnings.xml');
 const w = parseWarnings(xml);
 assert.equal(w.entries.length, 6); assert.ok(w.entries.every(e => e.active === false));
 assert.equal(parseWarnings(xml.replace('現時並沒有熱帶氣旋信號。', '現正懸掛三號風球。')).entries[0].active, true);
 assert.equal(parseWarnings(xml.replace('現時並沒有熱帶氣旋信號。', '資料更新中。')).entries[0].active, null);
});
test('missing numbers and upstream HTML must not become weather values', () => {
 assert.throws(() => parseCurrent('<html>Access denied</html>'));
 assert.throws(() => parseCurrent('<ActualWeatherBrief><Custom><Temperature><Type>3</Type><Value>NIL</Value></Temperature></Custom></ActualWeatherBrief>'));
});
test('hourly forecast uses actual API arrays, nulls and UTC instants', async () => {
 const data = JSON.parse(await fixture('hourly.json'));
 const result = parseHourly(data, now);
 assert.equal(result.hours.length, 12); assert.equal(result.hours[0].time, '2026-11-05T13:00:00.000Z');
 assert.equal(result.source, 'Open-Meteo');
 data.hourly.temperature_2m.fill(null);
 assert.throws(() => parseHourly(data, now));
});
test('partial upstream failure preserves other sources and identifies the missing feed', async () => {
 const data = Object.fromEntries(await Promise.all(Object.keys(FEEDS).map(async key => [FEEDS[key], await fixture(['hourly','air'].includes(key) ? `${key}.json` : `${key}.xml`)])));
 const result = await loadWeather(async url => {
   if (url === FEEDS.current) return new Response('unavailable', { status: 503 });
   return new Response(data[url]);
 }, now);
 assert.deepEqual(result.unavailable, ['current']); assert.equal(result.current, null);
 assert.equal(result.sevenDays.days.length, 7); assert.equal(result.hourly.hours.length, 12);
 const allDown = await loadWeather(async () => { throw Error('offline'); }, now);
 assert.equal(allDown.unavailable.length, 9);
});
test('API returns 503 without caching when every provider is unavailable and rejects writes', async () => {
 const original = globalThis.fetch;
 globalThis.fetch = async () => { throw Error('offline'); };
 const response = () => ({ headers: {}, setHeader(k,v) {this.headers[k]=v;}, status(n) {this.code=n;return this;}, json(data) {this.body=data;}, end() {} });
 try {
   const res=response(); await handler({method:'GET'},res);
   assert.equal(res.code,503); assert.equal(res.headers['Cache-Control'],'no-store');
   const post=response(); await handler({method:'POST'},post); assert.equal(post.code,405);
 } finally { globalThis.fetch=original; }
});
test('frontend JavaScript parses and does not render demo weather values', async () => {
 const html=await readFile(new URL('../index.html', import.meta.url),'utf8');
 new Script(html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm, ""));
 assert.doesNotMatch(html,/textContent=s\.temp|innerHTML=s\.pop/);
 assert.match(html,/id="currentTemp">—/);
 assert.doesNotMatch(html,/sceneRail|autoBtn|dayNightBtn|__manualWeatherScene|URLSearchParams/);
});

test('official UV zero is a valid night observation, not missing data', async () => {
 const data = parseUV(await fixture('uv.xml'));
 assert.equal(data.index, 0); assert.equal(data.level, '低'); assert.equal(data.observedAt, '2026-11-05T21:15+08:00');
 assert.throws(() => parseUV('<ActualUV-Index><Custom/></ActualUV-Index>'));
});
test('six air stations preserve concentrations, units, missing values and individual observation times', async () => {
 const raw = JSON.parse(await fixture('air.json')); const data = parseAir(raw);
 assert.equal(data.stations.length, 6); const tg = data.stations.find(s => s.code === 'TG');
 assert.equal(tg.pm25, 11); assert.equal(tg.co, .899); assert.equal(tg.observedAt,'2026-11-05T20:00+08:00');
 assert.equal(data.units.co,'mg/m³');assert.equal(data.units.pm25,'µg/m³');
 raw.tghopolu.HE_PM2_5='--';assert.equal(parseAir(raw).stations.find(s=>s.code==='TG').pm25,null);
});
test('AQI ranges are forecasts with valid dates, not observed AQI', async () => {
 const data = parseAirForecast(await fixture('airForecast.xml'));
 assert.equal(data.areas.length,3);assert.equal(data.areas[0].range,'60-80');assert.equal(data.areas[0].validFor,'2026-11-06');
});
test('full station data preserves decimal precision and missing pressure', async () => {
 const data = parseStations(await fixture('stations.xml'));const tg=data.stations.find(s=>s.code==='TG');
 assert.ok(data.stations.length>=10);assert.equal(tg.temperature,25.6);assert.equal(tg.pressure,1018);assert.equal(tg.dewPoint,23.7);
 assert.equal(data.stations.find(s=>s.code==='DP').pressure,null);
});
