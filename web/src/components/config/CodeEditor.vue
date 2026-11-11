<script setup lang="ts">
/**
 * YAML editor on CodeMirror 6 with JSON schema validation, hover and
 * completion. Colors come from the code tokens, so the editor follows the
 * design system without its own palette. Only the config editor route loads
 * this, so CodeMirror stays out of the main bundle.
 */
import { onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import {
  indentUnit,
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { yamlSchema } from "codemirror-json-schema/yaml";
import type { JSONSchema7 } from "json-schema";

const props = defineProps<{
  /** read once at mount; remount the editor to change it */
  schema?: JSONSchema7;
  label: string;
}>();
const model = defineModel<string>({ required: true });
const emit = defineEmits<{ save: [] }>();

const host = shallowRef<HTMLDivElement | null>(null);
let view: EditorView | undefined;

const theme = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "var(--text-primary)",
      backgroundColor: "var(--code-bg)",
      fontSize: "var(--text-md)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.6",
    },
    ".cm-content": { caretColor: "var(--code-cursor)" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--code-cursor)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
      { backgroundColor: "var(--code-selection)" },
    ".cm-activeLine": { backgroundColor: "var(--code-line-active)" },
    ".cm-gutters": {
      backgroundColor: "var(--code-gutter)",
      color: "var(--text-tertiary)",
      borderRight: "1px solid var(--glass-border)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--code-line-active)",
      color: "var(--text-secondary)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--bg-surface)",
      border: "none",
      color: "var(--text-secondary)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--bg-elevated)",
      border: "1px solid var(--glass-border)",
      borderRadius: "var(--radius-xs)",
      boxShadow: "var(--shadow-popover)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--text-sm)",
      maxWidth: "min(480px, 90vw)",
    },
    ".cm-tooltip-hover, .cm-tooltip-lint": { padding: "6px 10px" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--selected-surface)",
      color: "var(--text-primary)",
    },
    ".cm-panels": {
      backgroundColor: "var(--bg-elevated)",
      color: "var(--text-primary)",
    },
    ".cm-searchMatch": { backgroundColor: "var(--warning-surface)" },
    ".cm-diagnostic-error": { borderLeftColor: "var(--danger)" },
    ".cm-diagnostic-warning": { borderLeftColor: "var(--warning)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    color: "var(--code-key)",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--code-string)",
  },
  { tag: [tags.number, tags.integer, tags.float], color: "var(--code-number)" },
  {
    tag: [tags.bool, tags.null, tags.atom, tags.keyword],
    color: "var(--code-atom)",
  },
  {
    tag: [tags.comment, tags.lineComment],
    color: "var(--code-comment)",
    fontStyle: "italic",
  },
  {
    tag: [tags.punctuation, tags.separator, tags.operator],
    color: "var(--code-punctuation)",
  },
  { tag: [tags.labelName, tags.meta], color: "var(--code-atom)" },
]);

onMounted(() => {
  if (!host.value) return;
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        basicSetup,
        indentUnit.of("  "),
        EditorState.tabSize.of(2),
        theme,
        syntaxHighlighting(highlight),
        yamlSchema(props.schema),
        Prec.highest(
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                emit("save");
                return true;
              },
            },
          ]),
        ),
        EditorView.contentAttributes.of({ "aria-label": props.label }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) model.value = update.state.doc.toString();
        }),
      ],
    }),
  });
});

// outside changes, eg the config reloading after a save elsewhere
watch(model, (value) => {
  if (!view || value === view.state.doc.toString()) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
  });
});

onBeforeUnmount(() => {
  view?.destroy();
  view = undefined;
});

defineExpose({ focus: () => view?.focus() });
</script>

<template>
  <div ref="host" class="code-editor" />
</template>

<style scoped>
.code-editor {
  block-size: 100%;
  min-block-size: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}

.code-editor :deep(.cm-editor.cm-focused) {
  outline: none;
}

.code-editor:has(.cm-focused) {
  border-color: var(--selected-border);
}
</style>
