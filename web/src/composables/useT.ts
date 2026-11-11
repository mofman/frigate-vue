import { onBeforeMount, shallowRef } from "vue";
import { i18next, i18nVersion } from "@/i18n";

type TOptions = Record<string, unknown>;

/**
 * Translation function bound to one or more namespaces. Keys may be prefixed
 * with "ns:" to reach any other namespace. The function reads a reactive
 * version counter so templates re-render when a language loads.
 */
export function useT(namespaces: string[] = ["views/app"]) {
  const ready = shallowRef(false);

  onBeforeMount(() => {
    void i18next.loadNamespaces(namespaces).then(() => {
      ready.value = true;
    });
  });

  const t = (key: string, options?: TOptions): string => {
    void i18nVersion.value;
    void ready.value;
    return i18next.t(key, { ns: namespaces, ...options }) as string;
  };

  return { t };
}
