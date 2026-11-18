<script setup lang="ts">
/** A tracked object's clip beside its timeline, kept in step with each other. */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  SlidersHorizontal,
} from "@lucide/vue";
import { http } from "@/api/http";
import EmptyState from "@/components/ui/EmptyState.vue";
import IconButton from "@/components/ui/IconButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import {
  useConfig,
  useIsAdmin,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import { useTrackingDetails } from "@/composables/useTrackingDetails";
import { RecordingPlayer } from "@/players/recording";
import type { TimelineEntry, TrackedEvent } from "@/types/event";
import { REVIEW_PADDING } from "@/utils/review";
import { formatDateTime, formatTime } from "@/utils/time";
import {
  ACTIVE_WINDOW,
  detectTime,
  entryStats,
  percent,
  recordTime,
  rowProgress,
  zoneColor,
} from "@/utils/tracking";
import AnnotationOffsetPanel from "./AnnotationOffsetPanel.vue";
import TrackOverlay from "./TrackOverlay.vue";

const props = defineProps<{ event: TrackedEvent }>();

const { t } = useT([
  "views/explore",
  "views/events",
  "components/player",
  "common",
  "objects",
  "audio",
]);
const { data: config } = useConfig();
const admin = useIsAdmin();
const timeOptions = useTimeOptions();

const { timeline, fullEvent, isLoading } = useTrackingDetails(
  () => props.event.id,
);

const cameraConfig = computed(() => config.value?.cameras[props.event.camera]);
const detectWidth = computed(() => cameraConfig.value?.detect.width ?? 0);
const detectHeight = computed(() => cameraConfig.value?.detect.height ?? 0);
const autotracking = computed(
  () => !!cameraConfig.value?.onvif?.autotracking?.enabled_in_config,
);
const plusEnabled = computed(() => !!config.value?.plus?.enabled);

// ---- player -----------------------------------------------------------------

const video = shallowRef<HTMLVideoElement | null>(null);
const videoWidth = shallowRef(0);
const videoHeight = shallowRef(0);
const showPicture = shallowRef(false);
let player: RecordingPlayer | undefined;
const status = shallowRef<RecordingPlayer["status"]["value"]>("idle");
const playerTime = shallowRef<number>();

const offset = shallowRef(0);
const settingsOpen = shallowRef(false);
/** detect time held on screen while the offset is being adjusted */
let pinned: number | undefined;

const stopWatchers: (() => void)[] = [];

function load() {
  if (!player) return;
  const { event } = props;
  offset.value = cameraConfig.value?.detect.annotation_offset ?? 0;
  settingsOpen.value = false;
  showPicture.value = false;
  // the clip stays put while the offset changes, only the mapping moves
  const shift = offset.value / 1000;
  const end = event.end_time ?? Date.now() / 1000;
  void player.loadClip(
    event.camera,
    event.start_time + shift - REVIEW_PADDING,
    end + shift + REVIEW_PADDING,
  );
}

onMounted(() => {
  if (!video.value) return;
  player = new RecordingPlayer(video.value);
  stopWatchers.push(
    watch(player.status, (value) => (status.value = value), {
      immediate: true,
    }),
    watch(player.timestamp, (value) => (playerTime.value = value), {
      immediate: true,
    }),
  );
  load();
});

watch(() => props.event.id, load);
// the config can arrive after the dialog opened from a direct link
watch(
  () => cameraConfig.value?.detect.annotation_offset,
  (value) => {
    if (!settingsOpen.value && value !== undefined) offset.value = value;
  },
);

onBeforeUnmount(() => {
  stopWatchers.forEach((stop) => stop());
  player?.destroy();
});

function onMetadata() {
  videoWidth.value = video.value?.videoWidth ?? 0;
  videoHeight.value = video.value?.videoHeight ?? 0;
}

const overlayWidth = computed(() => videoWidth.value || detectWidth.value);
const overlayHeight = computed(() => videoHeight.value || detectHeight.value);
/** sized from the picture, so the overlay always lies exactly on top of it */
const frameStyle = computed(() => {
  const width = overlayWidth.value || 16;
  const height = overlayHeight.value || 9;
  return {
    aspectRatio: `${width} / ${height}`,
    maxInlineSize: `calc(72dvh * ${width / height})`,
  };
});

const currentDetect = computed(() =>
  playerTime.value === undefined
    ? props.event.start_time - REVIEW_PADDING
    : detectTime(playerTime.value, offset.value),
);

function seekRecord(time: number) {
  player?.seek(time);
}

function seekEntry(entry: TimelineEntry) {
  seekRecord(recordTime(entry.timestamp, offset.value));
}

// while adjusting, hold one step on screen so the box stays still and the
// footage moves underneath it
watch(settingsOpen, (open) => {
  pinned = undefined;
  if (!open) return;
  player?.pause();
  const first = timeline.value[0];
  if (first) {
    pinned = first.timestamp;
    seekRecord(recordTime(pinned, offset.value));
  }
});
watch(offset, (value) => {
  if (settingsOpen.value && pinned !== undefined)
    seekRecord(recordTime(pinned, value));
});

// ---- timeline ---------------------------------------------------------------

const eventEnd = computed(
  () => props.event.end_time ?? timeline.value.at(-1)?.timestamp,
);
const inRange = computed(
  () =>
    eventEnd.value !== undefined &&
    currentDetect.value >= props.event.start_time &&
    currentDetect.value <= eventEnd.value,
);
const progress = computed(() =>
  rowProgress(
    timeline.value.map((entry) => entry.timestamp),
    currentDetect.value,
  ),
);

const expanded = shallowRef(new Set<number>());

function toggleScores(index: number) {
  const next = new Set(expanded.value);
  if (!next.delete(index)) next.add(index);
  expanded.value = next;
}

watch(
  () => props.event.id,
  () => (expanded.value = new Set()),
);

function labelName(label: string, audio = false) {
  return t(`${audio ? "audio" : "objects"}:${label}`, {
    defaultValue: label.replaceAll("_", " "),
  });
}

function zoneName(zone: string) {
  return (
    cameraConfig.value?.zones?.[zone]?.friendly_name ??
    zone.replaceAll("_", " ")
  );
}

function entryTitle({ class_type: type, data }: TimelineEntry) {
  const name = data.sub_label
    ? data.sub_label
    : labelName(data.label, type === "heard");
  const key = "trackingDetails.lifecycleItemDesc";
  switch (type) {
    case "entered_zone":
      return t(`${key}.entered_zone`, {
        label: name,
        zones: new Intl.ListFormat().format(data.zones.map(zoneName)),
      });
    case "attribute": {
      const attribute = labelName(data.attribute ?? "");
      return data.attribute === "face" || data.attribute === "license_plate"
        ? t(`${key}.attribute.faceOrLicense_plate`, { label: name, attribute })
        : t(`${key}.attribute.other`, {
            label: labelName(data.label),
            attribute,
          });
    }
    default:
      return t(`${key}.${type}`, { label: name, defaultValue: type });
  }
}

function hasStats(entry: TimelineEntry) {
  return entry.class_type !== "heard" && entry.class_type !== "external";
}

const stats = (entry: TimelineEntry) =>
  entryStats(entry, detectWidth.value, detectHeight.value);
const pixels = (area: number) => t("common:information.pixels", { area });

const headerLabel = computed(
  () =>
    props.event.sub_label ||
    labelName(props.event.label, props.event.data.type === "audio"),
);
const range = computed(() => {
  const start = formatDateTime(props.event.start_time, timeOptions.value);
  return props.event.end_time
    ? `${start} - ${formatDateTime(props.event.end_time, timeOptions.value)}`
    : start;
});
const plate = computed(() => props.event.data.recognized_license_plate);

async function submitFrame(entry: TimelineEntry) {
  try {
    await http.post(
      `${entry.camera}/plus/${recordTime(entry.timestamp, offset.value)}`,
    );
    showToast(
      t("components/player:toast.success.submittedFrigatePlus"),
      "success",
    );
  } catch {
    showToast(
      t("components/player:toast.error.submitFrigatePlusFailed"),
      "error",
    );
  }
}
</script>

<template>
  <div class="tracking">
    <div class="tracking__stage">
      <div class="tracking__frame" :style="frameStyle">
        <video
          ref="video"
          class="tracking__video"
          controls
          muted
          playsinline
          :aria-label="t('trackingDetails.title')"
          @loadedmetadata="onMetadata"
          @loadeddata="showPicture = true"
        />
        <TrackOverlay
          v-if="!autotracking"
          :event="fullEvent ?? event"
          :timeline="timeline"
          :time="playerTime ?? event.start_time"
          :offset-ms="offset"
          :width="overlayWidth"
          :height="overlayHeight"
          @seek="seekRecord"
        />
        <div
          v-if="!showPicture && status !== 'empty' && status !== 'error'"
          class="tracking__loading"
        >
          <LoadingSpinner />
        </div>
        <EmptyState
          v-if="status === 'empty' || status === 'error'"
          class="tracking__empty"
          :title="t('ui.clipUnavailable')"
        />
      </div>
    </div>

    <div class="tracking__side">
      <p v-if="autotracking" class="tracking__warning">
        {{ t("trackingDetails.autoTrackingTips") }}
      </p>

      <header class="tracking__head">
        <button
          type="button"
          class="tracking__title"
          @click="seekRecord(recordTime(event.start_time, offset))"
        >
          <strong>{{ headerLabel }}</strong>
          <span>{{ range }}</span>
          <LoadingSpinner v-if="!event.end_time" :size="12" :delay="0" />
        </button>
        <RouterLink
          v-if="plate"
          class="tracking__plate"
          :to="{
            name: 'explore',
            query: { recognized_license_plate: plate },
          }"
        >
          {{ plate }}
        </RouterLink>
        <IconButton
          size="sm"
          :label="t('trackingDetails.adjustAnnotationSettings')"
          :active="settingsOpen"
          @click="settingsOpen = !settingsOpen"
        >
          <SlidersHorizontal />
        </IconButton>
      </header>

      <AnnotationOffsetPanel
        v-if="settingsOpen"
        v-model="offset"
        :camera="event.camera"
      />

      <LoadingSpinner v-if="isLoading" />
      <p v-else-if="!timeline.length" class="tracking__none">
        {{ t("views/events:detail.noObjectDetailData") }}
      </p>
      <ol v-else class="tracking__steps">
        <li
          v-for="(entry, index) in timeline"
          :key="`${entry.timestamp}-${entry.class_type}-${index}`"
          class="tracking-step"
          :class="{
            'is-active':
              Math.abs(currentDetect - entry.timestamp) <= ACTIVE_WINDOW,
            'is-reached': inRange && currentDetect >= entry.timestamp,
          }"
          :style="{ '--progress': inRange ? progress[index] : 0 }"
        >
          <span class="tracking-step__dot" aria-hidden="true" />
          <div class="tracking-step__body">
            <button
              type="button"
              class="tracking-step__main"
              @click="seekEntry(entry)"
            >
              <span>{{ entryTitle(entry) }}</span>
              <time>{{ formatTime(entry.timestamp, timeOptions) }}</time>
            </button>

            <dl v-if="hasStats(entry)" class="tracking-step__stats">
              <div>
                <dt>
                  {{ t("trackingDetails.lifecycleItemDesc.header.score") }}
                </dt>
                <dd>{{ percent(entry.data.score) ?? "-" }}</dd>
                <button
                  v-if="entry.data.computed_score || entry.data.top_score"
                  type="button"
                  :aria-expanded="expanded.has(index)"
                  :aria-label="
                    t(
                      'trackingDetails.lifecycleItemDesc.header.toggleAdvancedScores',
                    )
                  "
                  @click="toggleScores(index)"
                >
                  <ChevronDown v-if="expanded.has(index)" :size="13" />
                  <ChevronRight v-else :size="13" />
                </button>
              </div>
              <template v-if="expanded.has(index)">
                <div v-if="entry.data.computed_score">
                  <dt>
                    {{
                      t(
                        "trackingDetails.lifecycleItemDesc.header.computedScore",
                      )
                    }}
                  </dt>
                  <dd>{{ percent(entry.data.computed_score) }}</dd>
                </div>
                <div v-if="entry.data.top_score">
                  <dt>
                    {{ t("trackingDetails.lifecycleItemDesc.header.topScore") }}
                  </dt>
                  <dd>{{ percent(entry.data.top_score) }}</dd>
                </div>
              </template>
              <div>
                <dt>
                  {{ t("trackingDetails.lifecycleItemDesc.header.ratio") }}
                </dt>
                <dd>{{ stats(entry).ratio ?? "-" }}</dd>
              </div>
              <div>
                <dt>
                  {{ t("trackingDetails.lifecycleItemDesc.header.area") }}
                  <template v-if="stats(entry).attributeArea">
                    ({{ labelName(entry.data.label) }})
                  </template>
                </dt>
                <dd v-if="stats(entry).area">
                  {{ pixels(stats(entry).area!.pixels) }} ·
                  {{ stats(entry).area!.percent }}%
                </dd>
                <dd v-else>-</dd>
              </div>
              <div v-if="stats(entry).attributeArea">
                <dt>
                  {{ t("trackingDetails.lifecycleItemDesc.header.area") }}
                  ({{ labelName(entry.data.attribute ?? "") }})
                </dt>
                <dd>
                  {{ pixels(stats(entry).attributeArea!.pixels) }} ·
                  {{ stats(entry).attributeArea!.percent }}%
                </dd>
              </div>
            </dl>

            <ul v-if="entry.data.zones?.length" class="tracking-step__zones">
              <li
                v-for="zone in entry.data.zones"
                :key="zone"
                :style="{
                  '--zone': zoneColor(config, entry.camera, zone) || undefined,
                }"
              >
                {{ zoneName(zone) }}
              </li>
            </ul>
          </div>

          <PopoverMenu v-if="admin && plusEnabled" align="end" width="200px">
            <template #trigger="{ popovertarget }">
              <IconButton
                size="sm"
                :label="t('ui.rowActions')"
                :popovertarget="popovertarget"
              >
                <Ellipsis />
              </IconButton>
            </template>
            <template #default="{ close }">
              <MenuItem
                role="menuitem"
                @click="
                  close();
                  submitFrame(entry);
                "
              >
                {{ t("itemMenu.submitToPlus.label") }}
              </MenuItem>
            </template>
          </PopoverMenu>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.tracking {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
  gap: 16px;
  min-block-size: 0;
  block-size: 100%;
}

.tracking__stage {
  min-inline-size: 0;
}

.tracking__frame {
  position: relative;
  margin-inline: auto;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-media);
}

.tracking__video {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}

.tracking__loading,
.tracking__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  pointer-events: none;
}

.tracking__side {
  display: grid;
  align-content: start;
  gap: 10px;
  min-inline-size: 0;
  max-block-size: 72dvh;
  overflow-y: auto;
}

.tracking__warning {
  margin: 0;
  color: var(--danger);
  font-size: var(--text-sm);
}

.tracking__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tracking__title {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  min-inline-size: 0;
  text-align: start;

  strong {
    font-size: var(--text-md);
    text-transform: capitalize;
  }

  span {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }
}

.tracking__plate {
  color: var(--accent-text);
  font-size: var(--text-sm);
}

.tracking__none {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--text-md);
}

.tracking__steps {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tracking-step {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 6px 2px 6px 24px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  transition: background var(--dur);

  /* the line down to the next step, and how far the playhead is along it */
  &:not(:last-child)::before,
  &:not(:last-child)::after {
    content: "";
    position: absolute;
    inset-block: 15px -15px;
    inset-inline-start: 9px;
    inline-size: 2px;
    background: var(--line-hover);
  }

  &:not(:last-child)::after {
    background: var(--accent-strong);
    transform: scaleY(var(--progress));
    transform-origin: top;
    transition: transform var(--dur);
  }

  &.is-active {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  &.is-reached .tracking-step__dot {
    background: var(--accent-strong);
  }
}

.tracking-step__dot {
  position: absolute;
  z-index: 1;
  inset-block-start: 11px;
  inset-inline-start: 5px;
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: background var(--dur);
}

.tracking-step__body {
  display: grid;
  flex: 1;
  gap: 4px;
  min-inline-size: 0;
}

.tracking-step__main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  color: inherit;
  text-align: start;

  time {
    flex: none;
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }
}

.tracking-step__stats {
  display: grid;
  gap: 2px;
  margin: 0;
  font-size: var(--text-xs);

  div {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  dt {
    color: var(--text-tertiary);
  }

  dd {
    margin: 0;
    color: var(--text-primary);
  }

  button {
    display: inline-grid;
    color: var(--text-tertiary);
  }
}

.tracking-step__zones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    --zone: var(--text-tertiary);
    padding: 1px 8px;
    border-radius: var(--radius-pill);
    border: 1px solid color-mix(in srgb, var(--zone) 60%, transparent);
    background: color-mix(in srgb, var(--zone) 10%, transparent);
    font-size: var(--text-xs);
  }
}

@media (max-width: 900px) {
  .tracking {
    grid-template-columns: minmax(0, 1fr);
    block-size: auto;
  }

  .tracking__side {
    max-block-size: none;
    overflow: visible;
  }
}
</style>
