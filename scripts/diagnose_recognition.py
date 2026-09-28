"""Offline diagnostic capture; never imported by the production service."""
import csv, hashlib, json, sys, time
from pathlib import Path
import httpx
import numpy as np
import psycopg

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'ml'))
from wine_ml.config import DATABASE_URL, MODEL_NAME
from wine_ml.text_match import rerank

out=ROOT/'reports/recognition'
out.mkdir(exist_ok=True)
cache=out/'analysis-baseline.json'
labels=list(csv.DictReader((ROOT/'eval/real/labels.tsv').open(encoding='utf-8'),delimiter='\t'))
catalog={r['slug']:r for r in map(json.loads,(ROOT/'data/catalog/wines.jsonl').read_text(encoding='utf-8').splitlines())}
with psycopg.connect(DATABASE_URL) as conn:
    rows=conn.execute('SELECT slug,view,embedding::text FROM wine_embeddings WHERE model=%s ORDER BY slug,view',(MODEL_NAME,)).fetchall()
matrix=np.array([np.fromstring(r[2][1:-1],sep=',',dtype=np.float32) for r in rows])
matrix/=np.linalg.norm(matrix,axis=1,keepdims=True)
slugs=sorted({r[0] for r in rows})
lookup={s:i for i,s in enumerate(slugs)}
indices=np.array([lookup[r[0]] for r in rows])
full=np.array([r[1]=='full' for r in rows])
records=json.loads(cache.read_text(encoding='utf-8')) if cache.exists() else []
done={r['image']:r for r in records}
with httpx.Client(timeout=30) as client:
    for i,label in enumerate(labels):
        path=ROOT/'eval/real/photos'/label['image_path']
        sha=hashlib.sha256(path.read_bytes()).hexdigest()
        if path.name not in done:
            t=time.perf_counter()
            response=client.post('http://127.0.0.1:8001/analyze',files={'image':(path.name,path.read_bytes(),'image/webp')})
            response.raise_for_status()
            rec={'image':path.name,'truth':label['slug'],'sha256':sha,'analysis':response.json()}
            records.append(rec);done[path.name]=rec
            cache.write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
            print(f'{i+1}/100 {time.perf_counter()-t:.2f}s',flush=True)
        rec=done[path.name]
        assert rec['sha256']==sha and rec['truth']==label['slug']
        emb=np.array(rec['analysis']['embedding'],dtype=np.float32);emb/=np.linalg.norm(emb)
        sim=matrix@emb
        fs=np.full(len(slugs),-1.,dtype=np.float32);ls=fs.copy()
        np.maximum.at(fs,indices[full],sim[full]);np.maximum.at(ls,indices[~full],sim[~full])
        scores=.5*fs+.5*ls
        top=np.argsort(-scores)[:50]
        rec['candidates']=[{**{k:catalog[slugs[j]].get(k) for k in ('slug','name','winery','grapes','category')},'visual':float(scores[j])} for j in top]
cache.write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8')
known=[r for r in records if r['truth'] not in ('-','?','')]
correct=0
for r in known:
    ranked=rerank(r['analysis']['ocr'],r['candidates'][:10],.1,.05)
    ok=ranked[0]['slug'] in r['truth'].split('|');correct+=ok
    if not ok:
        print('\nERROR',r['image'],r['truth'])
        print('OCR',json.dumps(r['analysis']['ocr'],ensure_ascii=False))
        print('TOP',json.dumps(ranked[:5],ensure_ascii=False))
print('BASELINE',correct,len(known),flush=True)
