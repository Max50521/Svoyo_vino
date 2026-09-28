<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { TastePassport, TasteScale } from '~/types/taste'

// "На чём основано": every shown conclusion with the phrase it came from.
const props = defineProps<{ passport: TastePassport }>()
const open = ref(false)
const id = useId()

const TITLES: Record<TasteScale['id'], string> = { sweetness: 'Сладость', acidity: 'Кислотность', tannin: 'Танины', body: 'Тело вина' }
const scales = computed(() => Object.values(props.passport.scales).filter(s => s.evidence.length))
function verdict(s: TasteScale) {
  if (s.state === 'conflict') return 'в тексте есть несовместимые утверждения, поэтому уровень не показан'
  if (s.state === 'known') return [s.label, s.descriptor].filter(Boolean).join(', ')
  return s.descriptor ? `${s.descriptor}; силу описание не уточняет` : 'не уточнено'
}
</script>

<template>
  <div class="ev">
    <button type="button" class="ev__toggle" :aria-expanded="open" :aria-controls="`${id}-body`" @click="open = !open">
      На чём основано <span aria-hidden="true">{{ open ? '−' : '+' }}</span>
    </button>
    <div v-if="open" :id="`${id}-body`" class="ev__body">
      <p class="ev__lead">Паспорт собран только из названия и описания этой карточки. Мы ничего не добавляем от сорта или региона и не измеряем вино по фото.</p>
      <dl v-if="scales.length">
        <template v-for="s in scales" :key="s.id">
          <dt>{{ TITLES[s.id] }} — {{ verdict(s) }}</dt>
          <dd v-for="(e, i) in s.evidence" :key="i"><TasteQuote :evidence="e" /></dd>
        </template>
      </dl>
      <dl v-if="passport.notes.length">
        <template v-for="n in passport.notes" :key="n.id">
          <dt>{{ n.label }}<span v-if="n.generic" class="ev__muted"> (группа без уточнения)</span></dt>
          <dd><TasteQuote :evidence="n.evidence[0]!" /></dd>
        </template>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.ev { margin-top: 16px; border-top: 1px solid var(--sand); }
.ev__toggle {
  width: 100%; min-height: 48px; display: flex; justify-content: space-between; align-items: center;
  background: none; border: 0; padding: 0; color: var(--wine); font-weight: 600; font-size: 15px; cursor: pointer;
}
.ev__body { padding-bottom: 8px; font-size: 14px; }
.ev__lead { color: var(--text-muted); margin: 0 0 10px; line-height: 1.5; }
dl { margin: 0 0 12px; }
dt { font-weight: 600; margin-top: 10px; }
dd { margin: 4px 0 0; }
.ev__muted { color: var(--text-muted); font-weight: 400; }
</style>
