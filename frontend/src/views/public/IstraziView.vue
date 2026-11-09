<script setup>
import { computed } from 'vue'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
import api from '../../services/api'
import { resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'
import { themeLocationSafe } from '../../utils/publicPaths'
import { useCmsPage, buildHeroSlide } from '../../composables/useCmsPage'

const exploreFallback = (store) => ({
  title: store.t('explore.title'),
  content: '',
  hero_image: null,
})

const { page, extra, isLoading, langStore } = useCmsPage('istrazi', {
  loadExtra: (lang) => api.getThemes(lang),
  fallbackPage: exploreFallback,
})

const themes = computed(() => extra.value || [])
const pageTitle = computed(() => page.value?.title || exploreFallback(langStore).title)
const slides = computed(() => buildHeroSlide(page.value, pageTitle.value))
</script>

<template>
  <PageLoading v-if="isLoading" />
  <PageTemplate
    v-else
    :title="pageTitle"
    :textContent="page?.content || ''"
    :slides="slides"
  >
    <div class="themes-grid">
      <div v-for="theme in themes" :key="theme.id" class="theme-card">
        <div class="theme-content">
          <div class="theme-icon-container">
            <img :src="resolveMediaUrlOrPlaceholder(theme.icon || '/themes/flora.png')" class="theme-card-icon" />
          </div>
          <h3>{{ theme.name }}</h3>
          <p>{{ langStore.currentLang === 'sr' ? theme.excerpt_sr : theme.excerpt_en }}</p>
          <div class="keywords">
            <span v-for="kw in theme.keywords" :key="kw" class="kw-tag">#{{ kw }}</span>
          </div>
          <router-link :to="themeLocationSafe(theme)" class="read-more">
            {{ langStore.t('explore.learnMore') }} &rarr;
          </router-link>
        </div>
      </div>
    </div>
  </PageTemplate>
</template>

<style scoped>
.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 30px;
  max-width: var(--content-max-width);
  margin: 0 auto 40px;
  padding: 0 20px;
}

.theme-card {
  background: #fff;
  border: 1px solid #eee;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
}

.theme-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
}

.theme-content {
  padding: 30px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.theme-icon-container {
  width: 70px;
  height: 70px;
  background: #fdf8f4;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.theme-card-icon {
  width: 45px;
  height: 45px;
  object-fit: contain;
}

.theme-content h3 {
  font-size: 1.4rem;
  color: #332317;
  margin-bottom: 15px;
}

.theme-content p {
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
  flex-grow: 1;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.kw-tag {
  font-size: 0.8rem;
  color: #9a714e;
  background: #fdf8f4;
  padding: 4px 10px;
  border-radius: 4px;
}

.read-more {
  display: inline-block;
  font-weight: bold;
  color: #332317;
  text-decoration: none;
  border-bottom: 2px solid #cdac91;
  align-self: flex-start;
  transition: border-color 0.3s;
}

.read-more:hover {
  border-color: #332317;
}

@media (max-width: 1023px) {
  .themes-grid {
    grid-template-columns: 1fr;
  }
}
</style>
