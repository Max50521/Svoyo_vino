<script setup lang="ts">
import type { Wine, WineShort } from '~/types/api'

// Wine card in the vino-svoe.ru style + recognition alternatives + similar wines.
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const scan = useScan()

const { data: wine, error, refresh } = await useFetch<Wine>(() => `/v1/wines/${encodeURIComponent(slug.value)}`)
const { data: similar } = useLazyFetch<WineShort[]>(() => `/v1/wines/${encodeURIComponent(slug.value)}/similar?limit=8`, { default: () => [], server: false, timeout: 5000, retry: 0 })

useHead(() => ({ title: wine.value ? `${wine.value.name} — Своё вино` : 'Вино — Своё вино' }))

// Recognition context: only when this card was opened from a scan that contains it.
const fromScan = computed(() => {
  const s = scan.value
  return s && s.result.top5.some(c => c.slug === slug.value) ? s : null
})
const isTop1 = computed(() => fromScan.value?.result.top1?.slug === slug.value)
const uncertain = computed(() => isTop1.value && fromScan.value?.result.status === 'uncertain')
const alternatives = computed(() => fromScan.value?.result.top5.filter((c: WineShort) => c.slug !== slug.value) ?? [])
const showAlternatives = ref(false)
watchEffect(() => { showAlternatives.value = uncertain.value || (!!fromScan.value && !isTop1.value) })

// Catalog slugs match vino-svoe.ru card URLs (checked on a sample of real cards).
const portalUrl = computed(() => `https://vino-svoe.ru/wines/${encodeURIComponent(slug.value)}`)

const specs = computed(() => {
  const w = wine.value
  if (!w) return []
  return [
    ['Регион', w.region],
    ['Сорт винограда', w.grapes],
    ['Категория', w.category],
    ['Цвет', w.color],
  ].filter(([, v]) => v) as [string, string][]
})
</script>

<template>
  <main class="container card-page">
    <p class="crumbs muted">
      <NuxtLink to="/">Сканер</NuxtLink> · Свои вина · {{ wine?.name ?? '…' }}
    </p>

    <div v-if="error" class="notice">
      <span><b>{{ error.statusCode === 404 ? 'Вино не найдено.' : 'Карточка временно недоступна.' }}</b>
        <button v-if="error.statusCode !== 404" class="btn btn--ghost" @click="refresh()">Попробовать ещё раз</button>
        <NuxtLink to="/" class="link">Сканировать другое</NuxtLink></span>
    </div>

    <template v-else-if="wine">
      <div v-if="uncertain" class="notice top-notice">
        <span>🔍</span>
        <span><b>Возможно, это</b> — на фото похожие этикетки. Проверьте варианты ниже.</span>
      </div>

      <article class="card">
        <div class="card__media">
          <img :src="wine.image_url" :alt="wine.name">
        </div>
        <div class="card__body">
          <h1 class="serif card__title">{{ wine.name }}</h1>
          <p class="card__winery">{{ wine.winery }}</p>

          <dl class="specs">
            <div v-for="[k, v] in specs" :key="k" class="spec">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </div>
          </dl>
        </div>
      </article>

      <section v-if="alternatives.length" class="alts">
        <button class="alts__toggle" :aria-expanded="showAlternatives" @click="showAlternatives = !showAlternatives">
          <span class="serif">Не то вино?</span>
          <span class="muted">{{ showAlternatives ? 'Скрыть' : `Ещё ${alternatives.length} варианта` }}</span>
        </button>
        <div v-if="showAlternatives" class="alts__body">
          <img v-if="fromScan" :src="fromScan.photoUrl" class="alts__photo" alt="Ваше фото">
          <WineGrid :wines="alternatives" show-score />
        </div>
      </section>

      <TastePassport v-if="wine.taste_passport" :key="wine.slug" :passport="wine.taste_passport" :wine-name="wine.name" />

      <section v-if="wine.description" class="desc">
        <h2 class="section-title">Описание</h2>
        <p class="card__desc">{{ wine.description }}</p>
      </section>

      <a class="portal-link" :href="portalUrl" target="_blank" rel="noopener">Полная карточка на Своё Вино <span aria-hidden="true">↗</span></a>

      <section v-if="similar?.length">
        <h2 class="section-title">Похожие по этикетке</h2>
        <WineGrid :wines="similar" />
      </section>

      <NuxtLink to="/" class="btn btn--ghost again">Сканировать другое вино</NuxtLink>
    </template>
  </main>
</template>

<style scoped>
.card-page { padding-top: 8px; padding-bottom: 48px; }
.crumbs { font-size: 13px; margin: 8px 0 16px; }
.crumbs a { color: var(--wine); }
.top-notice { margin-bottom: 16px; }
.link { color: var(--wine); text-decoration: underline; }

.card { display: grid; gap: 20px; }
.card__media { background: var(--surface); border-radius: var(--radius); display: flex; justify-content: center; padding: 20px; }
.card__media img { height: 240px; object-fit: contain; mix-blend-mode: multiply; }
.card__title { font-size: 32px; line-height: 1.15; margin: 0; }
.card__winery { color: var(--wine); font-weight: 600; margin: 6px 0 20px; }
.specs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0; }
.spec { background: var(--sand-soft); border: 1px solid var(--sand); border-radius: var(--radius-s); padding: 10px 12px; }
.spec dt { font-size: 12px; color: var(--text-2); margin-bottom: 4px; }
.spec dd { margin: 0; font-weight: 600; font-size: 15px; }
.card__desc { line-height: 1.6; margin: 0; white-space: pre-line; }
.desc .section-title { margin-top: 28px; }
.portal-link {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; margin-top: 12px;
  color: var(--wine); font-weight: 600; text-decoration: underline; text-underline-offset: 3px;
}

@media (min-width: 720px) {
  .card { grid-template-columns: 260px 1fr; align-items: start; }
  .card__media img { height: 420px; }
}

.alts { margin-top: 24px; border-top: 1px solid var(--sand); border-bottom: 1px solid var(--sand); }
.alts__toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 16px 0; background: none; border: 0; cursor: pointer; color: var(--text); }
.alts__toggle .serif { font-size: 20px; }
.alts__body { padding-bottom: 16px; }
.alts__photo { width: 96px; height: 128px; object-fit: cover; border-radius: var(--radius-s); margin-bottom: 12px; }
.again { margin-top: 32px; }
</style>
