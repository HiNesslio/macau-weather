import test from 'node:test';
import assert from 'node:assert/strict';
import { inferScene, solarState } from '../assets/weather-state.js';
test('observed conditions select sky, rain and fog without user choices',()=>{
 for(const [description,scene] of [['多雲','cloudy'],['多雲，部份時間有陽光','partly'],['有幾陣雨','showers'],['雷雨','thunderRain'],['雷暴','thunder'],['大雨','heavy'],['薄霧','mist'],['天晴，沒有雨','sunny']])assert.equal(inferScene(description),scene);
 assert.equal(inferScene('資料更新中'),null);assert.equal(inferScene(null),null);
});
test('sunrise and sunset create continuous transitions and an automatic night state',()=>{
 const solar=[{sunrise:Date.parse('2026-11-05T06:30:00+08:00')/1000,sunset:Date.parse('2026-11-05T17:45:00+08:00')/1000}];
 const state=time=>solarState(new Date('2026-11-05T'+time+'+08:00'),solar);
 assert.equal(state('05:00:00').night,true);assert.equal(state('12:00:00').daylight,1);assert.equal(state('21:00:00').daylight,0);
 assert.ok(state('06:20:00').daylight<state('06:40:00').daylight);assert.ok(state('17:30:00').daylight>state('17:50:00').daylight);
 assert.equal(state('17:45:00').night,true);
});
test('Macau astronomical fallback handles night, midday and the next local day',()=>{
 assert.equal(solarState(new Date('2026-11-05T21:00:00+08:00')).night,true);
 assert.equal(solarState(new Date('2026-11-05T12:00:00+08:00')).night,false);
 assert.equal(solarState(new Date('2026-11-06T00:01:00+08:00')).night,true);
});
