<template>
  <div class="menu-label"><slot /></div>
</template>

<style scoped>
.menu-label {
  padding: 8px 10px 4px;
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
</style>
