// Unmodified SMG originals; verified against the official signal explanation pages.
// https://www.smg.gov.mo/zh/subpage/28/page/326
// https://www.smg.gov.mo/zh/subpage/33/page/85
export const WARNING_ICONS=Object.fromEntries([
 ['一號風球','1'],['三號風球','3'],['八號東北風球','8ne'],['八號西北風球','8nw'],['八號東南風球','8se'],['八號西南風球','8sw'],['九號風球','9'],['十號風球','10'],
].map(([title,id])=>[title,{url:`https://www.smg.gov.mo/assets/image/warning/dt${id}.gif`,path:`/assets/warnings/typhoon-${id}.gif`}]).concat([
 ['黃色暴雨警告信號','yellow'],['紅色暴雨警告信號','red'],['黑色暴雨警告信號','black'],
].map(([title,color])=>[title,{url:`https://cms.smg.gov.mo/uploads/tinymce//sitecontent/DM/${color}rain.jpg`,path:`/assets/warnings/rainstorm-${color}.jpg`}])));
