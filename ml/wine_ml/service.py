"""Bounded image inference and optional OCR refinement."""
from __future__ import annotations
import asyncio
import logging
import math
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Callable
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat
from wine_ml.config import MAX_UPLOAD_BYTES, OCR_ALPHA, OCR_BETA, OCR_TIMEOUT_S
from wine_ml.preprocess import ImageTooLarge, load_image, normalize_image
from wine_ml.text_match import rerank

log = logging.getLogger(__name__)

class OcrItem(BaseModel):
    text: str = Field(max_length=4096)
    conf: FiniteFloat = Field(default=1., ge=0, le=1)
    cx: FiniteFloat | None = Field(default=None, ge=0, le=1)
    cy: FiniteFloat | None = Field(default=None, ge=0, le=1)
    h: FiniteFloat | None = Field(default=None, ge=0, le=1)

class RerankCandidate(BaseModel):
    model_config = ConfigDict(extra='ignore')
    slug: str = Field(min_length=1, max_length=512)
    name: str | None = None
    winery: str | None = None
    grapes: str | None = None
    category: str | None = None
    visual: FiniteFloat = Field(ge=-1.01, le=1.01)

class RerankRequest(BaseModel):
    ocr: list[OcrItem] = Field(max_length=300)
    candidates: list[RerankCandidate] = Field(max_length=50)
    alpha: FiniteFloat = Field(default=OCR_ALPHA, ge=0, le=1)
    beta: FiniteFloat = Field(default=OCR_BETA, ge=0, le=1)


def create_app(embedder_factory: Callable, ocr_factory: Callable | None = None) -> FastAPI:
    get_embedder = lru_cache(maxsize=1)(embedder_factory)
    get_ocr = lru_cache(maxsize=1)(ocr_factory) if ocr_factory else None
    embedding_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='embedding')
    ocr_pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='ocr')
    embedding_slots = threading.BoundedSemaphore(3)
    ocr_slots = threading.BoundedSemaphore(1)
    ocr_ready = get_ocr is not None
    ocr_start_error = None

    @asynccontextmanager
    async def lifespan(app):
        nonlocal ocr_ready, ocr_start_error
        await asyncio.to_thread(get_embedder)
        if get_ocr:
            try:
                await asyncio.to_thread(get_ocr)
            except Exception as exc:
                ocr_ready = False
                ocr_start_error = type(exc).__name__
                log.exception('OCR warmup failed; visual search remains available')
        yield
        embedding_pool.shutdown(wait=False, cancel_futures=True)
        ocr_pool.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title='wine-ml', version='0.3.0', lifespan=lifespan)

    async def read_upload(image):
        data = await image.read(MAX_UPLOAD_BYTES + 1)
        if not data:
            raise HTTPException(400, 'empty file')
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, 'file too large')
        try:
            return await asyncio.to_thread(load_image, data)
        except ImageTooLarge:
            raise HTTPException(413, 'image pixel limit exceeded')
        except ValueError:
            raise HTTPException(400, 'invalid image')

    def embed_image(raw):
        t0 = time.perf_counter()
        e = get_embedder()
        vec = e.embed([normalize_image(raw)])[0]
        if not all(math.isfinite(float(x)) for x in vec):
            raise ValueError('non-finite embedding')
        return {'model': e.model_name, 'dim': int(vec.shape[0]), 'embedding': vec.tolist(),
                'embed_ms': round((time.perf_counter()-t0)*1000, 1)}

    def ocr_image(raw):
        t0 = time.perf_counter()
        items = get_ocr().read(raw) if get_ocr else []
        valid = [OcrItem.model_validate(i).model_dump(exclude_none=True) for i in items[:300]]
        return {'ocr': valid, 'ocr_ms': round((time.perf_counter()-t0)*1000, 1)}

    def submit(pool, slots, fn, raw):
        if not slots.acquire(blocking=False):
            return None
        try:
            future = pool.submit(fn, raw)
        except BaseException:
            slots.release()
            raise
        # Timeout cancels only the wait, never frees the slot while GPU work still runs.
        future.add_done_callback(lambda _: slots.release())
        wrapped = asyncio.wrap_future(future)
        wrapped.add_done_callback(lambda f: f.exception() if not f.cancelled() else None)
        return wrapped

    async def embedding(raw):
        future = submit(embedding_pool, embedding_slots, embed_image, raw)
        if future is None:
            raise HTTPException(503, 'inference queue full')
        try:
            return await asyncio.wait_for(asyncio.shield(future), timeout=7.5)
        except asyncio.TimeoutError:
            raise HTTPException(503, 'inference timeout')
        except Exception:
            log.exception('Embedding failed')
            raise HTTPException(503, 'inference unavailable')

    @app.get('/health')
    async def health():
        from wine_ml.config import OCR_PROVIDER
        e = get_embedder()
        return {'status':'ok', 'model':e.model_name, 'device':e.device, 'dim':e.dim,
                'ocr':OCR_PROVIDER if ocr_ready else None, 'ocr_error':ocr_start_error}

    @app.post('/embed')
    async def embed(image: UploadFile = File(...)):
        return await embedding(await read_upload(image))

    @app.post('/analyze')
    async def analyze(image: UploadFile = File(...)):
        raw = await read_upload(image)
        started = time.perf_counter()
        task = submit(ocr_pool, ocr_slots, ocr_image, raw) if ocr_ready else None
        emb = await embedding(raw)
        ocr = {'ocr':[], 'ocr_ms':None, 'ocr_fallback':'disabled' if not ocr_ready else 'busy'}
        if task is not None:
            try:
                remaining = max(0.001, OCR_TIMEOUT_S - (time.perf_counter()-started))
                ocr = await asyncio.wait_for(asyncio.shield(task), timeout=remaining)
            except asyncio.TimeoutError:
                ocr = {'ocr':[], 'ocr_ms':None, 'ocr_timeout':True, 'ocr_fallback':'timeout'}
            except Exception:
                log.exception('OCR failed; answering with visual features')
                ocr = {'ocr':[], 'ocr_ms':None, 'ocr_fallback':'error'}
        return {**emb, **ocr}

    @app.post('/rerank')
    def rerank_candidates(req: RerankRequest):
        if len({c.slug for c in req.candidates}) != len(req.candidates):
            raise HTTPException(422, 'duplicate candidate slug')
        return {'candidates':rerank([i.model_dump(exclude_none=True) for i in req.ocr],
                                   [c.model_dump() for c in req.candidates], req.alpha, req.beta)}
    return app


def _default_embedder():
    from wine_ml.config import DEVICE, MODEL_NAME
    from wine_ml.embedder import Embedder
    return Embedder(MODEL_NAME, DEVICE)

def _default_ocr():
    from wine_ml.config import make_ocr_engine
    return make_ocr_engine()

def _build_app():
    from wine_ml.config import OCR_ENABLED
    return create_app(_default_embedder, _default_ocr if OCR_ENABLED else None)

app = _build_app()
