<script setup lang="ts">
/** Which notices the Health tab shows: severities and the hidden list. */
import { computed } from "vue";
import { Filter } from "@lucide/vue";
import { useT } from "@/composables/useT";
import {
  DEFAULT_NOTICE_FILTER,
  type HealthSeverity,
  type NoticeFilter,
} from "@/types/health";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";

const filter = defineModel<NoticeFilter>({ required: true });
const { t } = useT(["views/system"]);

const severities: HealthSeverity[] = ["error", "warning", "info"];

const changed = computed(
  () =>
    filter.value.showHidden ||
    filter.value.severities.length !== DEFAULT_NOTICE_FILTER.severities.length,
);

function toggle(severity: HealthSeverity) {
  const current = filter.value.severities;
  const next = current.includes(severity)
    ? current.filter((s) => s !== severity)
    : [...current, severity];
  // an empty filter would hide everything, so keep at least one
  if (next.length) filter.value = { ...filter.value, severities: next };
}
</script>

<template>
  <PopoverMenu width="200px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="t('health.notices.filter.severity')"
        :active="changed"
        :popovertarget="popovertarget"
        ><Filter
      /></IconButton>
    </template>
    <MenuLabel>{{ t("health.notices.filter.severity") }}</MenuLabel>
    <MenuItem
      v-for="severity in severities"
      :key="severity"
      role="menuitemcheckbox"
      :selected="filter.severities.includes(severity)"
      @click="toggle(severity)"
    >
      {{ t(`health.notices.filter.${severity}`) }}
    </MenuItem>
    <div class="filter-divider" role="separator" />
    <MenuItem
      role="menuitemcheckbox"
      :selected="filter.showHidden"
      @click="filter = { ...filter, showHidden: !filter.showHidden }"
    >
      {{ t("health.notices.filter.showHidden") }}
    </MenuItem>
  </PopoverMenu>
</template>

<style scoped>
.filter-divider {
  block-size: 1px;
  margin: 6px 4px;
  background: var(--glass-border);
}
</style>
