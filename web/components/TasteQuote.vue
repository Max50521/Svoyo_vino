<script setup lang="ts">
import { computed } from 'vue'
import type { Evidence } from '~/types/taste'

// Source quote with the matched words highlighted; plain text only (no v-html).
const props = defineProps<{ evidence: Evidence }>()
const parts = computed(() => {
  const { quote, start, end } = props.evidence
  const ok = start >= 0 && end <= quote.length && start < end
  return ok ? [quote.slice(0, start), quote.slice(start, end), quote.slice(end)] : [quote, '', '']
})
</script>

<template>
  <q class="tq">{{ parts[0] }}<mark v-if="parts[1]">{{ parts[1] }}</mark>{{ parts[2] }}</q>
  <span class="tq__src">{{ evidence.field === 'name' ? 'из названия' : 'из описания' }}</span>
</template>

<style scoped>
.tq { quotes: '«' '»'; font-style: italic; line-height: 1.5; }
.tq mark { background: var(--sand); color: inherit; font-style: normal; font-weight: 600; padding: 0 2px; border-radius: 3px; }
.tq__src { display: inline-block; margin-left: 6px; font-size: 12px; color: var(--text-muted); }
</style>
