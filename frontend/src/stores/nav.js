import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useNavStore = defineStore('nav', () => {
  const items = ref([])
  const isLoaded = ref(false)

  const fetch = async (lang = 'sr') => {
    try {
      const rows = await api.getNav(lang)
      items.value = Array.isArray(rows) ? rows : []
      isLoaded.value = true
    } catch (err) {
      console.error('Error loading nav:', err)
      items.value = []
    }
  }

  return { items, isLoaded, fetch }
})
