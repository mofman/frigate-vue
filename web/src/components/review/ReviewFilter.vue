<script setup lang="ts">
/** Severity, label and zone filter for a camera's review items. */
import { computed } from "vue";
import { Filter } from "@lucide/vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import { useT } from "@/composables/useT";
import type { ReviewSeverity } from "@/types/frigate";

export type ReviewFilterValue = {
  severity: ReviewSeverity | "all";
  labels: string[];
  zones: string[];
};

const props = defineProps<{
  labels: string[];
  zones: string[];
  showLabel?: boolean;
  size?: "md" | "sm";
}>();
const model = defineModel<ReviewFilterValue>({ required: true });
const { t } = useT(["views/app", "objects", "views/events"]);

const active = computed(
  () =>
    (model.value.severity !== "all" ? 1 : 0) +
    model.value.labels.length +
    model.value.zones.length,
);

const severity = computed({
  get: () => model.value.severity,
  set: (value) => (model.value = { ...model.value, severity: value }),
});

function toggle(kind: "labels" | "zones", value: string) {
  const list = model.value[kind];
  model.value = {
    ...model.value,
    [kind]: list.includes(value)
      ? list.filter((item) => item !== value)
      : [...list, value],
  };
}

function reset() {
  model.value = { severity: "all", labels: [], zones: [] };
}

const severityOptions = computed(() => [
  { value: "all" as const, label: t("toolbar.all"), text: true },
  { value: "alert" as const, label: t("views/events:alerts"), text: true },
  {
    value: "detection" as const,
    label: t("views/events:detections"),
    text: true,
  },
]);
const hasZones = computed(() => props.zones.length > 0);
</script>

<template>
  <PopoverMenu align="end" width="300px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="t('toolbar.filter')"
        :size="size"
        :show-label="showLabel"
        :active="active > 0"
        :popovertarget="popovertarget"
      >
        <Filter />
        <span v-if="active" class="review-filter__count">{{ active }}</span>
      </IconButton>
    </template>
    <div class="review-filter">
      <MenuLabel>{{ t("toolbar.severity") }}</MenuLabel>
      <SegmentedToggle
        v-model="severity"
        class="review-filter__severity"
        :label="t('toolbar.severity')"
        :options="severityOptions"
      />
      <template v-if="labels.length">
        <MenuLabel>{{ t("toolbar.labels") }}</MenuLabel>
        <div class="review-filter__chips">
          <button
            v-for="label in labels"
            :key="label"
            type="button"
            class="review-filter__chip"
            :aria-pressed="model.labels.includes(label)"
            @click="toggle('labels', label)"
          >
            {{ t(`objects:${label}`, { defaultValue: label }) }}
          </button>
        </div>
      </template>
      <template v-if="hasZones">
        <MenuLabel>{{ t("toolbar.zones") }}</MenuLabel>
        <div class="review-filter__chips">
          <button
            v-for="zone in zones"
            :key="zone"
            type="button"
            class="review-filter__chip"
            :aria-pressed="model.zones.includes(zone)"
            @click="toggle('zones', zone)"
          >
            {{ zone.replaceAll("_", " ") }}
          </button>
        </div>
      </template>
      <button
        v-if="active"
        type="button"
        class="review-filter__reset"
        @click="reset"
      >
        {{ t("toolbar.clearFilters") }}
      </button>
    </div>
  </PopoverMenu>
</template>

<style scoped>
.review-filter {
  display: grid;
  gap: 2px;
  padding-block-end: 4px;
}

.review-filter__severity {
  margin-inline: 10px;
  justify-self: start;
}

.review-filter__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 10px 6px;
}

.review-filter__chip {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-transform: capitalize;

  &:hover {
    border-color: var(--line-hover);
  }

  &[aria-pressed="true"] {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: var(--selected-surface);
    color: var(--text-primary);
  }
}

.review-filter__reset {
  justify-self: start;
  margin: 4px 10px 0;
  color: var(--accent-text);
  font-size: var(--text-sm);
}

.review-filter__count {
  display: inline-grid;
  place-items: center;
  min-inline-size: 16px;
  block-size: 16px;
  padding-inline: 4px;
  border-radius: var(--radius-pill);
  background: var(--accent-strong);
  color: var(--text-on-media);
  font-size: var(--text-2xs);
  font-weight: 700;
}
</style>
