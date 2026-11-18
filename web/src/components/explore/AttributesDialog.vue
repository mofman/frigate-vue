<script setup lang="ts">
/** Choose one classification attribute per model for a tracked object. */
import { shallowRef, useId, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import { useT } from "@/composables/useT";

const props = defineProps<{
  label: string;
  models: Record<string, string[]>;
  selected: Record<string, string | null>;
  busy?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ save: [attributes: string[]] }>();

const { t } = useT(["views/explore", "common"]);
const formId = useId();
const draft = shallowRef<Record<string, string>>({});

watch(open, (value) => {
  if (!value) return;
  draft.value = Object.fromEntries(
    Object.keys(props.models).map((model) => [
      model,
      props.selected[model] ?? "",
    ]),
  );
});

function choose(model: string, event: Event) {
  draft.value = {
    ...draft.value,
    [model]: (event.target as HTMLSelectElement).value,
  };
}
</script>

<template>
  <AppDialog v-model:open="open" :title="t('details.editAttributes.title')">
    <form
      :id="formId"
      class="attributes"
      @submit.prevent="emit('save', Object.values(draft).filter(Boolean))"
    >
      <p>{{ t("details.editAttributes.desc", { label }) }}</p>
      <label v-for="(options, model) in models" :key="model">
        {{ String(model).replaceAll("_", " ") }}
        <select :value="draft[model]" @change="choose(String(model), $event)">
          <option value="">{{ t("common:label.none") }}</option>
          <option v-for="option in options" :key="option" :value="option">
            {{ option.replaceAll("_", " ") }}
          </option>
        </select>
      </label>
    </form>
    <template #actions>
      <AppButton @click="open = false">
        {{ t("common:button.cancel") }}
      </AppButton>
      <AppButton
        type="submit"
        :form="formId"
        variant="primary"
        :disabled="busy"
      >
        {{ t("common:button.save") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.attributes {
  display: grid;
  gap: 12px;

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-md);
  }

  label {
    display: grid;
    gap: 4px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    text-transform: capitalize;
  }

  select {
    padding: 7px 9px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
  }
}
</style>
