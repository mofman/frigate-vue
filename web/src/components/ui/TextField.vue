<script setup lang="ts">
/**
 * Labelled text input. Other attributes (placeholder, autocomplete, min...)
 * go to the input. Passing showLabel and hideLabel adds a reveal button.
 */
import { computed, shallowRef, useId } from "vue";
import { Eye, EyeOff } from "@lucide/vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  showLabel?: string;
  hideLabel?: string;
}>();
const model = defineModel<string>({ required: true });

const id = useId();
const revealed = shallowRef(false);
const canReveal = computed(() => !!props.showLabel && !!props.hideLabel);
const inputType = computed(() =>
  canReveal.value && revealed.value ? "text" : (props.type ?? "text"),
);
const describedBy = computed(
  () =>
    [props.hint && `${id}-hint`, props.error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined,
);
</script>

<template>
  <div class="text-field">
    <label class="text-field__label" :for="id">{{ label }}</label>
    <div class="text-field__control">
      <input
        v-bind="$attrs"
        :id="id"
        v-model="model"
        :type="inputType"
        :class="{ 'has-reveal': canReveal }"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="describedBy"
      />
      <button
        v-if="canReveal"
        type="button"
        class="text-field__reveal"
        :aria-label="revealed ? hideLabel : showLabel"
        :title="revealed ? hideLabel : showLabel"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="16" />
        <Eye v-else :size="16" />
      </button>
    </div>
    <p v-if="hint" :id="`${id}-hint`" class="text-field__hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="text-field__error" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.text-field {
  display: grid;
  gap: 6px;
  min-inline-size: 0;
}

.text-field__label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.text-field__control {
  position: relative;

  input {
    inline-size: 100%;
    block-size: 36px;
    padding-inline: 10px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    font-size: var(--text-md);
    color: var(--text-primary);
    transition: border-color var(--dur);

    &.has-reveal {
      padding-inline-end: 36px;
    }

    &:focus {
      outline: none;
      border-color: var(--accent);
    }

    &[aria-invalid="true"] {
      border-color: var(--danger);
    }
  }
}

.text-field__reveal {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  display: grid;
  place-items: center;
  inline-size: 36px;
  color: var(--text-tertiary);

  &:hover {
    color: var(--text-primary);
  }
}

.text-field__hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.text-field__error {
  font-size: var(--text-sm);
  color: var(--danger);
}
</style>
