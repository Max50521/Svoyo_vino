"""Download catalog photos that are missing from the dataset dump from the vino-svoe.ru wine cards.

For every row of ml/catalog_overrides.csv with source=site, the card https://vino-svoe.ru/wines/<slug>
is fetched and the image whose file name matches the CSV photo name (same normalisation as the catalog
build) is saved to data/raw/site_photos/<file>. Already downloaded files are skipped.

  ml\\.venv\\Scripts\\python scripts\\fetch_site_photos.py
"""
import csv
import re
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'ml'))
from wine_ml.catalog import name_key, strip_hash  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/raw/site_photos'
IMG = re.compile(r'https://api\.vino-svoe\.ru/v1/img/str-api/(\d+)/(\d+)/resize/uploads/([\w.-]+\.(?:webp|jpe?g|png))')

photos = {}
with (ROOT / 'data/raw/strapi_output0709.csv').open(encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f):
        photos.setdefault(r['Slug'].strip(), r['Название фото'].strip())

OUT.mkdir(parents=True, exist_ok=True)
with (ROOT / 'ml/catalog_overrides.csv').open(encoding='utf-8', newline='') as f:
    wanted = [o for o in csv.DictReader(f) if o['source'] == 'site']


def get(client: httpx.Client, url: str, attempts: int = 5) -> httpx.Response:
    """GET with retries: the site sometimes drops connections (WinError 10054) or answers 5xx."""
    for i in range(attempts):
        try:
            resp = client.get(url)
            if resp.status_code < 500:
                resp.raise_for_status()
                return resp
            err: Exception = httpx.HTTPStatusError(f'HTTP {resp.status_code}', request=resp.request, response=resp)
        except httpx.TransportError as e:
            err = e
        if i == attempts - 1:
            raise err
        wait = 2 ** i
        print(f'  retry in {wait}s after {type(err).__name__}: {err}')
        time.sleep(wait)


def fetch(client: httpx.Client, o: dict, dst: Path) -> bool:
    page = get(client, f"https://vino-svoe.ru/wines/{o['slug']}").text
    key = name_key(strip_hash(photos[o['slug']].rsplit('.', 1)[0]))
    found = {}
    for w, h, name in IMG.findall(page):
        if name_key(strip_hash(name.rsplit('.', 1)[0])) == key:
            found[name] = max(found.get(name, 0), int(w))
    if found:
        name = next(iter(found))
    else:  # the card photo was replaced after the dump: take the card's main (og:image) photo
        og = re.search(r'og:image" content="https://api\.vino-svoe\.ru/v1/img/str-api/\d+/\d+/resize/uploads/([\w.-]+)"', page)
        if not og:
            print('NOT FOUND on the card:', o['slug'], photos[o['slug']])
            return False
        name = og.group(1)
        print('  CSV photo name not on the card, using the card main photo:', name)
    url = f'https://api.vino-svoe.ru/v1/img/str-api/1440/1440/resize/uploads/{name}'
    resp = get(client, url)
    dst.write_bytes(resp.content)
    print('saved', o['slug'], '<-', url, len(resp.content), 'bytes')
    return True


missing = []
with httpx.Client(timeout=30, follow_redirects=True, headers={'User-Agent': 'Mozilla/5.0'}) as client:
    for o in wanted:
        dst = OUT / o['file']
        if dst.exists():
            print('have', o['slug'])
            continue
        try:
            ok = fetch(client, o, dst)
        except httpx.HTTPError as e:
            print('FAILED', o['slug'], '-', e)
            ok = False
        if not ok:
            missing.append(o['slug'])

if missing:
    print(f'\n{len(missing)} of {len(wanted)} site photos not downloaded: {", ".join(missing)}')
    print('Re-run this script, then the catalog steps of setup (it is safe to re-run setup).')
    sys.exit(1)
print(f'all {len(wanted)} site photos present')
