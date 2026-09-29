// OpenAPI 3.1 description of the public API, served at /openapi.json and rendered at /docs.
// Kept by hand next to the routes so it states exactly what they return (see tests/openapi.test.ts).

const image = { type: 'object', required: ['image'], properties: { image: { type: 'string', format: 'binary', description: 'Фото этикетки или бутылки: JPEG, PNG, WebP, HEIC; до 15 МБ' } } }
const multipart = { required: true, content: { 'multipart/form-data': { schema: image } } }
const slug = { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'le-k2-kamenolomnya-sira-krasnoe-suhoe-145' }
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: object, description: string) => ({ description, content: { 'application/json': { schema } } })
const err = (description: string) => json(ref('Error'), description)

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Сканер российских вин «Своё вино» — API',
    version: '1.1.0',
    description: [
      'Фото этикетки → вино из каталога «Своё вино» (SigLIP 2 + pgvector + чтение этикетки EasyOCR).',
      'Контракт скрипта кейсодержателя — `POST /v1/eval/predict` → `{"slug": "..."}`.',
      '`confidence` в `/v1/search` — значения ранжирования (скоры и отрывы), не вероятность и не F1; измеренное качество — `GET /v1/metrics`.',
      'Репозиторий: https://github.com/Max50521/Svoyo_vino',
    ].join('\n\n'),
  },
  tags: [
    { name: 'Распознавание' },
    { name: 'Карточка вина' },
    { name: 'Служебное' },
  ],
  paths: {
    '/v1/eval/predict': {
      post: {
        tags: ['Распознавание'],
        summary: 'Лучший slug для фото (контракт скрипта кейсодержателя)',
        requestBody: multipart,
        responses: {
          200: json({ type: 'object', required: ['slug'], additionalProperties: false, properties: { slug: { type: 'string' } } }, 'Ровно одно поле slug'),
          400: err('Нет поля image или файл — не изображение'),
          413: err('Файл больше 15 МБ'),
          503: err('ML-сервис или база недоступны, очередь распознавания переполнена'),
        },
      },
    },
    '/v1/search': {
      post: {
        tags: ['Распознавание'],
        summary: 'Top-1, Top-5, статус и уверенность; при «нет в каталоге» — аналоги по сорту с этикетки',
        requestBody: multipart,
        responses: {
          200: json(ref('SearchResult'), 'Результат распознавания'),
          400: err('Нет поля image или файл — не изображение'),
          413: err('Файл больше 15 МБ'),
          503: err('ML-сервис или база недоступны'),
        },
      },
    },
    '/v1/wines/{slug}': {
      get: {
        tags: ['Карточка вина'],
        summary: 'Карточка вина с «Паспортом вкуса»',
        parameters: [slug],
        responses: { 200: json(ref('Wine'), 'Карточка'), 404: err('Вина нет в каталоге'), 503: err('База недоступна') },
      },
    },
    '/v1/wines/{slug}/analogs': {
      get: {
        tags: ['Карточка вина'],
        summary: 'Аналоги из других виноделен по паспорту вкуса',
        parameters: [slug, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12, default: 6 } }],
        responses: { 200: json({ type: 'array', items: ref('Analog') }, 'По одному вину на винодельню, с объяснением общими фактами'), 404: err('Вина нет в каталоге'), 503: err('База недоступна') },
      },
    },
    '/v1/wines/{slug}/similar': {
      get: {
        tags: ['Карточка вина'],
        summary: 'Похожие по визуальному сходству эталонов',
        parameters: [slug, { name: 'limit', in: 'query', schema: { type: 'integer', default: 8 } }],
        responses: { 200: json({ type: 'array', items: ref('WineShort') }, 'Похожие вина'), 503: err('База недоступна') },
      },
    },
    '/v1/wines/{slug}/image': {
      get: {
        tags: ['Карточка вина'],
        summary: 'Фото вина из каталога',
        parameters: [slug],
        responses: { 200: { description: 'Изображение', content: { 'image/*': {} } }, 404: err('Нет фото') },
      },
    },
    '/v1/metrics': {
      get: {
        tags: ['Служебное'],
        summary: 'Измеренное качество: Top-1, Top-5, F1, not_found, задержка — с описанием набора данных',
        responses: { 200: json({ type: 'object' }, 'Результаты приёмки (docs/TOP1_ACCEPTANCE.md)') },
      },
    },
    '/health': { get: { tags: ['Служебное'], summary: 'Состояние сервиса, ML и базы', responses: { 200: json({ type: 'object' }, 'Состояние') } } },
    '/ready': { get: { tags: ['Служебное'], summary: 'Готовность: модель, размерность и полный индекс совпадают', responses: { 200: json({ type: 'object', properties: { ready: { type: 'boolean' } } }, 'Готов'), 503: json({ type: 'object' }, 'Не готов') } } },
  },
  components: {
    schemas: {
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
      WineShort: {
        type: 'object',
        required: ['slug', 'name', 'image_url'],
        properties: {
          slug: { type: 'string' }, name: { type: 'string' }, winery: { type: ['string', 'null'] },
          score: { type: 'number', description: 'итоговый скор: визуальное сходство + бонус за совпадение текста этикетки' },
          visual: { type: 'number', description: 'визуальное сходство с эталоном' },
          text: { type: 'number', description: 'доля названия и винодельни, подтверждённая текстом этикетки (0..1)' },
          image_url: { type: 'string' },
        },
      },
      Confidence: {
        type: 'object',
        description: 'Метрика уверенности для Top-1 и Top-5 в каждом ответе. Значения ранжирования, не вероятность.',
        properties: {
          top1: { type: 'number', description: 'скор первой карточки' },
          top5: { type: 'array', items: { type: 'number' }, description: 'скоры пятёрки по убыванию' },
          gap_top2: { type: ['number', 'null'], description: 'отрыв Top-1 от Top-2' },
          gap_top5: { type: ['number', 'null'], description: 'отрыв Top-1 от последней карточки пятёрки' },
          visual_top1: { type: 'number', description: 'лучшее визуальное сходство; ниже not_found_score — «нет в каталоге»' },
          thresholds: { type: 'object', properties: { confidence_margin: { type: 'number' }, not_found_score: { type: 'number' } } },
        },
      },
      Analog: {
        type: 'object',
        properties: {
          slug: { type: 'string' }, name: { type: 'string' }, winery: { type: ['string', 'null'] }, score: { type: 'number' },
          reasons: { type: 'array', items: { type: 'string' }, example: ['Тот же сорт: Сира', 'Тоже красное', 'Общие ноты: ежевика, слива, дым'] },
          image_url: { type: 'string' },
        },
      },
      LabelHints: {
        type: 'object',
        description: 'Что прочитано на этикетке неизвестного вина',
        properties: {
          category: { type: ['string', 'null'] },
          sweetness: { type: ['object', 'null'], properties: { label: { type: 'string' }, level: { type: 'integer' }, sparkling: { type: 'boolean' } } },
          grapes: { type: 'array', items: { type: 'string' } },
        },
      },
      SearchResult: {
        type: 'object',
        properties: {
          top1: { oneOf: [ref('WineShort'), { type: 'null' }] },
          top5: { type: 'array', items: ref('WineShort') },
          margin: { type: ['number', 'null'], description: 'top1.score − top2.score' },
          confident: { type: 'boolean' },
          status: { type: 'string', enum: ['confident', 'uncertain', 'not_found'], description: 'одна карточка / карточка + варианты / нет в каталоге' },
          confidence: ref('Confidence'),
          analogs: { type: 'array', items: ref('Analog'), description: 'только при not_found и прочитанном сорте' },
          label_hints: ref('LabelHints'),
          engine: { type: 'string' }, model: { type: ['string', 'null'] }, latency_ms: { type: 'integer' },
        },
      },
      Evidence: {
        type: 'object',
        properties: {
          field: { type: 'string', enum: ['name', 'description'] }, quote: { type: 'string' },
          start: { type: 'integer' }, end: { type: 'integer' }, rule: { type: 'string' },
        },
      },
      TasteScale: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['sweetness', 'acidity', 'tannin', 'body'] },
          state: { type: 'string', enum: ['known', 'unknown', 'conflict'] },
          level: { type: ['integer', 'null'], minimum: 1, maximum: 3 },
          label: { type: ['string', 'null'] }, descriptor: { type: ['string', 'null'] }, sparkling: { type: 'boolean' },
          evidence: { type: 'array', items: ref('Evidence') },
        },
      },
      TastePassport: {
        type: 'object',
        properties: {
          version: { type: 'string' }, summary: { type: ['string', 'null'] },
          scales: { type: 'object', additionalProperties: ref('TasteScale') },
          notes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, family: { type: 'string' }, generic: { type: 'boolean' }, evidence: { type: 'array', items: ref('Evidence') } } } },
          families: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, notes: { type: 'array', items: { type: 'string' } } } } },
        },
      },
      Wine: {
        type: 'object',
        properties: {
          slug: { type: 'string' }, name: { type: 'string' }, category: { type: ['string', 'null'], description: 'цвет: Белое / Красное / Розовое / Оранжевое' },
          color: { type: ['string', 'null'] }, region: { type: ['string', 'null'] }, grapes: { type: ['string', 'null'] },
          description: { type: ['string', 'null'] }, winery: { type: ['string', 'null'] }, image_url: { type: 'string' },
          taste_passport: { oneOf: [ref('TastePassport'), { type: 'null' }], description: 'null, если анализатор дал сбой' },
        },
      },
    },
  },
} as const

const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14'

/** Swagger UI page; the UI assets come from the CDN, the spec from this server. */
export const swaggerHtml = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>API — Сканер вин «Своё вино»</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css">
  <style>body { margin: 0; background: #fdf9ed; } .swagger-ui .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger"></div>
  <noscript>Спецификация: <a href="/openapi.json">/openapi.json</a></noscript>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger', deepLinking: true, tryItOutEnabled: true })
  </script>
</body>
</html>`
