<script setup lang="ts">
/** Zoom in / out buttons pinned to the bottom of the timeline. */
import { ZoomIn, ZoomOut } from "@lucide/vue";
import IconButton from "@/components/ui/IconButton.vue";
import { useT } from "@/composables/useT";

const props = defineProps<{ level: number; levels: number }>();
const emit = defineEmits<{ "update:level": [level: number] }>();
const { t } = useT(["views/app", "views/events"]);
</script>

<template>
  <div class="timeline-zoom">
    <IconButton
      size="md"
      :label="t('views/events:zoomOut')"
      :disabled="props.level === 0"
      @click="emit('update:level', props.level - 1)"
    >
      <ZoomOut />
    </IconButton>
    <IconButton
      size="md"
      :label="t('views/events:zoomIn')"
      :disabled="props.level >= props.levels - 1"
      @click="emit('update:level', props.level + 1)"
    >
      <ZoomIn />
    </IconButton>
  </div>
</template>

<style scoped>
.timeline-zoom {
  display: flex;
  justify-content: center;
  gap: 8px;
}
</style>
