<script setup lang="ts">
/** Create, edit and delete camera groups (admins). */
import { computed, shallowRef, watch } from "vue";
import { Pencil, Plus, Trash2 } from "@lucide/vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import { http } from "@/api/http";
import { invalidate } from "@/api/query";
import { cameraLabel, useCameras, useConfig } from "@/composables/useFrigate";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ deleted: [name: string]; saved: [name: string] }>();
const { t } = useT(["views/app"]);
const { data: config } = useConfig();
const cameras = useCameras();

const groups = computed(() =>
  Object.entries(config.value?.camera_groups ?? {})
    .filter(([group]) => group !== "default")
    .sort(([, a], [, b]) => a.order - b.order),
);

/** undefined: list, "": new group, otherwise the group being edited */
const editing = shallowRef<string>();
const name = shallowRef("");
const selected = shallowRef<string[]>([]);
const busy = shallowRef(false);

watch(open, (value) => {
  if (value) editing.value = groups.value.length ? undefined : "";
});
watch(editing, (group) => {
  if (group === undefined) return;
  name.value = group;
  selected.value = [...(config.value?.camera_groups[group]?.cameras ?? [])];
});

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const nameError = computed(() => {
  const value = name.value.trim();
  if (!value) return t("groups.nameRequired");
  if (!NAME_PATTERN.test(value)) return t("groups.nameInvalid");
  if (value === "default") return t("groups.nameReserved");
  if (value !== editing.value && config.value?.camera_groups[value])
    return t("groups.nameTaken");
  return "";
});
const valid = computed(() => !nameError.value && selected.value.length > 0);

function toggle(camera: string) {
  selected.value = selected.value.includes(camera)
    ? selected.value.filter((item) => item !== camera)
    : [...selected.value, camera];
}

async function setConfig(query: string) {
  await http.put(`config/set?${query}`, { requires_restart: 0 });
  invalidate("config");
}

async function save() {
  if (!valid.value || busy.value) return;
  busy.value = true;
  const next = name.value.trim();
  const previous = editing.value
    ? config.value?.camera_groups[editing.value]
    : undefined;
  const order = previous?.order ?? groups.value.length + 1;
  const icon = previous?.icon ?? "LuVideo";
  const parts: string[] = [];
  // renaming removes the old key in the same request
  if (editing.value && editing.value !== next)
    parts.push(`camera_groups.${editing.value}`);
  parts.push(`camera_groups.${next}.order=${order}`);
  parts.push(`camera_groups.${next}.icon=${encodeURIComponent(icon)}`);
  for (const camera of selected.value)
    parts.push(`camera_groups.${next}.cameras=${encodeURIComponent(camera)}`);
  try {
    await setConfig(parts.join("&"));
    showToast(t("groups.saved", { name: next }), "success");
    emit("saved", next);
    editing.value = undefined;
  } catch {
    showToast(t("groups.saveFailed"), "error");
  } finally {
    busy.value = false;
  }
}

async function remove(group: string) {
  if (!window.confirm(t("groups.confirmDelete", { name: group }))) return;
  try {
    await setConfig(`camera_groups.${group}`);
    emit("deleted", group);
  } catch {
    showToast(t("groups.saveFailed"), "error");
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="t('groups.title')" width="460px">
    <template v-if="editing === undefined">
      <ul class="group-list">
        <li v-for="[group, value] in groups" :key="group">
          <span class="group-list__name">{{ group.replaceAll("_", " ") }}</span>
          <span class="group-list__count">{{
            t("groups.cameraCount", { count: value.cameras.length })
          }}</span>
          <button
            type="button"
            class="group-list__action"
            :aria-label="t('groups.edit', { name: group })"
            @click="editing = group"
          >
            <Pencil :size="14" />
          </button>
          <button
            type="button"
            class="group-list__action is-danger"
            :aria-label="t('groups.delete', { name: group })"
            @click="remove(group)"
          >
            <Trash2 :size="14" />
          </button>
        </li>
      </ul>
      <button type="button" class="group-add" @click="editing = ''">
        <Plus :size="14" /> {{ t("groups.add") }}
      </button>
    </template>
    <form v-else id="group-form" class="group-form" @submit.prevent="save">
      <label>
        <span>{{ t("groups.name") }}</span>
        <input v-model="name" type="text" maxlength="64" required />
        <small v-if="name && nameError">{{ nameError }}</small>
      </label>
      <fieldset>
        <legend>{{ t("groups.cameras") }}</legend>
        <label
          v-for="camera in cameras"
          :key="camera.name"
          class="group-form__camera"
        >
          <input
            type="checkbox"
            :checked="selected.includes(camera.name)"
            @change="toggle(camera.name)"
          />
          {{ cameraLabel(camera) }}
        </label>
      </fieldset>
    </form>
    <template v-if="editing !== undefined" #actions>
      <button
        type="button"
        class="group-button"
        @click="groups.length ? (editing = undefined) : (open = false)"
      >
        {{ t("dialog.cancel") }}
      </button>
      <button
        type="submit"
        form="group-form"
        class="group-button is-primary"
        :disabled="!valid || busy"
      >
        {{ t("groups.save") }}
      </button>
    </template>
  </AppDialog>
</template>

<style scoped>
.group-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--radius-xs);
    background: var(--bg-surface);
  }
}

.group-list__name {
  flex: 1;
  font-weight: 600;
  text-transform: capitalize;
}

.group-list__count {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.group-list__action {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &.is-danger:hover {
    color: var(--danger);
  }
}

.group-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: start;
  color: var(--accent-text);
  font-size: var(--text-md);
}

.group-form {
  display: grid;
  gap: 14px;

  > label {
    display: grid;
    gap: 6px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  input[type="text"] {
    padding: 8px 10px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);
  }

  small {
    color: var(--danger);
  }

  fieldset {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-block-end: 6px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
}

.group-form__camera {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-md);
  text-transform: capitalize;

  input {
    accent-color: var(--accent-strong);
  }
}

.group-button {
  block-size: 34px;
  padding-inline: 14px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--text-md);
  font-weight: 600;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }

  &.is-primary {
    border-color: transparent;
    background: var(--accent-strong);
    color: var(--text-on-media);
  }

  &:disabled {
    opacity: 0.5;
  }
}
</style>
