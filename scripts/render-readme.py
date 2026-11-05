"""從可編輯 SVG 版面及真實截圖製作 README GIF／靜態備援。
需要 Pillow、NumPy、rsvg-convert、ffmpeg，以及 beautify-github-readme 的 render_motion_gif.py。
"""
import argparse, base64, copy, subprocess, tempfile
from pathlib import Path
from xml.etree import ElementTree as ET
parser=argparse.ArgumentParser()
parser.add_argument('--renderer',type=Path,required=True,help='beautify-github-readme/scripts/render_motion_gif.py')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=root/'assets/readme/source';output=root/'assets/readme'
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.register_namespace('xlink','http://www.w3.org/1999/xlink')
svg=ET.parse(source/'intro-layout.svg')
for image in svg.getroot().iter('{http://www.w3.org/2000/svg}image'):
 key='{http://www.w3.org/1999/xlink}href';name=image.attrib[key]
 image.set(key,'data:image/jpeg;base64,'+base64.b64encode((source/name).read_bytes()).decode())
with tempfile.TemporaryDirectory(prefix='macau-readme-') as tmp:
 tmp=Path(tmp);render=tmp/'intro.svg';svg.write(render,encoding='utf-8',xml_declaration=True)
 subprocess.run(['python3',str(args.renderer),str(render),str(output/'intro.gif'),'--spec',str(source/'intro-motion.json'),'--keep-frames',str(tmp/'inspection')],check=True)
 # Losslessly optimize frame deltas after the bundled renderer. Identical holds are merged.
 from PIL import Image, ImageChops
 import numpy as np
 with Image.open(output/'intro.gif') as image:
  palette=image.getpalette();colors=np.array(palette,dtype=np.uint32).reshape(-1,3)
  keys=(colors[:,0]<<16)|(colors[:,1]<<8)|colors[:,2];order=np.argsort(keys);sorted_keys=keys[order]
  frames=[];durations=[];original=[]
  for i in range(image.n_frames):
   image.seek(i);rgba=image.convert('RGBA');original.append(rgba.copy());raw=np.array(rgba,dtype=np.uint32)
   rgb=(raw[:,:,0]<<16)|(raw[:,:,1]<<8)|raw[:,:,2];positions=np.searchsorted(sorted_keys,rgb)
   mapped=order[np.minimum(positions,255)].astype(np.uint8);mapped[raw[:,:,3]<128]=255
   frame=Image.frombytes('P',rgba.size,mapped.tobytes());frame.putpalette(palette)
   frames.append(frame);durations.append(image.info.get('duration',33))
  optimized=tmp/'optimized.gif'
  frames[0].save(optimized,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=1,transparency=255)
  with Image.open(optimized) as check:
   at=0
   for i in range(check.n_frames):
    check.seek(i);candidate=check.convert('RGBA');expected=original[at]
    assert ImageChops.difference(candidate.getchannel('A'),expected.getchannel('A')).getbbox() is None
    black=Image.new('RGBA',expected.size,'black')
    assert ImageChops.difference(Image.alpha_composite(black,candidate),Image.alpha_composite(black,expected)).getbbox(alpha_only=False) is None
    elapsed=check.info['duration']
    while at<len(durations) and elapsed>0:elapsed-=durations[at];at+=1
  (output/'intro.gif').write_bytes(optimized.read_bytes())
  print(f"最佳化後：{(output/'intro.gif').stat().st_size/1024/1024:.2f} MB")
 # Render an uncluttered, stationary fallback from the same source composition.
 static=copy.deepcopy(svg)
 for parent in static.getroot().iter():
  for child in list(parent):
   if child.get('id','').startswith('focus-'):parent.remove(child)
 fallback=tmp/'fallback.svg';static.write(fallback,encoding='utf-8',xml_declaration=True)
 subprocess.run(['rsvg-convert',str(fallback),'-o',str(output/'intro.png')],check=True)
 from PIL import Image
 with Image.open(output/'intro.gif') as im:
  timeline=[];elapsed=0
  for i in range(im.n_frames):
   im.seek(i);timeline.append((elapsed,i));elapsed+=im.info.get('duration',33)
  for when,label in [(0,'entry'),(1500,'now'),(4000,'warning'),(6300,'details'),(elapsed-1,'loop')]:
   index=max(i for t,i in timeline if t<=when)
   im.seek(index);im.convert('RGBA').save('/tmp/macau-readme-'+label+'.png')
