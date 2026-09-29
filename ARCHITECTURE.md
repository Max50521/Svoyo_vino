# Архитектура

Состояние 29.09.2026 (тег `v1.1`): 2 080 вин, 6 240 векторов, Top-1 59/64 и Top-5 64/64 на публичном наборе с командной разметкой. Проверенный стенд — Windows + CUDA, PostgreSQL + pgvector в Docker или в WASM (PGlite); Linux-скрипты подготовлены, но не прогонялись на реальной машине. Обзор для экспертов — [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md).

## Компоненты

| Компонент | Технологии | Порт | Роль |
|---|---|---|---|
| web | Nuxt 3 (Vue 3 + Nitro), TypeScript | 8080 | мобильный интерфейс, публичный API, паспорт вкуса и аналоги, Swagger (`/docs`) |
| ml | Python 3.12, FastAPI, PyTorch, SigLIP 2, EasyOCR | 8001 (только localhost) | нормализация фото, векторы, чтение этикетки, переранжирование |
| БД | PostgreSQL 16 + pgvector (Docker) или PGlite (WASM) | 5432 / 5433 | каталог `wines`, векторы `wine_embeddings` |
| офлайн-конвейер | Python-скрипты `ml/scripts` | — | каталог из датасета, индекс, двойники, оценка |

## Поток запроса

```
фото (multipart "image")
   │
   ▼
web — Nuxt 3 / Nitro, :8080 ──────────────────────────────────────────────────┐
   │ 1. приём и проверка (readImage: multipart, сигнатура файла, ≤ 15 МБ)       │
   │ 2. RecognitionEngine.recognize(image, k=5)   ← ENGINE=vector|stub          │
   │ 3. статус и confidence (search.ts, status.ts)                              │
   │ 4. ответ: /v1/eval/predict → {"slug"}                                      │
   │           /v1/search → top1, top5, status, confidence (+ analogs при not_found)
   └──────────┬───────────────────────────────────────────────┬──────────────┘
              │ 1) POST /analyze  2) POST /rerank              │ SQL: визуальный Top-10
              ▼                                                ▼
ml — FastAPI, :8001                                  PostgreSQL + pgvector
   /analyze: нормализация → SigLIP 2 → вектор        wines, wine_embeddings
             ‖ параллельно EasyOCR → текст + координаты
   /rerank:  Top-10 + текст → финальный порядок

карточка: GET /v1/wines/:slug → строка wines + taste_passport (анализ описания, без сети)
          GET /v1/wines/:slug/analogs → профили вкуса каталога (кеш в памяти web)
```

VectorEngine: `/analyze` (вектор + OCR) → pgvector Top-`RERANK_K` по визуальному скору → `/rerank` → Top-5 по финальному скору. При `OCR_ENABLED=0` — `/embed` и только визуальный скор.

## Слои

| Слой | Где | Что делает |
|---|---|---|
| Нормализация фото | `ml/wine_ml/preprocess.py`, `views.py` | EXIF-поворот → RGB, прозрачность → белый → обрезка белых полей → уменьшение до 1024 → паддинг до квадрата; две зоны этикетки. Одна функция для эталонов, запросов и оценки, поэтому векторы сопоставимы. |
| Извлечение признаков | `ml/wine_ml/embedder.py` | SigLIP 2 (`google/siglip2-so400m-patch14-384`, 1152-d), fp16 на GPU, L2-нормировка. |
| Поиск по каталогу | `web/server/utils/engine/vector.ts` | косинусное сходство `<=>` в pgvector по трём видам вина (бутылка + 2 зоны этикетки); скор вина = (1 − w) · бутылка + w · лучшая зона, w = `LABEL_WEIGHT` (0,5); точный перебор ≈ 6 тыс. векторов. |
| Чтение этикетки | `ml/wine_ml/ocr.py`, `text_match.py` | EasyOCR (ru + en) или Yandex Vision (`OCR_PROVIDER=yandex`); смешанные алфавиты, разорванные слова, варианты написания сортов и фамилий. Сопоставляются название, винодельня и сорта; IDF внутри Top-10. Текстовый скор — F-beta (β = 0,5) согласования видимых слов, а не F1 качества. final = visual + α · text − β · противоречия (цвет, сахар, год). |
| Статус и уверенность | `web/server/utils/search.ts`, `status.ts` | `margin` = score₁ − score₂; `status`: `confident` / `uncertain` / `not_found` по `CONFIDENCE_MARGIN` (финальный скор) и `NOT_FOUND_SCORE` (лучший **визуальный** скор — текст не должен «вытягивать» непохожее вино). `confidence` — скоры Top-1 и Top-5, отрывы от второй и пятой карточки, пороги. |
| Выдача карточки | `web/server/routes/v1/wines/[slug]/`, `web/pages/wine/[slug].vue` | строка `wines` + фото каталога + `taste_passport`; мобильный интерфейс в стиле vino-svoe.ru. |
| Функция после поиска | `web/server/taste/`, `web/components/Taste*.vue`, `Aroma*.vue`, `AnalogGrid.vue` | паспорт вкуса и аналоги — см. ниже. |
| Документация API | `web/server/openapi.ts`, `/openapi.json`, `/docs` | OpenAPI 3.1, написан вручную рядом с маршрутами; тест сверяет его с файлами маршрутов. |

## Функция после поиска: паспорт вкуса и аналоги

```
wines.name + wines.description
   │ normalize.ts   очистка HTML, нижний регистр, ё→е; смещения совпадают с исходным текстом
   │ scales.ts      сладость (тихие / игристые), кислотность, танины, тело:
   │                модификатор ↔ признак в одной части фразы, отрицания, конфликты
   │ aromas.ts      135 нот в 13 семействах: длинные совпадения первыми,
   │                отсев цвета, гастросочетаний, технологии, отрицаний
   ▼
taste_passport { version, summary, scales, notes, families }  — у каждого вывода evidence (точная цитата + правило)
   │
   │ analogs.ts     профиль вина: цвет, сорта, игристое, сладость, уровни шкал, ноты
   ▼
аналоги: тот же цвет, игристое ↔ игристое, совместимая сладость, общий сорт или ≥ 2 общие ноты,
         по одному вину на винодельню, объяснение общими фактами
```

- `buildTastePassport()` — чистая детерминированная функция, без сети, БД и LLM; ~0,15 мс на вино. Источник — только название и описание: сорт, регион, slug и фото вкус не определяют.
- Профили всего каталога строятся в web один раз (~0,5 с) и держатся в памяти `TASTE_CATALOG_TTL_MS`; плагин прогревает кеш при старте.
- При `not_found` web передаёт текст этикетки из OCR в `findLabelAnalogs()`: сорт, цвет и сладость на этикетке → вина этого сорта у других производителей. Сорт не прочитан — аналогов нет. `/v1/eval/predict` этот шаг пропускает.
- Сбой анализатора → `taste_passport: null`, карточка остаётся 200; сбой аналогов не меняет ответ поиска.

## Recognition Engine — точка подключения CV

```ts
interface RecognitionEngine {
  name: string; model: string | null
  recognize(image: UploadedImage, k: number): Promise<RecognitionResult>
}
// RecognitionResult: { candidates: Candidate[], bestVisualScore: number, labelText?: string, diagnostics? }
```

- `VectorEngine` — `/analyze` + pgvector + `/rerank`; при выключенном OCR — `/embed` + pgvector.
- `StubEngine` — детерминированная заглушка (хеш картинки → реальные slug каталога) без ML и БД; для фронтенда и тестов.
- Другой способ распознавания = новый класс + строка в `getEngine()`; API и интерфейс не меняются.

Контракт ML-сервиса:

| Метод | Вход | Выход |
|---|---|---|
| `POST /analyze` | multipart `image` | `{model, embedding[], ocr: [{text, conf, cx, cy, h}], ocr_fallback?, ocr_timeout?}` |
| `POST /rerank` | `{ocr, candidates}` | `{candidates: [{…, text, conflicts, final}]}` |
| `POST /embed` | multipart `image` | `{model, dim, embedding[], embed_ms}` |
| `GET /health` | — | `{status, model, device, dim, ocr}` |

Web проверяет, что `model` ответа совпадает с `MODEL_NAME` индекса и размерность — с `EMBEDDING_DIM`; иначе 503 (защита от смешения векторов разных моделей).

## Данные и офлайн-конвейер

```
data/raw/strapi_output0709.csv + data/raw/strapi/.../uploads     (scripts/prepare_data.ps1)
   │ ml/scripts/build_catalog.py      однозначные позиции → data/catalog/{wines.jsonl, excluded.csv, images/}
   │ ml/scripts/load_catalog.py       → таблица wines
   │ ml/scripts/build_index.py        → таблица wine_embeddings (slug, model, view, vector, хеши)
   │ ml/scripts/find_twins.py         → data/catalog/twins.csv
   └ ml/scripts/evaluate.py           → reports/eval-*.md|json
```

Всё это запускает `scripts/setup.ps1` (или `setup-linux.sh`). Сопоставление: у файла Strapi отрезается `_<hash10>`, имена приводятся к общему ключу с учётом транслитераций; разрешаются однозначный снимок бутылки, повторная загрузка, повторное сжатие одного растра (проверка в полном разрешении). Общие фото нескольких slug сохраняются как `shared_photo`. Исключённые записи: `file_not_found`, `ambiguous_file`, `unreadable_image`.

`wine_embeddings` хранит модель и вид (`full`, `label_mid`, `label_low`) в ключе: можно держать индексы нескольких моделей. Хеши исходного фото и кода подготовки позволяют пропускать уже посчитанные векторы и не использовать устаревшие. «Похожие по этикетке» и поиск двойников используют только `full`.

**Двойники**: разные вина с почти одинаковым эталоном (косинус `full` ≥ 0,99) — 47 групп, 95 вин. Остаются в индексе и в оценке.

## Оценка

- **Реальная публичная**: `scripts/verify_http.py` — 100 фото через работающий API, фиксированные хеши входов, командная разметка; Top-1/Top-5, неизвестные вина, задержки. Закрытой разметки организаторов нет.
- **Контракт кейсодержателя**: неизменённый `eval/participant_test.sh` против запущенного сервиса.
- **Синтетическая** (`evaluate.py`): «полевые» копии эталонов (`augment.py`: перспектива, фон, свет, блик, размытие, JPEG) — ориентир, не реальная точность.
- **Паспорт вкуса**: покрытие на всём каталоге и ручная проверка 50 карточек — [reports/taste-passport](reports/taste-passport).
- **Автотесты**: 61 web-тест (контракт API, устойчивость, паспорт, аналоги, confidence, OpenAPI), 58 ML-тестов, 42 браузерные проверки интерфейса.

## Границы устойчивости

- Инференс — в отдельном потоке с ограниченной очередью (3 слота распознавания, 1 слот OCR); переполнение — 503, а не падение. OCR имеет таймаут; при сбое сохраняется визуальный результат.
- `/ready` проверяет модель, размерность и полное покрытие трёх видов индекса.
- Загруженные фото обрабатываются в памяти и на диск не пишутся; лимит 15 МБ и проверка сигнатуры файла.
- `CONFIDENCE_MARGIN=0.05` — эвристика отрыва, не калиброванная вероятность; `not_found` — отдельный порог визуального сходства 0,75. `/v1/eval/predict` возвращает лучший slug независимо от статуса.

## Куда расти

1. Новые размеченные фото с полок → калибровка `LABEL_WEIGHT`, `OCR_ALPHA/BETA` и порогов; сейчас «нет в каталоге» верно в 19 из 33 случаев.
2. OCR только по центральной части кадра — быстрее и меньше текста соседних бутылок.
3. Дообучение SigLIP 2 на полевых фото и отметках «не то вино».
4. Паспорт вкуса на структурных полях портала (крепость, температура, гастрономия) и цифровой сомелье поверх него.
