<script setup lang="ts">
/**
 * Confirm before restarting, then a full screen notice while Frigate comes
 * back. Mounted once in the shell; anything can open it through useRestart().
 */
import { RotateCcw } from "@lucide/vue";
import { useRestart } from "@/composables/useRestart";
import { useT } from "@/composables/useT";
import AppDialog from "@/components/ui/AppDialog.vue";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

const { t } = useT(["components/dialog", "common"]);
const { confirming, restarting, countdown, restart, reload } = useRestart();
</script>

<template>
  <AppDialog v-model:open="confirming" :title="t('restart.title')">
    <p class="restart-text">{{ t("restart.description") }}</p>
    <template #actions>
      <AppButton @click="confirming = false">
        {{ t("common:button.cancel") }}
      </AppButton>
      <AppButton variant="danger" @click="restart">
        <template #icon><RotateCcw /></template>
        {{ t("restart.button") }}
      </AppButton>
    </template>
  </AppDialog>

  <div
    v-if="restarting"
    class="restart-overlay"
    role="alertdialog"
    aria-modal="true"
    :aria-label="t('restart.restarting.title')"
  >
    <div class="restart-overlay__card">
      <LoadingSpinner />
      <h2>{{ t("restart.restarting.title") }}</h2>
      <p>{{ t("restart.restarting.content", { countdown }) }}</p>
      <AppButton @click="reload">
        {{ t("restart.restarting.button") }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.restart-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.restart-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 16px;
  background: var(--backdrop-dialog);
  backdrop-filter: blur(6px);
}

.restart-overlay__card {
  display: grid;
  justify-items: center;
  gap: 12px;
  max-inline-size: 360px;
  padding: 28px 24px;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
  text-align: center;

  h2 {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  p {
    font-size: var(--text-base);
    color: var(--text-secondary);
  }
}
</style>
