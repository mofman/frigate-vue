<script setup lang="ts">
/** App frame: rail, page area and status bar. */
import AppSidebar from "./AppSidebar.vue";
import StatusBar from "./StatusBar.vue";
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <main id="pageRoot" class="app-shell__page">
      <slot />
    </main>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr) var(--status-height);
  grid-template-areas:
    "sidebar page"
    "sidebar status";
  block-size: 100dvh;
}

.app-shell__page {
  grid-area: page;
  position: relative;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1;
}

@media (max-width: 768px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    grid-template-areas: "page";
  }

  .app-shell__page {
    padding-block-end: calc(var(--tabbar-height) + env(safe-area-inset-bottom));
  }
}
</style>
