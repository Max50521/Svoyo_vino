# Сканер вина — проверенный локальный запуск

Состояние после улучшения Top-1, 28.09.2026: реальный SigLIP 2 + EasyOCR, PostgreSQL/pgvector, 2080 карточек и 6240 векторов. Top-1 59/64 (92,19%), Top-5 64/64. Новые функции кислотности и иллюстраций вкуса не добавлены. Свежие доказательства — `reports/recognition`, прежний исходный прогон — `reports/verification/ocr-rows.json`.

## Windows без Docker — проверено с нуля 28.09.2026

Из корня проекта (RTX 4060, Python 3.12, Node 24, 7-Zip):

```powershell
.\scripts\setup.ps1 -DatasetDir "C:\путь\Датасет" -PortableDb   # один раз; или -DatasetZip "...\Датасет.zip"
.\scripts\start-local.ps1                                       # Node и PGlite находятся сами
.\scripts\stop-local.ps1
```

Открыть http://127.0.0.1:8080. Скрипт запускает процессы скрыто, ожидает `/ready`, повторный запуск не создаёт копии слушающих серверов. Уже настроены `.env`, `ml/.venv`, `web/.output`, веса в `data/model-cache` и `data/easyocr`, каталог и база `data/local-pg`. Журналы и PID находятся в `data/runtime`. Большие данные и `.env` не входят в Git.

База здесь — PGlite: настоящий PostgreSQL, скомпилированный в WASM, pgvector 0.8.1 и TCP-адаптер. Это локальный стенд; результат не подтверждает Docker-развёртывание или поведение обычного PostgreSQL при высокой конкуренции. Для PGlite оставить `DB_POOL_MAX=1` и порт 5433. Не запускать два процесса с одной папкой БД.

## На другой машине

Рекомендуемый основной путь команды — PostgreSQL из `docker-compose.yml`, Python 3.12, Node 24, CUDA 12.8 при NVIDIA GPU. Docker в этой проверке не запускался. Скопировать `.env.example` в `.env`, настроить одинаковые MODEL_NAME, EMBEDDING_DIM, DATABASE_URL у всех компонентов; для текущей модели размерность 1152.

```powershell
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r requirements-windows-tested.txt --extra-index-url https://download.pytorch.org/whl/cu128
cd web
npm ci
npm run typecheck
npm test
npm run build
cd ..
docker compose up -d --wait db
ml/.venv/Scripts/python ml/scripts/build_catalog.py
ml/.venv/Scripts/python ml/scripts/load_catalog.py
ml/.venv/Scripts/python ml/scripts/build_index.py --batch 8
.\scripts\start-local.ps1
```

Снимок Python-зависимостей проверен только на Windows GPU. На Linux использовать `pip install -e 'ml[dev]'`, затем отдельно зафиксировать и проверить своё окружение. Для CPU понадобятся CPU wheels PyTorch и новое измерение скорости.

Альтернатива без Docker для локальной разработки: `cd tools/local-db; npm ci; cd ../..`, в `.env` задать `DATABASE_URL=postgresql://postgres@127.0.0.1:5433/postgres` и `DB_POOL_MAX=1`. Перед load_catalog/build_index запустить `node tools/local-db/server.mjs` в отдельном процессе. После индексации использовать `start-local.ps1 -PortableDb`. Эту альтернативу проверили здесь, включая остановку и повторный запуск БД.

`prepare_data.ps1 -DatasetZip ... -SevenZipPath ...` позволяет указать переносимый 7-Zip. Результат распаковки нужно проверить; исходный RAR имеет предупреждение о хвостовых данных, извлечены 15803 файла. build_catalog.py учитывает длинные Windows-пути.

## Повторить приёмку

```powershell
ml/.venv/Scripts/python -m pytest ml/tests -q --basetemp data/pytest-local
ml/.venv/Scripts/python scripts/verify_contract.py
ml/.venv/Scripts/python scripts/verify_http.py --tag ocr-repeat
ml/.venv/Scripts/python scripts/verify_load.py
```

`verify_http.py` требует все 100 фото в `eval/real/photos` и существующую `labels.tsv`. Результаты пишутся в `reports/verification`. Разметка командная, не официальный ответ организаторов. Нагрузочный тест специально создаёт 12 одновременных запросов: часть получает 503 из-за ограниченной очереди; запускать отдельно от замера последовательной задержки.

Для сравнения без OCR изменить `OCR_ENABLED=0` только у процесса web, перезапустить web, выполнить `verify_http.py --tag visual-repeat`, затем вернуть 1 и перезапустить web. Изменение `.env` не меняет уже запущенные процессы.

Официальный скрипт: из `eval` запустить `bash participant_test.sh --images-dir ./queries --manifest ./queries.tsv --endpoint http://127.0.0.1:8080/v1/eval/predict --output predictions-new.jsonl`; нужны bash, curl, jq, awk. Не перезаписывать существующий файл результатов.

## Контрольные результаты

- 58 Python-тестов и 21 web-тест; production build и Vue/TypeScript без ошибок.
- 20 проверок живого HTTP-контракта; официальный скрипт — 100/100 ответов JSON со slug, Top-1 59/64.
- Два новых HTTP-прогона по 100 фото с OCR: 100/100 HTTP 200, Top-1 59/64, Top-5 64/64 в обоих.
- Финальный прогон: p50 683.9 ms, p95 874.5 ms, максимум 965 ms. Через официальный скрипт: p95 937 ms.
- Исходное сравнение до изменения OCR: с OCR 54/64, без OCR 46/64. Эти цифры относятся к прежнему каталогу 2076 вин.
- Неизвестные вина: верное not_found 19/33. При CONFIDENCE_MARGIN=0.05 среди 35 уверенных ответов с однозначной разметкой верны 33; ещё один уверенный ответ имеет спорную разметку. Не обещать «100% точности уверенных ответов».
- Совокупное правильное решение интерфейса: 74/97 (76.29%); 3 спорных фото не оцениваются по точности, но проходят технический прогон.

Подробные ответы, SHA-256 входных фото, времена, скриншоты и результаты отказов находятся в `reports/verification`. Старые таблицы в `reports/ACCURACY.md` и `docs/PRESENTATION.md` не заменяют этот свежий прогон.
