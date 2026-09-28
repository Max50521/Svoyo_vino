"""Paired diagnostic on fixed perturbations and fresh synthetic catalog queries.

Never called by the application. Synthetic scores are not real field accuracy.
Both rerankers receive identical inference and identical candidate lists.
"""
import os
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
import argparse, csv, hashlib, importlib.util, io, json, random, sys, time
from pathlib import Path
import httpx
import numpy as np
import psycopg
from PIL import Image, ImageEnhance, ImageOps

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'ml'))
from wine_ml.config import DATABASE_URL,MODEL_NAME
from wine_ml.text_match import rerank
from wine_ml.augment import field_like

p=argparse.ArgumentParser();p.add_argument('--mode',choices=['perturb','synthetic'],required=True)
p.add_argument('--baseline',type=Path,required=True);p.add_argument('--limit',type=int,default=100)
a=p.parse_args()
spec=importlib.util.spec_from_file_location('baseline_rerank',a.baseline)
baseline=importlib.util.module_from_spec(spec);spec.loader.exec_module(baseline)
out=ROOT/'reports/recognition';cache_dir=ROOT/'data/validation-cache';cache_dir.mkdir(exist_ok=True)
labels=list(csv.DictReader((ROOT/'eval/real/labels.tsv').open(encoding='utf-8'),delimiter='\t'))
catalog={r['slug']:r for r in map(json.loads,(ROOT/'data/catalog/wines.jsonl').read_text(encoding='utf-8').splitlines())}
with psycopg.connect(DATABASE_URL) as conn:
    refs=conn.execute('SELECT slug,view,embedding::text FROM wine_embeddings WHERE model=%s ORDER BY slug,view',(MODEL_NAME,)).fetchall()
matrix=np.array([np.fromstring(r[2][1:-1],sep=',',dtype=np.float32) for r in refs])
matrix/=np.linalg.norm(matrix,axis=1,keepdims=True)
slugs=sorted({r[0] for r in refs});lookup={s:i for i,s in enumerate(slugs)}
indices=np.array([lookup[r[0]] for r in refs]);full=np.array([r[1]=='full' for r in refs])

queries=[]
if a.mode=='perturb':
    for r in labels:
        if r['slug'] in ('-','?',''):continue
        for variant in ('jpeg-70','dark-075','rotate-7'):
            queries.append((r['image_path']+'/'+variant,r['slug'],ROOT/'eval/real/photos'/r['image_path'],variant))
else:
    excluded={s for r in labels for s in r['slug'].split('|')}
    # Exclude exact-image twins before sampling; do not inspect outcomes to choose wines.
    hashes={}
    for c in catalog.values():hashes.setdefault(c['image_sha256'],[]).append(c['slug'])
    pool=sorted(s for s,c in catalog.items() if s not in excluded and len(hashes[c['image_sha256']])==1)
    chosen=random.Random(20260928).sample(pool,min(a.limit,len(pool)))
    for i,s in enumerate(chosen):queries.append((s,s,ROOT/'data/catalog/images'/catalog[s]['image_file'],20260928+i))

records=[]
with httpx.Client(timeout=30) as client:
    for i,(qid,truth,path,variant) in enumerate(queries):
        with Image.open(path) as raw:
            if a.mode=='synthetic':im=field_like(raw,random.Random(variant),max_side=1536)
            else:
                im=ImageOps.exif_transpose(raw).convert('RGB')
                if variant=='jpeg-70':im.thumbnail((768,768))
                if variant=='dark-075':im=ImageEnhance.Brightness(im).enhance(.75)
                if variant=='rotate-7':im=im.rotate(7,Image.Resampling.BICUBIC,expand=True,fillcolor='white')
            buf=io.BytesIO();im.save(buf,'JPEG',quality=70 if variant=='jpeg-70' else 90)
        payload=buf.getvalue();sha=hashlib.sha256(payload).hexdigest();cache=cache_dir/(sha+'.json')
        if cache.exists():analysis=json.loads(cache.read_text(encoding='utf-8'))
        else:
            r=client.post('http://127.0.0.1:8001/analyze',files={'image':('query.jpg',payload,'image/jpeg')})
            r.raise_for_status();analysis=r.json();cache.write_text(json.dumps(analysis),encoding='utf-8')
        emb=np.array(analysis['embedding'],dtype=np.float32);emb/=np.linalg.norm(emb);sim=matrix@emb
        fs=np.full(len(slugs),-1.,dtype=np.float32);ls=fs.copy()
        np.maximum.at(fs,indices[full],sim[full]);np.maximum.at(ls,indices[~full],sim[~full]);scores=.5*(fs+ls)
        top=np.argsort(-scores)[:10]
        candidates=[{**{k:catalog[slugs[j]].get(k) for k in ('slug','name','winery','grapes','category')},'visual':float(scores[j])} for j in top]
        old=baseline.rerank(analysis['ocr'],candidates,.1,.05);new=rerank(analysis['ocr'],candidates,.1,.05)
        rec={'query':qid,'truth':truth,'sha256':sha,'baseline':old[0]['slug'],'current':new[0]['slug'],'baseline_top1':old[0]['slug'] in truth.split('|'),'current_top1':new[0]['slug'] in truth.split('|'),'current_top5':any(c['slug'] in truth.split('|') for c in new[:5]),'ocr_fallback':analysis.get('ocr_fallback')}
        records.append(rec)
        print(f'{a.mode} {i+1}/{len(queries)} old={rec["baseline_top1"]} new={rec["current_top1"]}',flush=True)
        (out/f'{a.mode}-validation-rows.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
summary={'mode':a.mode,'n':len(records),'baseline_top1':sum(r['baseline_top1'] for r in records),'current_top1':sum(r['current_top1'] for r in records),'current_top5':sum(r['current_top5'] for r in records),'improvements':sum(r['current_top1'] and not r['baseline_top1'] for r in records),'regressions':sum(r['baseline_top1'] and not r['current_top1'] for r in records),'same_index_for_both':len(slugs),'seed':20260928,'baseline_sha256':hashlib.sha256(a.baseline.read_bytes()).hexdigest(),'limitations':'Derived images / catalog synthesis, not independent real field holdout. No tuning on these outputs.'}
(out/f'{a.mode}-validation-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(summary)
