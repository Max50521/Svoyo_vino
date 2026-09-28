# Сканер вин «Своё вино»

Готовое задание для Claude на вкусовой профиль и визуальную карту ароматов: [docs/CLAUDE_TASTE_FEATURES_PROMPT.md](docs/CLAUDE_TASTE_FEATURES_PROMPT.md). Включает дизайн по референсам Wine Folly, правила достоверности, этапы реализации и приёмку; рядом находятся четыре настоящих примера метаданных каталога.

Итоговое продуктовое решение и ТЗ на «Паспорт вкуса»: [docs/PRODUCT_DECISION.md](docs/PRODUCT_DECISION.md). Черновое сравнение пяти направлений сохранено в [docs/FEATURE_ROADMAP.md](docs/FEATURE_ROADMAP.md).

## Проверенный результат — 28 сентября 2026

**Top-1: 59/64 (92,19%). Top-5: 64/64 (100%).** Все 100 публичных фото получили HTTP 200. Неизменённый скрипт организаторов на всех 100 фото также дал 59/64 правильных ответов, 100 валидных slug и p95 937 мс на RTX 3060 Ti. Каталог: **2080 вин, 6240 векторов**.

Разметка командная; публичный набор использовался при разработке. Это не закрытая оценка организаторов. Из 100 фото: 64 известных вина (у 8 заранее задан набор допустимых slug), 33 вне каталога, 3 спорных. На 56 фото с единственным slug: **51/56 — 91,07%**, micro-F1 0,9107. Top-5 hit rate не называется F1, а score/margin не являются вероятностью правильного ответа. Доказательства: [отчёт приёмки](docs/TOP1_ACCEPTANCE.md), [reports/recognition](reports/recognition). Старые материалы презентации и старые сводки не заменяют эти измерения.

### Ubuntu / Debian

**Подготовлено, но не проверено на настоящем Linux:** доступной Linux-машины нет. Проверенный локальный стенд работает на Windows с PGlite/PostgreSQL WASM. Требования: Python 3.12 + venv, Node 24 + npm, Docker Engine + Compose v2, официальный `7zz` с поддержкой RAR, исходный архив организаторов. Для CUDA — подходящий NVIDIA-драйвер. Планировать не менее 20 ГБ свободного места под данные, веса, зависимости и сборки.

В свежей копии репозитория:

```bash
cp .env.example .env
bash scripts/setup-linux.sh --cuda /absolute/path/dataset.zip
# Без GPU вместо предыдущей команды: bash scripts/setup-linux.sh --cpu /absolute/path/dataset.zip
bash scripts/start-linux.sh
```

Скрипт готовит данные, БД, каталог, индекс и web-сборку; `/ready` должен вернуть `ready=true`. Нельзя переносить `.env` с абсолютными Windows-путями. Сначала скачиваются веса и строится индекс; последующее распознавание локальное. Журналы — `data/runtime`. На подготовленном Windows-компьютере: `scripts/start-local.ps1 -PortableDb -NodeExe "путь/node.exe"`. Подробности: [docs/VERIFIED_RUN.md](docs/VERIFIED_RUN.md).

Официальные источники инструментов: [7-Zip](https://www.7-zip.org/download.html), [порядок запуска Compose](https://docs.docker.com/compose/how-tos/startup-order/).

Фото бутылки/этикетки → поиск по каталогу «Своё вино» → slug вина, Top-5 кандидатов со скорами и карточка.
Кейс РСХБ.Цифра «Сканер российских вин с описанием на платформе „Своё вино“».

Распознавание: SigLIP 2 (бутылка + зоны этикетки) → pgvector → OCR-переранжирование Top-10 по тексту этикетки; без дообучения.
Устройство — в [ARCHITECTURE.md](ARCHITECTURE.md). Что сделано для точности и идеи — в [docs/PRESENTATION.md](docs/PRESENTATION.md).

## Состав

| Папка | Что |
|---|---|
| `web/` | Nuxt 3 (Nitro): публичный API и mobile-first интерфейс (сканер + карточка вина) на :8080 |
| `ml/` | Python: сервис эмбеддингов (FastAPI, :8001), скрипты каталога/индекса/оценки |
| `db/init.sql` | схема Postgres + pgvector |
| `eval/` | набор кейсодержателя: `participant_test.sh`, `queries.tsv`, 3 фото |
| `scripts/` | `setup.ps1`, `dev.ps1`, `prepare_data.ps1` |
| `data/` | датасет и артефакты (не в git) |
| `reports/` | отчёты оценки |

## Требования

Windows + PowerShell, Python 3.11+, Node 20+, Docker Desktop, 7-Zip (для распаковки датасета).
GPU NVIDIA желательна: визуальная часть SigLIP 2 so400m в fp16 ~0.9 ГБ VRAM, вместе с EasyOCR ~2.3 ГБ; без GPU работает на CPU медленнее.
Для скрипта кейсодержателя: Git Bash + `jq` (`winget install jqlang.jq`).

## Быстрый старт

```powershell
# 1. один раз: распаковать датасет, поставить зависимости, собрать каталог и индекс
.\scripts\setup.ps1 -DatasetZip "C:\путь\Датасет.zip"     # добавьте -Cpu без NVIDIA GPU

# 2. запуск: Postgres в docker, ml и web локально
.\scripts\dev.ps1            # http://127.0.0.1:8080
.\scripts\dev.ps1 -Stub      # только API с заглушкой (без модели) — для фронтенда
```

Проверка:

```bash
curl -F image=@eval/queries/019c68d0.jpg http://127.0.0.1:8080/v1/eval/predict
curl -F image=@eval/queries/019c68d0.jpg http://127.0.0.1:8080/v1/search
curl http://127.0.0.1:8080/health
```

Весь стек в docker (индекс должен быть уже построен шагом 1):

```bash
docker compose --profile full up -d --build
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile full up -d --build   # ml на GPU
```

## API

| Метод | Путь | Ответ |
|---|---|---|
| `POST` | `/v1/eval/predict` (multipart `image`) | `{"slug": "..."}` — контракт скрипта кейсодержателя |
| `POST` | `/v1/search` (multipart `image`) | `{top1, top5: [{slug, name, winery, score, image_url}], margin, confident, status, engine, model, latency_ms}` |
| `GET` | `/v1/wines/:slug` | карточка: `slug, name, category, color, region, grapes, description, winery, image_url` |
| `GET` | `/v1/wines/:slug/image` | фото из каталога |
| `GET` | `/v1/wines/:slug/similar?limit=8` | похожие вина по визуальному сходству эталонов |
| `GET` | `/health` | `{status, engine, model, db: {wines, indexed}, ml}` |

Ошибки: `{"error": "..."}` — 400 (нет `image`, не картинка), 404, 413 (>15 МБ), 503 (ml/БД недоступны).
`score` — итоговый скор (визуальное сходство + бонус за совпадение текста этикетки); у кандидатов также `visual` и `text` (доля названия, подтверждённая OCR); `margin` — отрыв Top-1 от Top-2; `confident` — `margin ≥ CONFIDENCE_MARGIN`.
`status`: `confident` (одна карточка), `uncertain` (карточка + «Не то вино?» раскрыто), `not_found` (score₁ < `NOT_FOUND_SCORE` — «нет в каталоге» + похожие).

## Интерфейс

`/` — сканер (камера/галерея), `/wine/:slug` — карточка в стиле vino-svoe.ru: фото, характеристики, описание, «Не то вино?» (остальные кандидаты), «Похожие вина».

## Переменные окружения

| Переменная | По умолчанию | Где | Смысл |
|---|---|---|---|
| `ENGINE` | `vector` | web | `vector` — реальный поиск, `stub` — заглушка |
| `ML_URL` | `http://127.0.0.1:8001` | web | адрес ml-сервиса |
| `DATABASE_URL` | `postgresql://wine:wine@127.0.0.1:5432/wine` | web, ml | Postgres |
| `MODEL_NAME` | `google/siglip2-so400m-patch14-384` | web, ml | модель; web ищет только по векторам этой модели |
| `DEVICE` | `auto` | ml | `auto` / `cuda` / `cpu` |
| `CONFIDENCE_MARGIN` | `0.05` | web | консервативный порог отрыва для `confident`; не вероятность |
| `NOT_FOUND_SCORE` | `0.75` | web | лучший визуальный скор ниже — «нет в каталоге» (подобран на реальных фото: чётные — подбор, нечётные — проверка) |
| `LABEL_WEIGHT` | `0.5` | web | score вина = (1 − w)·бутылка + w·лучшая зона этикетки |
| `OCR_ENABLED` | `1` | web, ml | OCR-переранжирование Top-K по тексту этикетки (`0` — только картинка) |
| `RERANK_K` | `10` | web | сколько визуальных кандидатов переранжировать |
| `OCR_ALPHA` / `OCR_BETA` | `0.1` / `0.05` | ml | final = visual + α·совпадение текста − β·противоречия (цвет, сахар, год) |
| `OCR_PROVIDER` | `easyocr` | ml | `easyocr` (локально) или `yandex` (Yandex Vision OCR, облако) |
| `YC_OCR_API_KEY`, `YC_FOLDER_ID` | — | ml | ключ и каталог Yandex Cloud для `OCR_PROVIDER=yandex` |
| `OCR_TIMEOUT_S` | `3` | ml | если OCR не успел — ответ только по картинке (запрос не падает по таймауту) |
| `ML_TIMEOUT_MS` | `8000` | web | таймаут запроса к ml |
| `CATALOG_IMAGES_DIR` | `../data/catalog/images` | web | фото каталога |
| `HF_HUB_OFFLINE` | — | ml | `1` — не ходить в сеть за моделью (после первой загрузки) |

### Yandex Vision OCR вместо EasyOCR

1. В [консоли Yandex Cloud](https://console.yandex.cloud) создайте (или выберите) каталог — его ID нужен как `YC_FOLDER_ID`.
2. Создайте сервисный аккаунт с ролью `ai.vision.user`, для него — **API-ключ**.
3. Задайте переменные и перезапустите ml-сервис:

```powershell
$env:OCR_PROVIDER = "yandex"; $env:YC_OCR_API_KEY = "<ключ>"; $env:YC_FOLDER_ID = "<id каталога>"
.\scripts\dev.ps1
```

`GET http://127.0.0.1:8001/health` покажет `"ocr": "yandex"`. Ключ не храните в репозитории (`.env` в `.gitignore`).
Если облако недоступно, сервис не падает — отвечает только по картинке (в логе `[yandex-ocr] request failed`).
Сравнить движки на синтетике: `OCR_PROVIDER=yandex evaluate.py --limit 300 --hires --ocr` (кэш OCR хранится отдельно для каждого провайдера). Сервис платный (тарифицируется за запрос).

## Данные

`setup.ps1` → `build_catalog.py` сопоставляет вина CSV с фото из выгрузки Strapi:
из 2103 slug в CSV — **2080 в индексе**. Как найдено фото — поле `mapping` в `wines.jsonl`:
`exact` 2015; `product_shot` 19 (общее имя вроде `Screenshot_7` у баннеров и фото мероприятий — берётся единственный снимок бутылки на белом фоне);
`newest_reupload` 19 (одна бутылка загружена несколько раз — берётся новейший файл); `shared_photo` 24 (одно фото на несколько вин);
`equivalent_reencode` 2 (повторное сжатие того же снимка, проверка пикселей полного разрешения); `fuzzy` 1. Имена сравниваются с учётом разных транслитераций Strapi (`belyj`/`belyy`, `Lvicza`, `ovoshhi`).
Исключено 23 (15 — файл не найден, 8 — неоднозначное соответствие), список — `data/catalog/excluded.csv`.

**Двойники** (`ml/scripts/find_twins.py` → `data/catalog/twins.csv`): 95 вин в 47 группах близких эталонов (косинус ≥ 0.99). Некоторые имеют идентичные фотографии разных slug. Они остаются в индексе; из 64 известных фото свежего HTTP-прогона такие случаи не исключаются.

**Индекс**: на каждое вино 3 вектора — бутылка целиком (`full`) и две зоны этикетки (`label_mid`, `label_low`); score вина = 0.5 · сходство с бутылкой + 0.5 · лучшее сходство с зоной этикетки (`LABEL_WEIGHT`). Базу, созданную раньше, обновляет `db/migrations/002_views.sql` (`setup.ps1` применяет её сам).

## Оценка

```powershell
# синтетика: «полевые» копии эталонов, Top-1/Top-5, near-duplicates и двойники отдельно
ml\.venv\Scripts\python ml\scripts\evaluate.py --tag multiview
# только вид full — сравнение с baseline на тех же запросах (эмбеддинги запросов кэшируются)
ml\.venv\Scripts\python ml\scripts\evaluate.py --views full --tag baseline
# реальные размеченные фото (TSV: image_path<TAB>slug, "-" = вина нет в каталоге) — протокол съёмки: eval/real/README.md
ml\.venv\Scripts\python ml\scripts\photo_checklist.py        # чек-лист вин для съёмки (data/photo_kit/checklist.html)
ml\.venv\Scripts\python ml\scripts\evaluate.py --labels eval\real\labels.tsv --images-dir eval\real\photos --ocr --tag real
# глазами: каждое фото + Top-5 эталонов (нужен запущенный сервис)
ml\.venv\Scripts\python ml\scripts\contact_sheet.py --dir eval\queries
```

Скрипт кейсодержателя (Git Bash, сервис запущен):

```bash
bash eval/participant_test.sh --images-dir eval/queries --manifest eval/queries.tsv --output reports/predictions.jsonl
```

Результаты — в `reports/`.

## Тесты

```powershell
cd ml;  .venv\Scripts\python -m pytest     # нормализация, сопоставление каталога, /embed, аугментации
cd web; npx vitest run                     # контракт API на stub-движке
```

## Ограничения

- Публичный набор: 100 полевых фото с командной разметкой; исходный пример скрипта содержит 3 фото. Независимой закрытой оценки пока нет.
- Near-duplicates (одна этикетка, разный год/категория) визуально почти неразличимы — их добивает OCR-переранжирование; его реальный эффект можно измерить только на размеченных фото.
- С OCR ответ ~1.2 с (без OCR ~0.75 с); OCR-модели (~100 МБ) качаются при `setup.ps1`.
- 23 позиции каталога не сопоставлены с фото (см. `excluded.csv`); одинаковые эталоны разных вин остаются ограничением точного распознавания.
- Первый запуск качает модель (~4.5 ГБ) с Hugging Face.
