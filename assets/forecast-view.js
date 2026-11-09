const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const macauDay=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Macau',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const clock=seconds=>new Intl.DateTimeFormat('zh-Hant',{timeZone:'Asia/Macau',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(seconds*1000));
export function renderForecastRows(days=[],today='',currentTemp=null,weatherIcon=()=> ''){
 if(!days.length)return '<div class="week-empty">官方七日預報暫時未能讀取。</div>';
 const valid=days.filter(d=>Number.isFinite(d.low)&&Number.isFinite(d.high)&&d.high>=d.low);
 const min=Math.min(...valid.map(d=>d.low)),max=Math.max(...valid.map(d=>d.high));
 const span=Number.isFinite(min)&&Number.isFinite(max)?Math.max(1,max-min):1;
 const weekdays=['週日','週一','週二','週三','週四','週五','週六'];
 return days.map(d=>{
  const ok=Number.isFinite(d.low)&&Number.isFinite(d.high)&&d.high>=d.low;
  const parsed=/^\d{4}-\d\d-\d\d$/.test(d.date||'')?new Date(d.date+'T12:00:00+08:00'):null;
  const label=d.date===today?'今日':parsed&&!Number.isNaN(parsed.getTime())?weekdays[parsed.getUTCDay()]:'—';
  const pos=ok?Math.max(0,Math.min(100,(d.low-min)/span*100)):0;
  const width=ok?Math.max(2,Math.min(100-pos,(d.high-d.low)/span*100)):0;
  const fill=ok?'<span class="day-range-fill" style="left:'+pos.toFixed(2)+'%;width:'+width.toFixed(2)+'%"></span>':'';
  const dot=ok&&d.date===today&&Number.isFinite(currentTemp)&&currentTemp>=d.low&&currentTemp<=d.high?
   '<span class="day-current" style="left:'+Math.max(0,Math.min(100,(currentTemp-min)/span*100)).toFixed(2)+'%" title="目前氣溫 '+escapeHtml(currentTemp)+'°"></span>':'';
  const desc=escapeHtml(d.description||'天氣資料暫缺');
  return '<div class="day" data-today="'+String(d.date===today)+'" aria-label="'+escapeHtml(label+' '+(d.date||'')+'，'+(ok?'最低 '+d.low+' 度，最高 '+d.high+' 度':'溫度未提供')+'，'+(d.description||''))+'">'
   +'<div class="day-title"><strong>'+escapeHtml(label)+'</strong><small>'+escapeHtml(String(d.date||'').slice(5).replace('-','/'))+'</small></div>'
   +'<div class="day-weather">'+weatherIcon(d)+'<div class="day-weather-copy"><div class="day-description" title="'+desc+'">'+desc+'</div><div class="day-humidity">濕度 '+escapeHtml(d.humidity||'—')+'</div></div></div>'
   +'<div class="day-min">'+(Number.isFinite(d.low)?escapeHtml(d.low)+'°':'—')+'</div>'
   +'<div class="day-range" role="img" aria-label="'+(ok?escapeHtml('由 '+d.low+'° 至 '+d.high+'°'):'溫度區間未提供')+'">'+fill+dot+'</div>'
   +'<div class="day-max">'+(Number.isFinite(d.high)?escapeHtml(d.high)+'°':'—')+'</div></div>';
 }).join('');
}
export function getSolarTimes(solar=[],now=new Date()){
 const today=macauDay(now);
 const item=solar.find(s=>Number.isFinite(s.sunrise)&&Number.isFinite(s.sunset)&&s.sunset>s.sunrise&&macauDay(new Date(s.sunrise*1000))===today);
 if(!item)return {sunrise:'—',sunset:'—',progress:0,status:'日出日落資料暫缺',available:false};
 const current=now.getTime()/1000;
 const progress=Math.max(0,Math.min(100,(current-item.sunrise)/(item.sunset-item.sunrise)*100));
 return {sunrise:clock(item.sunrise),sunset:clock(item.sunset),progress,
  status:current<item.sunrise?'尚未日出':current>=item.sunset?'今日已日落':'日照進行中',available:true};
}
