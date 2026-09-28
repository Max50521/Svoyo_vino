"""Embed catalog reference images into wine_embeddings (pgvector), one vector per view.

Views: full (whole bottle) + label-band crops, see wine_ml/views.py.

Usage: python ml/scripts/build_index.py [--views full,label_mid,label_low] [--model NAME] [--force]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

from PIL import Image
from tqdm import tqdm

from wine_ml.config import DEVICE, MODEL_NAME
from wine_ml.db import connect, indexed_slugs, upsert_embeddings
from wine_ml.embedder import Embedder
from wine_ml.views import VIEWS, reference_views


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", type=Path, default=Path("data/catalog"))
    ap.add_argument("--model", default=MODEL_NAME)
    ap.add_argument("--device", default=DEVICE)
    ap.add_argument("--views", default=",".join(VIEWS), help=f"comma-separated subset of {VIEWS}")
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--force", action="store_true", help="re-embed already indexed wines")
    args = ap.parse_args()
    views = [v.strip() for v in args.views.split(",") if v.strip()]

    wines = [json.loads(l) for l in (args.catalog / "wines.jsonl").open(encoding="utf-8")]
    # Source + preprocessing hashes make an existing index safe to reuse.
    source_hashes = {w["slug"]: hashlib.sha256((args.catalog / "images" / w["image_file"]).read_bytes()).hexdigest() for w in wines}
    code_hash = hashlib.sha256(b"".join((Path(__file__).resolve().parents[1] / "wine_ml" / n).read_bytes() for n in ("preprocess.py", "views.py", "embedder.py"))).hexdigest()
    emb = None
    with connect() as conn:
        conn.execute("ALTER TABLE wine_embeddings ADD COLUMN IF NOT EXISTS source_sha256 text")
        conn.execute("ALTER TABLE wine_embeddings ADD COLUMN IF NOT EXISTS pipeline_sha256 text")
        conn.commit()
        for view in views:
            rows = conn.execute("SELECT slug, source_sha256, pipeline_sha256 FROM wine_embeddings WHERE model=%s AND view=%s", (args.model, view)).fetchall()
            done = set() if args.force else {slug for slug, src, code in rows if source_hashes.get(slug) == src and code == code_hash}
            todo = [w for w in wines if w["slug"] not in done]
            print(f"[{view}] {len(wines)} wines, {len(done)} already indexed, {len(todo)} to embed")
            if not todo:
                continue
            emb = emb or Embedder(args.model, args.device)
            t0 = time.perf_counter()
            for i in tqdm(range(0, len(todo), args.batch), unit="batch", desc=view):
                chunk = todo[i:i + args.batch]
                images = []
                for w in chunk:
                    with Image.open(args.catalog / "images" / w["image_file"]) as im:
                        images.append(reference_views(im, [view])[view])
                vecs = emb.embed(images, batch_size=args.batch)
                upsert_embeddings(conn, args.model, [w["slug"] for w in chunk], vecs, view)
                with conn.cursor() as cur:
                    cur.executemany("UPDATE wine_embeddings SET source_sha256=%s, pipeline_sha256=%s WHERE slug=%s AND model=%s AND view=%s", [(source_hashes[w["slug"]], code_hash, w["slug"], args.model, view) for w in chunk])
                conn.commit()
            dt = time.perf_counter() - t0
            print(f"[{view}] indexed {len(todo)} in {dt:.0f}s ({1000 * dt / len(todo):.0f} ms/img), dim={emb.dim}")


if __name__ == "__main__":
    main()
