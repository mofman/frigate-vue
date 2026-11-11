<script setup lang="ts">
/** Translucent glass button drawn on top of video. */
withDefaults(
  defineProps<{
    label: string;
    active?: boolean;
    tone?: "default" | "danger";
    /** md is for the camera stage, sm for tiles */
    size?: "sm" | "md";
  }>(),
  {
    active: false,
    tone: "default",
    size: "sm",
  },
);
</script>

<template>
  <button
    type="button"
    class="overlay-button"
    :class="[
      `overlay-button--${size}`,
      { 'is-active': active, 'is-danger': tone === 'danger' },
    ]"
    :aria-label="label"
    :aria-pressed="active || undefined"
    :title="label"
    @click.stop
  >
    <slot />
  </button>
</template>

<style scoped>
.overlay-button {
  display: inline-grid;
  place-items: center;
  inline-size: 30px;
  block-size: 30px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--line-overlay);
  background: var(--bg-overlay-control);
  color: var(--text-on-media-muted);
  backdrop-filter: blur(12px);
  pointer-events: auto;
  transition:
    background var(--dur-fast),
    color var(--dur-fast);

  &:hover {
    background: var(--bg-overlay-control-hover);
    color: var(--text-on-media);
  }

  &.is-active {
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  }

  &.is-danger.is-active {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }
}

.overlay-button :deep(svg) {
  inline-size: 14px;
  block-size: 14px;
}

.overlay-button--md {
  inline-size: 34px;
  block-size: 34px;
}

.overlay-button--md :deep(svg) {
  inline-size: 17px;
  block-size: 17px;
}
</style>
