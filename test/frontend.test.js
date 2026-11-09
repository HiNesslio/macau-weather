import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { inferScene, solarState } from '../assets/weather-state.js';
import { renderForecastRows, getSolarTimes, temperatureColor, temperatureRangeGradient } from '../assets/forecast-view.js';
import { warningView, mergeWarnings } from '../assets/warning-view.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(responses,warningResponses=[]){
 const elements=new Map(),intervals=[];
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>gradient:()=>{}});
 const make=id=>({id,dataset:{},style:{setProperty(key,value){this[key]=value;}},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',offsetWidth:100,
  setAttribute(key,value){this[key]=value;},getContext(){return context;},getBoundingClientRect(){return {width:1280,height:730,top:this.mockTop??(this.id==='heroMain'?120:0)};},addEventListener(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,make(id));return elements.get(id);};
 const events={};
 const document={readyState:'loading',hidden:false,getElementById:get,querySelector:get,querySelectorAll(){return [];},addEventListener(name,fn){events[name]=fn;}};
 const window={innerWidth:1280,devicePixelRatio:1,matchMedia(){return {matches:false,addEventListener(){}};},addEventListener(){}};
 const globals={document,window,inferScene,solarState,renderForecastRows,getSolarTimes,warningView,mergeWarnings,CloudRenderer:class{resize(){}draw(){}},Intl,Date,URL,AbortSignal,performance,
  requestAnimationFrame(){return 1;},cancelAnimationFrame(){},setInterval(fn,ms){intervals.push({fn,ms});},
  async fetch(url){const next=url==='/api/warnings'?(warningResponses.shift()||{checkedAt:new Date().toISOString(),entries:[{key:'typhoon',active:false,status:0},{key:'rainstorm',active:false,status:0}]}):responses.shift();if(next instanceof Error)throw next;return {ok:true,json:async()=>next};}};
 runInNewContext(code,globals);events.DOMContentLoaded();
 return {get,refresh:()=>intervals.find(i=>i.ms===300000).fn(),refreshWarnings:()=>intervals.filter(i=>i.ms===60000).at(-1).fn()};
}
const payload=(description)=>({fetchedAt:new Date().toISOString(),unavailable:[],current:description?{description,temperature:26,humidity:90,windSpeed:5,validFor:new Date().toISOString()}:null,today:{description:'預測明日有雷雨。'},warnings:{entries:[{active:false,description:'現時沒有雷暴警告信號。'}]}});
test('live refresh switches the scene while keeping data; missing observations cannot turn tomorrow rain into current rain',async()=>{
 const h=harness([payload('多雲'),payload('有驟雨'),payload(null)]);await settle();
 assert.equal(h.get('weatherApp').dataset.condition,'cloudy');assert.equal(h.get('currentTemp').textContent,26);
 await h.refresh();assert.equal(h.get('weatherApp').dataset.condition,'showers');assert.equal(h.get('conditionName').textContent,'有驟雨');
 await h.refresh();assert.equal(h.get('weatherApp').dataset.condition,'unknown');assert.equal(h.get('currentTemp').textContent,'—');assert.equal(h.get('conditionName').textContent,'實況暫缺');
});
test('partial data leaves UV and concentrations unavailable; refresh failure preserves the last real observation',async()=>{
 const h=harness([payload('多雲'),new Error('offline')]);await settle();
 assert.equal(h.get('uv').innerHTML,'—');assert.match(h.get('airReadings').innerHTML,/暫未能取得/);
 await h.refresh();assert.equal(h.get('currentTemp').textContent,26);assert.match(h.get('.update-line').textContent,/更新失敗/);
});
test('first-load failure provides unavailable state and clears environment loading placeholders',async()=>{
 const h=harness([new Error('offline')]);await settle();
 assert.equal(h.get('currentTemp').textContent,'—');assert.equal(h.get('conditionName').textContent,'資料暫未能取得');assert.match(h.get('stationReadings').innerHTML,/暫未能取得/);
});

test('separate warning updates remain prominent even when weather fails; cancellation clears active card',async()=>{
 const active={key:'typhoon',type:'熱帶氣旋',title:'八號東北風球',active:true,status:1,severity:'severe',description:'現正懸掛八號東北風球。',link:'https://www.smg.gov.mo/zh/subpage/28/typhoon-main'};
 const h=harness([new Error('weather offline')],[{checkedAt:new Date().toISOString(),entries:[active]},{checkedAt:new Date().toISOString(),entries:[{...active,active:false,status:2}]}]);await settle();
 assert.equal(h.get('warningRegion').dataset.mode,'active');assert.match(h.get('warningCards').innerHTML,/八號東北風球/);
 await h.refreshWarnings();assert.equal(h.get('warningRegion').dataset.mode,'clear');assert.equal(h.get('warningCards').innerHTML,'');
});

test('shared-scale seven-day forecast keeps accurate ranges and official metadata',()=>{
 const html=renderForecastRows([
  {date:'2026-11-09',low:22,high:26,description:'間中有陽光',humidity:'55–75%'},
  {date:'2026-11-10',low:16,high:21,description:'多雲',humidity:'65–95%'}
 ],'2026-11-09',26,()=>'<svg></svg>');
 assert.match(html,/left:60\.00%;width:40\.00%/);
 assert.match(html,/left:0\.00%;width:50\.00%/);
 assert.match(html,/目前氣溫 26°/);
 assert.match(html,/間中有陽光/);
 assert.match(html,/濕度 55–75%/);
});
test('sun times are formatted for Macau and absent values are never fabricated',()=>{
 const now=new Date('2026-11-09T12:00:00+08:00');
 const sunrise=Date.parse('2026-11-09T06:15:00+08:00')/1000;
 const sunset=Date.parse('2026-11-09T17:45:00+08:00')/1000;
 const result=getSolarTimes([{sunrise,sunset}],now);
 assert.equal(result.sunrise,'06:15');assert.equal(result.sunset,'17:45');
 assert.ok(result.progress>0&&result.progress<100);
 assert.equal(getSolarTimes([],now).sunrise,'—');
 assert.equal(getSolarTimes([{sunrise,sunset}],new Date('2026-11-10T12:00:00+08:00')).available,false);
});
test('frontend displays live SMG temperature tracks and the connected solar panel',async()=>{
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Macau',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const sunrise=Date.parse(date+'T06:15:00+08:00')/1000,sunset=Date.parse(date+'T17:45:00+08:00')/1000;
 const h=harness([{...payload('天晴'),sevenDays:{days:[{date,low:22,high:28,description:'間中有陽光',humidity:'55–75%'}]},hourly:{hours:[],solar:[{sunrise,sunset}]}}]);await settle();
 assert.match(h.get('weekDays').innerHTML,/day-range-fill/);
 assert.equal(h.get('sunriseTime').textContent,'06:15');
 assert.equal(h.get('sunsetTime').textContent,'17:45');
});

test('colour uses absolute Celsius: hot-only ranges have no cold blue',()=>{
 assert.equal(temperatureColor(28),'#f1ad4f');
 assert.equal(temperatureRangeGradient(28,30).startsWith('linear-gradient(90deg,#f1ad4f 0.00%'),true);
 const hot=renderForecastRows([{date:'2026-11-10',low:28,high:32,description:'炎熱'}],'2026-11-09');
 assert.match(hot,/background:linear-gradient\(90deg,#f1ad4f 0\.00%/);
 assert.doesNotMatch(hot,/#84b5d7|#78bfe9|#86bfe0/);
 const cold=renderForecastRows([{date:'2026-11-10',low:12,high:16,description:'清涼'}],'2026-11-09');
 assert.match(cold,/background:linear-gradient\(90deg,#/);
 assert.notEqual(temperatureColor(12),temperatureColor(28));
});
test('daily SMG forecast briefing remains visible in the row including humidity',()=>{
 const forecast='日間大致多雲，稍後部分時間有陽光。晚間有幾陣驟雨。';
 const html=renderForecastRows([{date:'2026-11-09',low:20,high:28,description:forecast,humidity:'60–85%'}],'2026-11-09',25,()=>'<svg></svg>');
 assert.match(html,/class="day-briefing"/);
 assert.match(html,/日間大致多雲，稍後部分時間有陽光/);
 assert.match(html,/晚間有幾陣驟雨/);
 assert.match(html,/相對濕度 60–85%/);
 assert.match(html,/class="day-icon"/);
});
test('forecast cards have no legacy seven-column border and sunlight has illustrated icons',()=>{
 assert.doesNotMatch(html,/border-right:1px solid #ebf0f4/);
 assert.match(html,/id="i-sunrise"/);
 assert.match(html,/id="i-sunset"/);
 assert.match(html,/href="#i-sunrise"/);
 assert.match(html,/href="#i-sunset"/);
});

test('the celestial scene follows the hero below tall warning cards and returns when cleared',async()=>{
 const active={key:'rainstorm',type:'暴雨',title:'紅色暴雨警告',active:true,status:1,severity:'severe',description:'測試用警告',link:'https://www.smg.gov.mo/'};
 const h=harness([payload('天晴')],[{checkedAt:new Date().toISOString(),entries:[active]},{checkedAt:new Date().toISOString(),entries:[{...active,active:false,status:2}]}]);
 await settle();
 assert.match(html,/id="heroMain"/);
 assert.match(html,/#atmosphere \.celestial-system\{/);
 assert.equal(h.get('atmosphere').style['--celestial-top'],'145px');
 h.get('heroMain').mockTop=520;
 await h.refreshWarnings();
 assert.equal(h.get('atmosphere').style['--celestial-top'],'545px');
 h.get('heroMain').mockTop=120;
 // The next update or resize recomputes the position from layout rather than a hard-coded alert offset.
 await h.refreshWarnings();
 assert.equal(h.get('atmosphere').style['--celestial-top'],'145px');
});

test('sun and moon stay centred in the same animated layer as glow and rays',()=>{
 const markup=html.match(/<div class="atmosphere" id="atmosphere"[^>]*>(.*?)<canvas id="skyCanvas"/);
 assert.ok(markup,'atmosphere markup exists');
 assert.match(markup[1],/id="celestialSystem"/);
 assert.match(markup[1],/class="sky-glow"/);
 assert.match(markup[1],/class="rays"/);
 assert.match(markup[1],/id="celestial"/);
 assert.match(html,/#atmosphere \.celestial-system \.sky-glow\{/);
 assert.match(html,/#atmosphere \.celestial-system \.rays\{/);
 assert.match(html,/left:calc\(50% - var\(--glow-radius\)\)/);
 assert.match(html,/left:calc\(50% - var\(--ray-radius\)\)/);
 assert.match(html,/const celestial=\$\('celestialSystem'\);celestial\.style\.transform/);
 assert.doesNotMatch(html,/const celestial=\$\('celestial'\);celestial\.style\.transform/);
 assert.match(html,/--glow-size:600px;--glow-radius:300px/);
});
