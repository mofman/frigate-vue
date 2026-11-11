<script setup lang="ts">
/** Export a clip of recordings for one camera. */
import { computed, shallowRef, watch } from "vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import { http } from "@/api/http";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";

const props = defineProps<{
  camera: string;
  /** the playhead, used to centre a custom range */
  time: number;
}>();
const open = defineModel<boolean>("open", { required: true });
const { t } = useT(["views/app"]);

type Preset = "1" | "4" | "8" | "12" | "24" | "custom";
const preset = shallowRef<Preset>("1");
const name = shallowRef("");
const start = shallowRef("");
const end = shallowRef("");
const busy = shallowRef(false);

const presets = computed(() => [
  ...(["1", "4", "8", "12", "24"] as const).map((hours) => ({
    value: hours,
    label: t("export.lastHours", { count: Number(hours) }),
    text: true,
  })),
  { value: "custom" as const, label: t("export.custom"), text: true },
]);

/** yyyy-mm-ddThh:mm in local time for datetime-local inputs */
function toLocalInput(seconds: number) {
  const date = new Date(seconds * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

watch(open, (value) => {
  if (!value) return;
  name.value = "";
  // a custom range starts around what is on screen
  start.value = toLocalInput(props.time - 300);
  end.value = toLocalInput(Math.min(props.time + 300, Date.now() / 1000));
});

const range = computed(() => {
  const now = Math.floor(Date.now() / 1000);
  if (preset.value !== "custom")
    return { after: now - Number(preset.value) * 3600, before: now };
  return {
    after: Math.floor(new Date(start.value).getTime() / 1000),
    before: Math.floor(new Date(end.value).getTime() / 1000),
  };
});
const valid = computed(
  () =>
    Number.isFinite(range.value.after) &&
    Number.isFinite(range.value.before) &&
    range.value.before > range.value.after,
);

async function submit() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  const { after, before } = range.value;
  try {
    await http.post(
      `export/${encodeURIComponent(props.camera)}/start/${after}/end/${before}`,
      { source: "recordings", name: name.value.trim() || undefined },
    );
    showToast(t("export.started"), "success");
    open.value = false;
  } catch {
    showToast(t("export.failed"), "error");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="t('export.title')" width="480px">
    <form id="export-form" class="export-form" @submit.prevent="submit">
      <SegmentedToggle
        v-model="preset"
        class="export-form__presets"
        :label="t('export.range')"
        :options="presets"
      />
      <div v-if="preset === 'custom'" class="export-form__custom">
        <label>
          <span>{{ t("export.start") }}</span>
          <input v-model="start" type="datetime-local" required />
        </label>
        <label>
          <span>{{ t("export.end") }}</span>
          <input v-model="end" type="datetime-local" required />
        </label>
      </div>
      <label>
        <span>{{ t("export.name") }}</span>
        <input
          v-model="name"
          type="text"
          maxlength="256"
          :placeholder="t('export.namePlaceholder')"
        />
      </label>
    </form>
    <template #actions>
      <button type="button" class="export-form__button" @click="open = false">
        {{ t("dialog.cancel") }}
      </button>
      <button
        type="submit"
        form="export-form"
        class="export-form__button is-primary"
        :disabled="!valid || busy"
      >
        {{ t("export.submit") }}
      </button>
    </template>
  </AppDialog>
</template>

<style scoped>
.export-form {
  display: grid;
  gap: 14px;

  label {
    display: grid;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  input {
    padding: 8px 10px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);
    color-scheme: dark;
  }
}

.export-form__presets {
  flex-wrap: wrap;
  justify-self: start;
}

.export-form__custom {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.export-form__button {
  block-size: 34px;
  padding-inline: 14px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--text-md);
  font-weight: 600;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  &.is-primary {
    border-color: transparent;
    background: var(--accent-strong);
    color: var(--text-on-media);
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
