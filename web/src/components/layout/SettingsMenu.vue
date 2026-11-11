<script setup lang="ts">
/**
 * The rail's settings entry. For admins it opens the system, logs, config
 * editor and restart menu, as the previous interface did; the settings page
 * itself is not rebuilt yet. Everyone else sees it disabled.
 */
import { computed, shallowRef } from "vue";
import { useRoute } from "vue-router";
import { Settings } from "@lucide/vue";
import { useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import SidebarNavItem from "./SidebarNavItem.vue";
import AdminMenuItems from "./AdminMenuItems.vue";

const { t } = useT(["views/app", "common"]);
const route = useRoute();
const isAdmin = useIsAdmin();
const menu = shallowRef<InstanceType<typeof PopoverMenu> | null>(null);

const onAdminPage = computed(() =>
  ["system", "logs", "config"].includes(String(route.name)),
);
</script>

<template>
  <PopoverMenu v-if="isAdmin" ref="menu" align="start" width="240px">
    <template #trigger="{ popovertarget, open }">
      <SidebarNavItem
        :icon="Settings"
        :label="t('nav.settings')"
        :active="onAdminPage || open"
        :popovertarget="popovertarget"
        aria-haspopup="menu"
        :aria-expanded="open"
      />
    </template>
    <AdminMenuItems @done="menu?.close()" />
    <MenuItem role="menuitem" disabled :title="t('nav.comingSoon')">
      {{ t("common:menu.settings") }}
    </MenuItem>
  </PopoverMenu>
  <SidebarNavItem
    v-else
    :icon="Settings"
    :label="t('nav.settings')"
    disabled
    :disabled-hint="t('nav.comingSoon')"
  />
</template>
