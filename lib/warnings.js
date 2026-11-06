import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { localTime } from './weather.js';
import { WARNING_ICONS } from '../assets/warning-icons.js';
const parser=new XMLParser({parseTagValue:false,trimValues:true});
export const WARNING_FEEDS={
 typhoon:{type:'熱帶氣旋',root:'TyphoonWarning',node:'TropicalCyclone',url:'https://xml.smg.gov.mo/c_typhoon.xml',link:'https://www.smg.gov.mo/zh/subpage/28/typhoon-main'},
 rainstorm:{type:'暴雨',root:'RainstormWarning',node:'Rainstorm',url:'https://xml.smg.gov.mo/c_rainstorm.xml',link:'https://www.smg.gov.mo/zh/subpage/33/rainstorm-main'},
 monsoon:{type:'強烈季候風',root:'MonsoonWarning',node:'Monsoon',url:'https://xml.smg.gov.mo/c_monsoon.xml',link:'https://www.smg.gov.mo/zh/subpage/35/monsoon-main'},
 thunderstorm:{type:'雷暴',root:'ThunderstormWarning',node:'Thunderstorm',url:'https://xml.smg.gov.mo/c_thunderstorm.xml',link:'https://www.smg.gov.mo/zh/subpage/34/thunderstorm-main'},
 stormsurge:{type:'風暴潮',root:'StormsurgeWarning',node:'Stormsurge',url:'https://xml.smg.gov.mo/c_stormsurge.xml',link:'https://www.smg.gov.mo/zh/subpage/36/stormsurge-main'},
 tsunami:{type:'海嘯',root:'TsunamiWarning',node:'Tsunami',url:'https://xml.smg.gov.mo/c_tsunami.xml',link:'https://www.smg.gov.mo/zh/subpage/210/tsunami-main'},
};
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function officialIcon(value){
 try{if(!clean(value))return null;const u=new URL(clean(value),'https://xml.smg.gov.mo');if(!['http:','https:'].includes(u.protocol)||!/(^|\.)(?:d?smg)\.gov\.mo$/.test(u.hostname)||u.username||u.password)return null;u.protocol='https:';return u.href;}catch{return null;}
}
export function parseWarning(text,key){
 const source=WARNING_FEEDS[key];if(!source||XMLValidator.validate(text)!==true)throw Error('Invalid warning XML');
 const root=parser.parse(text)[source.root],warning=root?.Custom?.[source.node];
 if(!warning||!['0','1','2','3'].includes(warning.Status))throw Error('Unknown warning status');
 const description=clean(warning.Description)||clean(warning.Major);
 const level=clean(warning.Inforce),active=warning.Status==='1';
 const match=description.match(/(?:[一二三四五六七八九十\d]+號(?:東北|東南|西北|西南)?(?:風球|熱帶氣旋信號)|[黃紅黑]色暴雨警告信號|[藍黃橙紅黑]色風暴潮警告)/);
 const title=match?.[0]||source.type+(active?'警告':warning.Status==='3'?'預告':'');
 const severity=/黑色|九號|十號|9號|10號/.test(title)?'critical':/紅色|八號|8號|海嘯/.test(title)?'severe':'warning';
 return {key,type:source.type,status:Number(warning.Status),active,level:level&&level!=='NIL'?level:null,title,
  description,issuedAt:localTime(warning.IssuedAt),publishedAt:localTime(clean(root.System?.SysPubdate).replace(/ GMT\+8$/,'')),
  iconUrl:officialIcon(warning.Icon?.IconURL)||WARNING_ICONS[title]?.url||null,severity,link:source.link,sourceUrl:source.url};
}
const ADVISORY_FEEDS = {
 temperature: 'https://rss.smg.gov.mo/c_temperatureAlert_rss.xml',
 cooling: 'https://rss.smg.gov.mo/c_tempDropAlert_rss.xml',
};
async function loadAdvisory(fetcher,key,url){
 try {
  const response=await fetcher(url,{signal:AbortSignal.timeout(6000)});
  if(!response.ok)throw Error('Advisory unavailable');
  const text=await response.text();
  if(text.length>600000||XMLValidator.validate(text)!==true)throw Error('Invalid advisory RSS');
  const channel=parser.parse(text).rss?.channel;
  const items=[channel?.item].flat().filter(Boolean);
  const bulletins=items.filter(item=>clean(item.title)&&!/^no data$/i.test(clean(item.title)));
  if(!items.length)throw Error('Missing advisory status');
  return {key,active:bulletins.length>0,title:bulletins.map(item=>clean(item.title)).join('、'),
   description:bulletins.map(item=>clean(item.description)).filter(Boolean).join('　'),sourceUrl:url};
 } catch {
  return {key,active:null,sourceUrl:url};
 }
}
export async function loadWarnings(fetcher=fetch,now=new Date()){
 const advisoryRequest=Promise.all(Object.entries(ADVISORY_FEEDS).map(([key,url])=>loadAdvisory(fetcher,key,url)));
 const keys=Object.keys(WARNING_FEEDS),results=await Promise.allSettled(keys.map(async key=>{
  const r=await fetcher(WARNING_FEEDS[key].url,{signal:AbortSignal.timeout(6000),headers:{Accept:'application/xml,text/xml'}});
  if(!r.ok)throw Error(`Upstream ${r.status}`);const text=await r.text();if(text.length>600000)throw Error('Warning too large');return parseWarning(text,key);
 }));
 const entries=results.map((r,i)=>r.status==='fulfilled'?r.value:{key:keys[i],type:WARNING_FEEDS[keys[i]].type,active:null,status:null,link:WARNING_FEEDS[keys[i]].link});
 return {source:'澳門地球物理氣象局',checkedAt:now.toISOString(),entries,advisories:await advisoryRequest,unavailable:entries.filter(e=>e.active===null).map(e=>e.key)};
}
