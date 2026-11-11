<script setup lang="ts">
/** Solid square badge with a label icon, pinned to a thumbnail corner. */
import { computed } from "vue";
import { labelIcon, labelTone } from "@/utils/labels";

const props = defineProps<{ label: string }>();
const icon = computed(() => labelIcon(props.label));
const tone = computed(() => labelTone(props.label));
</script>

<template>
  <span class="snapshot-badge" :class="`tone-${tone}`" aria-hidden="true">
    <component :is="icon" :size="10" :stroke-width="3" />
  </span>
</template>

<style scoped>
.snapshot-badge {
  position: absolute;
  inset-block-start: 4px;
  inset-inline-end: 4px;
  display: grid;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  border-radius: var(--radius-xs);
  color: var(--text-on-media);
}

.tone-person,
.tone-other,
.tone-animal {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}

.tone-motion {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning-glow);
}

.tone-vehicle {
  background: var(--vehicle);
  box-shadow: 0 0 8px var(--vehicle-glow);
}
</style>
