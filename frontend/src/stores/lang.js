import { defineStore } from 'pinia'
import { ref } from 'vue'
import rawMessages from '../locales'

/** Support both ESM default and accidental `{ default: catalog }` interop. */
const catalog = rawMessages?.sr ? rawMessages : rawMessages?.default

function normalizeLang(lang) {
  return lang === 'en' ? 'en' : 'sr'
}

function lookup(lang, key) {
  if (!key || !catalog) return key
  const parts = String(key).split('.')
  let value = catalog[normalizeLang(lang)]
  for (const part of parts) {
    value = value?.[part]
  }
  return typeof value === 'string' ? value : key
}

export const useLangStore = defineStore('lang', () => {
  const currentLang = ref(normalizeLang(localStorage.getItem('baza_goc_lang') || 'sr'))

  const setLang = (lang) => {
    currentLang.value = normalizeLang(lang)
    localStorage.setItem('baza_goc_lang', currentLang.value)
  }

  const t = (key) => lookup(currentLang.value, key)
  const tFor = (lang, key) => lookup(lang, key)

  return { currentLang, setLang, t, tFor }
})
