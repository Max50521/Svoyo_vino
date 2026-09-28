"""Promote the audited additive catalog build; retain prior metadata for rollback."""
from pathlib import Path
import json,shutil
root=Path(__file__).resolve().parents[1]
old=root/'data/catalog';new=root/'data/catalog-top1';backup=root/'data/catalog-before-top1'
a={w['slug']:w for w in map(json.loads,(old/'wines.jsonl').read_text(encoding='utf-8').splitlines())}
b={w['slug']:w for w in map(json.loads,(new/'wines.jsonl').read_text(encoding='utf-8').splitlines())}
assert a.keys()<=b.keys()
assert all(a[s]['image_sha256']==b[s]['image_sha256'] for s in a)
backup.mkdir(exist_ok=True)
for name in ('wines.jsonl','excluded.csv'):
    if not (backup/name).exists():shutil.copy2(old/name,backup/name)
for s in b.keys()-a.keys():shutil.copy2(new/'images'/b[s]['image_file'],old/'images'/b[s]['image_file'])
for name in ('wines.jsonl','excluded.csv'):shutil.copy2(new/name,old/name)
report={'before':len(a),'after':len(b),'changed_existing':0,'added':[b[s] for s in sorted(b.keys()-a.keys())]}
(root/'reports/recognition/catalog-changes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('Promoted',len(a),'->',len(b))
