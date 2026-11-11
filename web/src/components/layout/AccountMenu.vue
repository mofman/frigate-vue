<script setup lang="ts">
/** Account popover: who is signed in, language and logout. */
import { computed } from "vue";
import { LogOut } from "@lucide/vue";
import { baseUrl } from "@/api/baseUrl";
import { useConfig, useProfile } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";

const { t } = useT(["views/app"]);
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
  <PopoverMenu align="start" width="220px">
    <template #trigger="slotProps">
      <slot v-bind="slotProps" />
    </template>
    <MenuLabel>{{ t("account.signedInAs") }}</MenuLabel>
    <div class="account-name">
      {{ profile?.username ?? t("account.anonymous") }}
    </div>
    <div v-if="profile?.role" class="account-role">{{ profile.role }}</div>
    <MenuItem v-if="!isAnonymous" @click="logout">
      <template #icon><LogOut /></template>
      {{ t("account.logout") }}
    </MenuItem>
  </PopoverMenu>
</template>

<style scoped>
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
