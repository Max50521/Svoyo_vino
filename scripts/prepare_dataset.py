"""Extract the organizer ZIP with a supplied 7-Zip executable (Windows/Linux)."""
import argparse, hashlib, json, shutil, subprocess, zipfile
from pathlib import Path, PurePosixPath

ROOT=Path(__file__).resolve().parents[1]

def prepare(archive: Path, sevenzip: str, root: Path = ROOT):
    archive=archive.resolve(strict=True)
    raw=root/'data/raw';archives=raw/'archives';archives.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(archive) as z:
        selected=[]
        for info in z.infolist():
            name=PurePosixPath(info.filename.replace('\\','/')).name
            if info.is_dir() or '__MACOSX' in info.filename or name.startswith('._'):continue
            if name.lower().endswith(('.rar','.csv')) or name.lower()=='eval.zip' or (name.lower().endswith('.zip') and 'фото' in name.lower()):
                selected.append((info,name))
        names=[n for _,n in selected]
        if len(names)!=len(set(names)):raise ValueError('Duplicate archive basenames')
        if sum(n.lower().endswith('.csv') for n in names)!=1:raise ValueError('Expected one catalog CSV')
        for info,name in selected:
            target=raw/'strapi_output0709.csv' if name.lower().endswith('.csv') else archives/name
            with z.open(info) as src,target.open('wb') as dst:shutil.copyfileobj(src,dst)
    parts=sorted(archives.glob('*.part1.rar'))
    if len(parts)!=1:raise ValueError('Expected one multipart RAR starting at part1')
    logdir=root/'data/runtime';logdir.mkdir(exist_ok=True)
    def unpack(source,dest,*,flat=False,warning_ok=False):
        dest.mkdir(parents=True,exist_ok=True)
        with (logdir/'dataset-extract.log').open('ab') as log:
            proc=subprocess.run([sevenzip,'e' if flat else 'x','-y',f'-o{dest}',str(source),'-xr!__MACOSX','-xr!._*'],stdout=log,stderr=subprocess.STDOUT)
        if proc.returncode not in ({0,1} if warning_ok else {0}):
            raise RuntimeError(f'Extraction failed ({proc.returncode}); see {logdir}/dataset-extract.log')
        return proc.returncode
    rar_status=unpack(parts[0],raw/'strapi',warning_ok=True)
    if (archives/'eval.zip').exists():unpack(archives/'eval.zip',raw/'eval')
    photozips=[p for p in archives.glob('*.zip') if 'фото' in p.name.lower()]
    for p in photozips:unpack(p,root/'eval/real/photos',flat=True)
    uploads=raw/'strapi/prod-svoe-vino-strapi/prod-svoe-vino/strapi/uploads'
    count=sum(p.is_file() for p in uploads.iterdir()) if uploads.exists() else 0
    if count<15000:raise RuntimeError(f'Incomplete uploads extraction: {count} files')
    report={'archive':archive.name,'uploads_files':count,'rar_exit_code':rar_status,'csv_bytes':(raw/'strapi_output0709.csv').stat().st_size}
    (logdir/'dataset-extract.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--sevenzip',default='7zz')
    a=p.parse_args();prepare(a.archive,a.sevenzip)
