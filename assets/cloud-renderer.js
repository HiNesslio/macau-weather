// Four-layer parallax parameters from the user's Desktop/weather/RENDER_TUTORIAL.md.
const layers=[
 {id:'haze',speed:5,alpha:.55,y:.52,h:.58,blend:'screen'},
 {id:'far',speed:11,alpha:.60,y:.06,h:.48,blend:'screen'},
 {id:'mid',speed:22,alpha:.85,y:.22,h:.60,blend:'source-over'},
 {id:'near',speed:42,alpha:.92,y:.46,h:.72,blend:'source-over'},
];
const recipes={sunny:[1,.10,.20,.20,.05],partly:[1,.30,.55,.55,.20],cloudy:[1.1,.60,.80,.90,.60],overcast:[.85,.85,1,1,.95],rain:[1.35,.90,1,1,1],storm:[1.7,1,1,1,1]};
export class CloudRenderer {
 constructor(onReady){this.images={};this.cache={};this.current=recipes.cloudy.slice();this.offsets=[0,0,0,0];
   this.ready=Promise.allSettled(layers.map(l=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{this.images[l.id]=im;resolve();};im.onerror=reject;im.src=new URL(`./clouds/${l.id}.png`,import.meta.url).href;}))).then(onReady);
 }
 resize(width,height){if(this.width===width&&this.height===height)return;this.width=width;this.height=height;this.cache={};}
 sprite(layer){
   if(this.cache[layer.id])return this.cache[layer.id];const im=this.images[layer.id];if(!im)return null;
   const h=Math.ceil(this.height*layer.h),w=Math.ceil(im.naturalWidth*h/im.naturalHeight);
   const day=document.createElement('canvas');day.width=w;day.height=h;const g=day.getContext('2d');g.drawImage(im,0,0,w,h);
   const night=document.createElement('canvas');night.width=w;night.height=h;const n=night.getContext('2d');n.drawImage(day,0,0);n.globalCompositeOperation='source-atop';n.fillStyle='rgba(42,62,87,.76)';n.fillRect(0,0,w,h);
   return this.cache[layer.id]={day,night,w,h};
 }
 draw(g,scene,dt,daylight,still=false){
   const key=scene.lightning?'storm':scene.rain?'rain':scene.fog?'overcast':recipes[scene.id]?scene.id:'cloudy';const target=recipes[key];
   const k=still?1:1-Math.pow(.0015,Math.min(dt,.05));this.current=this.current.map((v,i)=>v+(target[i]-v)*k);
   g.save();layers.forEach((l,i)=>{const cached=this.sprite(l);if(!cached)return;const {day,night,w,h}=cached;
     if(!still)this.offsets[i]+=Math.min(dt,.05)*l.speed*this.current[0]*(scene.windy||1);
     const off=((this.offsets[i]%w)+w)%w,bob=still?0:1.6*Math.sin(this.offsets[i]/l.speed*.12+i*1.7);
     g.globalCompositeOperation=l.blend;
     for(const [texture,multiplier] of [[day,daylight],[night,1-daylight]]){
       g.globalAlpha=l.alpha*this.current[i+1]*multiplier;
       if(g.globalAlpha<.001)continue;
       for(let x=-off;x<this.width;x+=w)g.drawImage(texture,x,this.height*l.y+bob,w,h);
     }
   });g.restore();
 }
}
