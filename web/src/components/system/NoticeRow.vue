<script setup lang="ts">
/** One notice: severity, scope, text, when it happened and what to do. */
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  BellOff,
  Check,
  CircleX,
  ExternalLink,
  Eye,
  Info,
  Settings,
  TriangleAlert,
} from "@lucide/vue";
import {
  cameraLabel,
  useConfig,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { Notice } from "@/types/health";
import { formatDateTime } from "@/utils/time";
import IconButton from "@/components/ui/IconButton.vue";

const props = defineProps<{ notice: Notice; hidden?: boolean }>();
const emit = defineEmits<{
  acknowledge: [];
  mute: [];
  unhide: [];
}>();

const { t } = useT(["views/system"]);
const router = useRouter();
const { data: config } = useConfig();
const timeOptions = useTimeOptions();

const icon = computed(
  () =>
    ({ error: CircleX, warning: TriangleAlert, info: Info })[
      props.notice.severity
    ],
);

const scope = computed(() => {
  const { category, scope } = props.notice;
  // only a camera scope is a name; others are ids like a release
  if (category !== "camera" || !scope) return undefined;
  return cameraLabel(config.value?.cameras[scope], scope);
});

// replace keeps backend params out of i18next's own option names
const text = computed(() =>
  t(`health.notices.kinds.${props.notice.kind}`, {
    replace: props.notice.params,
    count: props.notice.count,
    defaultValue: props.notice.kind,
  }),
);

const time = (ts: number) => formatDateTime(ts, timeOptions.value);

const meta = computed(() => {
  const { muted_at, acknowledged_at, first_seen, last_seen, count } =
    props.notice;
  if (muted_at !== null)
    return t("health.notices.mutedAt", { time: time(muted_at) });
  if (acknowledged_at !== null) {
    return t("health.notices.acknowledgedAt", { time: time(acknowledged_at) });
  }
  return t("health.notices.occurred", {
    time: time(first_seen),
    lastTime: time(last_seen),
    count,
  });
});

const external = computed(() =>
  props.notice.link && /^https?:\/\//.test(props.notice.link)
    ? props.notice.link
    : undefined,
);

// in app links may point at pages the new interface has not rebuilt yet
const internal = computed(() => {
  const link = props.notice.link;
  if (!link || external.value) return undefined;
  return router.resolve(link).name === "not-found" ? undefined : link;
});
</script>

<template>
  <li
    class="notice"
    :class="[`is-${notice.severity}`, { 'is-hidden': hidden }]"
  >
    <component :is="icon" class="notice__icon" :size="18" aria-hidden="true" />
    <div class="notice__body">
      <p class="notice__text">
        <span v-if="scope" class="notice__scope">{{ scope }}</span>
        {{ text }}
      </p>
      <p class="notice__meta">{{ meta }}</p>
    </div>
    <div class="notice__actions">
      <IconButton
        v-if="internal"
        size="sm"
        :label="t('health.notices.openSettings')"
        @click="router.push(internal)"
        ><Settings
      /></IconButton>
      <a
        v-if="external"
        class="notice__link"
        :href="external"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('health.notices.openLink')"
        :title="t('health.notices.openLink')"
        ><ExternalLink :size="14"
      /></a>
      <template v-if="hidden">
        <IconButton
          size="sm"
          :label="t('health.notices.showAgain')"
          @click="emit('unhide')"
          ><Eye
        /></IconButton>
      </template>
      <template v-else>
        <IconButton
          v-if="notice.acknowledgeable"
          size="sm"
          :label="`${t('health.notices.acknowledge')}: ${t('health.notices.acknowledgeHint')}`"
          @click="emit('acknowledge')"
          ><Check
        /></IconButton>
        <IconButton
          size="sm"
          :label="`${t('health.notices.mute')}: ${t('health.notices.muteHint')}`"
          @click="emit('mute')"
          ><BellOff
        /></IconButton>
      </template>
    </div>
  </li>
</template>

<style scoped>
.notice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 12px 4px;
  --tone: var(--text-tertiary);

  & + & {
    border-block-start: 1px solid var(--glass-border);
  }

  &.is-error {
    --tone: var(--danger);
  }

  &.is-warning {
    --tone: var(--warning);
  }

  &.is-info {
    --tone: var(--online);
  }

  &.is-hidden {
    --tone: var(--text-tertiary);
  }
}

.notice__icon {
  margin-block-start: 1px;
  color: var(--tone);
}

.notice__body {
  display: grid;
  gap: 3px;
}

.notice__text {
  font-size: var(--text-base);
  line-height: 1.45;
  color: var(--text-primary);
  overflow-wrap: anywhere;

  .is-hidden & {
    color: var(--text-secondary);
  }
}

.notice__scope {
  display: inline-block;
  margin-inline-end: 6px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--bg-surface);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 20px;
  vertical-align: 1px;
  color: var(--text-secondary);
  text-transform: capitalize;
}

.notice__meta {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.notice__actions {
  display: flex;
  gap: 4px;
}

.notice__link {
  display: inline-grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-tertiary);

  &:hover {
    color: var(--text-primary);
    border-color: var(--line-hover);
  }
}
</style>
