<script setup lang="ts">
/** Camera, label, date and sort controls, plus More Filters and settings. */
import { computed, shallowRef } from "vue";
import { ArrowUpDown, Calendar, ListFilter, Tag } from "@lucide/vue";
import CameraFilter from "@/components/review/CameraFilter.vue";
import FilterChips from "@/components/ui/FilterChips.vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import type { ExploreFilter, SearchSort } from "@/types/event";
import {
  dateInputValue,
  endOfDateInput,
  sortOptions,
  startOfDateInput,
} from "@/utils/explore";
import MoreFiltersDialog from "./MoreFiltersDialog.vue";

const props = defineProps<{
  filter: ExploreFilter;
  cameras: CameraConfig[];
  labels: string[];
  audioLabels: ReadonlySet<string>;
  zones: string[];
  subLabels: string[];
  plates: string[];
  attributes: string[];
  showAttributes: boolean;
  plusEnabled: boolean;
  imperial: boolean;
}>();
const emit = defineEmits<{ "update:filter": [filter: ExploreFilter] }>();

const { t } = useT(["components/filter", "objects", "audio", "common"]);

const moreOpen = shallowRef(false);

function update(patch: Partial<ExploreFilter>) {
  emit("update:filter", { ...props.filter, ...patch });
}

const cameraModel = computed({
  get: () => props.filter.cameras ?? [],
  set: (cameras) => update({ cameras: cameras.length ? cameras : undefined }),
});
const labelModel = computed({
  get: () => props.filter.labels ?? [],
  set: (labels) => update({ labels: labels.length ? labels : undefined }),
});
const labelOptions = computed(() =>
  props.labels.map((label) => ({
    value: label,
    label: t(`${props.audioLabels.has(label) ? "audio" : "objects"}:${label}`, {
      defaultValue: label.replaceAll("_", " "),
    }),
  })),
);

const labelSummary = computed(() => {
  const count = labelModel.value.length;
  return count ? t("labels.count", { count }) : t("labels.all.short");
});

const after = computed({
  get: () => dateInputValue(props.filter.after),
  set: (value) => update({ after: startOfDateInput(value) }),
});
const before = computed({
  get: () => dateInputValue(props.filter.before),
  set: (value) => update({ before: endOfDateInput(value) }),
});
const hasDates = computed(
  () => props.filter.after !== undefined || props.filter.before !== undefined,
);

const SORT_LABELS: Record<SearchSort, string> = {
  date_asc: "sort.dateAsc",
  date_desc: "sort.dateDesc",
  score_asc: "sort.scoreAsc",
  score_desc: "sort.scoreDesc",
  speed_asc: "sort.speedAsc",
  speed_desc: "sort.speedDesc",
  relevance: "sort.relevance",
};
const sorts = computed(() => sortOptions(props.filter));
const currentSort = computed(
  () =>
    props.filter.sort ??
    (props.filter.query || props.filter.event_id ? "relevance" : "date_desc"),
);

const moreActive = computed(() => {
  const { filter } = props;
  return (
    !!filter.time_range ||
    filter.min_score !== undefined ||
    filter.max_score !== undefined ||
    filter.min_speed !== undefined ||
    filter.max_speed !== undefined ||
    filter.has_snapshot !== undefined ||
    filter.has_clip !== undefined ||
    filter.is_submitted !== undefined ||
    !!filter.zones?.length ||
    !!filter.sub_labels?.length ||
    !!filter.attributes?.length ||
    !!filter.recognized_license_plate?.length
  );
});
</script>

<template>
  <div class="filter-bar">
    <CameraFilter v-model="cameraModel" :cameras="cameras" />

    <PopoverMenu align="end" width="300px">
      <template #trigger="{ popovertarget }">
        <IconButton
          :label="labelSummary"
          show-label
          :active="labelModel.length > 0"
          :popovertarget="popovertarget"
        >
          <Tag />
        </IconButton>
      </template>
      <div class="filter-bar__panel">
        <FilterChips v-model="labelModel" :options="labelOptions" />
        <button
          v-if="labelModel.length"
          type="button"
          class="filter-bar__reset"
          @click="labelModel = []"
        >
          {{ t("labels.all.title") }}
        </button>
      </div>
    </PopoverMenu>

    <PopoverMenu align="end" width="240px">
      <template #trigger="{ popovertarget }">
        <IconButton
          :label="t('dates.all.short')"
          show-label
          :active="hasDates"
          :popovertarget="popovertarget"
        >
          <Calendar />
        </IconButton>
      </template>
      <div class="filter-bar__panel">
        <label class="filter-bar__field">
          {{ t("views/search:filter.label.after") }}
          <input v-model.lazy="after" type="date" :max="before || undefined" />
        </label>
        <label class="filter-bar__field">
          {{ t("views/search:filter.label.before") }}
          <input v-model.lazy="before" type="date" :min="after || undefined" />
        </label>
        <button
          v-if="hasDates"
          type="button"
          class="filter-bar__reset"
          @click="update({ after: undefined, before: undefined })"
        >
          {{ t("dates.all.title") }}
        </button>
      </div>
    </PopoverMenu>

    <PopoverMenu align="end" width="240px">
      <template #trigger="{ popovertarget }">
        <IconButton
          :label="t('sort.label')"
          :active="!!filter.sort"
          :popovertarget="popovertarget"
        >
          <ArrowUpDown />
        </IconButton>
      </template>
      <template #default="{ close }">
        <div role="menu">
          <MenuItem
            v-for="sort in sorts"
            :key="sort"
            :selected="currentSort === sort"
            @click="
              update({ sort });
              close();
            "
          >
            {{ t(SORT_LABELS[sort]) }}
          </MenuItem>
        </div>
      </template>
    </PopoverMenu>

    <IconButton
      :label="t('more')"
      :active="moreActive"
      @click="moreOpen = true"
    >
      <ListFilter />
    </IconButton>

    <slot />

    <MoreFiltersDialog
      v-model:open="moreOpen"
      :filter="filter"
      :zones="zones"
      :sub-labels="subLabels"
      :plates="plates"
      :attributes="attributes"
      :show-attributes="showAttributes"
      :plus-enabled="plusEnabled"
      :imperial="imperial"
      @update:filter="emit('update:filter', $event)"
    />
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.filter-bar__panel {
  display: grid;
  gap: 10px;
  padding: 6px;
}

.filter-bar__field {
  display: grid;
  gap: 4px;
  color: var(--text-secondary);
  font-size: var(--text-sm);

  input {
    padding: 6px 8px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
  }
}

.filter-bar__reset {
  justify-self: start;
  color: var(--accent-text);
  font-size: var(--text-sm);
}
</style>
