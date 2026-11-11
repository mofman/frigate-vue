<script setup lang="ts">
/**
 * Account popover: who is signed in and logout. On phones, where the rail's
 * settings menu is not in the dock, it also carries the admin pages.
 */
import { computed, shallowRef } from "vue";
import { LogOut } from "@lucide/vue";
import { baseUrl } from "@/api/baseUrl";
import { useConfig, useIsAdmin, useProfile } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import AdminMenuItems from "./AdminMenuItems.vue";

const { t } = useT(["views/app", "common"]);
const isAdmin = useIsAdmin();
const menu = shallowRef<InstanceType<typeof PopoverMenu> | null>(null);
const { data: profile } = useProfile();
const { data: config } = useConfig();

const logoutUrl = computed(
  () => config.value?.proxy?.logout_url || `${baseUrl}api/logout`,
);
const isAnonymous = computed(
  () => !profile.value || profile.value.username === "anonymous",
);

function logout() {
  window.location.href = logoutUrl.value;
}
</script>

<template>
  <PopoverMenu ref="menu" align="start" width="232px">
    <template #trigger="slotProps">
      <slot v-bind="slotProps" />
    </template>
    <MenuLabel>{{ t("account.signedInAs") }}</MenuLabel>
    <div class="account-name">
      {{ profile?.username ?? t("account.anonymous") }}
    </div>
    <div v-if="profile?.role" class="account-role">{{ profile.role }}</div>
    <div v-if="isAdmin" class="account-admin">
      <AdminMenuItems @done="menu?.close()" />
      <div class="account-divider" role="separator" />
    </div>
    <MenuItem v-if="!isAnonymous" @click="logout">
      <template #icon><LogOut /></template>
      {{ t("account.logout") }}
    </MenuItem>
  </PopoverMenu>
</template>

<style scoped>
/* the rail's settings menu has these on wider screens */
@media (min-width: 769px) {
  .account-admin {
    display: none;
  }
}

.account-divider {
  block-size: 1px;
  margin: 6px 4px;
  background: var(--glass-border);
}

.account-name {
  padding: 0 10px;
  font-size: var(--text-base);
  font-weight: 600;
}

.account-role {
  padding: 2px 10px 8px;
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-transform: capitalize;
}
</style>
