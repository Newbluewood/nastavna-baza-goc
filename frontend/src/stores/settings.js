import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useSettingsStore = defineStore('settings', () => {
  const values = ref({})
  const isLoaded = ref(false)

  const fetch = async (lang = 'sr') => {
    try {
      values.value = await api.getSiteSettings(lang)
      isLoaded.value = true
    } catch (err) {
      console.error('Error loading site settings:', err)
    }
  }

  const get = (key) => values.value[key] || ''

  return { values, isLoaded, fetch, get }
})
