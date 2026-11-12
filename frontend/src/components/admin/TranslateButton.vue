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

