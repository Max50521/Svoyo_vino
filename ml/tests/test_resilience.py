import asyncio
import importlib.util
import io
import time
from pathlib import Path
from types import SimpleNamespace
import httpx
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from wine_ml.service import create_app

class Fake:
    model_name, dim, device = 'fake', 4, 'cpu'
    def embed(self, images, batch_size=16): return np.ones((len(images),4),np.float32)/2

def picture(fmt='PNG', color='red'):
    b=io.BytesIO(); Image.new('RGB',(32,32),color).save(b,fmt); return b.getvalue()

@pytest.mark.parametrize('fmt',['PNG','JPEG','WEBP','GIF','BMP'])
def test_decode_real_bytes_despite_wrong_extension(fmt):
    with TestClient(create_app(Fake)) as c:
        assert c.post('/embed',files={'image':('wrong.txt',picture(fmt),'text/plain')}).status_code==200

@pytest.mark.parametrize('payload',[{'ocr':[{'conf':1}],'candidates':[]},{'ocr':[{'text':'x','conf':'bad'}],'candidates':[]},{'ocr':[],'candidates':[{'slug':'x','visual':.8},{'slug':'x','visual':.7}]}])
def test_bad_rerank_is_validation_error(payload):
    with TestClient(create_app(Fake)) as c: assert c.post('/rerank',json=payload).status_code==422

def test_pixel_bomb_returns_413(monkeypatch):
    monkeypatch.setattr(Image,'MAX_IMAGE_PIXELS',100)
    with TestClient(create_app(Fake)) as c: assert c.post('/embed',files={'image':('x.png',picture(),'image/png')}).status_code==413

def test_ocr_exception_falls_back():
    class Broken:
        def read(self, im): raise RuntimeError('controlled failure')
    with TestClient(create_app(Fake,Broken)) as c:
        r=c.post('/analyze',files={'image':('x.png',picture(),'image/png')})
    assert r.status_code==200 and r.json()['ocr_fallback']=='error' and len(r.json()['embedding'])==4

def test_ocr_failed_start_does_not_block_visual():
    def broken(): raise RuntimeError('weights unavailable')
    with TestClient(create_app(Fake,broken)) as c:
        assert c.get('/health').json()['ocr'] is None
        assert c.post('/analyze',files={'image':('x.png',picture(),'image/png')}).status_code==200

def test_timed_out_ocr_remains_bounded(monkeypatch):
    monkeypatch.setattr('wine_ml.service.OCR_TIMEOUT_S',.03)
    calls=[]
    class Slow:
        def read(self, im): calls.append(1); time.sleep(.3); return []
    with TestClient(create_app(Fake,Slow)) as c:
        first=c.post('/analyze',files={'image':('x.png',picture(),'image/png')}).json()
        second=c.post('/analyze',files={'image':('x.png',picture(),'image/png')}).json()
    assert first['ocr_fallback']=='timeout' and second['ocr_fallback']=='busy' and len(calls)==1

def test_health_responsive_and_embedding_queue_bounded():
    class Slow(Fake):
        def embed(self, images,batch_size=16): time.sleep(.15); return super().embed(images)
    async def run():
        app=create_app(Slow)
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://test') as c:
                tasks=[asyncio.create_task(c.post('/embed',files={'image':('x.png',picture(),'image/png')})) for _ in range(8)]
                await asyncio.sleep(.04)
                t=time.perf_counter(); h=await c.get('/health'); dt=time.perf_counter()-t
                results=await asyncio.gather(*tasks)
                assert h.status_code==200 and dt<.1
                codes=[r.status_code for r in results]
                assert codes.count(200)==3 and codes.count(503)==5
    asyncio.run(run())

def test_query_cache_changes_with_pixels(tmp_path, monkeypatch):
    spec=importlib.util.spec_from_file_location('eval_under_test',Path(__file__).parents[1]/'scripts/evaluate.py')
    ev=importlib.util.module_from_spec(spec); spec.loader.exec_module(ev)
    monkeypatch.setattr('wine_ml.embedder.Embedder',lambda *a:Fake())
    class OCR:
        def read(self,im): return [{'text':str(im.getpixel((0,0))),'conf':1}]
    monkeypatch.setattr(ev,'make_ocr_engine',lambda *a:OCR())
    args=SimpleNamespace(labels=Path('labels.tsv'),out=tmp_path,model='fake',device='cpu',batch=1)
    red=[('same',lambda:Image.new('RGB',(20,20),'red'))]
    blue=[('same',lambda:Image.new('RGB',(20,20),'blue'))]
    assert ev.query_fingerprint(args,red)!=ev.query_fingerprint(args,blue)
    ev.embed_queries(args,red)
    fp1=str(np.load(next((tmp_path/'cache').glob('*.npz')))['fingerprint'])
    ev.embed_queries(args,blue)
    fp2=str(np.load(next((tmp_path/'cache').glob('*.npz')))['fingerprint'])
    assert fp1!=fp2
    assert ev.ocr_queries(args,red)!=ev.ocr_queries(args,blue)
