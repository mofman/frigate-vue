/** The values Explore's filters and search suggestions can choose from. */
import { computed, type Ref } from "vue";
import { useQuery } from "@/api/query";
import {
  useCameras,
  useConfig,
  useTimeOptions,
} from "@/composables/useFrigate";
import type { ExploreFilter } from "@/types/event";
import {
  dateTagValue,
  localDateOrder,
  type TagContext,
  type TagSuggestions,
} from "@/utils/exploreTags";

export function useExploreOptions(filter: Ref<ExploreFilter>) {
  const { data: config } = useConfig();
  const cameras = useCameras();
  const timeOptions = useTimeOptions();

  const hasCustomClassification = computed(
    () => Object.keys(config.value?.classification?.custom ?? {}).length > 0,
  );
  const plusEnabled = computed(() => !!config.value?.plus?.enabled);
  const semanticSearch = computed(
    () => !!config.value?.semantic_search?.enabled,
  );
  const imperial = computed(() => config.value?.ui?.unit_system !== "metric");

  const { data: subLabelData } = useQuery<string[]>(
    ["sub_labels", { split_joined: 1 }],
    { staleTime: 60_000 },
  );
  const { data: plateData } = useQuery<string[]>("recognized_license_plates", {
    staleTime: 60_000,
  });
  const { data: attributeData } = useQuery<string[]>(
    computed(() =>
      hasCustomClassification.value ? "classification/attributes" : null,
    ),
    { staleTime: 60_000 },
  );

  /** cameras in the filter that this user may see, or all of them */
  const scoped = computed(() => {
    const chosen = filter.value.cameras;
    return chosen?.length
      ? cameras.value.filter((camera) => chosen.includes(camera.name))
      : cameras.value;
  });

  const labels = computed(() => {
    const attributes = new Set(
      Object.values(config.value?.model?.attributes_map ?? {}).flat(),
    );
    const found = new Set<string>();
    for (const camera of scoped.value) {
      for (const label of camera.objects?.track ?? [])
        if (!attributes.has(label)) found.add(label);
      if (camera.type === "lpr") found.add("license_plate");
      if (camera.audio?.enabled_in_config)
        for (const label of camera.audio.listen ?? []) found.add(label);
    }
    return [...found].sort();
  });

  /** labels that come from audio detection, translated from their own file */
  const audioLabels = computed(() => {
    const found = new Set<string>();
    for (const camera of cameras.value)
      if (camera.audio?.enabled_in_config)
        for (const label of camera.audio.listen ?? []) found.add(label);
    return found;
  });

  const zones = computed(() => {
    const found = new Set<string>();
    for (const camera of scoped.value)
      for (const zone of Object.keys(camera.zones ?? {})) found.add(zone);
    return [...found].sort();
  });

  const subLabels = computed(() => subLabelData.value ?? []);
  const plates = computed(() => plateData.value ?? []);
  const attributes = computed(() =>
    Array.isArray(attributeData.value) ? attributeData.value : [],
  );

  const hour12 = computed(() => {
    const configured = timeOptions.value.hour12;
    if (configured !== undefined) return configured;
    return !!new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
    }).resolvedOptions().hour12;
  });

  const tagContext = computed<TagContext>(() => {
    const dateOrder = localDateOrder();
    const suggestions: TagSuggestions = {
      cameras: cameras.value.map((camera) => camera.name),
      labels: labels.value,
      zones: zones.value,
      sub_labels: subLabels.value,
      ...(hasCustomClassification.value && { attributes: attributes.value }),
      search_type: ["thumbnail", "description"],
      time_range: [hour12.value ? "12:00AM-11:59PM" : "00:00-23:59"],
      before: [dateTagValue(dateOrder)],
      after: [dateTagValue(dateOrder, -5)],
      min_score: ["50"],
      max_score: ["100"],
      min_speed: ["1"],
      max_speed: ["150"],
      recognized_license_plate: plates.value,
      has_clip: ["yes", "no"],
      has_snapshot: ["yes", "no"],
      ...(plusEnabled.value &&
        filter.value.has_snapshot !== undefined && {
          is_submitted: ["yes", "no"],
        }),
    };
    return { suggestions, hour12: hour12.value, dateOrder };
  });

  return {
    cameras,
    labels,
    audioLabels,
    zones,
    subLabels,
    plates,
    attributes,
    hasCustomClassification,
    plusEnabled,
    semanticSearch,
    imperial,
    hour12,
    tagContext,
  };
}
