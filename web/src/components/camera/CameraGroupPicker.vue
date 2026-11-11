<script setup lang="ts">
/** Chooses which camera group the dashboard shows. */
import { computed, shallowRef } from "vue";
import { Check, ChevronDown, Settings2 } from "@lucide/vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useConfig, useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import CameraGroupDialog from "./CameraGroupDialog.vue";

/** "default" is every camera */
const group = defineModel<string>({ required: true });
const { t } = useT(["views/app"]);
const { data: config } = useConfig();
const isAdmin = useIsAdmin();
const editing = shallowRef(false);

const groups = computed(() =>
  Object.entries(config.value?.camera_groups ?? {})
    // "default" means every camera in the UI, never a stored group
    .filter(([name]) => name !== "default")
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([name]) => name),
);
const label = computed(() =>
  group.value === "default"
    ? t("groups.all")
    : group.value.replaceAll("_", " "),
);

function onDeleted(name: string) {
  if (group.value === name) group.value = "default";
}
</script>

<template>
  <PopoverMenu v-if="groups.length || isAdmin" align="start" width="220px">
    <template #trigger="{ popovertarget }">
      <button
        type="button"
        class="group-picker"
        :popovertarget="popovertarget"
        :aria-label="t('groups.choose')"
      >
        {{ label }}
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
    </template>
    <template #default="{ close }">
      <MenuItem
        :selected="group === 'default'"
        @click="
          group = 'default';
          close();
        "
      >
        {{ t("groups.all") }}
        <template v-if="group === 'default'" #hint
          ><Check :size="14"
        /></template>
      </MenuItem>
      <MenuItem
        v-for="name in groups"
        :key="name"
        :selected="group === name"
        @click="
          group = name;
          close();
        "
      >
        {{ name.replaceAll("_", " ") }}
        <template v-if="group === name" #hint><Check :size="14" /></template>
      </MenuItem>
      <MenuItem
        v-if="isAdmin"
        class="group-picker__edit"
        @click="
          editing = true;
          close();
        "
      >
        <template #icon><Settings2 /></template>
        {{ t("groups.manage") }}
      </MenuItem>
    </template>
  </PopoverMenu>
  <CameraGroupDialog
    v-if="isAdmin"
    v-model:open="editing"
    @deleted="onDeleted"
    @saved="group = $event"
  />
</template>

<style scoped>
.group-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  block-size: 30px;
  padding-inline: 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  font-size: var(--text-md);
  font-weight: 600;
  text-transform: capitalize;

  &:hover {
    border-color: var(--line-hover);
    background: var(--bg-hover);
  }

  svg {
    color: var(--text-tertiary);
  }
}

.group-picker__edit {
  margin-block-start: 4px;
  border-block-start: 1px solid var(--glass-border);
  border-start-start-radius: 0;
  border-start-end-radius: 0;
}
</style>
