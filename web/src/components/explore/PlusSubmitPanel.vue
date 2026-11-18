<script setup lang="ts">
/** Confirm a tracked object's label and send its snapshot to Frigate+. */
import { computed, shallowRef, watch } from "vue";
import { CircleCheck } from "@lucide/vue";
import { http } from "@/api/http";
import AppButton from "@/components/ui/AppButton.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import { i18next } from "@/i18n";
import type { TrackedEvent } from "@/types/event";
import { eventLabelKey, plainText } from "@/utils/explore";

const props = defineProps<{ event: TrackedEvent }>();
const emit = defineEmits<{ submitted: [id: string] }>();

const { t } = useT(["components/dialog", "common", "objects", "audio"]);

type State = "reviewing" | "uploading" | "submitted";
const state = shallowRef<State>("reviewing");

watch(
  () => [props.event.id, props.event.plus_id] as const,
  ([, plusId]) => (state.value = plusId ? "submitted" : "reviewing"),
  { immediate: true },
);

const question = computed(() => {
  const label = props.event.label;
  if (i18next.language !== "en") {
    return plainText(
      t("explore.plus.review.question.ask_full", {
        untranslatedLabel: label,
        translatedLabel: t(eventLabelKey(props.event), { defaultValue: label }),
      }),
    );
  }
  return plainText(
    /^[aeiou]/i.test(label)
      ? t("explore.plus.review.question.ask_an", { label })
      : t("explore.plus.review.question.ask_a", { label }),
  );
});

async function submit(falsePositive: boolean) {
  // the answer can arrive after the dialog has moved to another object
  const id = props.event.id;
  state.value = "uploading";
  try {
    const result = falsePositive
      ? await http.put<{ success?: boolean }>(`events/${id}/false_positive`)
      : await http.post<{ success?: boolean }>(`events/${id}/plus`, {
          include_annotation: 1,
        });
    if (!result?.success) throw new Error("not accepted");
    emit("submitted", id);
    if (props.event.id === id) state.value = "submitted";
  } catch {
    if (props.event.id === id) state.value = "reviewing";
    showToast(t("explore.plus.review.toast.error"), "error");
  }
}
</script>

<template>
  <section class="plus-panel">
    <h3>
      {{ t("explore.plus.submitToPlus.label") }}
      <InfoTip :label="t('common:button.info')">
        {{ t("explore.plus.submitToPlus.desc") }}
      </InfoTip>
    </h3>
    <div v-if="state === 'reviewing'" class="plus-panel__question">
      <span>{{ question }}</span>
      <div>
        <AppButton size="sm" variant="primary" @click="submit(false)">
          {{ t("common:button.yes") }}
        </AppButton>
        <AppButton size="sm" variant="danger" @click="submit(true)">
          {{ t("common:button.no") }}
        </AppButton>
      </div>
    </div>
    <LoadingSpinner v-else-if="state === 'uploading'" :delay="0" :size="16" />
    <p v-else class="plus-panel__done">
      <CircleCheck :size="15" aria-hidden="true" />
      {{ t("explore.plus.review.state.submitted") }}
    </p>
  </section>
</template>

<style scoped>
.plus-panel {
  display: grid;
  gap: 6px;

  h3 {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    font-weight: 400;
  }
}

.plus-panel__question {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--text-md);

  div {
    display: flex;
    gap: 6px;
  }
}

.plus-panel__done {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--text-md);

  svg {
    color: var(--live);
  }
}
</style>
