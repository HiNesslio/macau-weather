import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WARNING_FEEDS,loadWarnings,parseWarning,officialIcon} from '../lib/warnings.js';
import {mergeWarnings,warningView} from '../assets/warning-view.js';
import handler from '../api/warnings.js';
const fixture=key=>readFile(new URL(`./fixtures/warnings/${key}.xml`,import.meta.url),'utf8');
const now=new Date();
test('all six official XML feeds use status 0 as inactive regardless of old issue dates',async()=>{
 for(const key of Object.keys(WARNING_FEEDS)){const e=parseWarning(await fixture(key),key);assert.equal(e.active,false);assert.equal(e.status,0);assert.ok(e.issuedAt);}
});
test('Status 1 is active and official IconURL is preserved; removed and forecast states are not active',async()=>{
 const xml=await fixture('typhoon');
 const active=xml.replace('<Status>0</Status>','<Status>1</Status>').replaceAll('現時並沒有熱帶氣旋信號。','現正懸掛八號東北風球。').replace('<IconURL/>','<IconURL>https://www.smg.gov.mo/assets/image/warning/dt8ne.gif</IconURL>');
 const entry=parseWarning(active,'typhoon');assert.equal(entry.active,true);assert.equal(entry.title,'八號東北風球');assert.equal(entry.severity,'severe');assert.match(entry.iconUrl,/dt8ne.gif$/);
 for(const status of ['2','3'])assert.equal(parseWarning(active.replace('<Status>1</Status>',`<Status>${status}</Status>`),'typhoon').active,false);
 assert.throws(()=>parseWarning(xml.replace('<Status>0</Status>','<Status>9</Status>'),'typhoon'));
});
test('yellow, red and black rainstorms retain distinct titles and severity',async()=>{
 const xml=await fixture('rainstorm');
 for(const [color,severity] of [['黃','warning'],['紅','severe'],['黑','critical']]){
  const e=parseWarning(xml.replace('<Status>0</Status>','<Status>1</Status>').replace('現時沒有暴雨警告信號。',`現正發出${color}色暴雨警告信號。`),'rainstorm');
  assert.equal(e.title,`${color}色暴雨警告信號`);assert.equal(e.severity,severity);
 }
});
test('icon URLs must point to official SMG hosts and may not contain credentials',()=>{
 assert.equal(officialIcon('https://evil.example/icon.svg'),null);assert.equal(officialIcon('javascript:alert(1)'),null);
 assert.equal(officialIcon('https://smg.gov.mo.evil.example/x.gif'),null);assert.equal(officialIcon('https://secret@smg.gov.mo/x.gif'),null);
 assert.equal(officialIcon('http://xml.smg.gov.mo/icons/warning.gif'),'https://xml.smg.gov.mo/icons/warning.gif');
});
test('one failed warning feed is unknown, never equivalent to no warnings',async()=>{
 const snapshots=Object.fromEntries(await Promise.all(Object.keys(WARNING_FEEDS).map(async key=>[WARNING_FEEDS[key].url,await fixture(key)])));
 const data=await loadWarnings(async url=>{if(url===WARNING_FEEDS.rainstorm.url)throw Error('offline');return new Response(snapshots[url]);});
 assert.deepEqual(data.unavailable,['rainstorm']);assert.equal(data.entries.find(e=>e.key==='rainstorm').active,null);
 assert.equal(warningView(data).mode,'uncertain');
});
test('cancel clears a previous active warning; failed confirmation preserves it with a clear notice',()=>{
 const entry={key:'typhoon',active:true,status:1,title:'八號東北風球',description:'現正懸掛八號東北風球。',link:WARNING_FEEDS.typhoon.link};
 const previous={checkedAt:now.toISOString(),entries:[entry]};
 const pending=mergeWarnings(previous,{checkedAt:now.toISOString(),entries:[{key:'typhoon',active:null,status:null}]});
 const view=warningView(pending);assert.equal(view.mode,'active');assert.equal(view.uncertain,true);assert.match(view.cards,/狀態待確認/);
 const cancelled=mergeWarnings(pending,{checkedAt:now.toISOString(),entries:[{key:'typhoon',active:false,status:2}]});
 assert.equal(warningView(cancelled).cards,'');assert.equal(warningView(cancelled).mode,'clear');
 const stale=warningView({...previous,checkedAt:new Date(Date.now()-180000).toISOString()});assert.equal(stale.uncertain,true);assert.match(stale.cards,/狀態待確認/);assert.equal(stale.summary,'警告狀態待確認');
});
test('warning API never caches a complete outage or serves stale warning cache',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline');};
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(d){this.body=d;}};
 try{await handler({method:'GET'},res);assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.unavailable.length,6);}finally{globalThis.fetch=original;}
});
