<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import api, { BASE_URL } from '../../services/api'
import { useLangStore } from '../../stores/lang'

const router = useRouter()
const langStore = useLangStore()
const themes = ref([])
const isLoading = ref(true)

const fetchThemes = async () => {
  try {
    const allThemes = await api.getThemes()
    themes.value = allThemes.slice(0, 3) 
  } catch (err) {
    console.error('Error fetching discovery block:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchThemes)
watch(() => langStore.currentLang, fetchThemes)
</script>

<template>
  <!-- IDENTIČAN HTML KAO U STAROM HOMEVIEW -->
  <div class="themes-highlight" v-if="themes.length > 0">
    <hr class="section-divider" />
    <h2 class="old-title">
      {{ langStore.currentLang === 'sr' ? 'Откријте Гоч' : 'Discover Goč' }}
    </h2>
    <div class="themes-mini-grid">
      <div v-for="theme in themes" :key="theme.id" class="theme-mini-card">
        <div class="mini-icon-container">
           <img :src="theme.icon || '/themes/flora.png'" class="mini-card-icon" />
        </div>
        <h3>{{ theme.name }}</h3>
        <p>{{ langStore.currentLang === 'sr' ? theme.excerpt_sr : theme.excerpt_en }}</p>
        <router-link :to="`/istrazi/${theme.id}`" class="mini-link">
          {{ langStore.currentLang === 'sr' ? 'Опширније' : 'Read more' }} &rarr;
        </router-link>
      </div>
    </div>
    <div style="text-align: center; margin-top: 30px;">
      <router-link to="/istrazi" class="view-all-btn">
        {{ langStore.currentLang === 'sr' ? 'Погледај све теме' : 'View all themes' }}
      </router-link>
    </div>
  </div>
</template>

<style scoped>
/* VRAĆAMO ORIGINALNE STILOVE IZ HOMEVIEW.VUE */
.themes-mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}
.theme-mini-card {
  padding: 20px;
  border: 1px solid var(--color-border);
  background: #fdf8f4;
  text-align: left;
}
.mini-icon-container {
  width: 50px; height: 50px; background: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; margin-bottom: 15px;
  border: 1px solid var(--c-braon-2);
}
.mini-card-icon { width: 32px; height: 32px; object-fit: contain; }
.theme-mini-card h3 { margin-bottom: 10px; color: var(--color-nav); font-family: "FOF24", sans-serif; }
.theme-mini-card p { font-size: 0.9rem; color: #666; margin-bottom: 15px; line-height: 1.4; }
.mini-link { font-weight: bold; color: var(--color-nav); text-decoration: none; border-bottom: 1px solid var(--color-nav); font-size: 0.85rem; }

.old-title { margin: 30px 0 20px; border-left: 4px solid var(--color-nav); padding-left: 10px; color: var(--color-nav); }

.view-all-btn {
  display: inline-block; padding: 10px 30px; background: var(--color-nav);
  color: #fff; text-decoration: none; font-weight: bold;
}
.view-all-btn:hover { background: #332317; }
.section-divider { border: 0; border-top: 1px solid var(--color-border); margin: 40px 0; }
</style>
