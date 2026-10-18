<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import type { AromaNote } from '~/types/taste'

// First level: up to six notes with drawings; tapping one shows the source phrase.
const props = defineProps<{ notes: AromaNote[] }>()
const shown = computed(() => props.notes.slice(0, 6))
const open = ref<string | null>(null)
const id = useId()
const current = computed(() => shown.value.find(n => n.id === open.value))

function toggle(noteId: string) { open.value = open.value === noteId ? null : noteId }
</script>

<template>
  <div class="notes">
    <ul class="notes__grid" :class="`notes__grid--${Math.min(shown.length, 6)}`">
      <li v-for="n in shown" :key="n.id">
        <button
          type="button" class="note" :class="{ 'note--open': open === n.id }"
          :aria-expanded="open === n.id" :aria-controls="`${id}-src`" @click="toggle(n.id)"
        >
          <span class="note__disc" :style="{ '--fam': `var(--fam-${n.family})` }" aria-hidden="true">
            <AromaIcon :note="n.id" :family="n.family" :size="46" />
          </span>
          <span class="note__label">{{ n.label }}</span>
        </button>
      </li>
    </ul>
    <div v-if="current" :id="`${id}-src`" class="notes__src" role="region" :aria-label="`Источник: ${current.label}`">
      <p v-for="(e, i) in current.evidence" :key="i"><TasteQuote :evidence="e" /></p>
      <p v-if="current.generic" class="notes__hint">В описании названа только группа ароматов, без конкретных нот.</p>
    </div>
    <p v-if="notes.length > 6" class="notes__more">Ещё {{ notes.length - 6 }} — на карте ароматов.</p>
  </div>
</template>

<style scoped>
.notes__grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.notes__grid--1 { grid-template-columns: minmax(0, 120px); }
.notes__grid--2 { grid-template-columns: repeat(2, minmax(0, 120px)); }
@media (min-width: 720px) { .notes__grid:not(.notes__grid--1):not(.notes__grid--2) { grid-template-columns: repeat(6, 1fr); } }
.note {
  width: 100%; min-height: 44px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 10px 4px 8px; background: none; border: 1px solid transparent; border-radius: var(--radius-s);
  color: var(--text); cursor: pointer; transition: background .2s, border-color .2s, transform .2s, box-shadow .2s;
}
.note__disc {
  width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--fam) 12%, transparent); transition: background .2s, transform .2s;
}
.note:hover { background: var(--surface); transform: translateY(-3px); box-shadow: 0 6px 18px rgba(80, 40, 40, .08); }
.note:hover .note__disc, .note--open .note__disc { background: color-mix(in srgb, var(--fam) 20%, transparent); }
.note:focus-visible { outline: 2px solid var(--wine); outline-offset: 2px; }
.note--open { background: var(--surface); border-color: var(--sand); }
@media (prefers-reduced-motion: reduce) { .note, .note__disc { transition: none; } .note:hover { transform: none; } }
.note__label { font-size: 14px; line-height: 1.25; text-align: center; overflow-wrap: break-word; hyphens: auto; }
.notes__src { margin-top: 8px; padding: 10px 12px; border-left: 2px solid var(--wine); background: var(--surface); font-size: 14px; }
.notes__src p { margin: 0 0 4px; }
.notes__hint, .notes__more { color: var(--text-muted); font-size: 13px; }
.notes__more { margin: 8px 0 0; }
</style>
