import json,asyncio,time
from pathlib import Path
from collections import Counter
import httpx
async def main():
 data=next(Path('eval/real/photos').glob('*.webp')).read_bytes()
 async with httpx.AsyncClient(base_url='http://127.0.0.1:8080',timeout=20) as c:
  async def one(i):
   t=time.perf_counter()
   try:
    r=await c.post('/v1/search',files={'image':('load.webp',data,'image/webp')});return {'id':i,'http':r.status_code,'ms':round((time.perf_counter()-t)*1000,1),'body':r.json()}
   except Exception as e:return {'id':i,'http':0,'error':repr(e)}
  t=time.perf_counter();rs=await asyncio.gather(*[one(i) for i in range(12)]);elapsed=time.perf_counter()-t
  await asyncio.sleep(1)
  recovery=await one(12);health=await c.get('/ready')
 out={'concurrent':12,'elapsed_ms':round(elapsed*1000,1),'http':dict(Counter(x['http'] for x in rs)),'rows':rs,'recovery':recovery,'readiness':health.json()}
 Path('reports/verification/load.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8');print({k:v for k,v in out.items() if k not in ['rows','recovery','readiness']});print('recovery',recovery['http'],'ready',out['readiness']['ready'])
asyncio.run(main())
