<script setup lang="ts">
/** Health > Notices: problems the backend registry reports, and hidden ones. */
import { computed, shallowRef } from "vue";
import { CircleCheck } from "@lucide/vue";
import { useNotices } from "@/composables/useHealth";
import { useT } from "@/composables/useT";
import type { NoticeFilter } from "@/types/health";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import MetricCard from "./MetricCard.vue";
import NoticeRow from "./NoticeRow.vue";

const props = defineProps<{ filter: NoticeFilter }>();
const { t } = useT(["views/system", "common"]);

const { notices, hidden, acknowledge, mute, unhide, unhideAll } = useNotices(
  () => props.filter.showHidden,
);

const shown = computed(() =>
  notices.value?.filter((notice) =>
    props.filter.severities.includes(notice.severity),
  ),
);

const confirmUnhide = shallowRef(false);
async function showAllAgain() {
  confirmUnhide.value = false;
  await unhideAll();
}
</script>

<template>
  <MetricCard :title="t('health.notices.title')">
    <div v-if="!notices" class="notices__loading"><LoadingSpinner /></div>
    <p v-else-if="!notices.length" class="notices__healthy">
      <CircleCheck :size="18" aria-hidden="true" />
      {{ t("health.notices.empty") }}
    </p>
    <p v-else-if="!shown?.length" class="notices__none">
      {{ t("health.notices.noMatches") }}
    </p>
    <ul v-else class="notices__list">
      <NoticeRow
        v-for="notice in shown"
        :key="notice.id"
        :notice="notice"
        @acknowledge="acknowledge(notice.id)"
        @mute="mute(notice.id)"
      />
    </ul>
  </MetricCard>

  <MetricCard v-if="filter.showHidden" :title="t('health.notices.hiddenTitle')">
    <template v-if="hidden?.length" #actions>
      <AppButton size="sm" @click="confirmUnhide = true">
        {{ t("health.notices.showAll") }}
      </AppButton>
    </template>
    <div v-if="!hidden" class="notices__loading"><LoadingSpinner /></div>
    <p v-else-if="!hidden.length" class="notices__none">
      {{ t("health.notices.noneHidden") }}
    </p>
    <ul v-else class="notices__list">
      <NoticeRow
        v-for="notice in hidden"
        :key="notice.id"
        :notice="notice"
        hidden
        @unhide="unhide(notice.id)"
      />
    </ul>
  </MetricCard>

  <AppDialog
    v-model:open="confirmUnhide"
    :title="t('health.notices.showAllTitle')"
  >
    <p class="notices__confirm">{{ t("health.notices.showAllDesc") }}</p>
    <template #actions>
      <AppButton @click="confirmUnhide = false">
        {{ t("common:button.cancel") }}
      </AppButton>
      <AppButton variant="primary" @click="showAllAgain">
        {{ t("health.notices.showAll") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.notices__loading {
  display: grid;
  place-items: center;
  min-block-size: 80px;
}

.notices__healthy {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  font-size: var(--text-base);
  color: var(--chart-ok);
}

.notices__none,
.notices__confirm {
  font-size: var(--text-md);
  color: var(--text-tertiary);
}

.notices__list {
  display: grid;
}
</style>
