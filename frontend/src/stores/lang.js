import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLangStore = defineStore('lang', () => {
  const currentLang = ref(localStorage.getItem('baza_goc_lang') || 'sr')

  const setLang = (lang) => {
    currentLang.value = lang
    localStorage.setItem('baza_goc_lang', lang)
  }

  return { currentLang, setLang }
})
