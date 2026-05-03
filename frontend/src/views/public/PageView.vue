<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import api, { BASE_URL } from '../../services/api'

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}

const route = useRoute()
const langStore = useLangStore()
const pageData = ref(null)
const isLoading = ref(true)
const notFound = ref(false)

const faqItems = ref([])

const fetchPage = async () => {
  const currentSlug = route.meta.pageSlug
  if (!currentSlug) return

  isLoading.value = true
  notFound.value = false
  try {
    const data = await api.getPageBySlug(currentSlug, langStore.currentLang)
    pageData.value = data
    
    // Parse FAQ if it's faq page
    if (currentSlug === 'faq' && data.content) {
      const parts = data.content.split('### ').filter(p => p.trim())
      faqItems.value = parts.map(p => {
        const lines = p.split('\n')
        return {
          question: lines[0].trim(),
          answer: lines.slice(1).join('\n').trim(),
          isOpen: false
        }
      })
    }
  } catch (err) {
    console.error('Error loading page:', err)
    notFound.value = true
  } finally {
    isLoading.value = false
  }
}

const toggleFaq = (index) => {
  faqItems.value[index].isOpen = !faqItems.value[index].isOpen
}

onMounted(fetchPage)
watch(() => langStore.currentLang, fetchPage)
watch(() => route.meta.pageSlug, fetchPage)
</script>

<template>
  <div v-if="isLoading" class="page-loading">
    <p>{{ langStore.currentLang === 'sr' ? 'Учитавам...' : 'Loading...' }}</p>
  </div>
  <div v-else-if="notFound" class="page-not-found">
    <div class="content-box">
      <div class="big-icon">🚧</div>
      <h1>{{ langStore.currentLang === 'sr' ? 'Страница је у припреми' : 'Page coming soon' }}</h1>
      <p>{{ langStore.currentLang === 'sr' ? 'Ова секција је тренутно у припреми. Ускоро ће бити доступна.' : 'This section is currently being prepared. It will be available soon.' }}</p>
    </div>
  </div>
  <PageTemplate
    v-else-if="pageData"
    :title="pageData.title"
    :textContent="route.meta.pageSlug === 'faq' ? '' : (pageData.content || '')"
    :slides="pageData.hero_image ? [{ image_url: getImageUrl(pageData.hero_image), title: pageData.title }] : []"
  >
    <!-- FAQ Accordion -->
    <div v-if="route.meta.pageSlug === 'faq'" class="faq-container">
      <div v-for="(item, index) in faqItems" :key="index" class="faq-item" :class="{ 'faq-open': item.isOpen }">
        <div class="faq-question" @click="toggleFaq(index)">
          <span>{{ item.question }}</span>
          <span class="faq-icon">{{ item.isOpen ? '−' : '+' }}</span>
        </div>
        <transition name="faq-slide">
          <div v-if="item.isOpen" class="faq-answer">
            <p>{{ item.answer }}</p>
          </div>
        </transition>
      </div>
    </div>
  </PageTemplate>
</template>

<style scoped>
.page-loading {
  display: flex; justify-content: center; align-items: center;
  min-height: 60vh; color: #888; font-size: 1.1rem;
}
.page-not-found {
  display: flex; justify-content: center; align-items: center;
  min-height: 60vh; text-align: center; padding: 40px 20px;
}
.content-box { max-width: 500px; }
.big-icon { font-size: 4rem; margin-bottom: 20px; }
.page-not-found h1 { color: #332317; margin-bottom: 10px; }
.page-not-found p { color: #888; line-height: 1.6; }

/* FAQ Styles */
.faq-container {
  max-width: 800px;
  margin: 0 auto 40px;
  padding: 0 20px;
}
.faq-item {
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  background: #fdfcfb;
  transition: all 0.3s ease;
}
.faq-open {
  background: #fff;
  box-shadow: 0 4px 15px rgba(51, 35, 23, 0.05);
  border-left: 4px solid var(--color-nav);
}
.faq-question {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: bold;
  color: var(--color-nav);
  user-select: none;
}
.faq-icon {
  font-size: 1.5rem;
  line-height: 1;
}
.faq-answer {
  padding: 0 20px 20px;
  color: #666;
  line-height: 1.6;
}

/* Transitions */
.faq-slide-enter-active, .faq-slide-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}
.faq-slide-enter-from, .faq-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
