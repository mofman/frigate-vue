<script setup lang="ts">
/** "Live" or "Recording" badge in the stage corner. */
import { useT } from "@/composables/useT";

defineProps<{ live: boolean; scrubbing?: boolean }>();
const { t } = useT(["views/app"]);
</script>

<template>
  <Transition name="badge" mode="out-in">
    <span v-if="live" key="live" class="mode-badge mode-badge--live">
      <span class="mode-badge__dot" />
      {{ t("player.liveFeed") }}
    </span>
    <span v-else key="rec" class="mode-badge mode-badge--recording">
      {{ scrubbing ? t("player.scrubbing") : t("player.recording") }}
    </span>
  </Transition>
</template>

<style scoped>
.mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.mode-badge--live {
  background: var(--live);
  color: var(--live-ink);
  border: 1px solid var(--live-border);
  box-shadow: 0 0 24px var(--live-glow);
}

.mode-badge--recording {
  background: var(--bg-overlay-control);
  color: var(--text-on-media-muted);
  border: 1px solid var(--line-overlay);
  backdrop-filter: blur(12px);
}

.mode-badge__dot {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2.5s ease-in-out infinite;
}

.badge-enter-active,
.badge-leave-active {
  transition:
    opacity var(--dur-fast),
    translate var(--dur-fast) var(--ease);
}

.badge-enter-from,
.badge-leave-to {
  opacity: 0;
  translate: 0 -3px;
}
</style>
