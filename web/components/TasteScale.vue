<script setup lang="ts">
import { computed, useId } from 'vue'
import type { TasteScale } from '~/types/taste'

// One characteristic: name (opens a term explanation), three markers, word label.
const props = defineProps<{ scale: TasteScale, open: boolean }>()
defineEmits<{ toggle: [] }>()

const TITLES: Record<TasteScale['id'], string> = { sweetness: 'Сладость', acidity: 'Кислотность', tannin: 'Танины', body: 'Тело вина' }
const HELP: Record<TasteScale['id'], string> = {
  sweetness: 'Сколько сахара ощущается во вкусе. Категорию — сухое, полусухое, полусладкое, сладкое — указывает производитель. У игристых вин своя шкала: брют суше, чем «сухое» игристое.',
  acidity: 'Свежесть и сочность во вкусе. Высокая кислотность делает вино бодрым и освежающим, низкая — мягким и округлым. Это не то же самое, что «кислый» вкус.',
  tannin: 'Вяжущее, чуть сушащее ощущение на дёснах и языке — от кожицы и косточек винограда. Чаще встречается в красных винах. Если в описании танины не упомянуты, это не значит, что их нет.',
  body: 'Насколько плотным вино ощущается во рту: лёгкое — как вода или обезжиренное молоко, полное — ближе к сливкам. Интенсивный аромат или насыщенный цвет не означают полное тело.',
}

const id = useId()
const known = computed(() => props.scale.state === 'known' && props.scale.level)
const value = computed(() => {
  const s = props.scale
  if (s.state === 'conflict') return 'Противоречивые данные'
  if (!known.value) return 'В описании не уточнено'
  return s.label!.charAt(0).toUpperCase() + s.label!.slice(1)
})
</script>

<template>
  <li class="scale" :class="{ 'scale--muted': !known }">
    <button class="scale__name" type="button" :aria-expanded="open" :aria-controls="`${id}-help`" @click="$emit('toggle')">
      {{ TITLES[scale.id] }}<span class="scale__q" aria-hidden="true">?</span>
    </button>
    <span class="scale__dots" aria-hidden="true">
      <i v-for="n in 3" :key="n" :class="{ on: known && n <= scale.level! }" />
    </span>
    <span class="scale__value">
      <span v-if="known" class="visually-hidden">{{ scale.level }} из 3: </span>{{ value }}
      <span v-if="scale.descriptor" class="scale__desc">{{ scale.descriptor }}</span>
      <span v-if="scale.sparkling && scale.id === 'sweetness'" class="scale__note">шкала для игристых</span>
    </span>
    <p v-if="open" :id="`${id}-help`" class="scale__help">{{ HELP[scale.id] }}</p>
  </li>
</template>

<style scoped>
.scale {
  display: grid; grid-template-columns: minmax(118px, auto) auto 1fr; align-items: center; column-gap: 14px;
  padding: 6px 0; border-bottom: 1px solid var(--sand);
}
.scale:last-child { border-bottom: 0; }
.scale__name {
  display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0; background: none; border: 0;
  color: var(--text); font-weight: 600; font-size: 15px; cursor: pointer; text-align: left;
}
.scale__q {
  display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%;
  border: 1px solid var(--line); color: var(--text-muted); font-size: 11px; font-weight: 600;
}
.scale__name[aria-expanded='true'] .scale__q { background: var(--wine); border-color: var(--wine); color: #fff; }
.scale__dots { display: inline-flex; gap: 6px; }
.scale__dots i { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--wine); opacity: .35; }
.scale__dots i.on { background: var(--wine); opacity: 1; }
.scale--muted .scale__dots i { border-color: var(--line); opacity: .6; }
.scale__value { font-size: 15px; line-height: 1.35; }
.scale--muted .scale__value { color: var(--text-muted); font-size: 14px; }
.scale__desc { display: block; font-style: italic; color: var(--text-muted); font-size: 13px; }
.scale__note { display: block; font-size: 12px; color: var(--text-muted); }
.scale__help {
  grid-column: 1 / -1; margin: 4px 0 8px; padding: 10px 12px; border-radius: var(--radius-s);
  background: var(--sand-soft); font-size: 14px; line-height: 1.5;
}
@media (max-width: 380px) {
  .scale { grid-template-columns: 1fr auto; row-gap: 0; }
  .scale__value { grid-column: 1 / -1; padding-bottom: 6px; }
}
</style>
