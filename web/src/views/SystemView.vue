<script setup lang="ts">
/**
 * System: health, metrics and storage in tabs. The tab lives in the URL hash
 * (/system#storage) so the status bar can link straight to one. A tab stays
 * mounted after its first visit, so switching back keeps its history.
 */
import { computed, reactive, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Activity,
  HardDrive,
  HeartPulse,
  ScanSearch,
  Video,
} from "@lucide/vue";
import { useConfig, useStats } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { useDocumentTitle, useNow } from "@/composables/useUtil";
import { DEFAULT_NOTICE_FILTER, type NoticeFilter } from "@/types/health";
import { formatRelative } from "@/utils/time";
import PageHeader from "@/components/layout/PageHeader.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import CameraMetrics from "@/components/system/CameraMetrics.vue";
import EnrichmentMetrics from "@/components/system/EnrichmentMetrics.vue";
import GeneralMetrics from "@/components/system/GeneralMetrics.vue";
import HardwarePane from "@/components/system/HardwarePane.vue";
import NoticeFilterMenu from "@/components/system/NoticeFilterMenu.vue";
import NoticesPane from "@/components/system/NoticesPane.vue";
import StorageMetrics from "@/components/system/StorageMetrics.vue";

type Tab = "health" | "general" | "enrichments" | "storage" | "cameras";

const { t } = useT(["views/system"]);
const route = useRoute();
const router = useRouter();
const { data: config } = useConfig();
const stats = useStats();
const now = useNow(1000);

const hasEnrichments = computed(
  () =>
    !!config.value?.semantic_search?.enabled ||
    !!config.value?.lpr?.enabled ||
    !!config.value?.face_recognition?.enabled,
);

const tabs = computed(() =>
  (
    [
      { value: "health", icon: HeartPulse },
      { value: "general", icon: Activity },
      { value: "enrichments", icon: ScanSearch },
      { value: "storage", icon: HardDrive },
      { value: "cameras", icon: Video },
    ] as const
  )
    .filter((tab) => tab.value !== "enrichments" || hasEnrichments.value)
    .map((tab) => ({ ...tab, label: t(`${tab.value}.title`), text: true })),
);

const tab = computed<Tab>({
  get: () => {
    const hash = route.hash.slice(1) as Tab;
    return tabs.value.some((item) => item.value === hash) ? hash : "health";
  },
  set: (value) => void router.replace({ hash: `#${value}` }),
});

const visited = reactive(new Set<Tab>());
watch(tab, (value) => visited.add(value), { immediate: true });

useDocumentTitle(() => t(`documentTitle.${tab.value}`));

const noticeFilter = shallowRef<NoticeFilter>({ ...DEFAULT_NOTICE_FILTER });

const refreshed = computed(() => {
  const updated = stats.value?.service.last_updated;
  return updated ? formatRelative(updated, now.value) : undefined;
});
</script>

<template>
  <div class="system-view">
    <PageHeader :title="t('title')">
      <template #meta>
        <span v-if="stats" class="system-view__version">{{
          stats.service.version
        }}</span>
      </template>
      <template #actions>
        <NoticeFilterMenu v-if="tab === 'health'" v-model="noticeFilter" />
        <span v-else-if="refreshed" class="system-view__refreshed">
          {{ t("lastRefreshed") }}{{ refreshed }}
        </span>
      </template>
    </PageHeader>

    <div class="system-view__tabs">
      <SegmentedToggle v-model="tab" :options="tabs" :label="t('metrics')" />
    </div>

    <div class="system-view__scroll">
      <div
        v-if="visited.has('health')"
        v-show="tab === 'health'"
        class="system-view__panel"
      >
        <NoticesPane :filter="noticeFilter" />
        <HardwarePane />
      </div>
      <div
        v-if="visited.has('general')"
        v-show="tab === 'general'"
        class="system-view__panel"
      >
        <GeneralMetrics :active="tab === 'general'" />
      </div>
      <div
        v-if="hasEnrichments && visited.has('enrichments')"
        v-show="tab === 'enrichments'"
        class="system-view__panel"
      >
        <EnrichmentMetrics :active="tab === 'enrichments'" />
      </div>
      <div
        v-if="visited.has('storage')"
        v-show="tab === 'storage'"
        class="system-view__panel"
      >
        <StorageMetrics />
      </div>
      <div
        v-if="visited.has('cameras')"
        v-show="tab === 'cameras'"
        class="system-view__panel"
      >
        <CameraMetrics :active="tab === 'cameras'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.system-view__version {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.system-view__refreshed {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.system-view__tabs {
  padding: 14px 24px 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.system-view__scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  padding: 16px 24px 32px;
}

.system-view__panel {
  display: grid;
  gap: 24px;
  max-inline-size: 1800px;
}

@media (max-width: 768px) {
  /* the document scrolls on phones */
  .system-view {
    block-size: auto;
  }

  .system-view__tabs {
    padding: 10px 10px 0;
  }

  .system-view__scroll {
    overflow: visible;
    padding: 12px 10px 24px;
  }

  .system-view__refreshed {
    display: none;
  }
}
</style>
