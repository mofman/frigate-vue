<script setup lang="ts">
/** Explore preferences: default view, grid size and search source. */
import { computed } from "vue";
import { Settings } from "@lucide/vue";
import IconButton from "@/components/ui/IconButton.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import { useT } from "@/composables/useT";
import type { ExploreFilter, ExploreView, SearchSource } from "@/types/event";

const props = defineProps<{
  filter: ExploreFilter;
  semanticSearch: boolean;
}>();
const view = defineModel<ExploreView>("view", { required: true });
const columns = defineModel<number>("columns", { required: true });
const emit = defineEmits<{ "update:filter": [filter: ExploreFilter] }>();

const { t } = useT(["components/filter"]);

const viewOptions = computed(() => [
  {
    value: "summary" as const,
    label: t("explore.settings.defaultView.summary"),
    text: true,
  },
  {
    value: "grid" as const,
    label: t("explore.settings.defaultView.unfilteredGrid"),
    text: true,
  },
]);

const sources = computed<SearchSource[]>(() => {
  const current = props.filter.search_type;
  return current?.length && !current.includes("similarity")
    ? current
    : ["thumbnail"];
});

function sourceModel(source: SearchSource) {
  return computed({
    get: () => sources.value.includes(source),
    set: (enabled) => {
      const next = enabled
        ? [...sources.value, source]
        : sources.value.filter((item) => item !== source);
      // a search always needs something to look at
      if (next.length)
        emit("update:filter", { ...props.filter, search_type: next });
    },
  });
}
const thumbnails = sourceModel("thumbnail");
const descriptions = sourceModel("description");
</script>

<template>
  <PopoverMenu align="end" width="300px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="t('explore.settings.title')"
        :popovertarget="popovertarget"
      >
        <Settings />
      </IconButton>
    </template>
    <div class="explore-settings">
      <section>
        <h3>{{ t("explore.settings.defaultView.title") }}</h3>
        <p>{{ t("explore.settings.defaultView.desc") }}</p>
        <SegmentedToggle
          v-model="view"
          :label="t('explore.settings.defaultView.title')"
          :options="viewOptions"
        />
      </section>
      <section class="explore-settings__columns">
        <h3>{{ t("explore.settings.gridColumns.title") }}</h3>
        <p>{{ t("explore.settings.gridColumns.desc") }}</p>
        <div>
          <input
            v-model.number="columns"
            type="range"
            min="2"
            max="8"
            step="1"
            :aria-label="t('explore.settings.gridColumns.title')"
          />
          <output>{{ columns }}</output>
        </div>
      </section>
      <section v-if="semanticSearch">
        <h3>{{ t("explore.settings.searchSource.label") }}</h3>
        <p>{{ t("explore.settings.searchSource.desc") }}</p>
        <ToggleSwitch
          v-model="thumbnails"
          :label="t('explore.settings.searchSource.options.thumbnailImage')"
        />
        <ToggleSwitch
          v-model="descriptions"
          :label="t('explore.settings.searchSource.options.description')"
        />
      </section>
    </div>
  </PopoverMenu>
</template>

<style scoped>
.explore-settings {
  display: grid;
  gap: 16px;
  padding: 8px;

  section {
    display: grid;
    gap: 6px;
  }

  h3 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
  }

  p {
    margin: 0 0 4px;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
}

.explore-settings__columns div {
  display: flex;
  align-items: center;
  gap: 10px;

  input {
    flex: 1;
    accent-color: var(--accent-strong);
  }

  output {
    min-inline-size: 1ch;
    font-size: var(--text-md);
  }
}

@media (max-width: 768px) {
  /* phones always show two columns */
  .explore-settings__columns {
    display: none !important;
  }
}
</style>
