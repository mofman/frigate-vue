<script setup lang="ts">
/**
 * Export bar under the stage. The clip itself is picked on the timeline;
 * this shows what is selected and holds the options and the actions.
 */
import { computed } from "vue";
import { Check, Download, Play, Square, Video, X } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import type { ExportSelection } from "@/composables/useExportSelection";
import { cameraLabel, useTimeOptions } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { CameraConfig, ReviewSegment } from "@/types/frigate";
import { rangeAround, reviewRange } from "@/utils/exportRange";
import { formatDuration, formatTime } from "@/utils/time";

const props = defineProps<{
  selection: ExportSelection;
  cameras: CameraConfig[];
  /** the camera on stage, always part of the export */
  camera: string;
  /** playhead time, presets are centred on it */
  time: number;
  /** review item under the playhead, offered as a preset */
  review?: ReviewSegment;
  earliest: number;
}>();

const { t } = useT(["views/app"]);
const timeOptions = useTimeOptions();

const label = (time: number) => formatTime(time, timeOptions.value);
const range = computed(() => props.selection.range.value);

const PRESETS = [60, 300, 3600];
function preset(seconds: number) {
  props.selection.setRange(
    rangeAround(props.time, seconds, {
      earliest: props.earliest,
      now: Date.now() / 1000,
    }),
  );
}
function eventPreset() {
  if (props.review)
    props.selection.setRange(reviewRange(props.review, Date.now() / 1000));
}
/** Escape cancels the export, unless it is closing one of the bar's menus. */
function onEscape(event: KeyboardEvent) {
  if (document.querySelector(":popover-open")) return;
  event.stopPropagation();
  props.selection.close();
}
function presetLabel(seconds: number) {
  return seconds < 3600
    ? t("export.minutes", { count: seconds / 60 })
    : t("export.hours", { count: seconds / 3600 });
}

const streams = computed(() => [
  { value: "auto" as const, label: t("export.streamAuto"), text: true },
  { value: "main" as const, label: t("export.streamMain"), text: true },
  { value: "sub" as const, label: t("export.streamSub"), text: true },
]);

const cameraCount = computed(() => props.selection.cameras.value.length);
const camerasLabel = computed(() =>
  cameraCount.value > 1
    ? t("review.camerasSelected", { count: cameraCount.value })
    : t("export.addCameras"),
);
</script>

<template>
  <form
    class="export-bar"
    :aria-label="t('export.title')"
    @submit.prevent="selection.submit()"
    @keydown.esc="onEscape"
  >
    <div class="export-bar__range">
      <p class="export-bar__readout" aria-live="polite">
        <time>{{ label(range.start) }}</time>
        <span aria-hidden="true">→</span>
        <time>{{ label(range.end) }}</time>
        <span class="export-bar__duration">{{
          formatDuration(selection.duration.value)
        }}</span>
      </p>
      <div
        class="export-bar__presets"
        role="group"
        :aria-label="t('export.presets')"
      >
        <button
          v-if="review"
          type="button"
          class="export-bar__chip"
          @click="eventPreset"
        >
          {{ t("export.thisEvent") }}
        </button>
        <button
          v-for="seconds in PRESETS"
          :key="seconds"
          type="button"
          class="export-bar__chip"
          @click="preset(seconds)"
        >
          {{ presetLabel(seconds) }}
        </button>
      </div>
    </div>

    <div class="export-bar__options">
      <input
        :value="selection.name.value"
        class="export-bar__name"
        type="text"
        maxlength="256"
        :aria-label="t('export.name')"
        :placeholder="t('export.namePlaceholder')"
        @input="selection.setName(($event.target as HTMLInputElement).value)"
      />
      <SegmentedToggle
        :model-value="selection.stream.value"
        :label="t('export.stream')"
        :options="streams"
        @update:model-value="selection.setStream"
      />
      <PopoverMenu v-if="cameras.length > 1" align="start" width="240px">
        <template #trigger="{ popovertarget }">
          <IconButton
            :label="camerasLabel"
            show-label
            :active="cameraCount > 1"
            :popovertarget="popovertarget"
          >
            <Video />
          </IconButton>
        </template>
        <MenuItem
          v-for="cam in cameras"
          :key="cam.name"
          :selected="selection.cameras.value.includes(cam.name)"
          :disabled="cam.name === camera"
          @click="selection.toggleCamera(cam.name)"
        >
          <template #icon>
            <Check
              :class="{
                'export-bar__unchecked': !selection.cameras.value.includes(
                  cam.name,
                ),
              }"
            />
          </template>
          {{ cameraLabel(cam) }}
        </MenuItem>
      </PopoverMenu>
    </div>

    <div class="export-bar__actions">
      <AppButton
        compact
        :aria-pressed="selection.previewing.value"
        @click="selection.setPreviewing(!selection.previewing.value)"
      >
        <template #icon>
          <Square v-if="selection.previewing.value" />
          <Play v-else />
        </template>
        {{
          selection.previewing.value
            ? t("export.stopPreview")
            : t("export.preview")
        }}
      </AppButton>
      <AppButton compact @click="selection.close()">
        <template #icon><X /></template>
        {{ t("dialog.cancel") }}
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        :disabled="selection.busy.value"
      >
        <template #icon><Download /></template>
        {{
          cameraCount > 1
            ? t("export.submitMany", { count: cameraCount })
            : t("export.submit")
        }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.export-bar {
  container-type: inline-size;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid color-mix(in srgb, var(--export) 45%, transparent);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  transition:
    opacity var(--dur),
    translate var(--dur) var(--ease);

  @starting-style {
    opacity: 0;
    translate: 0 8px;
  }
}

.export-bar__range,
.export-bar__options,
.export-bar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

.export-bar__actions {
  margin-inline-start: auto;
}

.export-bar__readout {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-weight: 600;
  white-space: nowrap;

  span[aria-hidden] {
    color: var(--text-tertiary);
  }
}

.export-bar__duration {
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--export-surface);
  color: var(--accent-text);
  font-size: var(--text-xs);
}

.export-bar__presets {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.export-bar__chip {
  block-size: 26px;
  padding-inline: 9px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  transition:
    color var(--dur),
    background var(--dur),
    border-color var(--dur);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--line-hover);
  }
}

.export-bar__name {
  inline-size: 160px;
  block-size: 34px;
  padding-inline: 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-md);

  &::placeholder {
    color: var(--text-tertiary);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--selected-border);
  }
}

.export-bar__unchecked {
  visibility: hidden;
}

/* phones: the options flow with the actions so the timeline keeps its room */
@container (max-width: 520px) {
  .export-bar__options {
    display: contents;
  }

  .export-bar__name {
    flex: 1 1 120px;
    min-inline-size: 0;
  }
}
</style>
