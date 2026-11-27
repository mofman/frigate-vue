<script setup lang="ts">
/** Heading, content and navigation shared by the setup wizard steps. */
import WizardFooter from "@/components/ui/WizardFooter.vue";
import { useT } from "@/composables/useT";

defineProps<{
  title: string;
  description?: string;
  canSkip?: boolean;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}>();
defineEmits<{ back: []; skip: []; next: [] }>();

const { t } = useT(["views/setup"]);
</script>

<template>
  <section class="setup-step">
    <header class="setup-step__header">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </header>
    <slot />
    <WizardFooter
      :back-label="t('setupWizard.actions.back')"
      :skip-label="canSkip ? t('setupWizard.actions.skip') : undefined"
      :next-label="
        busy
          ? t('setupWizard.actions.saving')
          : (nextLabel ?? t('setupWizard.actions.next'))
      "
      :next-disabled="nextDisabled"
      :busy="busy"
      @back="$emit('back')"
      @skip="$emit('skip')"
      @next="$emit('next')"
    />
  </section>
</template>

<style scoped>
.setup-step {
  display: grid;
  gap: 16px;
}

.setup-step__header {
  display: grid;
  gap: 4px;

  h1 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  p {
    font-size: var(--text-md);
    color: var(--text-secondary);
  }
}
</style>
