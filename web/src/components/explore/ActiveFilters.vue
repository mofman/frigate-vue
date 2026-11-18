<script setup lang="ts">
/** Removable chips for every filter in effect. */
import { computed } from "vue";
import { Sparkles, X } from "@lucide/vue";
import { cameraLabel, useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { ExploreFilter } from "@/types/event";
import { isSimilaritySearch } from "@/utils/explore";
import { activeTags, removeTag, type ActiveTag } from "@/utils/exploreTags";

const props = defineProps<{
  filter: ExploreFilter;
  hour12: boolean;
  imperial: boolean;
  audioLabels: ReadonlySet<string>;
}>();
const emit = defineEmits<{ "update:filter": [filter: ExploreFilter] }>();

const { t } = useT([
  "views/search",
  "components/filter",
  "common",
  "objects",
  "audio",
]);
const { data: config } = useConfig();

const tags = computed(() => activeTags(props.filter));
const similarity = computed(() => isSimilaritySearch(props.filter));

function clock(time: string) {
  if (!props.hour12) return time;
  const [hours = "0", minutes = "00"] = time.split(":");
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour % 24 >= 12 ? "PM" : "AM"}`;
}

function keyLabel(tag: ActiveTag) {
  return tag.key === "is_submitted"
    ? t("components/filter:features.submittedToFrigatePlus.label")
    : t(`filter.label.${tag.key}`, { defaultValue: tag.key });
}

function valueLabel({ key, value }: ActiveTag) {
  switch (key) {
    case "before":
    case "after":
      return new Date(Number(value) * 1000).toLocaleDateString();
    case "time_range": {
      const [start = "", end = ""] = String(value).split(",");
      return `${clock(start)} - ${clock(end)}`;
    }
    case "min_score":
    case "max_score":
      return `${Math.round(Number(value) * 100)}%`;
    case "min_speed":
    case "max_speed":
      return `${value} ${t(props.imperial ? "common:unit.speed.mph" : "common:unit.speed.kph")}`;
    case "has_clip":
    case "has_snapshot":
    case "is_submitted":
      return t(value ? "common:button.yes" : "common:button.no");
    case "labels": {
      const name = String(value);
      return t(`${props.audioLabels.has(name) ? "audio" : "objects"}:${name}`, {
        defaultValue: name.replaceAll("_", " "),
      });
    }
    case "cameras":
      return cameraLabel(
        config.value?.cameras[String(value)],
        String(value).replaceAll("_", " "),
      );
    case "search_type":
      return t(`filter.searchType.${value}`, { defaultValue: String(value) });
    default:
      return String(value).replaceAll("_", " ");
  }
}

function clearSimilarity() {
  const { search_type: _type, event_id: _id, ...rest } = props.filter;
  emit("update:filter", rest);
}
</script>

<template>
  <ul v-if="tags.length || similarity" class="active-filters">
    <li v-if="similarity" class="active-filters__chip is-similarity">
      <Sparkles :size="12" aria-hidden="true" />
      <span>{{ t("similaritySearch.active") }}</span>
      <button
        type="button"
        :aria-label="t('similaritySearch.clear')"
        :title="t('similaritySearch.clear')"
        @click="clearSimilarity"
      >
        <X :size="12" />
      </button>
    </li>
    <li
      v-for="tag in tags"
      :key="`${tag.key}:${tag.value}`"
      class="active-filters__chip"
    >
      <span class="active-filters__key">{{ keyLabel(tag) }}</span>
      <span>{{ valueLabel(tag) }}</span>
      <button
        type="button"
        :aria-label="`${t('common:button.clear')} ${keyLabel(tag)}: ${valueLabel(tag)}`"
        @click="emit('update:filter', removeTag(filter, tag))"
      >
        <X :size="12" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 8px 24px 0;
  list-style: none;
}

.active-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-block-size: 26px;
  padding-inline: 10px 4px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: var(--text-sm);

  &.is-similarity {
    border-color: var(--selected-border);
    background: var(--selected-surface);
  }

  button {
    display: grid;
    place-items: center;
    inline-size: 20px;
    block-size: 20px;
    border-radius: 50%;
    color: var(--text-tertiary);

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
  }
}

.active-filters__key {
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .active-filters {
    padding-inline: 10px;
  }
}
</style>
