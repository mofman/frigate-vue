<script setup lang="ts">
/**
 * Left rail on desktop, bottom tab bar on phones. Pages not yet rebuilt in
 * the new interface show disabled until they land.
 */
import { computed } from "vue";
import {
  Bell,
  CircleUserRound,
  Download,
  Monitor,
  Search,
  Settings,
} from "@lucide/vue";
import logo from "@/assets/logo.svg";
import { useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import { useT } from "@/composables/useT";
import type { ReviewSegment } from "@/types/frigate";
import SidebarNavItem from "./SidebarNavItem.vue";
import AccountMenu from "./AccountMenu.vue";

const { t } = useT(["views/app"]);

const { data: alerts, refresh } = useQuery<ReviewSegment[]>(
  ["review", { limit: 10, severity: "alert", reviewed: 0 }],
  { staleTime: 30_000 },
);
onWsMessage("reviews", () => void refresh());

const alertCount = computed(() => alerts.value?.length ?? 0);
const soon = computed(() => t("nav.comingSoon"));
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar__top">
      <RouterLink to="/" class="sidebar__logo" :aria-label="t('nav.home')">
        <img :src="logo" alt="" />
      </RouterLink>
      <nav class="sidebar__nav" :aria-label="t('nav.primary')">
        <SidebarNavItem to="/" :icon="Monitor" :label="t('nav.cameras')" />
        <SidebarNavItem
          to="/review"
          :icon="Bell"
          :label="t('nav.review')"
          :badge="alertCount"
        />
        <SidebarNavItem
          :icon="Search"
          :label="t('nav.explore')"
          disabled
          :disabled-hint="soon"
        />
        <SidebarNavItem
          :icon="Download"
          :label="t('nav.exports')"
          disabled
          :disabled-hint="soon"
        />
      </nav>
    </div>
    <div class="sidebar__bottom">
      <SidebarNavItem
        :icon="Settings"
        :label="t('nav.settings')"
        disabled
        :disabled-hint="soon"
      />
      <AccountMenu v-slot="{ popovertarget }">
        <button
          type="button"
          class="sidebar__account"
          :popovertarget="popovertarget"
        >
          <CircleUserRound :size="22" aria-hidden="true" />
          <span>{{ t("nav.account") }}</span>
        </button>
      </AccountMenu>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px 0;
  background: var(--bg-base);
  border-inline-end: 1px solid var(--glass-border);
  z-index: 10;
}

.sidebar__top,
.sidebar__bottom {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  padding-inline: 10px;
}

.sidebar__logo {
  display: block;
  inline-size: 42px;
  margin: 0 auto 18px;

  img {
    inline-size: 100%;
    block-size: auto;
  }
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar__account {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  transition: color var(--dur);

  &:hover {
    color: var(--text-primary);
  }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    inset: auto 0 0;
    block-size: var(--tabbar-height);
    flex-direction: row;
    align-items: center;
    padding: 0 8px env(safe-area-inset-bottom);
    background: var(--bg-tabbar);
    backdrop-filter: blur(16px);
    border-inline-end: none;
    border-block-start: 1px solid var(--glass-border);
    z-index: 50;
  }

  .sidebar__logo,
  .sidebar__bottom {
    display: none;
  }

  .sidebar__top {
    flex: 1;
    flex-direction: row;
    padding: 0;
  }

  .sidebar__nav {
    flex: 1;
    flex-direction: row;
    justify-content: space-around;
    gap: 0;
  }
}
</style>
