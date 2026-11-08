<script setup>
import { computed } from 'vue'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
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
  <PageLoading v-if="isLoading" />
  <PageTemplate
    v-else
    :title="page?.title"
    :textContent="page?.content || ''"
    :news="news"
    :slides="slides"
    :gridType="4"
  />
</template>
