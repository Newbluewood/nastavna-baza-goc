<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNavStore } from '../../stores/nav'
import { locationFromPath } from '../../utils/publicPaths'

const emit = defineEmits(['navigate'])

const route = useRoute()
const navStore = useNavStore()
const isMenuOpen = ref(false)

const navItems = computed(() =>
  navStore.items.map((item) => ({
    key: item.id,
    to: locationFromPath(item.path),
    label: item.label,
    exact: item.path === '/',
  }))
)

watch(
  () => route.fullPath,
  () => {
    isMenuOpen.value = false
  }
)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const onNavigate = () => {
  isMenuOpen.value = false
  emit('navigate')
}
</script>

<template>
  <div class="header-nav">
    <button type="button" class="burger-toggle" :aria-expanded="isMenuOpen" @click="toggleMenu">
      <span></span>
      <span></span>
      <span></span>
    </button>
    <nav class="main-nav" :class="{ 'is-open': isMenuOpen }">
      <template v-for="(item, index) in navItems" :key="item.key">
        <span v-if="index > 0" class="nav-sep">|</span>
        <router-link
          :to="item.to"
          class="nav-link"
          :class="{ 'is-home-link': item.exact }"
          @click="onNavigate"
        >
          <span class="nav-bold">{{ item.label }}</span>
        </router-link>
      </template>
    </nav>
  </div>
</template>

<style scoped>
/*
  Vue School active-class pattern:
  - exact-active = true match
  - active = prefix match (e.g. /smestaj on /smestaj/hotel-piramida)
  Home must NOT use prefix-active (everything starts with /).
*/
.nav-link.router-link-exact-active,
.nav-link.router-link-active:not(.is-home-link),
.nav-link:hover {
  border: 1px solid var(--color-border, #cdac91);
}
</style>
