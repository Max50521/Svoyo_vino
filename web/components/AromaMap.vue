<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import type { AromaFamily, AromaNote, FamilyId } from '~/types/taste'

// Second level: families found in the description. Equal sectors on wide screens,
// a plain list on phones. Sector size never encodes quantity.
const props = defineProps<{ families: AromaFamily[], notes: AromaNote[], wineName: string }>()

const expanded = ref(false)
const selected = ref<FamilyId | null>(null)
const id = useId()
let opener: HTMLElement | null = null

const noteById = computed(() => new Map(props.notes.map(n => [n.id, n])))
const current = computed(() => props.families.find(f => f.id === selected.value) ?? null)
const currentNotes = computed(() => current.value?.notes.map(n => noteById.value.get(n)!).filter(Boolean) ?? [])

function pick(fam: FamilyId, ev: Event) {
  opener = ev.currentTarget as HTMLElement
  selected.value = selected.value === fam ? null : fam
}
function close() {
  selected.value = null
  nextTick(() => opener?.focus())
}
function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape' && selected.value) { ev.stopPropagation(); close() } }
function toggleMap() {
  expanded.value = !expanded.value
  if (!expanded.value) selected.value = null
}

// ---- wheel geometry (viewBox 720×420: room for horizontal labels on both sides) ----
const CX = 360, CY = 210, R_OUT = 128, R_IN = 66, R_LABEL = 150
const polar = (r: number, a: number) => [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const
const sectors = computed(() => {
  const n = props.families.length
  return props.families.map((f, i) => {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n
    const a1 = a0 + (2 * Math.PI) / n
    const mid = (a0 + a1) / 2
    let d: string
    if (n === 1) {
      d = `M${CX - R_OUT},${CY}a${R_OUT},${R_OUT} 0 1 0 ${2 * R_OUT},0a${R_OUT},${R_OUT} 0 1 0 ${-2 * R_OUT},0z`
        + `M${CX - R_IN},${CY}a${R_IN},${R_IN} 0 1 1 ${2 * R_IN},0a${R_IN},${R_IN} 0 1 1 ${-2 * R_IN},0z`
    }
    else {
      const large = a1 - a0 > Math.PI ? 1 : 0
      const [x0, y0] = polar(R_OUT, a0), [x1, y1] = polar(R_OUT, a1)
      const [x2, y2] = polar(R_IN, a1), [x3, y3] = polar(R_IN, a0)
      d = `M${x0},${y0}A${R_OUT},${R_OUT} 0 ${large} 1 ${x1},${y1}L${x2},${y2}A${R_IN},${R_IN} 0 ${large} 0 ${x3},${y3}Z`
    }
    const [ix, iy] = polar((R_OUT + R_IN) / 2, n === 1 ? -Math.PI / 2 : mid)
    const [lx, ly] = polar(R_LABEL, n === 1 ? -Math.PI / 2 : mid)
    const cos = Math.cos(mid)
    const anchor = n === 1 || Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
    const labels = f.notes.map(x => noteById.value.get(x)?.label).filter(Boolean) as string[]
    const detail = labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ')
    const dy = n === 1 ? -14 : Math.sin(mid) > 0.3 ? 14 : Math.sin(mid) < -0.3 ? -14 : 0
    return { f, d, ix, iy, lx, ly: ly + dy, anchor, detail }
  })
})
</script>

<template>
  <div class="map" @keydown="onKey">
    <button type="button" class="btn btn--ghost map__toggle" :aria-expanded="expanded" :aria-controls="`${id}-map`" @click="toggleMap">
      {{ expanded ? 'Свернуть карту ароматов' : 'Раскрыть карту ароматов' }}
    </button>

    <div v-if="expanded" :id="`${id}-map`" class="map__body">
      <p class="map__lead">Группы ароматов, названных в описании. Размер сектора не означает долю или силу аромата.</p>

      <!-- wide screens -->
      <svg class="map__wheel" viewBox="0 0 720 420" role="group" :aria-label="`Карта ароматов: ${wineName}`">
        <g
          v-for="s in sectors" :key="s.f.id" class="sector" :class="{ 'sector--on': selected === s.f.id }"
          role="button" tabindex="0" :aria-pressed="selected === s.f.id" :aria-label="`${s.f.label}: ${s.detail}`"
          @click="pick(s.f.id, $event)" @keydown.enter.prevent="pick(s.f.id, $event)" @keydown.space.prevent="pick(s.f.id, $event)"
        >
          <path :d="s.d" :style="{ fill: `var(--fam-${s.f.id})`, stroke: `var(--fam-${s.f.id})` }" fill-rule="evenodd" />
          <AromaIcon :family="s.f.id" :size="34" :x="s.ix - 17" :y="s.iy - 17" />
          <text :x="s.lx" :y="s.ly" :text-anchor="s.anchor" class="sector__label">{{ s.f.label }}</text>
          <text :x="s.lx" :y="s.ly + 18" :text-anchor="s.anchor" class="sector__detail">{{ s.detail }}</text>
        </g>
        <foreignObject :x="CX - R_IN + 8" :y="CY - 40" :width="(R_IN - 8) * 2" height="80">
          <div class="map__center serif">{{ wineName }}</div>
        </foreignObject>
      </svg>

      <!-- phones -->
      <ul class="map__list">
        <li v-for="f in families" :key="f.id">
          <button type="button" class="fam" :aria-expanded="selected === f.id" :aria-controls="`${id}-panel`" @click="pick(f.id, $event)">
            <span class="fam__mark" :style="{ background: `var(--fam-${f.id})` }" aria-hidden="true" />
            <AromaIcon :family="f.id" :size="32" />
            <span class="fam__text">
              <span class="fam__label">{{ f.label }}</span>
              <span class="fam__notes">{{ f.notes.map(n => noteById.get(n)?.label).join(', ') }}</span>
            </span>
          </button>
        </li>
      </ul>

      <div v-if="current" :id="`${id}-panel`" class="panel" role="region" :aria-label="current.label">
        <div class="panel__head">
          <span class="panel__title serif">{{ current.label }}</span>
          <button type="button" class="panel__close" @click="close">Закрыть</button>
        </div>
        <ul class="panel__notes">
          <li v-for="n in currentNotes" :key="n.id">
            <AromaIcon :note="n.id" :family="n.family" :size="40" />
            <div>
              <b>{{ n.label }}</b><span v-if="n.generic" class="panel__generic"> · группа без уточнения</span>
              <p><TasteQuote :evidence="n.evidence[0]!" /></p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map { margin-top: 16px; }
.map__toggle { width: auto; min-height: 44px; padding: 10px 20px; }
.map__lead { font-size: 13px; color: var(--text-muted); margin: 14px 0 8px; }
.map__wheel { display: none; width: 100%; height: auto; max-height: 440px; overflow: visible; }
.sector { cursor: pointer; outline: none; }
.sector path { fill-opacity: .14; stroke-opacity: .5; stroke-width: 1; transition: fill-opacity .15s; }
.sector:hover path { fill-opacity: .24; }
.sector--on path { fill-opacity: .34; stroke-opacity: 1; stroke-width: 2; }
.sector:focus-visible path { stroke: var(--wine) !important; stroke-opacity: 1; stroke-width: 3; }
.sector__label { font-family: var(--serif); font-size: 17px; fill: var(--text); }
.sector__detail { font-size: 13px; fill: var(--text-muted); }
.map__center { height: 80px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 14px; line-height: 1.2; color: var(--wine); overflow: hidden; }

.map__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.fam {
  width: 100%; min-height: 56px; display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  background: var(--surface); border: 1px solid var(--sand); border-radius: var(--radius-s); color: var(--text); cursor: pointer; text-align: left;
}
.fam[aria-expanded='true'] { border-color: var(--wine); }
.fam__mark { width: 4px; align-self: stretch; border-radius: 2px; flex: none; }
.fam__text { display: flex; flex-direction: column; min-width: 0; }
.fam__label { font-weight: 600; font-size: 15px; }
.fam__notes { font-size: 13px; color: var(--text-muted); overflow-wrap: anywhere; }

@media (min-width: 720px) {
  .map__wheel { display: block; }
  .map__list { display: none; }
}

.panel { margin-top: 10px; padding: 12px 14px; background: var(--surface); border: 1px solid var(--sand); border-radius: var(--radius-s); }
.panel__head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.panel__title { font-size: 18px; }
.panel__close { min-height: 44px; padding: 0 12px; background: none; border: 1px solid var(--line); border-radius: 999px; color: var(--text); cursor: pointer; }
.panel__notes { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; }
.panel__notes li { display: flex; gap: 10px; align-items: flex-start; }
.panel__notes p { margin: 2px 0 0; font-size: 14px; }
.panel__generic { color: var(--text-muted); font-size: 13px; }
</style>
