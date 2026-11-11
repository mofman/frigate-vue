<script setup lang="ts">
/** How far back the timeline reaches: presets or a start day. */
import { computed } from "vue";
import { Calendar, Check } from "@lucide/vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useT } from "@/composables/useT";

defineProps<{ showLabel?: boolean }>();
/** hours back from now */
const hours = defineModel<number>({ required: true });
const { t } = useT(["views/app"]);

const PRESETS = [24, 72, 168, 336];

const label = computed(() => {
  if (PRESETS.includes(hours.value))
    return hours.value === 24
      ? t("toolbar.last24h")
      : t("toolbar.lastDays", { count: hours.value / 24 });
  const since = new Date(Date.now() - hours.value * 3600_000);
  return t("toolbar.since", { date: since.toLocaleDateString() });
});

const today = new Date().toISOString().slice(0, 10);

function onDate(event: Event, close: () => void) {
  const value = (event.target as HTMLInputElement).valueAsDate;
  if (!value) return;
  // the input gives UTC midnight, start from local midnight of that day
  const local = new Date(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
  hours.value = Math.max(
    1,
    Math.ceil((Date.now() - local.getTime()) / 3600_000),
  );
  close();
}
</script>

<template>
  <PopoverMenu align="end" width="220px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="label"
        :show-label="showLabel"
        :popovertarget="popovertarget"
      >
        <Calendar />
      </IconButton>
    </template>
    <template #default="{ close }">
      <MenuItem
        v-for="preset in PRESETS"
        :key="preset"
        :selected="hours === preset"
        @click="
          hours = preset;
          close();
        "
      >
        {{
          preset === 24
            ? t("toolbar.last24h")
            : t("toolbar.lastDays", { count: preset / 24 })
        }}
        <template v-if="hours === preset" #hint><Check :size="14" /></template>
      </MenuItem>
      <MenuLabel>{{ t("toolbar.startDay") }}</MenuLabel>
      <input
        class="range-picker__date"
        type="date"
        :max="today"
        :aria-label="t('toolbar.startDay')"
        @change="onDate($event, close)"
      />
    </template>
  </PopoverMenu>
</template>

<style scoped>
.range-picker__date {
  inline-size: calc(100% - 20px);
  margin: 4px 10px 8px;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-md);
  color-scheme: dark;
}
</style>
