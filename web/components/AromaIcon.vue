<script setup lang="ts">
import { computed } from 'vue'
import type { FamilyId } from '~/types/taste'

// Original thin-line drawings (48×48 grid, stroke only). Decorative: the label next to
// each icon always carries the meaning.
const props = defineProps<{ note?: string, family: FamilyId, size?: number }>()

const ICONS: Record<string, string[]> = {
  lemon: ['M8 25c0-7 7-13 16-13s16 6 16 13-7 12-16 12S8 32 8 25z', 'M5 25h3M40 25h3', 'M15 21c3-3 8-4 12-3'],
  slice: ['M24 10a14 14 0 1 1 0 28 14 14 0 0 1 0-28z', 'M24 14a10 10 0 1 1 0 20 10 10 0 0 1 0-20z', 'M24 14v20M15.3 19l17.4 10M15.3 29l17.4-10'],
  apple: ['M24 17c-3-3-9-3-12 1-4 5-2 14 2 19 3 4 6 5 10 3 4 2 7 1 10-3 4-5 6-14 2-19-3-4-9-4-12-1z', 'M24 17c0-4 1-7 4-10', 'M27 12c3-3 7-3 10-1-2 3-6 4-10 1z'],
  pear: ['M24 13c-3 0-5 3-5 7 0 3-6 6-6 13 0 6 5 10 11 10s11-4 11-10c0-7-6-10-6-13 0-4-2-7-5-7z', 'M24 13c0-3 1-6 4-8', 'M29 19c2 3 3 6 2 9'],
  peach: ['M24 15a13 13 0 1 1-.1 0z', 'M24 15c-4 6-4 20 0 26', 'M24 15c2-5 7-7 11-6-1 5-6 7-11 6z'],
  grapes: ['M18 20a4 4 0 1 1 0 .1zM30 20a4 4 0 1 1 0 .1zM24 20a4 4 0 1 1 0 .1z', 'M21 27a4 4 0 1 1 0 .1zM27 27a4 4 0 1 1 0 .1z', 'M24 34a4 4 0 1 1 0 .1z', 'M24 16c0-4 2-7 6-9', 'M24 11c-3-2-7-2-9 0'],
  cherry: ['M16 34a7 7 0 1 1 0-.1z', 'M32 32a7 7 0 1 1 0-.1z', 'M16 27c2-8 6-13 12-18M32 25c-1-6-2-11-4-16', 'M28 9c3-2 7-1 9 1-3 2-7 2-9-1z'],
  berry: ['M24 41c-8-4-13-12-12-20 5-3 19-3 24 0 1 8-4 16-12 20z', 'M18 25l1 1M24 24l1 1M30 25l-1 1M20 31l1 1M27 31l1 1M24 36l.5.5', 'M17 20c2-4 5-6 7-6s5 2 7 6', 'M24 14v-5'],
  currant: ['M24 13v6', 'M24 19c-5 2-8 5-10 9M24 19c5 2 8 5 10 9M24 19v4', 'M14 32a4 4 0 1 1 0 .1zM24 27a4 4 0 1 1 0 .1zM34 32a4 4 0 1 1 0 .1zM19 38a4 4 0 1 1 0 .1zM29 38a4 4 0 1 1 0 .1z'],
  plum: ['M24 13c8 0 13 7 13 15s-6 13-13 13-13-5-13-13 5-15 13-15z', 'M24 13c-2 6-2 20 1 28', 'M24 13c1-3 3-5 6-6'],
  pineapple: ['M24 19c6 0 10 5 10 11s-4 11-10 11-10-5-10-11 4-11 10-11z', 'M17 25l14 12M31 25L17 37M15 31l7 7M33 31l-7 7', 'M24 19l-5-11M24 19l0-12M24 19l5-11M24 19l-9-7M24 19l9-7'],
  dried: ['M24 10c6 7 12 14 12 21a12 12 0 0 1-24 0c0-7 6-14 12-21z', 'M19 27c2 2 3 5 2 8M26 24c2 3 3 7 1 11M31 30c1 2 1 4 0 6'],
  jar: ['M16 17h16v4c3 2 4 5 4 9v8a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3v-8c0-4 1-7 4-9v-4z', 'M14 12h20v5H14z', 'M12 29h24'],
  flower: ['M24 21a3 3 0 1 1 0 6 3 3 0 0 1 0-6z', 'M24 21c-3-5-3-10 0-13 3 3 3 8 0 13zM27 24c5-3 10-3 13 0-3 3-8 3-13 0zM24 27c3 5 3 10 0 13-3-3-3-8 0-13zM21 24c-5 3-10 3-13 0 3-3 8-3 13 0z'],
  rose: ['M24 14c6 0 10 4 10 9s-4 9-10 9-10-4-10-9 4-9 10-9z', 'M24 19c3 0 5 2 5 4s-2 4-5 4-5-2-5-4', 'M20 17c1 3 4 4 7 3', 'M24 32v10M24 37c3-2 6-2 8 0'],
  leaf: ['M10 38C12 20 22 11 38 10c-1 16-10 26-28 28z', 'M10 38L30 18', 'M18 30h7M22 26v-6M26 22h5'],
  herb: ['M24 42V10', 'M24 16c-4-1-7-4-8-8 4 0 7 3 8 8zM24 16c4-1 7-4 8-8-4 0-7 3-8 8z', 'M24 25c-5-1-9-5-10-10 5 0 9 4 10 10zM24 25c5-1 9-5 10-10-5 0-9 4-10 10z', 'M24 34c-5-1-9-5-10-10 5 0 9 4 10 10zM24 34c5-1 9-5 10-10-5 0-9 4-10 10z'],
  pepper: ['M17 20a5 5 0 1 1 0 .1zM31 20a5 5 0 1 1 0 .1zM24 31a5 5 0 1 1 0 .1z', 'M15 19l2 1M29 19l2 1M22 30l2 1'],
  anise: ['M24 8l3 11 10-6-6 10 11 3-11 3 6 10-10-6-3 11-3-11-10 6 6-10-11-3 11-3-6-10 10 6z', 'M24 21a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'],
  nut: ['M24 14c7 0 12 6 12 13 0 8-5 14-12 14s-12-6-12-14c0-7 5-13 12-13z', 'M14 22c6 2 14 2 20 0', 'M24 14c0-3 1-5 3-6'],
  oak: ['M24 42V30', 'M24 30c-3 0-5-2-5-4-3 0-5-2-4-5-3-1-3-5 0-6-1-3 2-5 4-4 0-3 3-5 5-3 2-2 5 0 5 3 2-1 5 1 4 4 3 1 3 5 0 6 1 3-1 5-4 5 0 2-2 4-5 4z', 'M24 30V14M24 22l-4-3M24 25l4-3'],
  honey: ['M17 12h14l7 12-7 12H17l-7-12z', 'M24 18l5 3v6l-5 3-5-3v-6z', 'M31 36c0 3 1 5 3 6 2-1 3-3 3-6'],
  vanilla: ['M14 40C20 30 26 18 34 8', 'M18 40C24 30 30 18 36 10', 'M14 40c1 1 3 1 4 0M34 8c1 0 2 1 2 2'],
  cocoa: ['M24 9c7 5 10 11 10 17s-3 12-10 15c-7-3-10-9-10-15s3-12 10-17z', 'M24 9v32M18 18c4 2 8 2 12 0M17 26c5 2 9 2 14 0M18 34c4 2 8 2 12 0'],
  stone: ['M12 30l6-14 14-4 8 12-5 14-15 2z', 'M18 16l6 10 16-2M24 26l-4 14M24 26l11 12'],
  smoke: ['M16 40c-4-5 4-8 0-13s4-8 0-13', 'M24 40c-4-5 4-8 0-13s4-8 0-13', 'M32 40c-4-5 4-8 0-13s4-8 0-13'],
  cup: ['M12 20h20v8a10 10 0 0 1-20 0z', 'M32 22h3a4 4 0 0 1 0 8h-4', 'M10 42h26', 'M18 16c-2-2 2-4 0-6M24 16c-2-2 2-4 0-6'],
}

const NOTE_ICON: Record<string, string> = {
  lemon: 'lemon', lime: 'lemon', grapefruit: 'slice', orange: 'slice', mandarin: 'slice', bergamot: 'lemon', pomelo: 'slice', zest: 'lemon', citrus: 'slice',
  apple: 'apple', green_apple: 'apple', pear: 'pear', quince: 'pear', peach: 'peach', nectarine: 'peach', apricot: 'peach', alycha: 'plum', white_plum: 'plum', grape: 'grapes', fruit: 'apple',
  cherry: 'cherry', sweet_cherry: 'cherry', dried_cherry: 'cherry',
  black_currant: 'currant', currant: 'currant', red_currant: 'currant', blueberry: 'currant', bilberry: 'currant', elderberry: 'currant', aronia: 'currant', dark_berries: 'currant', sloe: 'currant', mulberry: 'berry', blackberry: 'berry',
  plum: 'plum', prune: 'dried', dried_apricot: 'dried', raisin: 'grapes', fig: 'dried', date: 'dried', dried_fruit: 'dried', jam: 'jar',
  rose: 'rose', white_flowers: 'flower', flowers: 'flower',
  herbs: 'herb', mint: 'herb', rosemary: 'herb', thyme: 'herb', sage: 'leaf', basil: 'leaf', eucalyptus: 'leaf', fennel: 'herb', wormwood: 'herb', pine: 'herb', cut_grass: 'herb', currant_leaf: 'leaf', green_pepper: 'pepper',
  black_pepper: 'pepper', pepper: 'pepper', anise: 'anise', clove: 'anise', spices: 'anise', nutmeg: 'nut',
  oak: 'oak', woody: 'oak', cedar: 'oak', tobacco: 'leaf', leather: 'leaf', coffee: 'cup',
  honey: 'honey', vanilla: 'vanilla', chocolate: 'cocoa', cocoa: 'cocoa', caramel: 'honey', pastry: 'honey', toffee: 'honey',
  mineral: 'stone', chalk: 'stone', flint: 'stone', graphite: 'stone', salt: 'stone', smoke: 'smoke', petrol: 'smoke', earth: 'leaf',
}
const FAMILY_ICON: Record<FamilyId, string> = {
  citrus: 'slice', orchard: 'apple', red_berry: 'cherry', dark_berry: 'currant', tropical: 'pineapple', dried: 'dried',
  floral: 'flower', herbal: 'herb', spice: 'anise', nut: 'nut', wood: 'oak', sweet: 'honey', mineral: 'stone',
}

const paths = computed(() => ICONS[(props.note && NOTE_ICON[props.note]) || FAMILY_ICON[props.family]] ?? ICONS.leaf!)
</script>

<template>
  <svg
    class="aroma-icon" :width="size ?? 56" :height="size ?? 56" viewBox="0 0 48 48" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    :style="{ color: `var(--fam-${family})` }"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<style scoped>
.aroma-icon { display: block; flex: none; }
</style>
