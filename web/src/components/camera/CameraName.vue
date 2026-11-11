<script setup lang="ts">
/** Status dot plus camera name, drawn over video. */
import StatusDot from "@/components/ui/StatusDot.vue";

defineProps<{ name: string; state?: "live" | "alert" | "offline" }>();
</script>

<template>
  <div class="camera-name">
    <StatusDot :state="state ?? 'live'" />
    <span class="camera-name__text">{{ name }}</span>
  </div>
</template>

<style scoped>
.camera-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

.camera-name__text {
  font-size: var(--text-md);
  font-weight: 600;
  color: var(--text-on-media);
  text-shadow: var(--text-shadow-media);
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
