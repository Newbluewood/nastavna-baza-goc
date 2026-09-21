<script setup>
import { ref } from 'vue'
import api from '../../services/api'

const props = defineProps({
  source: { type: String, default: '' },
  current: { type: String, default: '' },
  html: { type: Boolean, default: false }
})

const emit = defineEmits(['translated'])
const busy = ref(false)

const run = async () => {
  const text = String(props.source || '').trim()
  if (!text || busy.value) return
  if (String(props.current || '').trim()) {
    if (!confirm('Zameniti postojeći engleski tekst prevodom?')) return
  }
  busy.value = true
  try {
    const data = await api.translateText(text, 'EN', { html: props.html })
    emit('translated', data.translated_text || '')
  } catch (err) {
    alert(err?.data?.error || 'Prevod nije uspeo.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="translate-mini"
    :disabled="busy || !String(source || '').trim()"
    :title="busy ? 'Prevođenje…' : 'Prevedi na engleski (DeepL)'"
    @click.stop="run"
  >
    {{ busy ? '…' : 'SR → EN' }}
  </button>
</template>

<style scoped>
.translate-mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #cdac91;
  background: #fff;
  color: #67462e;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
}
.translate-mini:hover:not(:disabled) {
  background: #f5f0ea;
}
.translate-mini:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
