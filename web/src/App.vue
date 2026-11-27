<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import RestartDialog from "@/components/layout/RestartDialog.vue";
import ToastHost from "@/components/ui/ToastHost.vue";

const route = useRoute();
const bare = computed(() => route.meta.bare === true);
</script>

<template>
  <RouterView v-if="bare" />
  <AppShell v-else>
    <RouterView />
  </AppShell>
  <ToastHost />
  <RestartDialog />
</template>
