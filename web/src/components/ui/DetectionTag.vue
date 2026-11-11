<script setup lang="ts">
/** Glass chip naming a detected label, tinted by label type. */
import { computed } from "vue";
import { labelIcon, labelTone } from "@/utils/labels";

const props = withDefaults(
  defineProps<{ label: string; text: string; size?: "sm" | "md" }>(),
  { size: "sm" },
);
const icon = computed(() => labelIcon(props.label));
const tone = computed(() => labelTone(props.label));
</script>

<template>
  <span
    class="detection-tag"
    :class="[`tone-${tone}`, `detection-tag--${size}`]"
  >
    <component
      :is="icon"
      :size="size === 'md' ? 13 : 12"
      :stroke-width="2.5"
      aria-hidden="true"
    />
    {{ text }}
  </span>
</template>

<style scoped>
.detection-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  backdrop-filter: blur(12px);
  border: 1px solid transparent;
  text-transform: capitalize;
}

.detection-tag--md {
  gap: 5px;
  block-size: 26px;
  padding-inline: 9px;
  font-size: var(--text-sm);
  font-weight: 500;
}

.tone-person,
.tone-other {
  background: var(--accent-surface);
  color: var(--accent-text);
  border-color: color-mix(in srgb, var(--accent) 24%, transparent);
}

.tone-animal {
  background: var(--online-surface);
  color: var(--online);
  border-color: color-mix(in srgb, var(--online) 22%, transparent);
}

.tone-motion {
  background: var(--warning-surface);
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 25%, transparent);
}

.tone-vehicle {
  background: var(--vehicle-surface);
  color: var(--vehicle);
  border-color: color-mix(in srgb, var(--vehicle) 24%, transparent);
}
</style>
