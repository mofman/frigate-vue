/** Lets CameraGrid hand each CameraTile its computed position. */
import type { InjectionKey, Ref } from "vue";
import type { TileRect } from "@/utils/gridLayout";

export const gridRectsKey: InjectionKey<Ref<Map<string, TileRect>>> =
  Symbol("gridRects");
