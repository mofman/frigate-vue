<script setup lang="ts">
/** Small dialog for editing one short piece of text. An empty value is allowed. */
import { shallowRef, useId, watch } from "vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import { useT } from "@/composables/useT";

const props = defineProps<{
  title: string;
  description: string;
  value: string;
  busy?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ save: [value: string] }>();

const { t } = useT(["common"]);
const formId = useId();
const text = shallowRef("");

watch(open, (value) => {
  if (value) text.value = props.value;
});
</script>

<template>
  <AppDialog v-model:open="open" :title="title">
    <form
      :id="formId"
      class="text-entry"
      @submit.prevent="emit('save', text.trim())"
    >
      <p>{{ description }}</p>
      <input v-model="text" type="text" maxlength="100" :aria-label="title" />
    </form>
    <template #actions>
      <AppButton @click="open = false">{{ t("button.cancel") }}</AppButton>
      <AppButton
        type="submit"
        :form="formId"
        variant="primary"
        :disabled="busy"
      >
        {{ t("button.save") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.text-entry {
  display: grid;
  gap: 10px;

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--text-md);
  }

  input {
    inline-size: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);
  }
}
</style>
