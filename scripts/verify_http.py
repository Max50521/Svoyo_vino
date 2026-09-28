"""End-to-end HTTP evaluation. Uses existing repository labels, not organizer ground truth."""
import argparse, csv, hashlib, json, time, statistics
from collections import Counter
from pathlib import Path
import httpx
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8080');p.add_argument('--tag',default='ocr');p.add_argument('--out',default='reports/verification');a=p.parse_args()
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
labels=list(csv.DictReader(Path('eval/real/labels.tsv').open(encoding='utf-8'),delimiter='\t'))
catalog={json.loads(x)['slug'] for x in Path('data/catalog/wines.jsonl').read_text(encoding='utf-8').splitlines()}
records=[]
with httpx.Client(timeout=20) as c:
    health=c.get(a.url+'/ready'); health.raise_for_status(); readiness=health.json()
    warm=Path('eval/real/photos')/labels[0]['image_path']
    for _ in range(3): c.post(a.url+'/v1/search',files={'image':(warm.name,warm.read_bytes(),'image/webp')})
    for i,label in enumerate(labels):
        path=Path('eval/real/photos')/label['image_path'];truth=label['slug'];data=path.read_bytes();t=time.perf_counter()
        rec={'image':path.name,'sha256':hashlib.sha256(data).hexdigest(),'truth':truth,'indexed':bool(set(truth.split('|'))&catalog)}
        try:
            r=c.post(a.url+'/v1/search',files={'image':(path.name,data,'image/webp')})
            rec.update(http_status=r.status_code,elapsed_ms=round((time.perf_counter()-t)*1000,1),response=r.json())
        except Exception as e:rec.update(http_status=0,elapsed_ms=round((time.perf_counter()-t)*1000,1),error=repr(e))
        b=rec.get('response',{});pred=(b.get('top1') or {}).get('slug');truths=truth.split('|')
        rec.update(top1=pred in truths,top5=any(x['slug'] in truths for x in b.get('top5',[])),status=b.get('status'),pred=pred)
        records.append(rec)
        print(f'{a.tag} {i+1}/{len(labels)} HTTP={rec["http_status"]} ms={rec["elapsed_ms"]} top1={rec["top1"]} status={rec["status"]}',flush=True)
        (out/f'{a.tag}-rows.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
def metric(rs):
    n=len(rs);return {'n':n,'top1':sum(r['top1'] for r in rs),'top5':sum(r['top5'] for r in rs),'top1_pct':round(100*sum(r['top1'] for r in rs)/n,2) if n else None,'top5_pct':round(100*sum(r['top5'] for r in rs)/n,2) if n else None}
known=[r for r in records if r['truth'] not in ['-','?','']];indexed=[r for r in known if r['indexed']];unknown=[r for r in records if r['truth']=='-'];skipped=[r for r in records if r['truth'] in ['?','']]
valid=[r for r in records if r['http_status']==200];lat=sorted(r['elapsed_ms'] for r in valid)
conf=[r for r in known if r['status']=='confident'];decision=sum((r['truth']=='-' and r['status']=='not_found') or (r['truth']!='-' and r['top1'] and r['status']!='not_found') for r in known+unknown)
summary={'tag':a.tag,'label_provenance':'repository labels; not independently verified organizer ground truth','readiness':readiness,'n':len(records),'http':dict(Counter(r['http_status'] for r in records)),'known_all':metric(known),'known_indexed':metric(indexed),'ambiguous_excluded':len(skipped),'unknown':{'n':len(unknown),'correct_not_found':sum(r['status']=='not_found' for r in unknown)},'known_false_not_found':sum(r['status']=='not_found' for r in known),'confident_known':metric(conf),'correct_ui_decisions':decision,'ui_decision_n':len(known+unknown),'status':dict(Counter(r['status'] for r in records)),'ocr_fallback':dict(Counter(str(r.get('response',{}).get('diagnostics',{}).get('ocr_fallback')) for r in records)),'latency_ms':{'p50':statistics.median(lat),'p95':lat[max(0,__import__('math').ceil(.95*len(lat))-1)],'max':max(lat),'mean':round(statistics.mean(lat),1)}}
(out/f'{a.tag}-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(summary,ensure_ascii=False,indent=2),flush=True)
