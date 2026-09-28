# Сканер российских вин «Своё вино»

**Команда «Бешеные свинки» · кейс РСХБ.Цифра «Сканер российских вин с описанием на платформе „Своё вино“»**

Покупатель у полки фотографирует этикетку — сервис за ~0,7 с находит вино в каталоге «Своё вино» и открывает **одну карточку**: производитель, регион, сорт, описание и «Паспорт вкуса». Если сервис не уверен — показывает «Возможно, это» и Top-5; если вина нет в каталоге — честно говорит об этом и предлагает похожие вина и аналоги из других виноделен.

Распознавание: **SigLIP 2** (бутылка + 2 зоны этикетки) → **pgvector** → переранжирование Top-10 по тексту этикетки (**EasyOCR**). Сервер и интерфейс — **Nuxt 3**, ML — **FastAPI**. Без дообучения и внешних API.

## Результат

Публичный набор организаторов — 100 полевых фото, разметка командой (закрытой разметки организаторов нет; набор использовался при разработке):

| Метрика | Значение |
|---|---|
| **Top-1** (64 фото вин из каталога) | **59 / 64 — 92,19 %** |
| **Top-5** | **64 / 64 — 100 %** |
| micro-F1 Top-1 (56 фото с единственным верным slug) | 0,9107 |
| Верный «нет в каталоге» (33 фото вин вне каталога) | 19 / 33 |
| Точность ответов со статусом «уверен» | 32 / 33 |
| Официальный `participant_test.sh`, 100 фото | 100 валидных slug, p50 / p95 — 685 / 970 мс (RTX 4060) |
| Каталог | 2 080 вин из 2 103, 6 240 векторов |

Вклад компонентов в Top-1: только изображение — 71,9 % → + чтение этикетки — 84,4 % → + сорт и смешанные алфавиты — 92,2 %. Подробности и оставшиеся ошибки: [docs/TOP1_ACCEPTANCE.md](docs/TOP1_ACCEPTANCE.md), сырые прогоны — [reports/recognition](reports/recognition). Top-5 hit rate не называется F1; `score` и отрывы — не вероятности.

![Карта ароматов и паспорт вкуса](reports/taste-passport/screenshots/rich-1440-map-open.png)

## Что умеет — по пунктам ТЗ

| Требование ТЗ | Реализация |
|---|---|
| 1. Загрузка фото с камеры или из галереи | `/` — мобильный сканер; JPEG, PNG, WebP, HEIC до 15 МБ |
| 2. Поиск по изображению (CV), OCR по желанию | SigLIP 2 → pgvector (3 вида на вино) → OCR-переранжирование Top-10 ([ARCHITECTURE.md](ARCHITECTURE.md)) |
| 3. Карточка в JSON + метрика уверенности для Top-1 и Top-5 в API | `POST /v1/search` → `top1`, `top5`, `status`, `confidence {top1, top5, gap_top2, gap_top5}`; измеренные Top-k и F1 — `GET /v1/metrics` |
| 4. Мобильная карточка в стиле «Своё Вино» + функция после поиска | `/wine/:slug`: палитра и шрифты портала, «Паспорт вкуса», аналоги, ссылка на карточку vino-svoe.ru |
| 5. Вина нет в каталоге | статус `not_found`: «похожие по этикетке» + **аналоги из других виноделен** по сорту, прочитанному на этикетке |
| 6. Скрипт кейсодержателя | `POST /v1/eval/predict` → ровно `{"slug":"..."}`; проверено неизменённым `eval/participant_test.sh` |
| Near-duplicates (серии, годы) | чтение этикетки: название, винодельня, сорт, штраф за противоречия цвета/сахара/года |
| Нормализация фото (подсказка кейсодержателя) | EXIF-поворот, обрезка полей, квадрат, зоны этикетки — одинаково для эталонов и запросов |
| SLA < 3 с | p95 0,97 с на GPU; работает и на CPU (медленнее) |
| README, ARCHITECTURE, воспроизводимость | этот файл, [ARCHITECTURE.md](ARCHITECTURE.md), установка одной командой, Docker Compose |

### Функция после поиска: «Паспорт вкуса» и аналоги

- **«Какое оно на вкус»** — сладость, кислотность, танины, тело вина: три маркера и слово, справка по термину; у игристых своя шкала (брют натюр … сладкое).
- **«Ароматы и вкусовые ноты»** — до 6 нот с оригинальными рисунками и карта из 13 семейств (колесо на ПК, список на телефоне).
- **«На чём основано»** — у каждого вывода цитата из описания карточки. Источник — только название и описание; ничего не берётся от сорта, региона или фото, нет «процентов уверенности». Нет факта — «В описании не уточнено».
- **«Похожие по вкусу — другие винодельни»** — тот же цвет и совместимый стиль, общий сорт или ноты, по одному вину на винодельню, с объяснением общими фактами: «Тот же сорт: Сира · Общие ноты: ежевика, слива».

Покрытие на всём каталоге (2 103 вина): ноты ароматов — у 2 073, аналоги — у 2 071; шкалы только по явным словам (сладость — 373, кислотность — 290, тело — 181, танины — 68). Ручная проверка 50 карточек: 0 ложных находок. Анализ — 0,15 мс на вино, без сети и LLM. Отчёт: [reports/taste-passport/REPORT.md](reports/taste-passport/REPORT.md).

## Быстрый старт (Windows 10/11 — проверено)

**Нужно:** Python 3.11+ (проверено 3.12), Node.js 20+ (проверено 24), 7-Zip, ~20 ГБ диска, NVIDIA GPU желательна (SigLIP 2 fp16 + EasyOCR ≈ 2,3 ГБ видеопамяти). Docker **не обязателен**.

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install 7zip.7zip
git clone https://github.com/Max50521/Svoyo_vino.git
cd Svoyo_vino
```

**1. Установка — один раз.** Датасет организаторов указывается архивом или распакованной папкой (в ней `strapi_output0709.csv`, `eval.zip`, `prod-svoe-vino-strapi.part1.rar`, …):

```powershell
# без Docker: PostgreSQL + pgvector в WASM (PGlite) на 127.0.0.1:5433
.\scripts\setup.ps1 -DatasetDir "C:\путь\Датасет" -PortableDb

# или с Postgres в Docker Desktop
.\scripts\setup.ps1 -DatasetZip "C:\путь\Датасет.zip"

# без NVIDIA GPU добавьте -Cpu
```

Скрипт распаковывает данные, ставит зависимости, собирает web, сопоставляет каталог с фото, строит индекс (первый запуск скачивает SigLIP 2 ≈ 4,5 ГБ и EasyOCR ≈ 100 МБ; индекс на RTX 4060 — ~10 минут) и готовит OCR для работы офлайн. Повторный запуск безопасен: уже посчитанные векторы пропускаются. Если PowerShell запрещает запуск скриптов: `Set-ExecutionPolicy -Scope Process Bypass`.

**2. Запуск и остановка:**

```powershell
.\scripts\start-local.ps1      # ждёт /ready, затем открыть http://127.0.0.1:8080
.\scripts\stop-local.ps1
```

**3. Проверка:**

```bash
curl -F image=@eval/queries/019c68d0.jpg http://127.0.0.1:8080/v1/eval/predict   # {"slug":"..."}
curl -F image=@eval/queries/019c68d0.jpg http://127.0.0.1:8080/v1/search
curl http://127.0.0.1:8080/ready
```

**Скрипт кейсодержателя** (Git Bash, нужен `jq`: `winget install jqlang.jq`):

```bash
cd eval
bash participant_test.sh --images-dir ./queries --manifest ./queries.tsv \
  --endpoint http://127.0.0.1:8080/v1/eval/predict --output predictions.jsonl
```

Журналы процессов — `data/runtime`. Если `jq` установлен через winget, но Git Bash его не видит, добавьте папку `%LOCALAPPDATA%\Microsoft\WinGet\Packages\jqlang.jq_*` в `PATH`.

### Docker Compose

Индекс строится один раз шагом установки (`setup.ps1` без `-PortableDb`), затем:

```bash
docker compose --profile full up -d --build                                                 # ml на CPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml --profile full up -d --build   # ml на GPU
```

### Ubuntu / Debian — подготовлено, не проверено на реальной машине

```bash
cp .env.example .env
bash scripts/setup-linux.sh --cuda /absolute/path/dataset.zip    # или --cpu
bash scripts/start-linux.sh
```

Нужны Python 3.12, Node 24, Docker Engine + Compose v2, `7zz` с поддержкой RAR. Подробности — [docs/VERIFIED_RUN.md](docs/VERIFIED_RUN.md).

### Только интерфейс, без модели

`.\scripts\dev.ps1 -Stub` — web с детерминированной заглушкой вместо распознавания (для фронтенда; карточкам нужна БД).

## API

| Метод | Путь | Ответ |
|---|---|---|
| `POST` | `/v1/eval/predict` (multipart `image`) | `{"slug": "..."}` — контракт скрипта кейсодержателя |
| `POST` | `/v1/search` (multipart `image`) | `{top1, top5: [{slug, name, winery, score, visual, text, image_url}], margin, confident, status, confidence, engine, model, latency_ms}`; при `not_found` — ещё `analogs`, `label_hints` |
| `GET` | `/v1/wines/:slug` | карточка: `slug, name, category, color, region, grapes, description, winery, image_url, taste_passport` |
| `GET` | `/v1/wines/:slug/analogs?limit=6` | аналоги из других виноделен: `[{slug, name, winery, score, reasons[], image_url}]` |
| `GET` | `/v1/wines/:slug/similar?limit=8` | похожие по визуальному сходству эталонов |
| `GET` | `/v1/wines/:slug/image` | фото из каталога |
| `GET` | `/v1/metrics` | измеренное качество (Top-1, Top-5, F1, not_found, задержка) с описанием набора данных |
| `GET` | `/health`, `/ready` | состояние; `/ready` — модель, размерность и полный индекс совпадают |

- `status`: `confident` — одна карточка; `uncertain` — карточка + «Не то вино?»; `not_found` — лучший **визуальный** скор ниже `NOT_FOUND_SCORE`.
- `confidence` — метрика уверенности каждого ответа: `top1` (скор первой карточки), `top5` (скоры пятёрки), `gap_top2` / `gap_top5` (отрыв от второй / пятой), `visual_top1`, пороги. Это значения ранжирования, не вероятность и не F1.
- `score` = визуальное сходство + бонус за совпадение текста этикетки; `visual`, `text` — составляющие.
- Ошибки: `{"error": "..."}` — 400 (нет `image` или не картинка), 404, 413 (> 15 МБ), 503 (ML или БД недоступны, очередь переполнена).
- `taste_passport`: `{version, summary, scales: {sweetness, acidity, tannin, body}, notes, families}`; шкала — `{state: known|unknown|conflict, level, label, descriptor, evidence[]}`; evidence — `{field, quote, start, end, rule}`. При сбое анализатора — `null`, карточка открывается как обычно.

## Переменные окружения

Шаблон — [.env.example](.env.example); `setup.ps1` создаёт `.env` сам.

| Переменная | По умолчанию | Где | Смысл |
|---|---|---|---|
| `ENGINE` | `vector` | web | `vector` — реальный поиск, `stub` — заглушка |
| `ML_URL` | `http://127.0.0.1:8001` | web | адрес ML-сервиса |
| `DATABASE_URL` | `postgresql://wine:wine@localhost:5432/wine` | web, ml | Postgres; с `-PortableDb` — `postgresql://postgres@127.0.0.1:5433/postgres` |
| `DB_POOL_MAX` | `5` | web | пул соединений; для PGlite — `1` |
| `MODEL_NAME` | `google/siglip2-so400m-patch14-384` | web, ml | модель; web ищет только по векторам этой модели |
| `EMBEDDING_DIM` | `1152` | web | размерность векторов модели |
| `DEVICE` | `auto` | ml | `auto` / `cuda` / `cpu` |
| `CONFIDENCE_MARGIN` | `0.05` | web | отрыв Top-1 от Top-2 для статуса `confident` |
| `NOT_FOUND_SCORE` | `0.75` | web | лучший визуальный скор ниже — «нет в каталоге» |
| `LABEL_WEIGHT` | `0.5` | web | скор вина = (1 − w) · бутылка + w · лучшая зона этикетки |
| `OCR_ENABLED` | `1` | web, ml | переранжирование по тексту этикетки (`0` — только изображение) |
| `RERANK_K` | `10` | web | сколько визуальных кандидатов переранжировать |
| `OCR_ALPHA` / `OCR_BETA` | `0.1` / `0.05` | ml | final = visual + α · совпадение текста − β · противоречия |
| `OCR_PROVIDER` | `easyocr` | ml | `easyocr` (локально) или `yandex` (Yandex Vision OCR, облако, платно) |
| `YC_OCR_API_KEY`, `YC_FOLDER_ID` | — | ml | ключ и каталог Yandex Cloud для `OCR_PROVIDER=yandex` |
| `OCR_TIMEOUT_S` | `3` | ml | OCR не успел — ответ только по изображению |
| `ML_TIMEOUT_MS` | `8000` | web | таймаут запроса к ML |
| `HF_HOME`, `EASYOCR_MODULE_PATH` | `data/model-cache`, `data/easyocr` | ml | где лежат веса (задаёт `setup.ps1`) |
| `CATALOG_IMAGES_DIR` | `data/catalog/images` | web | фото каталога |
| `TASTE_CATALOG_TTL_MS` | `600000` | web | как часто пересобирать профили вкуса каталога для аналогов |

## Архитектура

```
фото ─► web (Nuxt/Nitro :8080) ─► ml (FastAPI :8001): нормализация → SigLIP 2 ‖ EasyOCR
            │
            ├─ pgvector: Top-10 по бутылке и зонам этикетки  ◄─ PostgreSQL / PGlite
            ├─ ml /rerank: Top-10 + текст этикетки → Top-5, статус, confidence
            └─ карточка: паспорт вкуса (анализ описания) + аналоги (профили каталога в памяти)
```

Слои и их границы — нормализация фото, извлечение признаков, поиск, выдача карточки, функция после поиска: [ARCHITECTURE.md](ARCHITECTURE.md).

| Папка | Что |
|---|---|
| `web/` | Nuxt 3: API, интерфейс; `server/taste/` — паспорт вкуса и аналоги |
| `ml/` | FastAPI-сервис (SigLIP 2, EasyOCR), скрипты каталога, индекса и оценки |
| `db/` | схема PostgreSQL + pgvector и миграции |
| `tools/local-db/` | PGlite: PostgreSQL + pgvector без Docker |
| `eval/` | набор кейсодержателя: `participant_test.sh`, `queries.tsv`, 3 фото; разметка реальных фото |
| `scripts/` | установка, запуск, остановка, проверки |
| `reports/` | результаты прогонов, покрытие паспорта, скриншоты |
| `docs/` | приёмка, проверенный запуск, продуктовое решение, текст выступления, презентация |
| `data/` | датасет, веса, индекс, журналы — не в Git |

## Данные

`build_catalog.py` сопоставляет вина CSV с фото выгрузки Strapi: из 2 103 slug в индексе **2 080** (точное имя — 2 015, снимок бутылки среди баннеров — 19, новейшая перезагрузка — 19, общее фото нескольких вин — 24, повторное сжатие — 2, нечёткое совпадение — 1). Исключено 23: 15 без файла, 8 неоднозначных (`data/catalog/excluded.csv`). 47 групп двойников (95 вин с почти одинаковыми эталонами) остаются в индексе. На вино 3 вектора: бутылка целиком и две зоны этикетки.

## Проверки

```powershell
cd web; npm test                                     # 58 тестов: контракт API, устойчивость, паспорт, аналоги, confidence
cd web; npm run typecheck; npm run build
ml\.venv\Scripts\python -m pytest ml\tests -q        # 58 тестов ML: нормализация, каталог, OCR, сервис
ml\.venv\Scripts\python scripts\verify_contract.py   # 20 проверок живого HTTP-контракта
ml\.venv\Scripts\python scripts\verify_http.py       # 100 реальных фото через API (нужны eval/real/photos)
cd web; node scripts/taste-browser-check.mjs         # 42 браузерные проверки интерфейса (Chrome/Edge)
cd web; npx vitest run -c vitest.scripts.config.ts   # покрытие паспорта на полном каталоге
```

Реальные фото публичного набора в Git не входят: `setup.ps1` распаковывает их из датасета в `eval/real/photos`; разметка — `eval/real/labels.tsv`.

## Ограничения

- Все точности — на публичном наборе с командной разметкой; закрытой оценки ещё не было.
- «Нет в каталоге» верно в 19 из 33 случаев: часть неизвестных вин похожа на вина каталога. 5 ошибок Top-1 — близкие вина одной линейки; верный ответ во всех случаях есть в Top-5.
- Аналоги для вина вне каталога появляются, только если OCR прочитал сорт на этикетке (на публичных фото — 2 из 25 ответов `not_found`).
- Шкалы вкуса заполнены только там, где описание говорит об этом явно; рейтинга Роскачества и гастросочетаний нет в данных — ссылка ведёт на полную карточку портала.
- Проверенный стенд — Windows + GPU; Linux и Docker подготовлены, но не прогонялись на реальной машине.

## Команда

Владислав Новиков — капитан, бизнес-модель · Виолетта Феофанова — анализ данных · Екатерина Алесинская — продукт · Станислав Космынин — ML · Максим Космынин — backend.

## Документы

[ARCHITECTURE.md](ARCHITECTURE.md) · [приёмка Top-1](docs/TOP1_ACCEPTANCE.md) · [проверенный запуск](docs/VERIFIED_RUN.md) · паспорт вкуса: [отчёт](reports/taste-passport/REPORT.md), [покрытие](reports/taste-passport/coverage.md), [ручная проверка](reports/taste-passport/manual-review.md) · [продуктовое решение](docs/PRODUCT_DECISION.md) · [текст выступления](docs/PITCH.md) · [презентация](docs/presentation.pdf)
