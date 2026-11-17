<script setup lang="ts">
/** Plays a finished export in a dialog. */
import AppDialog from "@/components/ui/AppDialog.vue";
import type { Export } from "@/types/export";
import { exportVideo } from "@/utils/exports";

defineProps<{ item?: Export }>();
const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <AppDialog v-model:open="open" :title="item?.name ?? ''" width="960px">
    <!-- the element only exists while open, so closing stops playback -->
    <video
      v-if="open && item"
      class="export-player"
      :src="exportVideo(item)"
      controls
      autoplay
      playsinline
    />
  </AppDialog>
</template>

<style scoped>
.export-player {
  display: block;
  inline-size: 100%;
  max-block-size: 70dvh;
  border-radius: var(--radius-sm);
  background: var(--bg-media);
}
</style>
