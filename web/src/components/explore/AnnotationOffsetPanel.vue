<script setup lang="ts">
/** Lines detection boxes up with the recording, optionally saving the offset. */
import { shallowRef } from "vue";
import { ExternalLink, Minus, Plus } from "@lucide/vue";
import { errorMessage, http } from "@/api/http";
import { invalidate } from "@/api/query";
import AppButton from "@/components/ui/AppButton.vue";
import { useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import { plainText } from "@/utils/explore";
import {
  ANNOTATION_OFFSET_MAX,
  ANNOTATION_OFFSET_MIN,
  ANNOTATION_OFFSET_STEP,
  clampOffset,
} from "@/utils/tracking";

const props = defineProps<{ camera: string }>();
const offset = defineModel<number>({ required: true });

const { t } = useT(["views/explore", "common"]);
const admin = useIsAdmin();
const saving = shallowRef(false);

function step(delta: number) {
  offset.value = clampOffset(offset.value + delta);
}

async function save() {
  saving.value = true;
  try {
    await http.put(
      `config/set?cameras.${props.camera}.detect.annotation_offset=${offset.value}`,
      { requires_restart: 0 },
    );
    showToast(
      t("trackingDetails.annotationSettings.offset.toast.success", {
        camera: props.camera,
      }),
      "success",
    );
    invalidate("config");
  } catch (error) {
    showToast(
      t("common:toast.save.error.title", {
        errorMessage: errorMessage(error),
      }),
      "error",
    );
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="offset-panel">
    <h3>{{ t("trackingDetails.annotationSettings.offset.label") }}</h3>
    <p>
      {{
        plainText(
          t("trackingDetails.annotationSettings.offset.millisecondsToOffset"),
        )
      }}
    </p>
    <div class="offset-panel__control">
      <button
        type="button"
        :aria-label="t('ui.offsetDecrease')"
        :disabled="offset <= ANNOTATION_OFFSET_MIN"
        @click="step(-ANNOTATION_OFFSET_STEP)"
      >
        <Minus :size="14" />
      </button>
      <input
        v-model.number="offset"
        type="range"
        :min="ANNOTATION_OFFSET_MIN"
        :max="ANNOTATION_OFFSET_MAX"
        :step="ANNOTATION_OFFSET_STEP"
        :aria-label="t('trackingDetails.annotationSettings.offset.label')"
      />
      <button
        type="button"
        :aria-label="t('ui.offsetIncrease')"
        :disabled="offset >= ANNOTATION_OFFSET_MAX"
        @click="step(ANNOTATION_OFFSET_STEP)"
      >
        <Plus :size="14" />
      </button>
    </div>
    <div class="offset-panel__value">
      <output>{{ offset > 0 ? "+" : "" }}{{ offset }}ms</output>
      <AppButton size="sm" @click="offset = 0">
        {{ t("common:button.reset") }}
      </AppButton>
      <AppButton
        v-if="admin"
        size="sm"
        variant="primary"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? t("common:button.saving") : t("common:button.save") }}
      </AppButton>
    </div>
    <p>{{ t("trackingDetails.annotationSettings.offset.tips") }}</p>
    <a
      href="https://docs.frigate.video/troubleshooting/dummy-camera#annotation-offset"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t("common:readTheDocumentation") }}
      <ExternalLink :size="12" aria-hidden="true" />
    </a>
  </section>
</template>

<style scoped>
.offset-panel {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--text-sm);

  h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-md);
  }

  p {
    margin: 0;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-text);
  }
}

.offset-panel__control {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    flex: 1;
    min-inline-size: 0;
    accent-color: var(--accent-strong);
  }

  button {
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);

    &:disabled {
      opacity: 0.4;
    }
  }
}

.offset-panel__value {
  display: flex;
  align-items: center;
  gap: 6px;

  output {
    margin-inline-end: auto;
    color: var(--text-primary);
    font-family: var(--font-mono, monospace);
  }
}
</style>
