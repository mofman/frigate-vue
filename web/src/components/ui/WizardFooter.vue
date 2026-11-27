<script setup lang="ts">
/** Back, optional skip and primary actions at the end of a wizard step. */
import AppButton from "./AppButton.vue";
import LoadingSpinner from "./LoadingSpinner.vue";

defineProps<{
  backLabel?: string;
  skipLabel?: string;
  nextLabel: string;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  busy?: boolean;
}>();
defineEmits<{ back: []; skip: []; next: [] }>();
</script>

<template>
  <footer class="wizard-footer">
    <AppButton
      v-if="backLabel"
      :disabled="backDisabled || busy"
      @click="$emit('back')"
    >
      {{ backLabel }}
    </AppButton>
    <span class="wizard-footer__end">
      <AppButton v-if="skipLabel" :disabled="busy" @click="$emit('skip')">
        {{ skipLabel }}
      </AppButton>
      <AppButton
        variant="primary"
        :disabled="nextDisabled || busy"
        @click="$emit('next')"
      >
        <template v-if="busy" #icon>
          <LoadingSpinner :size="14" :delay="0" />
        </template>
        {{ nextLabel }}
      </AppButton>
    </span>
  </footer>
</template>

<style scoped>
.wizard-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-block-start: 8px;
}

.wizard-footer__end {
  display: flex;
  gap: 8px;
  margin-inline-start: auto;
}
</style>
