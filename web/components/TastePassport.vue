<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ScaleId, TastePassport } from '~/types/taste'

// Two parts of one passport: taste characteristics and aroma notes of the open card.
const props = defineProps<{ passport: TastePassport, wineName: string }>()

const ORDER: ScaleId[] = ['sweetness', 'acidity', 'tannin', 'body']
const help = ref<ScaleId | null>(null)
const scales = computed(() => ORDER.map(id => props.passport.scales[id]))
const hasScales = computed(() => scales.value.some(s => s.state !== 'unknown' || s.descriptor))
const hasNotes = computed(() => props.passport.notes.length > 0)
const showMap = computed(() => props.passport.families.length >= 2 || props.passport.notes.length >= 3)
</script>

<template>
  <section class="tp" aria-labelledby="tp-title">
    <h2 id="tp-title" class="section-title">Паспорт вкуса</h2>

    <p v-if="!hasScales && !hasNotes" class="tp__empty">
      В описании этого вина нет явных вкусовых характеристик.
    </p>
    <template v-else>
      <p v-if="passport.summary" class="tp__summary">{{ passport.summary }}</p>

      <div class="tp__block">
        <h3 class="tp__h serif">Какое оно на вкус</h3>
        <p v-if="!hasScales" class="tp__none">Сладость, кислотность, танины и тело в описании не уточнены.</p>
        <ul v-else class="tp__scales">
          <TasteScale
            v-for="s in scales" :key="s.id" :scale="s" :open="help === s.id"
            @toggle="help = help === s.id ? null : s.id"
          />
        </ul>
      </div>

      <div v-if="hasNotes" class="tp__block">
        <h3 class="tp__h serif">Ароматы и вкусовые ноты</h3>
        <AromaNotes :notes="passport.notes" />
        <p class="tp__caption">Ассоциации из описания вина, а не добавленные ингредиенты</p>
        <AromaMap v-if="showMap" :families="passport.families" :notes="passport.notes" :wine-name="wineName" />
      </div>

      <TasteEvidence :passport="passport" />
    </template>
  </section>
</template>

<style scoped>
.tp { margin-top: 28px; }
.tp .section-title { margin-top: 0; }
.tp__summary { font-family: var(--serif); font-size: 19px; line-height: 1.35; color: var(--wine); margin: 0 0 12px; }
.tp__block { background: var(--surface); border: 1px solid var(--sand); border-radius: var(--radius); padding: 14px 16px 16px; margin-top: 12px; }
.tp__h { font-size: 19px; margin: 0 0 6px; }
.tp__scales { list-style: none; margin: 0; padding: 0; }
.tp__caption { margin: 10px 0 0; font-size: 13px; color: var(--text-muted); }
.tp__empty, .tp__none { color: var(--text-muted); margin: 0; font-size: 14px; line-height: 1.5; }
</style>
