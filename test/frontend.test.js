import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { inferScene, solarState } from '../assets/weather-state.js';
import { warningView, mergeWarnings } from '../assets/warning-view.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function harness(responses,warningResponses=[]){
 const elements=new Map(),intervals=[];
 const gradient={addColorStop(){}};
 const context=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>gradient:()=>{}});
 const make=id=>({id,dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},textContent:'',innerHTML:'',offsetWidth:100,
  setAttribute(key,value){this[key]=value;},getContext(){return context;},getBoundingClientRect(){return {width:1280,height:730};},addEventListener(){}});
 const get=id=>{if(!elements.has(id))elements.set(id,make(id));return elements.get(id);};
 const events={};
 const document={readyState:'loading',hidden:false,getElementById:get,querySelector:get,querySelectorAll(){return [];},addEventListener(name,fn){events[name]=fn;}};
 const window={innerWidth:1280,devicePixelRatio:1,matchMedia(){return {matches:false,addEventListener(){}};},addEventListener(){}};
 const globals={document,window,inferScene,solarState,warningView,mergeWarnings,CloudRenderer:class{resize(){}draw(){}},Intl,Date,URL,AbortSignal,performance,
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
