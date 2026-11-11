<script setup lang="ts">
/** Top and bottom scrims over a feed, with slots for chrome on each edge. */
</script>

<template>
  <div class="camera-overlay">
    <div class="camera-overlay__top">
      <div class="camera-overlay__start"><slot name="top-start" /></div>
      <div class="camera-overlay__end"><slot name="top-end" /></div>
    </div>
    <div class="camera-overlay__bottom">
      <div class="camera-overlay__start"><slot name="bottom-start" /></div>
      <div class="camera-overlay__end"><slot name="bottom-end" /></div>
    </div>
  </div>
</template>

<style scoped>
.camera-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  z-index: 6;
}

.camera-overlay__top,
.camera-overlay__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
}

.camera-overlay__top {
  background: var(--scrim-top);
  padding-block-end: 22px;
}

.camera-overlay__bottom {
  align-items: flex-end;
  background: var(--scrim-bottom);
  padding-block-start: 22px;
}

.camera-overlay__start,
.camera-overlay__end {
  display: flex;
  align-items: center;
  gap: 6px;
  min-inline-size: 0;
}

.camera-overlay__start {
  flex-wrap: wrap;
}

.camera-overlay__end {
  flex-shrink: 0;
}

.camera-overlay__end > :deep(*) {
  pointer-events: auto;
}

/* tiny tiles drop chrome rather than overflow */
@container tile (max-width: 260px) {
  .camera-overlay__bottom .camera-overlay__end {
    display: none;
  }

  .camera-overlay__top,
  .camera-overlay__bottom {
    padding: 6px 8px;
  }
}
</style>
