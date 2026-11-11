<script setup lang="ts">
import EmptyState from "@/components/ui/EmptyState.vue";
import { useT } from "@/composables/useT";

const { t } = useT(["views/app"]);
</script>

<template>
  <EmptyState :title="t('notFound.title')">
    <RouterLink to="/" class="not-found__home">{{
      t("notFound.home")
    }}</RouterLink>
  </EmptyState>
</template>

<style scoped>
.not-found__home {
  color: var(--accent);
  font-size: var(--text-md);
}
</style>
