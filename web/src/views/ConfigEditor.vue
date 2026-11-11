<script setup lang="ts">
/**
 * Raw YAML config editor. Saves go to config/save as plain text; the server
 * validates them and its message is shown above the editor when it refuses.
 * In safe mode the current (invalid) config is validated on load, so the
 * reason Frigate is in safe mode shows straight away.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { Copy, RotateCcw, Save } from "@lucide/vue";
import type { JSONSchema7 } from "json-schema";
import { errorMessage, http } from "@/api/http";
import { useQuery } from "@/api/query";
import { useConfig } from "@/composables/useFrigate";
import { useRestart } from "@/composables/useRestart";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import { useDocumentTitle } from "@/composables/useUtil";
import CodeEditor from "@/components/config/CodeEditor.vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

type SaveOption = "saveonly" | "restart";

const { t } = useT(["views/configEditor"]);
useDocumentTitle(() => t("documentTitle"));

const { data: config } = useConfig();
const { data: rawResponse } = useQuery<string>("config/raw", {
  staleTime: 0,
  revalidateOnFocus: false,
});

/**
 * The backend JSON encodes the file but labels it text/plain, so the body
 * arrives as a quoted string with escaped newlines. Decode it here, and keep
 * accepting a plain body in case the endpoint is ever corrected.
 */
const raw = computed(() => {
  const body = rawResponse.value;
  if (body === undefined || !body.startsWith('"')) return body;
  try {
    const decoded: unknown = JSON.parse(body);
    return typeof decoded === "string" ? decoded : body;
  } catch {
    return body;
  }
});
const { requestRestart } = useRestart();

const text = shallowRef("");
/** what the server last returned or accepted, to tell when there are edits */
const saved = shallowRef<string | undefined>();
const error = shallowRef("");
const saving = shallowRef(false);
const dirty = computed(
  () => saved.value !== undefined && text.value !== saved.value,
);

// the schema only feeds hints, so the editor opens without it if it fails
const schema = shallowRef<JSONSchema7 | undefined>();
const schemaSettled = shallowRef(false);
onMounted(() => {
  http
    .get<JSONSchema7>("config/schema.json")
    .then((value) => (schema.value = value))
    .catch(() => undefined)
    .finally(() => (schemaSettled.value = true));
});

watch(
  raw,
  (value) => {
    if (value === undefined || dirty.value) return;
    text.value = value;
    saved.value = value;
  },
  { immediate: true },
);

async function save(option: SaveOption = "saveonly") {
  if (saving.value) return false;
  saving.value = true;
  const content = text.value;
  try {
    const response = await http.post<{ message?: string }>(
      "config/save",
      undefined,
      { params: { save_option: option }, text: content },
    );
    saved.value = content;
    error.value = "";
    if (response?.message) showToast(response.message, "success");
    return true;
  } catch (err) {
    error.value = errorMessage(err);
    showToast(t("toast.error.savingError"), "error");
    return false;
  } finally {
    saving.value = false;
  }
}

async function saveAndRestart() {
  if (await save("saveonly")) requestRestart();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    showToast(t("toast.success.copyToClipboard"), "success");
  } catch {
    // clipboard access is refused outside secure contexts
  }
}

// safe mode: validate the config that failed so the reason is visible
let validated = false;
watch(
  [() => config.value?.safe_mode, raw],
  async ([safeMode, value]) => {
    if (!safeMode || value === undefined || validated) return;
    validated = true;
    try {
      await http.post("config/save", undefined, {
        params: { save_option: "saveonly" },
        text: value,
      });
    } catch (err) {
      error.value = errorMessage(err);
    }
  },
  { immediate: true },
);

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
}
onMounted(() => window.addEventListener("beforeunload", onBeforeUnload));
onBeforeUnmount(() =>
  window.removeEventListener("beforeunload", onBeforeUnload),
);

onBeforeRouteLeave(() => !dirty.value || window.confirm(t("confirm")));
</script>

<template>
  <div class="config-editor">
    <PageHeader
      :title="t(config?.safe_mode ? 'safeConfigEditor' : 'configEditor')"
    >
      <template #meta>
        <span v-if="dirty" class="config-editor__dirty" aria-hidden="true" />
      </template>
      <template #actions>
        <AppButton compact @click="copy">
          <template #icon><Copy /></template>
          {{ t("copyConfig") }}
        </AppButton>
        <AppButton compact :disabled="saving" @click="saveAndRestart">
          <template #icon><RotateCcw /></template>
          {{ t("saveAndRestart") }}
        </AppButton>
        <AppButton compact variant="primary" :disabled="saving" @click="save()">
          <template #icon><Save /></template>
          {{ t("saveOnly") }}
        </AppButton>
      </template>
    </PageHeader>

    <div class="config-editor__body">
      <p v-if="config?.safe_mode" class="config-editor__safe">
        {{ t("safeModeDescription") }}
      </p>
      <pre v-if="error" class="config-editor__error" role="alert">{{
        error
      }}</pre>
      <CodeEditor
        v-if="saved !== undefined && schemaSettled"
        v-model="text"
        class="config-editor__code"
        :schema="schema"
        :label="t('configEditor')"
        @save="save()"
      />
      <div v-else class="config-editor__loading">
        <LoadingSpinner :size="28" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-editor {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.config-editor__dirty {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--warning);
  box-shadow: 0 0 6px var(--warning-glow);
}

.config-editor__body {
  flex: 1;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 24px 20px;
}

.config-editor__safe {
  font-size: var(--text-md);
  color: var(--warning);
}

.config-editor__error {
  flex-shrink: 0;
  max-block-size: 30%;
  overflow: auto;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid color-mix(in srgb, var(--danger), transparent 60%);
  background: var(--danger-surface);
  color: var(--danger);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.config-editor__code {
  flex: 1;
}

.config-editor__loading {
  flex: 1;
  display: grid;
  place-items: center;
}

@media (max-width: 768px) {
  /* the document scrolls on phones, so give the editor the screen it has */
  .config-editor {
    block-size: auto;
  }

  .config-editor__body {
    /* a flex basis would override the height in this auto height column */
    flex: none;
    padding: 10px 10px 12px;
    block-size: calc(
      100dvh - 112px - var(--tabbar-height) - env(safe-area-inset-bottom)
    );
  }
}
</style>
