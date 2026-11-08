<script setup>
import { computed } from 'vue'
import { useLangStore } from '../../stores/lang'

const props = defineProps({
  message: { type: String, default: '' },
})

const langStore = useLangStore()
const label = computed(() => (
  props.message
  || (langStore.currentLang === 'sr' ? 'Учитавам...' : 'Loading...')
))
</script>

<template>
  <div class="page-loading">
    <p>{{ label }}</p>
  </div>
</template>

<style scoped>
.page-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 100px 20px;
  color: #888;
  font-size: 1.1rem;
  min-height: 60vh;
}
</style>
