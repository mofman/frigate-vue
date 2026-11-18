<script setup lang="ts">
/**
 * Explore: browse and search every tracked object. The filter and the open
 * object live in the URL, so any view can be linked to or stepped back from.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { HttpError, errorMessage, http } from "@/api/http";
import { mutate, useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import ActiveFilters from "@/components/explore/ActiveFilters.vue";
import BulkActionBar from "@/components/explore/BulkActionBar.vue";
import ExploreGrid from "@/components/explore/ExploreGrid.vue";
import ExploreSettingsMenu from "@/components/explore/ExploreSettingsMenu.vue";
import ExploreSummary from "@/components/explore/ExploreSummary.vue";
import ExploreUnavailable from "@/components/explore/ExploreUnavailable.vue";
import FilterBar from "@/components/explore/FilterBar.vue";
import ObjectDialog, {
  type ObjectTab,
} from "@/components/explore/ObjectDialog.vue";
import ResultMenu from "@/components/explore/ResultMenu.vue";
import SearchInput from "@/components/explore/SearchInput.vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import SkeletonBlock from "@/components/ui/SkeletonBlock.vue";
import { useEmbeddingsState } from "@/composables/useEmbeddingsState";
import { useExploreFilters } from "@/composables/useExploreFilters";
import { useExploreOptions } from "@/composables/useExploreOptions";
import { useExploreResults } from "@/composables/useExploreResults";
import { useTimeOptions } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import {
  useDocumentTitle,
  useMediaQuery,
  usePersistedRef,
} from "@/composables/useUtil";
import type {
  ExploreFilter,
  ExploreView,
  TrackedEvent,
  TrackedObjectUpdate,
} from "@/types/event";
import { exploreRequest, plainText, isTextEntry } from "@/utils/explore";

const FLASH_MS = 3000;

// children share these, loading them here has them ready before any child shows
const { t } = useT([
  "views/explore",
  "views/app",
  "views/search",
  "views/events",
  "components/filter",
  "components/dialog",
  "components/player",
  "common",
  "objects",
  "audio",
]);
useDocumentTitle(() => t("views/app:nav.explore"));

const {
  filter,
  hasFilter,
  similarity,
  openId,
  setFilter,
  findSimilar,
  openObject,
  closeObject,
} = useExploreFilters();
const options = useExploreOptions(filter);
const embeddings = useEmbeddingsState();
const timeOptions = useTimeOptions();
const phone = useMediaQuery("(max-width: 768px)");

const defaultView = usePersistedRef<ExploreView>(
  "explore-default-view",
  "summary",
);
const columns = usePersistedRef("explore-columns", 4);
const scroller = shallowRef<HTMLElement | null>(null);

const ready = computed(() => embeddings.status.value === "ready");

// ---- data -------------------------------------------------------------------

const request = computed(() =>
  ready.value
    ? exploreRequest(filter.value, {
        timezone: timeOptions.value.timezone,
        defaultView: defaultView.value,
      })
    : null,
);
const results = useExploreResults(request);

const showSummary = computed(
  () => ready.value && !hasFilter.value && defaultView.value === "summary",
);
const summaryKey = computed(() =>
  showSummary.value
    ? (["events/explore", { limit: phone.value ? 5 : 10 }] as const)
    : null,
);
const {
  data: summaryData,
  error: summaryError,
  isLoading: summaryLoading,
  refresh: refreshSummary,
} = useQuery<TrackedEvent[]>(summaryKey);
const summary = computed(() => summaryData.value ?? []);

/** what is on screen, in order */
const visible = computed(() =>
  showSummary.value ? summary.value : results.items.value,
);

function refreshAll() {
  if (showSummary.value) void refreshSummary();
  else void results.refresh();
}

onWsMessage<TrackedObjectUpdate>("tracked_object_update", (update) => {
  if (update?.type === "description") refreshAll();
});

function onVisibility() {
  if (document.visibilityState === "visible" && request.value)
    void results.refresh();
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() =>
  document.removeEventListener("visibilitychange", onVisibility),
);

watch(results.error, (error) => {
  if (!error) return;
  showToast(
    t("fetchingTrackedObjectsFailed", { errorMessage: errorMessage(error) }),
    "error",
  );
  // a similarity search for a deleted object has nothing left to show
  if (error instanceof HttpError && error.status === 404) void setFilter({});
});

const isInitialLoad = computed(() =>
  showSummary.value
    ? summaryLoading.value
    : !!request.value && !results.hasLoaded.value,
);
const loadError = computed(() =>
  showSummary.value
    ? summaryError.value && !summary.value.length
    : results.error.value && !results.items.value.length,
);

function updateFilter(next: ExploreFilter) {
  void setFilter(next);
}

// ---- selection --------------------------------------------------------------

const selected = shallowRef<ReadonlySet<string>>(new Set());

function clearSelection() {
  if (selected.value.size) selected.value = new Set();
}

function toggleSelect(event: TrackedEvent) {
  const next = new Set(selected.value);
  if (!next.delete(event.id)) next.add(event.id);
  selected.value = next;
}

function selectAll() {
  selected.value =
    selected.value.size < visible.value.length
      ? new Set(visible.value.map((event) => event.id))
      : new Set();
}

watch(filter, clearSelection);

// ---- open object ------------------------------------------------------------

const tab = shallowRef<ObjectTab>("snapshot");
const flashId = shallowRef<string>();
let flashTimer: ReturnType<typeof setTimeout> | undefined;

const listed = computed(() =>
  openId.value
    ? visible.value.find((event) => event.id === openId.value)
    : undefined,
);

// a direct link can name an object that is not in the current list
const directKey = computed(() =>
  openId.value && !listed.value && !isInitialLoad.value
    ? `events/${encodeURIComponent(openId.value)}`
    : null,
);
const { data: directEvent, error: directError } = useQuery<TrackedEvent>(
  directKey,
  { revalidateOnFocus: false },
);

const openEvent = computed(
  () =>
    listed.value ??
    (directEvent.value?.id === openId.value ? directEvent.value : undefined),
);

watch(directError, (error) => {
  if (!error || !directKey.value) return;
  showToast(t("ui.objectNotFound"), "error");
  closeObject();
});

function open(event: TrackedEvent, nextTab: ObjectTab = "snapshot") {
  if (selected.value.size) {
    toggleSelect(event);
    return;
  }
  tab.value = nextTab;
  void openObject(event.id);
}

// outline the card the user was just looking at
watch(openId, (id, previous) => {
  if (id || !previous) return;
  clearTimeout(flashTimer);
  flashId.value = previous;
  flashTimer = setTimeout(() => (flashId.value = undefined), FLASH_MS);
});
onBeforeUnmount(() => clearTimeout(flashTimer));

/** neighbors while browsing, the summary steps within one label */
const siblings = computed(() => {
  const event = openEvent.value;
  if (!event) return [];
  return showSummary.value
    ? summary.value.filter((item) => item.label === event.label)
    : results.items.value;
});

function step(delta: number) {
  const list = siblings.value;
  if (!list.length) return;
  const index = list.findIndex((event) => event.id === openId.value);
  const next =
    index === -1
      ? delta > 0
        ? 0
        : list.length - 1
      : (index + delta + list.length) % list.length;
  void openObject(list[next]!.id);
  // reaching the end of what is loaded brings in the next page
  if (!showSummary.value && next >= list.length - 3) void results.loadMore();
}

function applyChange(
  id: string,
  change: (event: TrackedEvent) => TrackedEvent,
) {
  results.patch(id, change);
  const update = (list: TrackedEvent[] | undefined) =>
    (list ?? []).map((event) => (event.id === id ? change(event) : event));
  if (summaryKey.value) mutate(summaryKey.value, update);
  if (directKey.value)
    mutate<TrackedEvent>(directKey.value, (event) =>
      event ? change(event) : (event as unknown as TrackedEvent),
    );
}

function similar(event: TrackedEvent) {
  clearSelection();
  void findSimilar(event.id);
}

// ---- deleting ---------------------------------------------------------------

const deleting = shallowRef<string[]>([]);
const deleteBusy = shallowRef(false);
const deleteOpen = computed({
  get: () => deleting.value.length > 0,
  set: (value) => {
    if (!value) deleting.value = [];
  },
});

async function performDelete(ids: string[]) {
  deleteBusy.value = true;
  try {
    if (ids.length === 1) await http.delete(`events/${ids[0]}`);
    else await http.delete("events/", { body: { event_ids: ids } });
  } catch (error) {
    const message = errorMessage(error);
    showToast(
      ids.length === 1
        ? t("searchResult.deleteTrackedObject.toast.error", {
            errorMessage: message,
          })
        : t("components/filter:trackedObjectDelete.toast.error", {
            errorMessage: message,
          }),
      "error",
    );
    return;
  } finally {
    deleteBusy.value = false;
  }
  showToast(
    ids.length === 1
      ? t("searchResult.deleteTrackedObject.toast.success")
      : t("components/filter:trackedObjectDelete.toast.success"),
    "success",
  );
  deleting.value = [];
  clearSelection();
  if (openId.value && ids.includes(openId.value)) closeObject();
  results.remove(ids);
  refreshAll();
}

function deleteSelected(immediate: boolean) {
  const ids = [...selected.value];
  if (immediate) void performDelete(ids);
  else deleting.value = ids;
}

const deleteMessage = computed(() =>
  plainText(
    deleting.value.length === 1
      ? t("dialog.confirmDelete.desc")
      : t("components/filter:trackedObjectDelete.desc", {
          objectLength: deleting.value.length,
        }),
  ),
);

// ---- keyboard ---------------------------------------------------------------

function onKeydown(event: KeyboardEvent) {
  if (isTextEntry(event.target)) return;
  if (openId.value) {
    // a confirmation on top of the object keeps the keyboard to itself
    if (document.querySelectorAll("dialog[open]").length > 1) return;
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
    return;
  }
  // another dialog or menu owns the keyboard while it is open
  if (document.querySelector("dialog[open], [popover]:popover-open")) return;
  if (event.key === "Escape") {
    clearSelection();
  } else if (
    event.key.toLowerCase() === "a" &&
    (event.ctrlKey || event.metaKey) &&
    !event.repeat
  ) {
    event.preventDefault();
    selectAll();
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="explore-view">
    <PageHeader :title="t('views/app:nav.explore')">
      <template #actions>
        <template v-if="ready">
          <BulkActionBar
            v-if="selected.size"
            :count="selected.size"
            :total="visible.length"
            @clear="clearSelection"
            @select-all="selectAll"
            @delete="deleteSelected"
          />
          <template v-else>
            <SearchInput
              v-if="options.semanticSearch.value"
              :filter="filter"
              :context="options.tagContext.value"
              @update:filter="updateFilter"
            />
            <FilterBar
              :filter="filter"
              :cameras="options.cameras.value"
              :labels="options.labels.value"
              :audio-labels="options.audioLabels.value"
              :zones="options.zones.value"
              :sub-labels="options.subLabels.value"
              :plates="options.plates.value"
              :attributes="options.attributes.value"
              :show-attributes="options.hasCustomClassification.value"
              :plus-enabled="options.plusEnabled.value"
              :imperial="options.imperial.value"
              @update:filter="updateFilter"
            >
              <ExploreSettingsMenu
                v-model:view="defaultView"
                v-model:columns="columns"
                :filter="filter"
                :semantic-search="options.semanticSearch.value"
                @update:filter="updateFilter"
              />
            </FilterBar>
          </template>
        </template>
      </template>
    </PageHeader>

    <div
      v-if="embeddings.status.value === 'checking'"
      class="explore-view__center"
    >
      <LoadingSpinner />
    </div>
    <ExploreUnavailable v-else-if="!ready" />

    <template v-else>
      <ActiveFilters
        :filter="filter"
        :hour12="options.hour12.value"
        :imperial="options.imperial.value"
        :audio-labels="options.audioLabels.value"
        @update:filter="updateFilter"
      />
      <div
        ref="scroller"
        class="explore-view__scroll"
        :class="{
          'is-refreshing': results.isValidating.value && visible.length,
        }"
      >
        <div
          v-if="isInitialLoad"
          class="explore-view__skeletons"
          :style="{ '--columns': columns }"
        >
          <SkeletonBlock v-for="n in 12" :key="n" />
        </div>
        <EmptyState v-else-if="loadError" :title="t('ui.loadFailed')">
          <AppButton @click="refreshAll">
            {{ t("common:button.retry") }}
          </AppButton>
        </EmptyState>
        <EmptyState
          v-else-if="!visible.length"
          :title="t('noTrackedObjects')"
        />
        <ExploreSummary
          v-else-if="showSummary"
          :events="summary"
          :selected="selected"
          :flash-id="flashId"
          @open="open($event)"
          @toggle-select="toggleSelect"
        >
          <template #actions="{ event }">
            <ResultMenu
              :event="event"
              @tracking-details="open(event, 'tracking_details')"
              @find-similar="similar(event)"
              @delete="deleting = [event.id]"
            />
          </template>
        </ExploreSummary>
        <ExploreGrid
          v-else
          :items="results.items.value"
          :selected="selected"
          :columns="columns"
          :show-matches="!!filter.query || similarity"
          :similarity="similarity"
          :has-more="results.hasMore.value"
          :loading-more="results.isLoadingMore.value"
          :scroller="scroller"
          :focus-id="openId"
          :flash-id="flashId"
          @open="open($event)"
          @toggle-select="toggleSelect"
          @load-more="results.loadMore"
        >
          <template #actions="{ event }">
            <ResultMenu
              :event="event"
              @tracking-details="open(event, 'tracking_details')"
              @find-similar="similar(event)"
              @delete="deleting = [event.id]"
            />
          </template>
        </ExploreGrid>
      </div>
    </template>

    <ObjectDialog
      v-if="openEvent"
      v-model:tab="tab"
      :event="openEvent"
      :can-navigate="siblings.length > 1"
      @close="closeObject"
      @previous="step(-1)"
      @next="step(1)"
      @find-similar="similar(openEvent!)"
      @delete="deleting = [openEvent!.id]"
      @change="applyChange"
    />

    <AppDialog
      v-model:open="deleteOpen"
      :title="t('dialog.confirmDelete.title')"
    >
      <p class="explore-view__confirm">{{ deleteMessage }}</p>
      <template #actions>
        <AppButton @click="deleteOpen = false">
          {{ t("common:button.cancel") }}
        </AppButton>
        <AppButton
          variant="danger"
          :disabled="deleteBusy"
          @click="performDelete(deleting)"
        >
          {{ t("common:button.delete") }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.explore-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.explore-view :deep(.page-header__end) {
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-inline-size: 0;
}

.explore-view__center {
  display: grid;
  flex: 1;
  place-items: center;
}

.explore-view__scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  padding: 14px 24px 32px;
  transition: opacity var(--dur);

  &.is-refreshing {
    opacity: 0.65;
  }
}

.explore-view__skeletons {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  gap: 10px;

  > * {
    aspect-ratio: 1;
    border-radius: var(--radius);
  }
}

.explore-view__confirm {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-md);
  white-space: pre-line;
}

@media (max-width: 768px) {
  /* the document scrolls on phones */
  .explore-view {
    block-size: auto;
  }

  .explore-view__scroll {
    overflow: visible;
    padding: 8px 10px 24px;
  }

  .explore-view__skeletons {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}
</style>
