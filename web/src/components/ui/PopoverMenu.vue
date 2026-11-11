<script setup lang="ts">
/**
 * Menu built on the native Popover API: light dismiss, Escape and top-layer
 * stacking for free. Positioned under its trigger, flipping above when the
 * viewport runs out of room.
 */
import { nextTick, ref, useId } from "vue";

withDefaults(defineProps<{ align?: "start" | "end"; width?: string }>(), {
  align: "end",
  width: "240px",
});

const id = useId();
const trigger = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const open = ref(false);
const position = ref<Record<string, string>>({});

function place(align: "start" | "end") {
  // the wrapper is display: contents, so measure the actual trigger element
  const anchor = trigger.value?.firstElementChild?.getBoundingClientRect();
  const menu = panel.value;
  if (!anchor || !menu) return;
  const { innerWidth, innerHeight } = window;
  const height = menu.offsetHeight;
  const below = anchor.bottom + 6 + height <= innerHeight - 8;
  const top = below ? anchor.bottom + 6 : Math.max(8, anchor.top - 6 - height);
  const style: Record<string, string> = { top: `${top}px` };
  if (align === "end")
    style.right = `${Math.max(8, innerWidth - anchor.right)}px`;
  else style.left = `${Math.max(8, anchor.left)}px`;
  position.value = style;
}

async function onToggle(event: Event, align: "start" | "end") {
  open.value = (event as ToggleEvent).newState === "open";
  if (open.value) {
    await nextTick();
    place(align);
  }
}

function close() {
  panel.value?.hidePopover();
}

defineExpose({ close });
</script>

<template>
  <div class="popover-menu">
    <div ref="trigger" class="popover-menu__trigger">
      <slot name="trigger" :popovertarget="id" :open="open" />
    </div>
    <div
      :id="id"
      ref="panel"
      popover
      class="popover-menu__panel"
      :style="{ ...position, inlineSize: width }"
      @toggle="onToggle($event, align)"
    >
      <slot :close="close" />
    </div>
  </div>
</template>

<style scoped>
.popover-menu__trigger {
  display: contents;
}

.popover-menu__panel {
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 6px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-popover);
  max-block-size: min(70dvh, 520px);
  overflow: auto;
  opacity: 0;
  translate: 0 -4px;
  transition:
    opacity var(--dur-fast),
    translate var(--dur-fast) var(--ease),
    display var(--dur-fast) allow-discrete,
    overlay var(--dur-fast) allow-discrete;

  &:popover-open {
    opacity: 1;
    translate: 0 0;

    @starting-style {
      opacity: 0;
      translate: 0 -4px;
    }
  }
}
</style>
