"""Summarize frozen HTTP evidence; preserve set-valued labels explicitly."""
import csv,hashlib,importlib.metadata,json,platform,sys
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from dotenv import dotenv_values
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'reports/recognition'
rows=json.loads((out/'final-rows.json').read_text(encoding='utf-8'))
official=[json.loads(x) for x in (out/'official-100.jsonl').read_text(encoding='utf-8').splitlines()]
earlier={r['image']:r for r in json.loads((out/'top1-v1-rows.json').read_text(encoding='utf-8'))}
baseline={r['image']:r for r in json.loads((ROOT/'reports/verification/ocr-rows.json').read_text(encoding='utf-8'))}
by_official={r['image_path']:r for r in official}
known=[r for r in rows if r['truth'] not in ('-','?','')]
single=[r for r in known if '|' not in r['truth']]
tp=Counter(r['truth'] for r in single if r['pred']==r['truth'])
support=Counter(r['truth'] for r in single);predicted=Counter(r['pred'] or '<error>' for r in single)
classes=set(support)|set(predicted)
perclass={s:2*tp[s]/(support[s]+predicted[s]) for s in classes}
scored_conf=[r for r in rows if r['truth'] not in ('?','') and r['status']=='confident']
checks=json.loads((out/'final-http-checks.json').read_text(encoding='utf-8'))
ui=json.loads((out/'browser.json').read_text(encoding='utf-8'))
assert all(r['sha256']==by_official[r['image']]['image_sha256'] for r in rows)
assert all(r['sha256']==baseline[r['image']]['sha256'] and r['truth']==baseline[r['image']]['truth'] for r in rows)
assert all(c['pass'] for c in checks)
summary={
 'n':len(rows),'known_n':len(known),'known_top1':sum(r['top1'] for r in known),'known_top5':sum(r['top5'] for r in known),
 'single_slug_n':len(single),'single_slug_top1':sum(r['top1'] for r in single),
 'single_slug_micro_f1':sum(tp.values())/len(single),'single_slug_macro_f1':sum(perclass.values())/len(classes),
 'macro_f1_class_count':len(classes),'macro_f1_convention':'Union of truth and predicted classes on the single-slug subset; zero-division=0',
 'accepted_slug_set_n':len(known)-len(single),'accepted_slug_set_correct':sum(r['top1'] for r in known if '|' in r['truth']),
 'same_prediction_in_three_runs':sum(r['pred']==earlier[r['image']]['pred']==by_official[r['image']]['predicted_slug'] for r in rows),
 'baseline_correct_retained':sum(baseline[r['image']]['top1'] and r['top1'] for r in known),
 'fixed_public_errors':[r['image'] for r in known if r['top1'] and not baseline[r['image']]['top1']],
 'remaining_public_errors':[{'image':r['image'],'truth':r['truth'],'pred':r['pred']} for r in known if not r['top1']],
 'scored_confident_n':len(scored_conf),'scored_confident_correct':sum(r['top1'] for r in scored_conf),
 'contract_checks_passed':sum(c['pass'] for c in checks),'ui_cases_passed':sum(c['pass'] for c in ui['results']),'browser_errors':ui['pageErrors'],
 'labels_unchanged_from_baseline':True,'input_photos_unchanged_from_baseline':True,
}
(out/'acceptance-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
with (out/'all-100-results.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.DictWriter(f,fieldnames=['image','truth','pred','top1','top5','status','elapsed_ms','http_status','sha256'])
    writer.writeheader();writer.writerows({k:r[k] for k in writer.fieldnames} for r in rows)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source={}
for folder in ('ml/wine_ml','ml/tests','web/server','web/pages','web/components','web/composables','web/tests','scripts'):
    for path in (ROOT/folder).rglob('*'):
        if path.is_file() and path.suffix in ('.py','.ts','.vue','.sh','.ps1'):source[path.relative_to(ROOT).as_posix()]=sha(path)
settings=dotenv_values(ROOT/'.env')
safe_keys=('MODEL_NAME','DEVICE','OCR_ENABLED','OCR_PROVIDER','OCR_ALPHA','OCR_BETA','OCR_TIMEOUT_S','RERANK_K','LABEL_WEIGHT','NOT_FOUND_SCORE','CONFIDENCE_MARGIN','EMBEDDING_DIM','ML_TIMEOUT_MS')
cache=Path(settings.get('HF_HOME') or ROOT/'data/model-cache')
snapshots=[p.name for p in cache.glob('hub/models--google--siglip2-so400m-patch14-384/snapshots/*') if p.is_dir()]
manifest={'created_utc':datetime.now(timezone.utc).isoformat(),'python':sys.version,'platform':platform.platform(),
 'packages':{n:importlib.metadata.version(n) for n in ('torch','torchvision','transformers','easyocr','fastapi','numpy','pillow')},
 'settings':{k:settings.get(k) for k in safe_keys},'model_snapshots':snapshots,
 'labels_sha256':sha(ROOT/'eval/real/labels.tsv'),'organizer_script_sha256':sha(ROOT/'eval/participant_test.sh'),
 'catalog_sha256':sha(ROOT/'data/catalog/wines.jsonl'),'sources':source}
(out/'run-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
