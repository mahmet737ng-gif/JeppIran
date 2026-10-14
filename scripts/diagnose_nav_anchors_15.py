#!/usr/bin/env python3
"""List on-page navaid symbols and printed coordinates for remaining 15 charts."""
import re,json,fitz
doc=fitz.open("Iran2621.pdf")
targets=[307,308,323,376,386,388,446,456,457,497,498,499,500,501,502]
for n in targets:
 p=doc[n-1]
 disks=[]
 for draw in p.get_drawings():
  r=fitz.Rect(draw['rect'])
  if not draw.get('fill') or not (16 <= r.width <= 100 and 16 <= r.height <= 100):continue
  ratio=r.width/r.height
  if .67<ratio<1.33:
   disks.append({'cx':round((r.x0+r.x1)/2,2),'cy':round((r.y0+r.y1)/2,2),
      'size':[round(r.width,2),round(r.height,2)],
      'fill':str(draw.get('fill')),'type':draw.get('type')})
  if len(disks)>200:break
 words=p.get_text('words')
 gr=[{'name':w[4],'loc':[round(v,1) for v in w[:4]]} for w in words if re.fullmatch(r'\d{2,3}-\d{2}(?:\.\d+)?',w[4])]
 print("SYMBOLS",n,json.dumps({'disks':disks[:30],'grid':gr}),flush=True)
for icao,lo,hi in (('OIGG',304,334),('OIIE',358,393),('OIKB',440,469),('OIKK',491,507)):
 found=[]
 for n in range(lo,hi+1):
  text=doc[n-1].get_text()
  matches=re.findall(r'N\s*\d{2}\s*[0-9 .]+\s*E\s*0?\d{2,3}\s*[0-9 .]+',text)
  if matches:found.append([n,matches[:18]])
 print('PRINTED_COORDS',icao,json.dumps(found),flush=True)
