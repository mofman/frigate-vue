<script setup lang="ts">
/** Detection chips summarizing what a camera currently sees. */
import { computed } from "vue";
import DetectionTag from "@/components/ui/DetectionTag.vue";
import { useT } from "@/composables/useT";
import type { ObjectType } from "@/types/frigate";

const props = withDefaults(
  defineProps<{ objects: ObjectType[]; motion?: boolean; max?: number }>(),
  {
    motion: false,
    max: 3,
  },
);

const { t } = useT(["views/app", "objects"]);

const groups = computed(() => {
  const counts = new Map<string, number>();
  for (const obj of props.objects) {
    const label = obj.label.replace(/-verified$/, "");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].slice(0, props.max).map(([label, count]) => ({
    label,
    text: t("activity.count", {
      count,
      label: t(`objects:${label}`, { defaultValue: label }),
    }),
  }));
});
</script>

<template>
  <div v-if="groups.length || motion" class="activity-tags">
    <DetectionTag
      v-for="group in groups"
      :key="group.label"
      :label="group.label"
      :text="group.text"
    />
    <DetectionTag
      v-if="!groups.length && motion"
      label="motion"
      :text="t('activity.motion')"
    />
  </div>
</template>

<style scoped>
.activity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
