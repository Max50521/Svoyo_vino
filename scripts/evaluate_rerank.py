"""Evaluate a reranker on frozen inference, preserving the original labels."""
import argparse,json,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'ml'))
from wine_ml.text_match import rerank
p=argparse.ArgumentParser();p.add_argument('--tag',default='text-v2');p.add_argument('--alpha',type=float,default=.1);p.add_argument('--beta',type=float,default=.05);p.add_argument('--k',type=int,default=10);a=p.parse_args()
rows=json.loads((root/'reports/recognition/analysis-baseline.json').read_text(encoding='utf-8'))
baseline={r['image']:r for r in json.loads((root/'reports/verification/ocr-rows.json').read_text(encoding='utf-8'))}
out=[];start=time.perf_counter()
for r in rows:
    ranked=rerank(r['analysis']['ocr'],r['candidates'][:a.k],a.alpha,a.beta)
    known=r['truth'] not in ('-','?','');ok=ranked[0]['slug'] in r['truth'].split('|')
    out.append({'image':r['image'],'truth':r['truth'],'known':known,'top1':ok,'top5':any(c['slug'] in r['truth'].split('|') for c in ranked[:5]),'candidates':ranked})
    if known and (ok != baseline[r['image']]['top1'] or not ok):
        print(('FIX' if ok else 'REGRESSION' if baseline[r['image']]['top1'] else 'MISS'),r['image'],r['truth'])
        for c in ranked[:3]:print(' ',c['slug'],c['visual'],c['text'],c['conflicts'],c['final'])
known=[r for r in out if r['known']]
summary={'tag':a.tag,'top1':sum(r['top1'] for r in known),'top5':sum(r['top5'] for r in known),'n':len(known),'seconds':round(time.perf_counter()-start,2),'alpha':a.alpha,'beta':a.beta,'k':a.k}
(root/f'reports/recognition/{a.tag}.json').write_text(json.dumps({'summary':summary,'rows':out},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary))
