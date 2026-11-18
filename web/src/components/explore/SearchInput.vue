<script setup lang="ts">
/** Semantic search box that also accepts typed `key:value` filters. */
import { computed, shallowRef, useId, watch } from "vue";
import { CircleHelp, Search, Star, Trash2, X } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppDialog from "@/components/ui/AppDialog.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useSavedSearches } from "@/composables/useSavedSearches";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { ExploreFilter } from "@/types/event";
import { hasExploreFilter, isSimilaritySearch } from "@/utils/explore";
import {
  applyTag,
  currentWord,
  isTagKey,
  splitTag,
  tagSuggestions,
  withoutLastWord,
  type TagContext,
  type TagKey,
} from "@/utils/exploreTags";

const props = defineProps<{ filter: ExploreFilter; context: TagContext }>();
const emit = defineEmits<{ "update:filter": [filter: ExploreFilter] }>();

const { t } = useT(["views/search", "views/explore", "common"]);
const { searches, save, remove } = useSavedSearches();
const listId = useId();

const input = shallowRef<HTMLInputElement | null>(null);
const text = shallowRef(props.filter.query ?? "");
const open = shallowRef(false);
const active = shallowRef(-1);

watch(
  () => props.filter.query,
  (query) => (text.value = query ?? ""),
);

const savedNames = computed(() => searches.value.map((item) => item.name));
const list = computed(() =>
  tagSuggestions(text.value, props.filter, props.context, savedNames.value),
);
const similarity = computed(() => isSimilaritySearch(props.filter));
const canClear = computed(() => !!text.value || hasExploreFilter(props.filter));
const canSave = computed(
  () => !similarity.value && (!!text.value.trim() || canClear.value),
);

watch(list, () => (active.value = -1));

function optionId(index: number) {
  return `${listId}-${index}`;
}

function setFilter(filter: ExploreFilter) {
  emit("update:filter", filter);
}

/** Apply a typed or chosen filter value. True when the word was consumed. */
function commitTag(key: TagKey, value: string) {
  const result = applyTag(props.filter, key, value, props.context);
  if (!result) return false;
  if ("error" in result) {
    showToast(t(`filter.toast.error.${result.error}`), "error");
    return true;
  }
  text.value = withoutLastWord(text.value);
  setFilter(result.filter);
  return true;
}

function onInput() {
  open.value = true;
  const { word, ended } = currentWord(text.value);
  const tag = splitTag(word);
  if (ended && tag && isTagKey(tag.key, props.context))
    commitTag(tag.key, tag.value);
}

function loadSaved(name: string) {
  const saved = searches.value.find((item) => item.name === name);
  if (!saved) return;
  const query = saved.search || saved.filter?.query;
  text.value = query ?? "";
  setFilter({ ...saved.filter, query: query || undefined });
  open.value = false;
}

function choose(item: string) {
  const { key } = list.value;
  if (key) {
    commitTag(key, item);
  } else if (savedNames.value.includes(item)) {
    loadSaved(item);
    return;
  } else {
    const { ended } = currentWord(text.value);
    const base = ended ? text.value.trim() : withoutLastWord(text.value);
    text.value = `${base ? `${base} ` : ""}${item}:`;
  }
  input.value?.focus();
}

function submit() {
  const { word } = currentWord(text.value);
  const tag = splitTag(word);
  if (
    tag &&
    isTagKey(tag.key, props.context) &&
    commitTag(tag.key, tag.value)
  ) {
    return;
  }
  const query = text.value.trim();
  const next: ExploreFilter = { ...props.filter, query: query || undefined };
  // typing a query leaves a similarity search
  if (query && similarity.value) {
    next.search_type = undefined;
    next.event_id = undefined;
  }
  setFilter(next);
  open.value = false;
  input.value?.blur();
}

function clear() {
  text.value = "";
  open.value = false;
  setFilter({});
}

function onKeydown(event: KeyboardEvent) {
  const count = list.value.items.length;
  switch (event.key) {
    case "ArrowDown":
    case "ArrowUp":
      if (!count) return;
      event.preventDefault();
      open.value = true;
      active.value =
        event.key === "ArrowDown"
          ? (active.value + 1) % count
          : (active.value - 1 + count) % count;
      break;
    case "Enter": {
      event.preventDefault();
      const item = open.value ? list.value.items[active.value] : undefined;
      if (item) choose(item);
      else submit();
      break;
    }
    case "Escape":
      if (open.value) {
        event.stopPropagation();
        open.value = false;
      }
      break;
  }
}

function onFocusOut(event: FocusEvent) {
  const root = event.currentTarget as HTMLElement;
  if (!root.contains(event.relatedTarget as Node | null)) open.value = false;
}

// saving and removing searches

const saveOpen = shallowRef(false);
const saveName = shallowRef("");
const removing = shallowRef<string>();
const removeOpen = computed({
  get: () => removing.value !== undefined,
  set: (value) => {
    if (!value) removing.value = undefined;
  },
});
const overwrites = computed(() =>
  savedNames.value.includes(saveName.value.trim()),
);

function startSave() {
  saveName.value = "";
  saveOpen.value = true;
}

function confirmSave() {
  const name = saveName.value.trim();
  if (!name) return;
  void save(name, text.value.trim(), {
    ...props.filter,
    query: text.value.trim() || undefined,
  });
  saveOpen.value = false;
}

function confirmRemove() {
  if (removing.value !== undefined) void remove(removing.value);
  removing.value = undefined;
}
</script>

<template>
  <div class="search-input" @focusout="onFocusOut">
    <div class="search-input__box">
      <Search :size="15" aria-hidden="true" />
      <input
        ref="input"
        v-model="text"
        type="text"
        role="combobox"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :aria-label="t('search')"
        :aria-expanded="open && list.items.length > 0"
        :aria-controls="listId"
        :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
        :placeholder="t('placeholder.search')"
        @focus="open = true"
        @input="onInput"
        @keydown="onKeydown"
      />
      <button
        v-if="canSave"
        type="button"
        class="search-input__icon"
        :aria-label="t('button.save')"
        :title="t('button.save')"
        @click="startSave"
      >
        <Star :size="14" />
      </button>
      <PopoverMenu align="end" width="320px">
        <template #trigger="{ popovertarget }">
          <button
            type="button"
            class="search-input__icon"
            :aria-label="t('button.filterInformation')"
            :title="t('button.filterInformation')"
            :popovertarget="popovertarget"
          >
            <CircleHelp :size="14" />
          </button>
        </template>
        <div class="search-input__help">
          <h3>{{ t("filter.tips.title") }}</h3>
          <p>{{ t("filter.tips.desc.text") }}</p>
          <ol>
            <li>{{ t("filter.tips.desc.step1") }}</li>
            <li>{{ t("filter.tips.desc.step2") }}</li>
            <li>{{ t("filter.tips.desc.step3") }}</li>
            <li>
              {{
                t("filter.tips.desc.step4", {
                  DateFormat: context.suggestions.before?.[0],
                })
              }}
            </li>
            <li>
              {{
                t("filter.tips.desc.step5", {
                  exampleTime: context.suggestions.time_range?.[0],
                })
              }}
            </li>
          </ol>
          <p>
            {{ t("filter.tips.desc.exampleLabel") }}
            <code
              >cameras:{{
                context.suggestions.cameras?.[0]
              }}
              labels:person</code
            >
          </p>
        </div>
      </PopoverMenu>
      <button
        v-if="canClear"
        type="button"
        class="search-input__icon"
        :aria-label="t('button.clear')"
        :title="t('button.clear')"
        @click="clear"
      >
        <X :size="14" />
      </button>
    </div>

    <div
      v-show="open && list.items.length"
      :id="listId"
      class="search-input__panel"
      role="listbox"
      :aria-label="t('search')"
      @mousedown.prevent
    >
      <p class="search-input__heading">
        {{
          list.key
            ? t("filter.header.currentFilterType")
            : t("filter.header.noFilters")
        }}
      </p>
      <div
        v-for="(item, index) in list.items"
        :id="optionId(index)"
        :key="item"
        class="search-input__option"
        :class="{ 'is-active': index === active }"
        role="option"
        :aria-selected="index === active"
        @click="choose(item)"
      >
        <Star
          v-if="!list.key && savedNames.includes(item)"
          :size="13"
          aria-hidden="true"
        />
        <span>{{
          list.key
            ? item.replaceAll("_", " ")
            : savedNames.includes(item)
              ? item
              : t(`filter.label.${item}`, { defaultValue: item })
        }}</span>
        <code v-if="!list.key && !savedNames.includes(item)">{{ item }}:</code>
        <button
          v-if="!list.key && savedNames.includes(item)"
          type="button"
          class="search-input__icon"
          :aria-label="t('button.delete')"
          :title="t('button.delete')"
          @click.stop="removing = item"
        >
          <Trash2 :size="13" />
        </button>
      </div>
    </div>

    <AppDialog v-model:open="saveOpen" :title="t('button.save')">
      <form id="explore-save-search" @submit.prevent="confirmSave">
        <input
          v-model="saveName"
          class="search-input__field"
          type="text"
          required
          :aria-label="t('views/explore:ui.savedSearchName')"
          :placeholder="t('views/explore:ui.savedSearchName')"
        />
      </form>
      <p v-if="overwrites" class="search-input__note">
        {{ t("views/explore:ui.savedSearchOverwrite") }}
      </p>
      <template #actions>
        <AppButton @click="saveOpen = false">
          {{ t("common:button.cancel") }}
        </AppButton>
        <AppButton
          type="submit"
          form="explore-save-search"
          variant="primary"
          :disabled="!saveName.trim()"
        >
          {{ t("common:button.save") }}
        </AppButton>
      </template>
    </AppDialog>

    <AppDialog v-model:open="removeOpen" :title="t('button.delete')">
      <p class="search-input__note">
        {{ t("views/explore:ui.savedSearchDelete", { name: removing }) }}
      </p>
      <template #actions>
        <AppButton @click="removeOpen = false">
          {{ t("common:button.cancel") }}
        </AppButton>
        <AppButton variant="danger" @click="confirmRemove">
          {{ t("common:button.delete") }}
        </AppButton>
      </template>
    </AppDialog>
  </div>
</template>

<style scoped>
.search-input {
  position: relative;
  flex: 1 1 280px;
  min-inline-size: 0;
  max-inline-size: 460px;
}

.search-input__box {
  display: flex;
  align-items: center;
  gap: 6px;
  block-size: 34px;
  padding-inline: 10px 4px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-tertiary);

  &:focus-within {
    border-color: var(--selected-border);
  }

  input {
    flex: 1;
    min-inline-size: 0;
    border: none;
    outline: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    font-size: var(--text-md);

    &::placeholder {
      color: var(--text-tertiary);
    }
  }
}

.search-input__icon {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 26px;
  block-size: 26px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.search-input__panel {
  position: absolute;
  z-index: 20;
  inset-block-start: calc(100% + 6px);
  inset-inline: 0;
  max-block-size: min(60dvh, 380px);
  padding: 6px;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
}

.search-input__heading {
  margin: 0;
  padding: 4px 8px;
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}

.search-input__option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-block-size: 32px;
  padding-inline: 8px 4px;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-size: var(--text-md);
  cursor: pointer;

  &:hover,
  &.is-active {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  span {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  code {
    padding-inline-end: 4px;
    color: var(--text-tertiary);
    font-size: var(--text-xs);
  }
}

.search-input__help {
  display: grid;
  gap: 8px;
  padding: 6px;
  color: var(--text-secondary);
  font-size: var(--text-sm);

  h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-md);
  }

  p,
  ol {
    margin: 0;
  }

  ol {
    display: grid;
    gap: 4px;
    padding-inline-start: 18px;
  }

  code {
    color: var(--accent-text);
    overflow-wrap: anywhere;
  }
}

.search-input__field {
  inline-size: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-primary);
  font: inherit;
  font-size: var(--text-md);
}

.search-input__note {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-md);
}

@media (max-width: 768px) {
  .search-input {
    flex-basis: 100%;
    max-inline-size: none;
  }
}
</style>
