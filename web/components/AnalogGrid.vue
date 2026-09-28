<script setup lang="ts">
import type { Analog } from '~/types/api'

// Analog tiles with the shared facts that make them similar.
defineProps<{ analogs: Analog[] }>()
</script>

<template>
  <ul class="analogs">
    <li v-for="a in analogs" :key="a.slug">
      <NuxtLink :to="`/wine/${a.slug}`" class="analog">
        <span class="analog__img"><img :src="a.image_url" :alt="a.name" loading="lazy"></span>
        <span class="analog__body">
          <span class="analog__name">{{ a.name }}</span>
          <span class="analog__winery">{{ a.winery }}</span>
          <span v-for="r in a.reasons" :key="r" class="analog__reason">{{ r }}</span>
        </span>
      </NuxtLink>
    </li>
  </ul>
</template>

<style scoped>
.analogs { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
@media (min-width: 640px) { .analogs { grid-template-columns: 1fr 1fr; } }
.analog {
  display: flex; gap: 12px; align-items: flex-start; min-height: 44px; padding: 10px;
  background: var(--surface); border: 1px solid var(--sand); border-radius: var(--radius-s); color: var(--text);
}
.analog:hover { border-color: var(--wine); }
.analog__img { flex: none; width: 64px; height: 88px; display: flex; justify-content: center; }
.analog__img img { height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.analog__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.analog__name { font-weight: 600; font-size: 15px; line-height: 1.25; }
.analog__winery { font-size: 13px; color: var(--wine); margin-bottom: 4px; }
.analog__reason { font-size: 13px; line-height: 1.35; color: var(--text-muted); }
.analog__reason::before { content: '· '; color: var(--wine); }
</style>
