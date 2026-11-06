// Use the SMG condition code when it maps to a supported scene.
const smgScenes = new Map(Object.entries({
  '01':'sunny', a1:'sunny', '02':'partly', a2:'partly', '03':'cloudy', '04':'overcast',
  '06':'fog', '07':'haze', '08':'mist', '10':'drizzle', '12':'rain', '13':'heavy',
  '16':'showers', '17':'downpour', '18':'thunderRain', '21':'dry', '24':'squallThunder',
  '25':'thunder', '26':'humid', '27':'wind', '28':'rain', c8:'rain', '29':'showers', c9:'showers'
}));
export function inferScene(text, code) {
  const scene = smgScenes.get(String(code ?? '').trim().toLowerCase());
  if (scene) return scene;
  const t=String(text||'').replace(/(?:無|沒有|並無)(?:雷暴|雷雨|雨|霧)/g,'');
  if(/狂風雷暴/.test(t))return 'squallThunder';
  if(/雷雨|雷暴伴雨/.test(t))return 'thunderRain';
  if(/雷暴|閃電/.test(t))return 'thunder';
  if(/大驟雨|猛烈驟雨/.test(t))return 'downpour';
  if(/大雨|暴雨/.test(t))return 'heavy';
  if(/毛毛雨|微雨/.test(t))return 'drizzle';
  if(/驟雨|陣雨/.test(t))return 'showers';
  if(/有雨|降雨|雨天|下雨/.test(t))return 'rain';
  if(/薄霧/.test(t))return 'mist';if(/煙霞/.test(t))return 'haze';if(/霧/.test(t))return 'fog';
  if(/密雲|陰天|陰雲/.test(t))return 'overcast';
  if(/間晴|部[分份]時間有陽光|部[分份]時間天晴|短暫時間有陽光|天晴[，,、\s]*部[分份]時間多雲/.test(t))return 'partly';
  if(/多雲/.test(t))return 'cloudy';
  if(/天晴|陽光充沛|晴朗/.test(t))return 'sunny';
  if(/狂風/.test(t))return 'gale';if(/大風|強風/.test(t))return 'wind';
  return null;
}
const smooth = (a,b,x) => {const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);};
export function solarState(now = new Date(), solar = []) {
  const seconds=now.getTime()/1000;
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Macau',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const today=solar.find(s=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Macau',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(s.sunrise*1000))===date);
  if(today){
    const daylight=smooth(today.sunrise-1800,today.sunrise+1800,seconds)*(1-smooth(today.sunset-1800,today.sunset+1800,seconds));
    const golden=Math.exp(-Math.pow((seconds-today.sunrise)/2400,2))+Math.exp(-Math.pow((seconds-today.sunset)/2400,2));
    return {night:seconds<today.sunrise||seconds>=today.sunset, daylight, golden};
  }
  // Astronomical fallback for Macau (22.1987 N, 113.5439 E), including equation of time.
  const day=Math.floor((Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-Date.UTC(now.getUTCFullYear(),0,0))/86400000);
  const b=2*Math.PI*(day-81)/364,eq=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b);
  const minutes=now.getUTCHours()*60+now.getUTCMinutes()+now.getUTCSeconds()/60+4*113.5439+eq;
  const angle=(minutes/4-180)*Math.PI/180,decl=23.44*Math.sin(2*Math.PI*(284+day)/365)*Math.PI/180,lat=22.1987*Math.PI/180;
  const altitude=Math.asin(Math.sin(lat)*Math.sin(decl)+Math.cos(lat)*Math.cos(decl)*Math.cos(angle))*180/Math.PI;
  return {night:altitude<-.833, daylight:smooth(-6,5,altitude), golden:Math.exp(-Math.pow(altitude/6,2))};
}
