<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
import api from '../../services/api'
import { resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'
import { locationFromPath } from '../../utils/publicPaths'

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()
const langStore = useLangStore()
const theme = ref(null)
const isLoading = ref(true)

const fetchTheme = async () => {
  isLoading.value = true
  try {
    const key = props.slug
    const data = await api.getThemeDetail(key, langStore.currentLang)
    theme.value = data
    if (data?.slug && String(key) !== data.slug) {
      router.replace({ name: 'tema-detail', params: { slug: data.slug } })
    }
  } catch (err) {
    console.error('Error fetching theme detail:', err)
  } finally {
    isLoading.value = false
  }
}

const looksLikeHtml = (value) => /<[a-z][\s\S]*>/i.test(String(value || ''))

const formattedArticle = computed(() => {
  if (!theme.value) return ''
  const raw = langStore.currentLang === 'sr' ? theme.value.article_sr : theme.value.article_en
  if (!raw) return ''

  // TipTap / CMS HTML — render as-is. Legacy plain text keeps the old formatter.
  if (looksLikeHtml(raw)) return raw

  return raw
    .split(/\n\s*\n/)
    .map((para) => {
      if (para.includes('* ')) {
        const items = para.split(/\n\* /).filter((i) => i.trim())
        const listItems = items.map((item) => `<li>${item.replace('* ', '').trim()}</li>`).join('')
        return `<ul>${listItems}</ul>`
      }
      return `<p>${para.trim().replace(/\n/g, '<br>')}</p>`
    })
    .join('')
})

onMounted(fetchTheme)
watch(() => props.slug, fetchTheme)
watch(() => langStore.currentLang, fetchTheme)
</script>

<template>
  <PageLoading v-if="isLoading" />

  <PageTemplate
    v-else-if="theme"
    :title="theme.name"
    :slides="[{ image_url: resolveMediaUrlOrPlaceholder(theme.hero_image || '/explore-hero.png'), title: theme.name }]"
  >
    <div class="theme-article" v-html="formattedArticle"></div>
    
    <!-- Dodatne sekcije specifične za teme -->
    <div class="theme-footer">
      <div class="container">
        <div class="meta-box">
          <div class="keywords">
            <strong>{{ langStore.t('explore.keywords') }}</strong>
            <span v-for="kw in theme.keywords" :key="kw" class="tag">#{{ kw }}</span>
          </div>
        </div>

        <div v-if="theme.ctas && theme.ctas.length > 0" class="ctas-box">
          <router-link 
            v-for="cta in theme.ctas" 
            :key="cta.route" 
            :to="locationFromPath(cta.route)" 
            class="cta-button"
          >
            {{ langStore.currentLang === 'sr' ? cta.label.sr : cta.label.en }}
          </router-link>
        </div>

        <div class="back-link">
          <router-link :to="{ name: 'istrazi' }">&larr; {{ langStore.t('explore.backToExplore') }}</router-link>
        </div>
      </div>
    </div>
  </PageTemplate>
</template>

<style scoped>
.theme-article {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  line-height: 1.8;
  font-size: 1.1rem;
  color: #444;
}

.theme-article :deep(p) {
  margin-bottom: 25px;
}

.theme-article :deep(ul) {
  margin-bottom: 25px;
  padding-left: 20px;
}

.theme-article :deep(li) {
  margin-bottom: 10px;
}

.theme-article :deep(strong), .theme-article :deep(b) {
  color: #332317;
}

.theme-footer {
  margin-top: 40px;
  padding: 40px 0;
  border-top: 1px solid #eee;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.meta-box {
  margin-bottom: 30px;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.tag {
  background: #f5f0eb;
  color: #332317;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
}

.ctas-box {
  display: flex;
  gap: 15px;
  margin-bottom: 40px;
}

.cta-button {
  background: #332317;
  color: #fff;
  padding: 12px 25px;
  text-decoration: none;
  font-weight: bold;
  transition: background 0.3s;
}

.cta-button:hover {
  background: #cdac91;
}

.back-link {
  margin-top: 20px;
}

.back-link a {
  color: #888;
  text-decoration: none;
}

.back-link a:hover {
  color: #332317;
}
</style>
