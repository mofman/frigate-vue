/**
 * Whether semantic search is ready. Explore cannot be used while its models
 * download or its embeddings reindex.
 */
import { computed } from "vue";
import { useWsTopic } from "@/api/ws";
import { useConfig } from "@/composables/useFrigate";
import type { EmbeddingsReindexProgress, ModelState } from "@/types/event";

const JINA_MODELS = ["jinav1", "jinav2"];

export function useEmbeddingsState() {
  const { data: config } = useConfig();
  const modelStates = useWsTopic<Record<string, ModelState>>("model_state");
  const reindex = useWsTopic<EmbeddingsReindexProgress>(
    "embeddings_reindex_progress",
  );

  const enabled = computed(() => !!config.value?.semantic_search?.enabled);

  const models = computed(() => {
    const search = config.value?.semantic_search;
    const version = search?.model || "jinav1";
    // GenAI providers have no local models to download
    if (!JINA_MODELS.includes(version)) return [];
    const large = search?.model_size === "large";
    const v2File = large
      ? "jinaai/jina-clip-v2-model_fp16.onnx"
      : "jinaai/jina-clip-v2-model_quantized.onnx";
    const v1 = version === "jinav1";
    const files = {
      visionModel: !v1
        ? v2File
        : large
          ? "jinaai/jina-clip-v1-vision_model_fp16.onnx"
          : "jinaai/jina-clip-v1-vision_model_quantized.onnx",
      visionModelFeatureExtractor: `jinaai/jina-clip-${v1 ? "v1" : "v2"}-preprocessor_config.json`,
      textModel: v1 ? "jinaai/jina-clip-v1-text_model_fp16.onnx" : v2File,
      textTokenizer: `jinaai/jina-clip-${v1 ? "v1" : "v2"}-tokenizer`,
    };
    return Object.entries(files).map(([key, file]) => ({
      key,
      state: modelStates.value?.[file],
    }));
  });

  const modelsLoaded = computed(() =>
    models.value.every((model) => model.state === "downloaded"),
  );
  const modelError = computed(() =>
    models.value.some((model) => model.state === "error"),
  );
  const reindexing = computed(() => reindex.value?.status === "indexing");

  const status = computed<"checking" | "unavailable" | "ready">(() => {
    if (!config.value) return "checking";
    if (!enabled.value) return "ready";
    if (!reindex.value || models.value.some((model) => !model.state))
      return "checking";
    return !modelsLoaded.value || reindexing.value ? "unavailable" : "ready";
  });

  return {
    enabled,
    models,
    modelsLoaded,
    modelError,
    reindex,
    reindexing,
    status,
  };
}
