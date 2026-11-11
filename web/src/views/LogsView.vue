<script setup lang="ts">
/**
 * Logs for Frigate, go2rtc and nginx. The last lines load first, then new
 * lines stream in while the view follows the bottom; scrolling to the top
 * loads older lines. Rows use content-visibility instead of a virtual list.
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowDown, Copy, Download } from "@lucide/vue";
import { buildUrl, errorMessage, http } from "@/api/http";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import { downloadText, useDocumentTitle } from "@/composables/useUtil";
import {
  logServices,
  type LogLine,
  type LogPage,
  type LogService,
  type LogSeverity,
} from "@/types/log";
import { parseLogLine } from "@/utils/logs";
import PageHeader from "@/components/layout/PageHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import IconButton from "@/components/ui/IconButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";

/** lines per request, both the first page and each older page */
const PAGE = 200;
/** lines kept in memory while streaming; older ones reload on scroll */
const MAX_LINES = 5000;
/** distance from the bottom that still counts as following */
const FOLLOW_PX = 48;

type Entry = { id: number; raw: string; line: LogLine };

const { t } = useT(["views/system", "common"]);
const route = useRoute();
const router = useRouter();

const service = computed<LogService>({
  get: () => {
    const hash = route.hash.slice(1) as LogService;
    return logServices.includes(hash) ? hash : "frigate";
  },
  set: (value) => void router.replace({ hash: `#${value}` }),
});
const serviceOptions = logServices.map((value) => ({
  value,
  label: value,
  text: true,
}));

useDocumentTitle(() => t(`documentTitle.logs.${service.value}`));

const entries = shallowRef<Entry[]>([]);
const loading = shallowRef(true);
const following = shallowRef(true);
const severities = shallowRef<LogSeverity[]>([]);
const selected = shallowRef<Entry>();
const detailOpen = computed({
  get: () => !!selected.value,
  set: (open) => {
    if (!open) selected.value = undefined;
  },
});

const scroller = useTemplateRef<HTMLElement>("scroller");

/** file line index of the oldest loaded line; 0 means nothing older */
let oldestIndex = 0;
let nextId = 0;
let loadingOlder = false;
let stream: AbortController | undefined;
let generation = 0;

const visible = computed(() =>
  severities.value.length
    ? entries.value.filter((entry) =>
        severities.value.includes(entry.line.severity),
      )
    : entries.value,
);

function toEntries(lines: string[]): Entry[] {
  return lines.flatMap((raw) => {
    const line = parseLogLine(service.value, raw);
    return line ? [{ id: nextId++, raw, line }] : [];
  });
}

function atBottom() {
  const el = scroller.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_PX;
}

async function scrollToBottom() {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function fetchPage(start: number, end?: number) {
  return http.get<LogPage>(`logs/${service.value}`, {
    params: { start, end },
  });
}

function append(lines: string[]) {
  const added = toEntries(lines.filter((line) => line.trim()));
  if (!added.length) return;
  const stick = following.value && atBottom();
  let next = [...entries.value, ...added];
  if (next.length > MAX_LINES) {
    const dropped = next.length - MAX_LINES;
    next = next.slice(dropped);
    oldestIndex += dropped;
  }
  entries.value = next;
  if (stick) void scrollToBottom();
}

async function streamLines(run: number) {
  stream?.abort();
  const controller = new AbortController();
  stream = controller;
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    const response = await fetch(
      buildUrl(`logs/${service.value}`, { stream: true }),
      { credentials: "include", signal: controller.signal },
    );
    if (!response.ok || !response.body) {
      throw new Error(`${response.status}`);
    }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done || run !== generation) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      append(lines);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError" || run !== generation) return;
    showToast(
      t("logs.toast.error.whileStreamingLogs", {
        errorMessage: errorMessage(err),
      }),
      "error",
    );
  }
}

async function load() {
  const run = ++generation;
  stream?.abort();
  entries.value = [];
  loading.value = true;
  following.value = true;
  oldestIndex = 0;
  try {
    const page = await fetchPage(-PAGE);
    if (run !== generation) return;
    entries.value = toEntries(page.lines);
    oldestIndex = Math.max(0, page.totalLines - page.lines.length);
  } catch (err) {
    if (run !== generation) return;
    showToast(
      t("logs.toast.error.fetchingLogsFailed", {
        errorMessage: errorMessage(err),
      }),
      "error",
    );
  } finally {
    if (run === generation) loading.value = false;
  }
  await scrollToBottom();
  void streamLines(run);
}

async function loadOlder() {
  if (loadingOlder || oldestIndex <= 0) return;
  loadingOlder = true;
  const run = generation;
  const end = oldestIndex;
  const start = Math.max(0, end - PAGE);
  try {
    const page = await fetchPage(start, end);
    if (run !== generation || oldestIndex !== end) return;
    const el = scroller.value;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    entries.value = [...toEntries(page.lines), ...entries.value];
    oldestIndex = start;
    // keep the rows that were on screen in place
    await nextTick();
    if (el) el.scrollTop = el.scrollHeight - before;
  } catch {
    // scrolling up again retries
  } finally {
    loadingOlder = false;
  }
}

function onScroll() {
  const el = scroller.value;
  if (!el) return;
  following.value = atBottom();
  if (el.scrollTop < el.clientHeight) void loadOlder();
}

function jumpToLatest() {
  following.value = true;
  void scrollToBottom();
}

watch(service, () => void load(), { immediate: true });

// filtering changes the height, so stay at the end if we were following
watch(severities, () => {
  if (following.value) void scrollToBottom();
});

onBeforeUnmount(() => {
  generation++;
  stream?.abort();
});

const levels: LogSeverity[] = ["debug", "info", "warning", "error"];
function toggleLevel(level: LogSeverity) {
  severities.value = severities.value.includes(level)
    ? severities.value.filter((s) => s !== level)
    : [...severities.value, level];
}

async function copyLogs() {
  try {
    await navigator.clipboard.writeText(
      visible.value.map((entry) => entry.raw).join("\n"),
    );
    showToast(t("logs.copy.success"), "success");
  } catch {
    showToast(t("logs.copy.error"), "error");
  }
}

async function download() {
  try {
    const text = await http.get<string>(`logs/${service.value}`, {
      params: { download: true },
    });
    downloadText(`${service.value}-logs.txt`, String(text));
  } catch (err) {
    showToast(
      t("logs.toast.error.fetchingLogsFailed", {
        errorMessage: errorMessage(err),
      }),
      "error",
    );
  }
}
</script>

<template>
  <div class="logs-view">
    <PageHeader :title="t('common:menu.systemLogs')">
      <template #meta>
        <SegmentedToggle
          v-model="service"
          :options="serviceOptions"
          :label="t('logs.type.label')"
        />
      </template>
      <template #actions>
        <PopoverMenu width="180px">
          <template #trigger="{ popovertarget }">
            <AppButton
              compact
              :popovertarget="popovertarget"
              :class="{ 'is-filtered': severities.length }"
            >
              {{
                severities.length
                  ? severities.map((s) => s.toUpperCase()).join(", ")
                  : t("logs.type.label")
              }}
            </AppButton>
          </template>
          <MenuLabel>{{ t("logs.type.label") }}</MenuLabel>
          <MenuItem
            v-for="level in levels"
            :key="level"
            role="menuitemcheckbox"
            :selected="severities.includes(level)"
            @click="toggleLevel(level)"
          >
            {{ level }}
          </MenuItem>
        </PopoverMenu>
        <IconButton :label="t('logs.copy.label')" @click="copyLogs"
          ><Copy
        /></IconButton>
        <IconButton :label="t('logs.download.label')" @click="download"
          ><Download
        /></IconButton>
      </template>
    </PageHeader>

    <div class="logs-view__frame">
      <div
        ref="scroller"
        class="logs-view__scroll"
        role="log"
        :aria-label="t('logs.tips')"
        :aria-busy="loading"
        @scroll.passive="onScroll"
      >
        <div v-if="loading" class="logs-view__loading">
          <LoadingSpinner :size="28" />
        </div>
        <ol v-else class="logs-view__lines">
          <li
            v-for="entry in visible"
            :key="entry.id"
            class="log-line"
            :class="`is-${entry.line.severity}`"
            tabindex="0"
            @click="selected = entry"
            @keydown.enter="selected = entry"
          >
            <span class="log-line__date">{{ entry.line.dateStamp }}</span>
            <span class="log-line__level">{{ entry.line.severity }}</span>
            <span class="log-line__section">{{ entry.line.section }}</span>
            <span class="log-line__text">{{ entry.line.content }}</span>
          </li>
        </ol>
      </div>
      <AppButton
        v-if="!following && !loading"
        class="logs-view__latest"
        size="sm"
        variant="primary"
        @click="jumpToLatest"
      >
        <template #icon><ArrowDown /></template>
        {{ t("logs.tips") }}
      </AppButton>
    </div>

    <AppDialog
      v-model:open="detailOpen"
      :title="selected?.line.section ?? ''"
      width="640px"
    >
      <dl v-if="selected" class="log-detail">
        <dt>{{ t("logs.type.timestamp") }}</dt>
        <dd>{{ selected.line.dateStamp }}</dd>
        <dt>{{ t("logs.type.label") }}</dt>
        <dd class="log-line" :class="`is-${selected.line.severity}`">
          <span class="log-line__level">{{ selected.line.severity }}</span>
        </dd>
        <dt>{{ t("logs.type.tag") }}</dt>
        <dd>{{ selected.line.section }}</dd>
        <dt>{{ t("logs.type.message") }}</dt>
        <dd class="log-detail__message">{{ selected.line.content }}</dd>
      </dl>
    </AppDialog>
  </div>
</template>

<style scoped>
.logs-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.is-filtered {
  border-color: var(--selected-border);
  background: var(--selected-surface);
}

.logs-view__frame {
  position: relative;
  flex: 1;
  min-block-size: 0;
  margin: 16px 24px 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--code-bg);
  overflow: hidden;
}

.logs-view__scroll {
  block-size: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}

.logs-view__loading {
  display: grid;
  place-items: center;
  block-size: 100%;
  min-block-size: 200px;
}

.logs-view__lines {
  padding-block: 6px;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.55;
}

.log-line {
  display: grid;
  grid-template-columns: 19ch 8ch 22ch minmax(0, 1fr);
  gap: 12px;
  padding: 2px 14px;
  cursor: pointer;
  content-visibility: auto;
  contain-intrinsic-size: auto 22px;
  --tone: var(--text-tertiary);

  &:hover,
  &:focus-visible {
    background: var(--code-line-active);
    outline: none;
  }

  &.is-info {
    --tone: var(--online);
  }

  &.is-warning {
    --tone: var(--warning);
  }

  &.is-error {
    --tone: var(--danger);
  }
}

.log-line__date {
  color: var(--text-tertiary);
  white-space: nowrap;
}

.log-line__level {
  color: var(--tone);
  font-weight: 500;
  text-transform: uppercase;
}

.log-line__section {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.log-line__text {
  color: var(--text-primary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.logs-view__latest {
  position: absolute;
  inset: auto 16px 14px auto;
  box-shadow: var(--shadow-pill);
}

.log-detail {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 16px;
  font-size: var(--text-md);

  dt {
    color: var(--text-tertiary);
  }

  dd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }

  .log-line {
    display: block;
    padding: 0;
    cursor: auto;
  }
}

.log-detail__message {
  max-block-size: 50dvh;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .logs-view {
    block-size: auto;
  }

  .logs-view__frame {
    margin: 10px 10px 12px;
    block-size: calc(
      100dvh - 160px - var(--tabbar-height) - env(safe-area-inset-bottom)
    );
    flex: none;
  }

  /* timestamp and level above the message on narrow screens */
  .log-line {
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 2px 8px;
    padding: 6px 10px;
    border-block-end: 1px solid var(--glass-border);
  }

  .log-line__text {
    grid-column: 1 / -1;
  }
}
</style>
