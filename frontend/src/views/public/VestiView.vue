<script setup>
import { computed } from 'vue'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import api from '../../services/api'
import { useCmsPage, buildHeroSlide } from '../../composables/useCmsPage'

const { page, extra, isLoading, langStore } = useCmsPage('vesti', {
  loadExtra: (lang) => api.getNews(lang),
  fallbackPage: (store) => ({ title: store.t('nav.news'), content: '', hero_image: null }),
})

const news = computed(() => extra.value || [])
const slides = computed(() => buildHeroSlide(page.value, langStore.t('nav.news')))
</script>

<template>
  <div v-if="isLoading" class="page-loading">
    <p>{{ langStore.currentLang === 'sr' ? 'Учитавање...' : 'Loading...' }}</p>
  </div>
  <PageTemplate
    v-else
    :title="page?.title"
    :textContent="page?.content || ''"
    :news="news"
    :slides="slides"
    :gridType="4"
  />
</template>

<style scoped>
.page-loading {
  text-align: center;
  padding: 100px 20px;
  color: #888;
  font-size: 1.2rem;
  min-height: 60vh;
}
</style>
