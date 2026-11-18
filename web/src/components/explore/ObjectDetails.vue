<script setup lang="ts">
/** A tracked object's facts, with editing for those who may change them. */
import { computed, onMounted, shallowRef, watch } from "vue";
import { ArrowRight, Check, Mic, Pencil, Sparkles, X } from "@lucide/vue";
import { errorMessage, http } from "@/api/http";
import { useQuery } from "@/api/query";
import { sendWs, useWsTopic } from "@/api/ws";
import DetectionTag from "@/components/ui/DetectionTag.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import {
  cameraLabel,
  useCamera,
  useConfig,
  useIsAdmin,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { TrackedEvent } from "@/types/event";
import { eventLabelKey, eventTopScore } from "@/utils/explore";
import { formatDateTime } from "@/utils/time";
import AttributesDialog from "./AttributesDialog.vue";
import PlusSubmitPanel from "./PlusSubmitPanel.vue";
import TextEntryDialog from "./TextEntryDialog.vue";

type EventChange = (event: TrackedEvent) => TrackedEvent;

const props = defineProps<{ event: TrackedEvent }>();
const emit = defineEmits<{ change: [id: string, change: EventChange] }>();

const { t } = useT(["views/explore", "common", "objects", "audio"]);
const { data: config } = useConfig();
const admin = useIsAdmin();
const timeOptions = useTimeOptions();
const camera = useCamera(() => props.event.camera);

const labelText = computed(() =>
  t(eventLabelKey(props.event), {
    defaultValue: props.event.label.replaceAll("_", " "),
  }),
);
const when = computed(() =>
  formatDateTime(props.event.start_time, timeOptions.value),
);

const asPercent = (value: number, round = Math.round) =>
  `${round(value * 100)}%`;
const topScore = computed(() => asPercent(eventTopScore(props.event)));
const subLabelScore = computed(() =>
  props.event.sub_label && props.event.data.sub_label_score
    ? asPercent(props.event.data.sub_label_score)
    : undefined,
);
const snapshotScore = computed(() =>
  props.event.has_snapshot
    ? asPercent(props.event.data.score ?? props.event.score ?? 0, Math.floor)
    : undefined,
);
const plateScore = computed(() =>
  props.event.data.recognized_license_plate_score
    ? asPercent(props.event.data.recognized_license_plate_score)
    : undefined,
);
const speed = computed(() =>
  props.event.data.average_estimated_speed
    ? props.event.data.average_estimated_speed.toFixed(1)
    : undefined,
);
const speedUnit = computed(() =>
  t(
    config.value?.ui?.unit_system === "imperial"
      ? "common:unit.speed.mph"
      : "common:unit.speed.kph",
  ),
);
const direction = computed(() => {
  const angle = props.event.data.velocity_angle;
  return angle ? `rotate(${(360 - angle) % 360}deg)` : undefined;
});

// ---- saving -----------------------------------------------------------------

const busy = shallowRef(false);

/** Run an edit, reporting failure with the given message key. */
async function attempt(
  request: () => Promise<void>,
  failure: (message: string) => string,
) {
  busy.value = true;
  try {
    await request();
    return true;
  } catch (error) {
    showToast(failure(errorMessage(error)), "error");
    return false;
  } finally {
    busy.value = false;
  }
}

// ---- sub label and license plate --------------------------------------------

const subLabelOpen = shallowRef(false);
const plateOpen = shallowRef(false);

async function saveSubLabel(text: string) {
  const { id, camera: cameraName, data } = props.event;
  // a typed value is certain, unless the existing score says otherwise
  const score = text ? data.sub_label_score || 1 : undefined;
  const saved = await attempt(
    async () => {
      await http.post(`events/${id}/sub_label`, {
        camera: cameraName,
        subLabel: text,
        subLabelScore: score,
      });
    },
    (message) =>
      t("details.item.toast.error.updatedSublabelFailed", {
        errorMessage: message,
      }),
  );
  if (!saved) return;
  showToast(t("details.item.toast.success.updatedSublabel"), "success");
  emit("change", id, (event) => ({
    ...event,
    sub_label: text,
    data: { ...event.data, sub_label_score: score },
  }));
  subLabelOpen.value = false;
}

async function savePlate(text: string) {
  const { id } = props.event;
  const score = text ? 1 : undefined;
  const saved = await attempt(
    async () => {
      await http.post(`events/${id}/recognized_license_plate`, {
        recognizedLicensePlate: text,
        recognizedLicensePlateScore: score,
      });
    },
    (message) =>
      t("details.item.toast.error.updatedLPRFailed", {
        errorMessage: message,
      }),
  );
  if (!saved) return;
  showToast(t("details.item.toast.success.updatedLPR"), "success");
  emit("change", id, (event) => ({
    ...event,
    data: {
      ...event.data,
      recognized_license_plate: text,
      recognized_license_plate_score: score,
    },
  }));
  plateOpen.value = false;
}

// ---- classification attributes ----------------------------------------------

const attributesOpen = shallowRef(false);
const hasCustomModels = computed(
  () => Object.keys(config.value?.classification?.custom ?? {}).length > 0,
);
const { data: modelData } = useQuery<Record<string, string[]>>(
  () =>
    hasCustomModels.value
      ? [
          "classification/attributes",
          { object_type: props.event.label, group_by_model: "true" },
        ]
      : null,
  { staleTime: 60_000 },
);
const models = computed(() => modelData.value ?? {});
const hasModels = computed(() => Object.keys(models.value).length > 0);

const selectedAttributes = computed(() => {
  const selections: Record<string, string | null> = {};
  for (const [model, options] of Object.entries(models.value)) {
    const value = props.event.data[model];
    selections[model] =
      typeof value === "string" && options.includes(value) ? value : null;
  }
  return selections;
});
const attributeList = computed(() =>
  Object.values(selectedAttributes.value)
    .filter((value): value is string => value !== null)
    .sort((a, b) => a.localeCompare(b)),
);

type AppliedAttribute = {
  model?: string;
  label?: string | null;
  score?: number | null;
};

async function saveAttributes(attributes: string[]) {
  const { id } = props.event;
  let applied: AppliedAttribute[] = [];
  const saved = await attempt(
    async () => {
      const result = await http.post<{ applied?: AppliedAttribute[] }>(
        `events/${id}/attributes`,
        { attributes },
      );
      applied = Array.isArray(result?.applied) ? result.applied : [];
    },
    (message) =>
      t("details.item.toast.error.updatedAttributesFailed", {
        errorMessage: message,
      }),
  );
  if (!saved) return;
  showToast(t("details.item.toast.success.updatedAttributes"), "success");
  emit("change", id, (event) => {
    const data = { ...event.data };
    for (const { model, label, score } of applied) {
      if (!model) continue;
      data[model] = label ?? null;
      data[`${model}_score`] = score ?? null;
    }
    return { ...event, data };
  });
  attributesOpen.value = false;
}

// ---- description ------------------------------------------------------------

const editing = shallowRef(false);
const description = shallowRef("");

watch(
  () => [props.event.id, props.event.data.description] as const,
  ([, text], previous) => {
    // a change arriving for this object must not wipe out unsaved typing
    if (editing.value && previous?.[0] === props.event.id) return;
    editing.value = false;
    description.value = text ?? "";
  },
  { immediate: true },
);

function cancelEdit() {
  editing.value = false;
  description.value = props.event.data.description ?? "";
}

async function saveDescription() {
  const { id } = props.event;
  const text = description.value;
  const saved = await attempt(
    async () => {
      await http.post(`events/${id}/description`, { description: text });
    },
    (message) =>
      t("details.tips.saveDescriptionFailed", { errorMessage: message }),
  );
  if (!saved) return;
  editing.value = false;
  showToast(t("details.tips.descriptionSaved"), "success");
  emit("change", id, (event) => ({
    ...event,
    data: { ...event.data, description: text },
  }));
}

const genai = computed(() => camera.value?.objects?.genai);
const canRegenerate = computed(
  () => admin.value && !!genai.value?.enabled && !!props.event.end_time,
);
/** a description is on its way once this object finishes */
const descriptionPending = computed(() => {
  const settings = genai.value;
  if (!settings?.enabled || props.event.end_time) return false;
  const zones = settings.required_zones ?? [];
  const objects = settings.objects ?? [];
  return (
    (!zones.length || props.event.zones.some((z) => zones.includes(z))) &&
    (!objects.length || objects.includes(props.event.label))
  );
});

const provider = computed(() => {
  const agent = Object.values(config.value?.genai ?? {}).find((item) =>
    item?.roles?.includes("descriptions"),
  );
  return agent?.provider?.replaceAll("_", " ") ?? t("generativeAI");
});

async function regenerate(source: "snapshot" | "thumbnails") {
  const { id } = props.event;
  const sent = await attempt(
    async () => {
      await http.put(`events/${id}/description/regenerate?source=${source}`);
    },
    (message) =>
      t("details.item.toast.error.regenerate", {
        provider: provider.value,
        errorMessage: message,
      }),
  );
  if (sent)
    showToast(
      t("details.item.toast.success.regenerate", { provider: provider.value }),
      "success",
      7000,
    );
}

// ---- speech transcription ---------------------------------------------------

const transcriptionState = useWsTopic<string>("audio_transcription_state");
const transcribing = computed(() => transcriptionState.value === "processing");
const canTranscribe = computed(
  () =>
    admin.value &&
    !!camera.value?.audio_transcription?.enabled &&
    props.event.label === "speech" &&
    !!props.event.end_time &&
    props.event.has_clip,
);

onMounted(() => sendWs("audioTranscriptionState", ""));

async function transcribe() {
  const sent = await attempt(
    async () => {
      await http.put("audio/transcribe", { event_id: props.event.id });
    },
    (message) =>
      t("details.item.toast.error.audioTranscription", {
        errorMessage: message,
      }),
  );
  if (sent)
    showToast(t("details.item.toast.success.audioTranscription"), "success");
}

// ---- Frigate+ ---------------------------------------------------------------

const canSubmit = computed(
  () =>
    admin.value &&
    !!config.value?.plus?.enabled &&
    props.event.data.type === "object" &&
    !!props.event.end_time &&
    props.event.has_snapshot,
);

function onSubmitted(id: string) {
  emit("change", id, (event) => ({ ...event, plus_id: "new_upload" }));
}
</script>

<template>
  <div class="object-details">
    <dl class="object-details__facts">
      <div>
        <dt>{{ t("details.label") }}</dt>
        <dd class="object-details__row">
          <DetectionTag
            :label="event.label"
            :text="
              event.sub_label ? `${labelText} (${event.sub_label})` : labelText
            "
            size="md"
          />
          <button
            v-if="admin && event.end_time"
            type="button"
            class="object-details__icon"
            :aria-label="t('details.editSubLabel.title')"
            :title="t('details.editSubLabel.title')"
            @click="subLabelOpen = true"
          >
            <Pencil :size="13" />
          </button>
        </dd>
      </div>
      <div>
        <dt class="object-details__row">
          {{ t("details.topScore.label") }}
          <InfoTip :label="t('details.scoreInfo')">
            {{ t("details.topScore.info") }}
          </InfoTip>
        </dt>
        <dd>
          {{ topScore
          }}<template v-if="subLabelScore"> ({{ subLabelScore }})</template>
        </dd>
      </div>
      <div v-if="snapshotScore">
        <dt>{{ t("details.snapshotScore.label") }}</dt>
        <dd>{{ snapshotScore }}</dd>
      </div>
      <div>
        <dt>{{ t("details.camera") }}</dt>
        <dd>{{ cameraLabel(camera, event.camera) }}</dd>
      </div>
      <div v-if="speed">
        <dt>{{ t("details.estimatedSpeed") }}</dt>
        <dd class="object-details__row">
          {{ speed }} {{ speedUnit }}
          <ArrowRight
            v-if="direction"
            :size="12"
            :style="{ transform: direction }"
            aria-hidden="true"
          />
        </dd>
      </div>
      <div>
        <dt>{{ t("details.timestamp") }}</dt>
        <dd>{{ when }}</dd>
      </div>
      <div v-if="event.zones.length">
        <dt>{{ t("details.zones") }}</dt>
        <dd class="object-details__zones">
          {{ event.zones.map((zone) => zone.replaceAll("_", " ")).join(", ") }}
        </dd>
      </div>
      <div v-if="event.data.recognized_license_plate">
        <dt>{{ t("details.recognizedLicensePlate") }}</dt>
        <dd class="object-details__row">
          {{ event.data.recognized_license_plate }}
          <template v-if="plateScore">({{ plateScore }})</template>
          <button
            v-if="admin"
            type="button"
            class="object-details__icon"
            :aria-label="t('details.editLPR.title')"
            :title="t('details.editLPR.title')"
            @click="plateOpen = true"
          >
            <Pencil :size="13" />
          </button>
        </dd>
      </div>
      <div v-if="hasCustomModels && hasModels">
        <dt class="object-details__row">
          {{ t("details.attributes") }}
          <button
            v-if="admin"
            type="button"
            class="object-details__icon"
            :aria-label="t('details.editAttributes.title')"
            :title="t('details.editAttributes.title')"
            @click="attributesOpen = true"
          >
            <Pencil :size="13" />
          </button>
        </dt>
        <dd>{{ attributeList.join(", ") || t("common:label.none") }}</dd>
      </div>
    </dl>

    <PlusSubmitPanel v-if="canSubmit" :event="event" @submitted="onSubmitted" />

    <section class="object-details__description">
      <header class="object-details__row">
        <h3>{{ t("details.description.label") }}</h3>
        <button
          v-if="admin && !editing"
          type="button"
          class="object-details__icon"
          :aria-label="t('common:button.edit')"
          :title="t('common:button.edit')"
          @click="editing = true"
        >
          <Pencil :size="13" />
        </button>
        <button
          v-if="canTranscribe"
          type="button"
          class="object-details__icon"
          :aria-label="t('itemMenu.audioTranscription.label')"
          :title="t('itemMenu.audioTranscription.label')"
          :disabled="transcribing"
          @click="transcribe"
        >
          <LoadingSpinner v-if="transcribing" :size="13" :delay="0" />
          <Mic v-else :size="13" />
        </button>
        <PopoverMenu v-if="canRegenerate" align="start" width="230px">
          <template #trigger="{ popovertarget }">
            <button
              type="button"
              class="object-details__icon"
              :aria-label="t('details.button.regenerate.label')"
              :title="t('details.button.regenerate.title')"
              :popovertarget="popovertarget"
            >
              <Sparkles :size="13" />
            </button>
          </template>
          <template #default="{ close }">
            <MenuItem
              v-if="event.has_snapshot"
              role="menuitem"
              @click="
                close();
                regenerate('snapshot');
              "
            >
              {{ t("details.regenerateFromSnapshot") }}
            </MenuItem>
            <MenuItem
              role="menuitem"
              @click="
                close();
                regenerate('thumbnails');
              "
            >
              {{ t("details.regenerateFromThumbnails") }}
            </MenuItem>
          </template>
        </PopoverMenu>
      </header>

      <form v-if="editing" @submit.prevent="saveDescription">
        <textarea
          v-model="description"
          rows="5"
          autofocus
          :aria-label="t('details.description.label')"
          :placeholder="t('details.description.placeholder')"
        />
        <div class="object-details__row is-end">
          <button
            type="button"
            class="object-details__icon"
            :aria-label="t('common:button.cancel')"
            :title="t('common:button.cancel')"
            @click="cancelEdit"
          >
            <X :size="15" />
          </button>
          <button
            type="submit"
            class="object-details__icon"
            :aria-label="t('common:button.save')"
            :title="t('common:button.save')"
            :disabled="busy"
          >
            <Check :size="15" />
          </button>
        </div>
      </form>
      <div v-else-if="descriptionPending" class="object-details__pending">
        <LoadingSpinner :delay="0" :size="18" />
        {{ t("details.description.aiTips") }}
      </div>
      <p v-else>{{ description || t("common:label.none") }}</p>
    </section>

    <TextEntryDialog
      v-model:open="subLabelOpen"
      :title="t('details.editSubLabel.title')"
      :description="t('details.editSubLabel.desc', { label: event.label })"
      :value="event.sub_label ?? ''"
      :busy="busy"
      @save="saveSubLabel"
    />
    <TextEntryDialog
      v-model:open="plateOpen"
      :title="t('details.editLPR.title')"
      :description="t('details.editLPR.desc', { label: event.label })"
      :value="event.data.recognized_license_plate ?? ''"
      :busy="busy"
      @save="savePlate"
    />
    <AttributesDialog
      v-model:open="attributesOpen"
      :label="event.label"
      :models="models"
      :selected="selectedAttributes"
      :busy="busy"
      @save="saveAttributes"
    />
  </div>
</template>

<style scoped>
.object-details {
  display: grid;
  align-content: start;
  gap: 18px;
  font-size: var(--text-md);
}

.object-details__facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px 16px;
  margin: 0;

  dt {
    margin-block-end: 4px;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }

  dd {
    margin: 0;
    text-transform: none;
  }
}

.object-details__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;

  &.is-end {
    justify-content: flex-end;
  }
}

.object-details__zones {
  text-transform: capitalize !important;
}

.object-details__icon {
  display: inline-grid;
  place-items: center;
  inline-size: 24px;
  block-size: 24px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.object-details__description {
  display: grid;
  gap: 6px;

  h3 {
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    font-weight: 400;
  }

  p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  form {
    display: grid;
    gap: 6px;
  }

  textarea {
    inline-size: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
    resize: vertical;
  }
}

.object-details__pending {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 20px 14px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  text-align: center;
}
</style>
