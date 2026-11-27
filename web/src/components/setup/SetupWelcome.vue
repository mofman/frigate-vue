<script setup lang="ts">
/** First screen of the setup wizard. */
import logo from "@/assets/logo.svg";
import AppButton from "@/components/ui/AppButton.vue";
import { useT } from "@/composables/useT";

defineEmits<{ next: []; dismiss: [] }>();
const { t } = useT(["views/setup"]);
</script>

<template>
  <section class="setup-welcome">
    <img class="setup-welcome__logo" :src="logo" alt="" />
    <div class="setup-welcome__text">
      <h1>{{ t("setupWizard.welcome.title") }}</h1>
      <p>{{ t("setupWizard.welcome.description") }}</p>
    </div>
    <AppButton
      class="setup-welcome__start"
      variant="primary"
      @click="$emit('next')"
    >
      {{ t("setupWizard.welcome.getStarted") }}
    </AppButton>
    <button type="button" class="setup-welcome__skip" @click="$emit('dismiss')">
      {{ t("setupWizard.welcome.skipSetup") }}
    </button>
  </section>
</template>

<style scoped>
.setup-welcome {
  display: grid;
  justify-items: center;
  gap: 16px;
  padding-block: 12px;
  text-align: center;
}

.setup-welcome__logo {
  inline-size: 56px;
}

.setup-welcome__text {
  display: grid;
  gap: 6px;

  h1 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }

  p {
    font-size: var(--text-base);
    color: var(--text-secondary);
  }
}

.setup-welcome__start {
  inline-size: 100%;
}

.setup-welcome__skip {
  font-size: var(--text-sm);
  color: var(--text-tertiary);

  &:hover {
    color: var(--text-primary);
  }
}
</style>
