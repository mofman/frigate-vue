<script setup lang="ts">
/** Shown while semantic search models download or embeddings reindex. */
import { computed } from "vue";
import { Check, CircleAlert, ExternalLink, X } from "@lucide/vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import { useEmbeddingsState } from "@/composables/useEmbeddingsState";
import { useT } from "@/composables/useT";
import { formatDuration } from "@/utils/time";

const { t } = useT(["views/explore", "common"]);
const { models, modelsLoaded, modelError, reindex, reindexing } =
  useEmbeddingsState();

const progress = computed(() => {
  const total = reindex.value?.total_objects ?? 0;
  if (!total) return 0;
  return Math.round(((reindex.value?.processed_objects ?? 0) / total) * 100);
});
</script>

<template>
  <div class="explore-unavailable">
    <CircleAlert :size="36" aria-hidden="true" />
    <h2>{{ t("exploreIsUnavailable.title") }}</h2>

    <template v-if="reindexing && modelsLoaded && reindex">
      <p>{{ t("exploreIsUnavailable.embeddingsReindexing.context") }}</p>
      <progress
        :value="reindex.processed_objects"
        :max="reindex.total_objects || 1"
        :aria-label="
          t(
            'exploreIsUnavailable.embeddingsReindexing.step.trackedObjectsProcessed',
          )
        "
      />
      <strong>{{ progress }}%</strong>
      <p v-if="reindex.time_remaining === -1">
        {{ t("exploreIsUnavailable.embeddingsReindexing.startingUp") }}
      </p>
      <p
        v-else-if="
          reindex.time_remaining !== null &&
          reindex.time_remaining !== undefined
        "
      >
        {{ t("exploreIsUnavailable.embeddingsReindexing.estimatedTime") }}
        {{
          reindex.time_remaining > 0
            ? formatDuration(reindex.time_remaining)
            : t("exploreIsUnavailable.embeddingsReindexing.finishingShortly")
        }}
      </p>
      <dl>
        <div>
          <dt>
            {{
              t(
                "exploreIsUnavailable.embeddingsReindexing.step.thumbnailsEmbedded",
              )
            }}
          </dt>
          <dd>{{ reindex.thumbnails }}</dd>
        </div>
        <div>
          <dt>
            {{
              t(
                "exploreIsUnavailable.embeddingsReindexing.step.descriptionsEmbedded",
              )
            }}
          </dt>
          <dd>{{ reindex.descriptions }}</dd>
        </div>
        <div>
          <dt>
            {{
              t(
                "exploreIsUnavailable.embeddingsReindexing.step.trackedObjectsProcessed",
              )
            }}
          </dt>
          <dd>{{ reindex.processed_objects }} / {{ reindex.total_objects }}</dd>
        </div>
      </dl>
    </template>

    <template v-if="!modelsLoaded">
      <p>{{ t("exploreIsUnavailable.downloadingModels.context") }}</p>
      <ul>
        <li v-for="model in models" :key="model.key">
          <LoadingSpinner
            v-if="model.state === 'downloading'"
            :size="16"
            :delay="0"
          />
          <Check
            v-else-if="model.state === 'downloaded'"
            class="is-done"
            :size="16"
          />
          <X v-else class="is-failed" :size="16" />
          {{ t(`exploreIsUnavailable.downloadingModels.setup.${model.key}`) }}
        </li>
      </ul>
      <p v-if="modelError" class="is-failed">
        {{ t("exploreIsUnavailable.downloadingModels.error") }}
      </p>
      <p>{{ t("exploreIsUnavailable.downloadingModels.tips.context") }}</p>
      <a
        href="https://docs.frigate.video/configuration/semantic_search"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("common:readTheDocumentation") }}
        <ExternalLink :size="12" aria-hidden="true" />
      </a>
    </template>
  </div>
</template>

<style scoped>
.explore-unavailable {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  flex: 1;
  max-inline-size: 440px;
  margin-inline: auto;
  padding: 32px 16px;
  color: var(--text-secondary);
  font-size: var(--text-md);
  text-align: center;

  h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-lg);
  }

  p {
    margin: 0;
  }

  progress {
    inline-size: 100%;
    block-size: 6px;
    accent-color: var(--accent-strong);
  }

  dl {
    display: grid;
    gap: 4px;
    margin: 0;

    div {
      display: flex;
      justify-content: center;
      gap: 8px;
    }
  }

  dt {
    color: var(--text-tertiary);
  }

  dd {
    margin: 0;
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-text);
  }
}

.is-done {
  color: var(--live);
}

.is-failed {
  color: var(--danger);
}
</style>
