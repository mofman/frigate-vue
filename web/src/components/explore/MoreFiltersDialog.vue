<script setup lang="ts">
/** The less common filters, edited together and applied at once. */
import { computed, shallowRef, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import FilterChips from "@/components/ui/FilterChips.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { ExploreFilter } from "@/types/event";

type ListKey =
  "zones" | "sub_labels" | "attributes" | "recognized_license_plate";
type FlagKey = "has_snapshot" | "has_clip" | "is_submitted";
type Flag = "any" | "yes" | "no";

const MIN_SCORE = 50;
const MAX_SCORE = 100;
const MIN_SPEED = 1;
const MAX_SPEED = 150;
const DAY_START = "00:00";
const DAY_END = "23:59";

const props = defineProps<{
  filter: ExploreFilter;
  zones: string[];
  subLabels: string[];
  plates: string[];
  attributes: string[];
  showAttributes: boolean;
  plusEnabled: boolean;
  imperial: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ "update:filter": [filter: ExploreFilter] }>();

const { t } = useT(["components/filter", "views/search", "common"]);

const draft = shallowRef<ExploreFilter>({});
const start = shallowRef(DAY_START);
const end = shallowRef(DAY_END);
const minScore = shallowRef(MIN_SCORE);
const maxScore = shallowRef(MAX_SCORE);
const minSpeed = shallowRef(MIN_SPEED);
const maxSpeed = shallowRef(MAX_SPEED);
const plateSearch = shallowRef("");

function load(filter: ExploreFilter) {
  draft.value = { ...filter };
  const [from, to] = filter.time_range?.split(",") ?? [];
  start.value = from ?? DAY_START;
  end.value = !to || to === "24:00" ? DAY_END : to;
  minScore.value = Math.round((filter.min_score ?? MIN_SCORE / 100) * 100);
  maxScore.value = Math.round((filter.max_score ?? MAX_SCORE / 100) * 100);
  minSpeed.value = filter.min_speed ?? MIN_SPEED;
  maxSpeed.value = filter.max_speed ?? MAX_SPEED;
  plateSearch.value = "";
}

watch(open, (value) => {
  if (value) load(props.filter);
});

function listModel(key: ListKey) {
  return computed({
    get: () => draft.value[key] ?? [],
    set: (value: string[]) =>
      (draft.value = {
        ...draft.value,
        [key]: value.length ? value : undefined,
      }),
  });
}
const zoneModel = listModel("zones");
const subLabelModel = listModel("sub_labels");
const attributeModel = listModel("attributes");
const plateModel = listModel("recognized_license_plate");

function flagModel(key: FlagKey) {
  return computed<Flag>({
    get: () =>
      draft.value[key] === undefined ? "any" : draft.value[key] ? "yes" : "no",
    set: (value) => {
      const next: ExploreFilter = {
        ...draft.value,
        [key]: value === "any" ? undefined : value === "yes" ? 1 : 0,
      };
      // only objects with a snapshot can have been submitted
      if (key === "has_snapshot" && value !== "yes")
        next.is_submitted = undefined;
      draft.value = next;
    },
  });
}
const snapshotModel = flagModel("has_snapshot");
const clipModel = flagModel("has_clip");
const submittedModel = flagModel("is_submitted");

const flagOptions = computed(() => [
  { value: "any" as const, label: t("common:label.all"), text: true },
  { value: "yes" as const, label: t("common:button.yes"), text: true },
  { value: "no" as const, label: t("common:button.no"), text: true },
]);

const asOptions = (values: string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("_", " ") }));

const plateOptions = computed(() => {
  const query = plateSearch.value.trim().toLowerCase();
  const chosen = plateModel.value;
  return props.plates
    .filter(
      (plate) => chosen.includes(plate) || plate.toLowerCase().includes(query),
    )
    .slice(0, 60)
    .map((value) => ({ value, label: value }));
});

const speedUnit = computed(() =>
  t(props.imperial ? "common:unit.speed.mph" : "common:unit.speed.kph"),
);

function reset() {
  load({
    ...props.filter,
    time_range: undefined,
    zones: undefined,
    sub_labels: undefined,
    attributes: undefined,
    recognized_license_plate: undefined,
    min_score: undefined,
    max_score: undefined,
    min_speed: undefined,
    max_speed: undefined,
    has_snapshot: undefined,
    has_clip: undefined,
    is_submitted: undefined,
  });
}

function apply() {
  if (minScore.value > maxScore.value) {
    showToast(
      t("views/search:filter.toast.error.minScoreMustBeLessOrEqualMaxScore"),
      "error",
    );
    return;
  }
  if (minSpeed.value > maxSpeed.value) {
    showToast(
      t("views/search:filter.toast.error.minSpeedMustBeLessOrEqualMaxSpeed"),
      "error",
    );
    return;
  }
  const wholeDay = start.value === DAY_START && end.value === DAY_END;
  emit("update:filter", {
    ...draft.value,
    time_range: wholeDay ? undefined : `${start.value},${end.value}`,
    min_score: minScore.value > MIN_SCORE ? minScore.value / 100 : undefined,
    max_score: maxScore.value < MAX_SCORE ? maxScore.value / 100 : undefined,
    min_speed: minSpeed.value > MIN_SPEED ? minSpeed.value : undefined,
    max_speed: maxSpeed.value < MAX_SPEED ? maxSpeed.value : undefined,
  });
  open.value = false;
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    class="more-filters"
    :title="t('more')"
    width="520px"
  >
    <form
      id="explore-more-filters"
      class="more-filters__form"
      @submit.prevent="apply"
    >
      <fieldset>
        <legend>{{ t("timeRange") }}</legend>
        <div class="more-filters__pair">
          <input
            v-model="start"
            type="time"
            required
            :aria-label="`${t('timeRange')}: ${t('views/search:filter.label.after')}`"
          />
          <input
            v-model="end"
            type="time"
            required
            :min="start"
            :aria-label="`${t('timeRange')}: ${t('views/search:filter.label.before')}`"
          />
        </div>
      </fieldset>

      <fieldset v-if="zones.length">
        <legend>{{ t("zones.label") }}</legend>
        <FilterChips v-model="zoneModel" :options="asOptions(zones)" />
      </fieldset>

      <fieldset v-if="subLabels.length">
        <legend>{{ t("subLabels.label") }}</legend>
        <FilterChips v-model="subLabelModel" :options="asOptions(subLabels)" />
      </fieldset>

      <fieldset v-if="showAttributes && attributes.length">
        <legend>{{ t("attributes.label") }}</legend>
        <FilterChips
          v-model="attributeModel"
          :options="asOptions(attributes)"
        />
      </fieldset>

      <fieldset v-if="plates.length">
        <legend>{{ t("recognizedLicensePlates.title") }}</legend>
        <input
          v-model="plateSearch"
          type="search"
          :aria-label="t('recognizedLicensePlates.placeholder')"
          :placeholder="t('recognizedLicensePlates.placeholder')"
        />
        <FilterChips v-model="plateModel" :options="plateOptions" />
        <p v-if="!plateOptions.length" class="more-filters__hint">
          {{ t("recognizedLicensePlates.noLicensePlatesFound") }}
        </p>
      </fieldset>

      <fieldset>
        <legend>{{ t("score") }}</legend>
        <div class="more-filters__pair">
          <label>
            {{ t("views/search:filter.label.min_score") }}
            <input
              v-model.number="minScore"
              type="number"
              :min="MIN_SCORE"
              :max="MAX_SCORE"
              required
            />
          </label>
          <label>
            {{ t("views/search:filter.label.max_score") }}
            <input
              v-model.number="maxScore"
              type="number"
              :min="MIN_SCORE"
              :max="MAX_SCORE"
              required
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{{ t("estimatedSpeed", { unit: speedUnit }) }}</legend>
        <div class="more-filters__pair">
          <label>
            {{ t("views/search:filter.label.min_speed") }}
            <input
              v-model.number="minSpeed"
              type="number"
              :min="MIN_SPEED"
              :max="MAX_SPEED"
              required
            />
          </label>
          <label>
            {{ t("views/search:filter.label.max_speed") }}
            <input
              v-model.number="maxSpeed"
              type="number"
              :min="MIN_SPEED"
              :max="MAX_SPEED"
              required
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>{{ t("features.label") }}</legend>
        <div class="more-filters__flag">
          <span>{{ t("features.hasSnapshot") }}</span>
          <SegmentedToggle
            v-model="snapshotModel"
            :label="t('features.hasSnapshot')"
            :options="flagOptions"
          />
        </div>
        <div class="more-filters__flag">
          <span>{{ t("features.hasVideoClip") }}</span>
          <SegmentedToggle
            v-model="clipModel"
            :label="t('features.hasVideoClip')"
            :options="flagOptions"
          />
        </div>
        <div
          v-if="plusEnabled && draft.has_snapshot === 1"
          class="more-filters__flag"
        >
          <span>{{ t("features.submittedToFrigatePlus.label") }}</span>
          <SegmentedToggle
            v-model="submittedModel"
            :label="t('features.submittedToFrigatePlus.label')"
            :options="flagOptions"
          />
        </div>
      </fieldset>
    </form>
    <template #actions>
      <AppButton @click="reset">{{ t("common:button.reset") }}</AppButton>
      <AppButton type="submit" form="explore-more-filters" variant="primary">
        {{ t("common:button.apply") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.more-filters__form {
  display: grid;
  gap: 16px;
  max-block-size: min(62dvh, 620px);
  padding-inline-end: 4px;
  overflow-y: auto;

  fieldset {
    display: grid;
    gap: 8px;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-block-end: 6px;
    padding: 0;
    color: var(--text-primary);
    font-size: var(--text-md);
    font-weight: 600;
  }

  input {
    inline-size: 100%;
    padding: 7px 9px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);
  }
}

.more-filters__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  label {
    display: grid;
    gap: 4px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
}

.more-filters__flag {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--text-md);
}

.more-filters__hint {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}
</style>
