<script setup lang="ts">
/** Full details for one tracked object, a whole page on phones. */
import { computed, watch } from "vue";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import IconButton from "@/components/ui/IconButton.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import { useT } from "@/composables/useT";
import type { TrackedEvent } from "@/types/event";
import ObjectDetails from "./ObjectDetails.vue";
import ObjectSnapshot from "./ObjectSnapshot.vue";
import ResultMenu from "./ResultMenu.vue";
import TrackingDetails from "./TrackingDetails.vue";

export type ObjectTab = "snapshot" | "tracking_details";

const props = defineProps<{ event: TrackedEvent; canNavigate: boolean }>();
const tab = defineModel<ObjectTab>("tab", { required: true });
const emit = defineEmits<{
  close: [];
  previous: [];
  next: [];
  findSimilar: [];
  delete: [];
  change: [id: string, change: (event: TrackedEvent) => TrackedEvent];
}>();

const { t } = useT(["views/explore"]);

const open = computed({
  get: () => true,
  set: (value) => {
    if (!value) emit("close");
  },
});

const tabs = computed(() => [
  {
    value: "snapshot" as const,
    label: t(props.event.has_snapshot ? "type.snapshot" : "type.thumbnail"),
    text: true,
  },
  ...(props.event.has_clip
    ? [
        {
          value: "tracking_details" as const,
          label: t("type.tracking_details"),
          text: true,
        },
      ]
    : []),
]);

// not every object has a clip to track
watch(
  () => props.event.has_clip,
  (hasClip) => {
    if (!hasClip) tab.value = "snapshot";
  },
  { immediate: true },
);
</script>

<template>
  <AppDialog
    v-model:open="open"
    class="object-dialog"
    :title="t('trackedObjectDetails')"
    width="min(1240px, 94vw)"
  >
    <div class="object-dialog__bar">
      <SegmentedToggle
        v-model="tab"
        class="object-dialog__tabs"
        :label="t('trackedObjectDetails')"
        :options="tabs"
      />
      <ResultMenu
        detail
        :event="event"
        @find-similar="emit('findSimilar')"
        @delete="emit('delete')"
      />
      <template v-if="canNavigate">
        <IconButton
          size="sm"
          :label="t('searchResult.previousTrackedObject')"
          @click="emit('previous')"
        >
          <ChevronLeft />
        </IconButton>
        <IconButton
          size="sm"
          :label="t('searchResult.nextTrackedObject')"
          @click="emit('next')"
        >
          <ChevronRight />
        </IconButton>
      </template>
    </div>

    <TrackingDetails v-if="tab === 'tracking_details'" :event="event" />
    <div v-else class="object-dialog__overview">
      <ObjectSnapshot :event="event" />
      <ObjectDetails
        :event="event"
        @change="(id, change) => emit('change', id, change)"
      />
    </div>
  </AppDialog>
</template>

<style scoped>
.object-dialog__bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.object-dialog__tabs {
  margin-inline-end: auto;
}

.object-dialog__bar :deep(.result-menu__trigger) {
  color: var(--text-secondary);
}

.object-dialog__overview {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
  gap: 18px;
  min-block-size: 0;
}

.object-dialog__overview > :last-child {
  max-block-size: 72dvh;
  overflow-y: auto;
}

@media (max-width: 900px) {
  .object-dialog__overview {
    grid-template-columns: minmax(0, 1fr);
  }

  .object-dialog__overview > :last-child {
    max-block-size: none;
    overflow: visible;
  }
}

@media (max-width: 768px) {
  .object-dialog {
    inline-size: 100vw !important;
    max-inline-size: 100vw;
    block-size: 100dvh;
    max-block-size: 100dvh;
    margin: 0;
    border: none;
    border-radius: 0;
  }
}
</style>
