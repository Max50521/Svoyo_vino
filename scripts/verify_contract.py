import io,json,time,asyncio,struct,zlib
from pathlib import Path
from PIL import Image
import httpx
out=Path('reports/verification');out.mkdir(parents=True,exist_ok=True);rows=[]
def record(name, expected, r):
    rows.append({'test':name,'expected':expected,'status':r.status_code,'pass':r.status_code==expected,'body':r.text[:350] if not r.headers.get('content-type','').startswith('image/') else '<image>'})
def pic(fmt='PNG'):
    b=io.BytesIO();Image.new('RGB',(32,32),'red').save(b,fmt);return b.getvalue()
with httpx.Client(base_url='http://127.0.0.1:8080',timeout=20) as c:
    record('ready',200,c.get('/ready'))
    record('missing image',400,c.post('/v1/search',files={'other':('x.png',pic())}))
    record('invalid type',400,c.post('/v1/search',files={'image':('x.txt',b'not image')}))
    record('truncated PNG',400,c.post('/v1/search',files={'image':('x.png',pic()[:24])}))
    record('empty image',400,c.post('/v1/search',files={'image':('x.png',b'')}))
    record('over 15MiB',413,c.post('/v1/search',files={'image':('x.png',pic()+b'x'*(15*1024*1024))}))
    data=bytearray(pic());data[16:24]=struct.pack('>II',50000,50000);data[29:33]=struct.pack('>I',zlib.crc32(data[12:29]));record('pixel bomb',413,c.post('/v1/search',files={'image':('x.png',bytes(data))}))
    for fmt in ['PNG','JPEG','WEBP','GIF','BMP']:
        record('valid '+fmt+' misleading name',200,c.post('/v1/search',files={'image':('wrong.txt',pic(fmt),'text/plain')}))
    record('missing wine',404,c.get('/v1/wines/does-not-exist'))
    record('missing wine image',404,c.get('/v1/wines/does-not-exist/image'))
    slug=json.loads(Path('data/catalog/wines.jsonl').read_text(encoding='utf-8').splitlines()[0])['slug']
    record('wine card',200,c.get('/v1/wines/'+slug));record('wine photo',200,c.get('/v1/wines/'+slug+'/image'));record('similar',200,c.get('/v1/wines/'+slug+'/similar?limit=8'))
    record('predict contract',200,c.post('/v1/eval/predict',files={'image':('x.png',pic())}))
    if rows[-1]['pass']: rows[-1]['pass']=set(json.loads(rows[-1]['body']))=={'slug'}
    def body():
        yield b'--chunkbound\r\nContent-Disposition: form-data; name="image"; filename="x.png"\r\nContent-Type: image/png\r\n\r\n'
        for _ in range(17):yield b'x'*(1024*1024)
        yield b'\r\n--chunkbound--\r\n'
    record('chunked over limit',413,c.post('/v1/search',content=body(),headers={'content-type':'multipart/form-data; boundary=chunkbound'}))
    record('recovery after invalid requests',200,c.get('/ready'))
(out/'http-checks.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(rows,ensure_ascii=False,indent=2));print('PASSED',sum(r['pass'] for r in rows),'/',len(rows))
