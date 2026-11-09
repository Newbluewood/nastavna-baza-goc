<script setup>
import { onBeforeUnmount, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
  ],
  editorProps: {
    attributes: {
      class: 'rich-editor-surface',
      'data-placeholder': props.placeholder,
    },
  },
  onUpdate: ({ editor: ed }) => {
    const html = ed.isEmpty ? '' : ed.getHTML()
    emit('update:modelValue', html)
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return
    const current = editor.value.isEmpty ? '' : editor.value.getHTML()
    const next = value || ''
    if (current === next) return
    editor.value.commands.setContent(next, { emitUpdate: false })
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const setLink = () => {
  if (!editor.value) return
  const previous = editor.value.getAttributes('link').href || ''
  const url = window.prompt('URL', previous)
  if (url === null) return
  if (!url.trim()) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}
</script>

<template>
  <div v-if="editor" class="rich-editor">
    <div class="rich-toolbar" role="toolbar">
      <button type="button" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button type="button" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>
      <button type="button" :class="{ active: editor.isActive('paragraph') }" @click="editor.chain().focus().setParagraph().run()">P</button>
      <button type="button" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()"><strong>B</strong></button>
      <button type="button" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()"><em>I</em></button>
      <button type="button" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">• List</button>
      <button type="button" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">1. List</button>
      <button type="button" :class="{ active: editor.isActive('link') }" @click="setLink">Link</button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.rich-editor {
  border: 1px solid #e8ddd2;
  background: #fff;
}
.rich-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #e8ddd2;
  background: #fdfaf7;
}
.rich-toolbar button {
  border: 1px solid #cdac91;
  background: #fff;
  color: #332317;
  padding: 4px 8px;
  font-size: 0.78rem;
  cursor: pointer;
  min-width: 32px;
}
.rich-toolbar button.active {
  background: #332317;
  color: #cdac91;
  border-color: #332317;
}
.rich-editor :deep(.tiptap),
.rich-editor :deep(.rich-editor-surface) {
  min-height: 180px;
  padding: 12px 14px;
  outline: none;
  font-size: 0.92rem;
  line-height: 1.6;
  color: #333;
}
.rich-editor :deep(.tiptap p) { margin: 0 0 0.75em; }
.rich-editor :deep(.tiptap h2),
.rich-editor :deep(.tiptap h3) { margin: 0.6em 0 0.4em; color: #332317; }
.rich-editor :deep(.tiptap ul),
.rich-editor :deep(.tiptap ol) { padding-left: 1.4em; margin: 0 0 0.75em; }
.rich-editor :deep(.tiptap a) { color: #9a714e; }
</style>
