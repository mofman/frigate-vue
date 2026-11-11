<script setup lang="ts">
/**
 * Pan, tilt, zoom and focus pad for ONVIF cameras. Buttons move while held
 * and send STOP on release, cancel or losing the pointer.
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Focus,
  Minus,
  MousePointerClick,
  Move,
  Plus,
  ZoomIn,
  ZoomOut,
} from "@lucide/vue";
import { shallowRef } from "vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import type { Ptz } from "@/composables/usePtz";
import { useT } from "@/composables/useT";

const props = defineProps<{ ptz: Ptz }>();
const clickMove = defineModel<boolean>("clickMove", { required: true });
const { t } = useT(["views/app"]);
/** small stages fold the pad behind one button */
const expanded = shallowRef(false);

let moving = false;

function press(event: PointerEvent, command: string) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  moving = true;
  props.ptz.send(command);
}

function release() {
  if (!moving) return;
  moving = false;
  props.ptz.send("STOP");
}

type Hold = { command: string; label: string; icon: unknown };
const pad: (Hold & { area: string })[] = [
  { command: "MOVE_UP", label: "ptz.up", icon: ArrowUp, area: "up" },
  { command: "MOVE_LEFT", label: "ptz.left", icon: ArrowLeft, area: "left" },
  {
    command: "MOVE_RIGHT",
    label: "ptz.right",
    icon: ArrowRight,
    area: "right",
  },
  { command: "MOVE_DOWN", label: "ptz.down", icon: ArrowDown, area: "down" },
];
const zoom: Hold[] = [
  { command: "ZOOM_IN", label: "ptz.zoomIn", icon: ZoomIn },
  { command: "ZOOM_OUT", label: "ptz.zoomOut", icon: ZoomOut },
];
const focus: Hold[] = [
  { command: "FOCUS_IN", label: "ptz.focusIn", icon: Plus },
  { command: "FOCUS_OUT", label: "ptz.focusOut", icon: Minus },
];
</script>

<template>
  <div
    class="ptz-panel"
    :class="{ 'is-expanded': expanded }"
    :aria-label="t('ptz.title')"
    role="group"
  >
    <OverlayButton
      class="ptz-panel__toggle"
      :label="t('ptz.title')"
      :active="expanded"
      @click="expanded = !expanded"
    >
      <Move />
    </OverlayButton>
    <div v-if="ptz.canMove.value" class="ptz-panel__pad">
      <OverlayButton
        v-for="button in pad"
        :key="button.command"
        :style="{ gridArea: button.area }"
        :label="t(button.label)"
        @pointerdown="press($event, button.command)"
        @pointerup="release"
        @pointercancel="release"
        @lostpointercapture="release"
        @contextmenu.prevent
      >
        <component :is="button.icon" />
      </OverlayButton>
    </div>
    <div v-if="ptz.canZoom.value" class="ptz-panel__column">
      <OverlayButton
        v-for="button in zoom"
        :key="button.command"
        :label="t(button.label)"
        @pointerdown="press($event, button.command)"
        @pointerup="release"
        @pointercancel="release"
        @lostpointercapture="release"
        @contextmenu.prevent
      >
        <component :is="button.icon" />
      </OverlayButton>
    </div>
    <div v-if="ptz.canFocus.value" class="ptz-panel__column">
      <Focus class="ptz-panel__hint" :size="12" aria-hidden="true" />
      <OverlayButton
        v-for="button in focus"
        :key="button.command"
        :label="t(button.label)"
        @pointerdown="press($event, button.command)"
        @pointerup="release"
        @pointercancel="release"
        @lostpointercapture="release"
        @contextmenu.prevent
      >
        <component :is="button.icon" />
      </OverlayButton>
    </div>
    <div class="ptz-panel__column">
      <OverlayButton
        v-if="ptz.canClickMove.value"
        :label="
          ptz.canBoxZoom.value ? t('ptz.clickMoveZoom') : t('ptz.clickMove')
        "
        :active="clickMove"
        @click="clickMove = !clickMove"
      >
        <MousePointerClick />
      </OverlayButton>
      <PopoverMenu v-if="ptz.presets.value.length" align="end" width="200px">
        <template #trigger="{ popovertarget }">
          <OverlayButton
            :label="t('ptz.presets')"
            :popovertarget="popovertarget"
          >
            <Crosshair />
          </OverlayButton>
        </template>
        <template #default="{ close }">
          <MenuItem
            v-for="(preset, index) in ptz.presets.value"
            :key="preset"
            @click="
              ptz.send(`preset_${preset}`);
              close();
            "
          >
            {{ preset.replaceAll("_", " ") }}
            <template v-if="index < 9" #hint>{{ index + 1 }}</template>
          </MenuItem>
        </template>
      </PopoverMenu>
    </div>
  </div>
</template>

<style scoped>
.ptz-panel {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.ptz-panel__pad {
  display: grid;
  grid-template-areas:
    ". up ."
    "left . right"
    ". down .";
  gap: 2px;
}

.ptz-panel__column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ptz-panel__hint {
  color: var(--text-on-media-faint);
}

.ptz-panel__toggle {
  display: none;
}

/* the stage frame is the size container */
@container (max-width: 640px) {
  .ptz-panel__toggle {
    display: inline-grid;
  }

  .ptz-panel:not(.is-expanded) > :not(.ptz-panel__toggle) {
    display: none;
  }

  .ptz-panel.is-expanded {
    flex-wrap: wrap-reverse;
    justify-content: flex-end;
  }
}
</style>
