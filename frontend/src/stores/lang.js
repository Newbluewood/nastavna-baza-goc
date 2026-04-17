import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import messages from '../locales'

export const useLangStore = defineStore('lang', () => {
  const currentLang = ref(localStorage.getItem('baza_goc_lang') || 'sr')

  const setLang = (lang) => {
    currentLang.value = lang
    localStorage.setItem('baza_goc_lang', lang)
  }

  const t = (key) => {
    const keys = key.split('.')
    let value = messages[currentLang.value]
    for (const k of keys) {
      value = value?.[k]
    }
    return value || key
  }

  return { currentLang, setLang, t }
})
