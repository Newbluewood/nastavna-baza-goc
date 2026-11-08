import { ref, watch, onMounted, unref } from 'vue'
import { useLangStore } from '../stores/lang'
import api from '../services/api'
import { resolveMediaUrlOrPlaceholder } from '../utils/mediaUrl'

/** One hero slide from a CMS page row. */
export function buildHeroSlide(page, titleFallback = '') {
  const title = page?.title || titleFallback
  return [{
    image_url: resolveMediaUrlOrPlaceholder(page?.hero_image),
    title,
  }]
}

/**
 * Load CMS page by slug (+ optional parallel domain fetch).
 * Keep views thin: title/hero/content from `page`, list data from `extra`.
 */
export function useCmsPage(slugSource, {
  loadExtra = null,
  fallbackPage = null,
  required = false,
} = {}) {
  const langStore = useLangStore()
  const page = ref(null)
  const extra = ref(null)
  const isLoading = ref(true)
  const notFound = ref(false)

  const resolveSlug = () => String(unref(
    typeof slugSource === 'function' ? slugSource() : slugSource
  ) || '').trim()

  async function reload() {
    const slug = resolveSlug()
    const lang = langStore.currentLang
    isLoading.value = true
    notFound.value = false

    try {
      const pagePromise = slug
        ? api.getPageBySlug(slug, lang).catch((err) => {
          console.error(`CMS page "${slug}" failed:`, err)
          if (typeof fallbackPage === 'function') return fallbackPage(langStore)
          if (fallbackPage) return fallbackPage
          if (required) notFound.value = true
          return null
        })
        : Promise.resolve(null).then((value) => {
          if (required) notFound.value = true
          return value
        })

      const extraPromise = loadExtra
        ? loadExtra(lang).catch((err) => {
          console.error(`Extra data for "${slug || 'page'}" failed:`, err)
          return null
        })
        : Promise.resolve(null)

      const [pageData, extraData] = await Promise.all([pagePromise, extraPromise])
      page.value = pageData
      extra.value = extraData
    } finally {
      isLoading.value = false
    }
  }

  onMounted(reload)
  watch(() => langStore.currentLang, reload)
  watch(() => resolveSlug(), reload)

  return {
    page,
    extra,
    isLoading,
    notFound,
    reload,
    langStore,
    heroSlide: (titleFallback = '') => buildHeroSlide(page.value, titleFallback),
  }
}
