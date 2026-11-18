<script setup lang="ts">
/** Replaces the filters while objects are selected. */
import { onBeforeUnmount, onMounted, shallowRef } from "vue";
import { Trash2 } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";

defineProps<{ count: number; total: number }>();
const emit = defineEmits<{
  clear: [];
  selectAll: [];
  /** `immediate` skips the confirmation, requested by holding Shift */
  delete: [immediate: boolean];
}>();

const { t } = useT(["views/events", "common"]);
const admin = useIsAdmin();
const shift = shallowRef(false);

function trackShift(event: KeyboardEvent) {
  shift.value = event.shiftKey;
}

onMounted(() => {
  window.addEventListener("keydown", trackShift);
  window.addEventListener("keyup", trackShift);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", trackShift);
  window.removeEventListener("keyup", trackShift);
});
</script>

<template>
  <div class="bulk-bar" role="toolbar" :aria-label="t('selected', { count })">
    <span class="bulk-bar__count">{{ t("selected", { count }) }}</span>
    <AppButton size="sm" @click="emit('clear')">
      {{ t("common:button.unselect") }}
    </AppButton>
    <AppButton v-if="count < total" size="sm" @click="emit('selectAll')">
      {{ t("select_all") }}
    </AppButton>
    <AppButton
      v-if="admin"
      size="sm"
      variant="danger"
      @click="emit('delete', $event.shiftKey)"
    >
      <template #icon><Trash2 aria-hidden="true" /></template>
      {{ shift ? t("common:button.deleteNow") : t("common:button.delete") }}
    </AppButton>
  </div>
</template>

<style scoped>
.bulk-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.bulk-bar__count {
  margin-inline-end: 6px;
  color: var(--text-secondary);
  font-size: var(--text-md);
}
</style>
