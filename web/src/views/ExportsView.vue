<script setup lang="ts">
/**
 * Exports: every exported clip, newest first, with the ones still being
 * made showing live progress. Clips exported together (one range from
 * several cameras) are grouped under their case.
 */
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Download, Search } from "@lucide/vue";
import { apiBase, http } from "@/api/http";
import { invalidate, useQuery } from "@/api/query";
import ExportCard from "@/components/export/ExportCard.vue";
import ExportPlayerDialog from "@/components/export/ExportPlayerDialog.vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import CameraFilter from "@/components/review/CameraFilter.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import SkeletonBlock from "@/components/ui/SkeletonBlock.vue";
import { useExportJobs } from "@/composables/useExportJobs";
import { useCameras, useIsAdmin } from "@/composables/useFrigate";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import { useDocumentTitle } from "@/composables/useUtil";
import type { Export, ExportCase, ExportJob } from "@/types/export";
import { exportLink } from "@/utils/exports";

const { t } = useT(["views/app"]);
const route = useRoute();
const router = useRouter();
const cameras = useCameras();
const admin = useIsAdmin();
useDocumentTitle(() => t("exports.title"));

const { data: exports, isLoading } = useQuery<Export[]>("exports", {
  staleTime: 5000,
});
const { data: cases } = useQuery<ExportCase[]>("cases", { staleTime: 5000 });
const { jobs } = useExportJobs();

const search = shallowRef("");
const cameraFilter = shallowRef<string[]>([]);

type Row = { item: Export; job?: ExportJob };

/** Exports plus queued jobs, which have no export row until they start. */
const rows = computed<Row[]>(() => {
  const byId = new Map(jobs.value.map((job) => [job.id, job]));
  const list: Row[] = (exports.value ?? []).map((item) => ({
    item,
    job: byId.get(item.id),
  }));
  const known = new Set(list.map((row) => row.item.id));
  const queued: Row[] = jobs.value
    .filter((job) => !known.has(job.id))
    .map((job) => ({
      job,
      item: {
        id: job.id,
        camera: job.camera,
        name: job.name || job.camera,
        date: job.request_start_time,
        video_path: "",
        thumb_path: "",
        in_progress: true,
        export_case_id: job.export_case_id,
      },
    }));
  return [...queued, ...list];
});

const visible = computed(() => {
  const query = search.value.trim().toLowerCase();
  return rows.value.filter(
    ({ item }) =>
      (!cameraFilter.value.length ||
        cameraFilter.value.includes(item.camera)) &&
      (!query ||
        item.name.toLowerCase().replaceAll("_", " ").includes(query) ||
        item.camera.toLowerCase().includes(query)),
  );
});

type Group = { id: string; name?: string; rows: Row[] };

const caseOf = (item: Export) => item.export_case_id ?? item.export_case;

/** Cases first, newest first, then everything exported on its own. */
const groups = computed<Group[]>(() => {
  const result: Group[] = [];
  for (const item of cases.value ?? []) {
    const members = visible.value.filter((row) => caseOf(row.item) === item.id);
    if (members.length)
      result.push({ id: item.id, name: item.name, rows: members });
  }
  const grouped = new Set(result.map((group) => group.id));
  const loose = visible.value.filter((row) => {
    const id = caseOf(row.item);
    return !id || !grouped.has(id);
  });
  if (loose.length)
    result.push({
      id: "",
      // only needs a heading when there are cases to tell it apart from
      name: result.length ? t("exports.ungrouped") : undefined,
      rows: loose,
    });
  return result;
});

// ---- playing ---------------------------------------------------------------

const playing = shallowRef<Export>();
const playerOpen = computed({
  get: () => !!playing.value,
  set: (open) => {
    if (open) return;
    playing.value = undefined;
    if (route.query.id) void router.replace({ query: {} });
  },
});

// a shared link carries ?id=, open that export once the list has it
watch(
  [() => route.query.id, exports],
  ([id, list]) => {
    if (typeof id !== "string" || playing.value) return;
    const match = list?.find((item) => item.id === id && !item.in_progress);
    if (match) playing.value = match;
  },
  { immediate: true },
);

async function share(item: Export) {
  const url = exportLink(item);
  try {
    await navigator.clipboard.writeText(url);
    showToast(t("toolbar.linkCopied"), "success");
  } catch {
    // no clipboard (insecure context), show the link so it can be copied
    window.prompt(t("toolbar.copyLink"), url);
  }
}

// ---- rename and delete (admin) ----------------------------------------------

const renaming = shallowRef<Export>();
const newName = shallowRef("");
const removing = shallowRef<Export>();
const busy = shallowRef(false);

const renameOpen = computed({
  get: () => !!renaming.value,
  set: (open) => {
    if (!open) renaming.value = undefined;
  },
});
const removeOpen = computed({
  get: () => !!removing.value,
  set: (open) => {
    if (!open) removing.value = undefined;
  },
});

function startRename(item: Export) {
  newName.value = item.name.replaceAll("_", " ");
  renaming.value = item;
}

async function rename() {
  const item = renaming.value;
  const name = newName.value.trim();
  if (!item || !name || busy.value) return;
  busy.value = true;
  try {
    await http.patch(`export/${encodeURIComponent(item.id)}/rename`, { name });
  } catch {
    showToast(t("exports.renameFailed"), "error");
    return;
  } finally {
    busy.value = false;
  }
  renaming.value = undefined;
  invalidate("exports");
}

async function remove() {
  const item = removing.value;
  if (!item || busy.value) return;
  busy.value = true;
  try {
    await http.post("exports/delete", { ids: [item.id] });
  } catch {
    showToast(t("exports.deleteFailed"), "error");
    return;
  } finally {
    busy.value = false;
  }
  removing.value = undefined;
  invalidate("exports");
  invalidate("cases");
}
</script>

<template>
  <div class="exports-view">
    <PageHeader :title="t('exports.title')">
      <template #actions>
        <label class="exports-view__search">
          <Search :size="15" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            :aria-label="t('exports.search')"
            :placeholder="t('exports.search')"
          />
        </label>
        <CameraFilter v-model="cameraFilter" :cameras="cameras" />
      </template>
    </PageHeader>

    <div class="exports-view__scroll">
      <div v-if="isLoading" class="exports-view__grid">
        <SkeletonBlock v-for="n in 8" :key="n" class="exports-view__skeleton" />
      </div>
      <EmptyState
        v-else-if="!rows.length"
        :title="t('exports.empty')"
        :description="t('exports.emptyHint')"
      />
      <EmptyState v-else-if="!groups.length" :title="t('exports.noMatches')" />
      <section
        v-for="group in groups"
        v-else
        :key="group.id"
        class="exports-view__group"
      >
        <header v-if="group.name" class="exports-view__group-head">
          <h2>{{ group.name }}</h2>
          <span class="exports-view__count">{{
            t("exports.clips", { count: group.rows.length })
          }}</span>
          <a
            v-if="group.id"
            class="exports-view__download-all"
            :href="`${apiBase}cases/${encodeURIComponent(group.id)}/download`"
            download
          >
            <Download :size="14" aria-hidden="true" />
            {{ t("exports.downloadAll") }}
          </a>
        </header>
        <div class="exports-view__grid">
          <ExportCard
            v-for="row in group.rows"
            :key="row.item.id"
            :item="row.item"
            :job="row.job"
            :admin="admin"
            @play="playing = row.item"
            @share="share(row.item)"
            @rename="startRename(row.item)"
            @remove="removing = row.item"
          />
        </div>
      </section>
    </div>

    <ExportPlayerDialog v-model:open="playerOpen" :item="playing" />

    <AppDialog v-model:open="renameOpen" :title="t('exports.rename')">
      <form id="export-rename" @submit.prevent="rename">
        <input
          v-model="newName"
          class="exports-view__input"
          type="text"
          maxlength="256"
          required
          :aria-label="t('export.name')"
        />
      </form>
      <template #actions>
        <AppButton @click="renameOpen = false">
          {{ t("dialog.cancel") }}
        </AppButton>
        <AppButton
          type="submit"
          form="export-rename"
          variant="primary"
          :disabled="busy || !newName.trim()"
        >
          {{ t("exports.save") }}
        </AppButton>
      </template>
    </AppDialog>

    <AppDialog v-model:open="removeOpen" :title="t('exports.delete')">
      <p class="exports-view__confirm">
        {{
          t("exports.deleteConfirm", {
            name: removing?.name.replaceAll("_", " "),
          })
        }}
      </p>
      <template #actions>
        <AppButton @click="removeOpen = false">
          {{ t("dialog.cancel") }}
        </AppButton>
        <AppButton variant="danger" :disabled="busy" @click="remove">
          {{ t("exports.delete") }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.exports-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.exports-view__scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  padding: 16px 24px 32px;
}

.exports-view__search {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  block-size: 34px;
  padding-inline: 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-tertiary);

  &:focus-within {
    border-color: var(--selected-border);
  }

  input {
    inline-size: 180px;
    border: none;
    outline: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);

    &::placeholder {
      color: var(--text-tertiary);
    }
  }
}

.exports-view__group + .exports-view__group {
  margin-block-start: 28px;
}

.exports-view__group-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-block-end: 10px;

  h2 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
  }
}

.exports-view__count {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.exports-view__download-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent-text);

  &:hover {
    color: var(--accent-text-hover);
  }
}

.exports-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.exports-view__skeleton {
  aspect-ratio: 16 / 12;
  border-radius: var(--radius);
}

.exports-view__input {
  inline-size: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-md);
}

.exports-view__confirm {
  margin: 0;
  font-size: var(--text-md);
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  /* the document scrolls on phones */
  .exports-view {
    block-size: auto;
  }

  .exports-view__scroll {
    overflow: visible;
    padding: 8px 10px 24px;
  }

  .exports-view__search input {
    inline-size: 110px;
  }

  .exports-view__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
}
</style>
