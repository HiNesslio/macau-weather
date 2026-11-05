import { WARNING_ICONS } from './warning-icons.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=v=>v&&!Number.isNaN(Date.parse(v))?new Intl.DateTimeFormat('zh-HK',{timeZone:'Asia/Macau',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v)):'';
// Keep previously active signals visible when a later fetch cannot confirm that signal.
export function mergeWarnings(previous,next){
 return {...next,entries:next.entries.map(entry=>{
  const old=previous?.entries?.find(e=>e.key===entry.key);
  return entry.active===null&&old?.active?{...old,unverified:true}:entry;
 })};
}
export function warningView(data,now=Date.now()){
 const stale=!data?.checkedAt||!Number.isFinite(Date.parse(data.checkedAt))||now-Date.parse(data.checkedAt)>120000;
 const entries=data?.entries||[],active=entries.filter(e=>e.active).sort((a,b)=>({critical:3,severe:2,warning:1}[b.severity]||0)-({critical:3,severe:2,warning:1}[a.severity]||0)),forecasts=entries.filter(e=>e.status===3);
 const uncertain=stale||!entries.length||entries.some(e=>e.active===null||e.unverified);
 const mode=active.length?'active':uncertain?'uncertain':forecasts.length?'forecast':'clear';
 const summary=active.length?(stale||active.some(e=>e.unverified)?'警告狀態待確認':`${active.length} 項警告生效`):uncertain?'警告狀態暫未能確認':forecasts.length?'天氣警告預告':'目前沒有生效警告';
 const cards=[...active,...forecasts].map(e=>`<article class="warning-card" data-severity="${esc(e.severity||'warning')}"${e.active?' role="alert"':''}>
  <div class="warning-icon">${e.iconUrl?`<img src="${esc(WARNING_ICONS[e.title]?.path||e.iconUrl)}" alt="${esc(e.title)}官方圖示" width="64" height="64" referrerpolicy="no-referrer"><svg class="warning-image-fallback" aria-hidden="true"><use href="#i-alert"/></svg>`:'<svg aria-hidden="true"><use href="#i-alert"/></svg>'}</div>
  <div class="warning-copy"><div class="warning-title-line"><h2>${esc(e.title)}</h2><span class="warning-badge">${e.unverified||stale?'狀態待確認':e.active?'生效中':'預告'}</span></div><p>${esc(e.description?.length>220?e.description.slice(0,220)+'…':e.description)}</p><div class="warning-meta">${e.issuedAt?`<time>${esc(time(e.issuedAt))}</time>`:''}<a href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">官方公告 ↗</a></div>${e.unverified||stale?'<p class="warning-unverified">更新未成功，尚未確認是否取消。</p>':''}</div></article>`).join('');
 return {mode,summary,cards,uncertain,checkedAt:time(data?.checkedAt)};
}
