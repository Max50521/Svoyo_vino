<script setup lang="ts">
import { computed } from 'vue'
import type { FamilyId } from '~/types/taste'
import { aromaDrawing } from '~/utils/aromaIcons'

// Thin outline in the family colour plus a soft fill of the fruit body (drawings: utils/aromaIcons.ts).
// Decorative: the label next to each icon always carries the meaning.
const props = defineProps<{ note?: string, family: FamilyId, size?: number }>()
const drawing = computed(() => aromaDrawing(props.note, props.family))
</script>

<template>
  <svg
    class="aroma-icon" :width="size ?? 56" :height="size ?? 56" viewBox="0 0 64 64" aria-hidden="true" focusable="false"
    fill="none" stroke-linecap="round" stroke-linejoin="round" :style="{ color: `var(--fam-${family})` }"
  >
    <path v-for="(d, i) in drawing.fill" :key="`f${i}`" :d="d" fill="currentColor" fill-opacity="0.2" stroke="none" />
    <path v-for="(d, i) in drawing.stroke" :key="`s${i}`" :d="d" stroke="currentColor" stroke-width="2" />
  </svg>
</template>

<style scoped>
.aroma-icon { display: block; flex: none; }
</style>
