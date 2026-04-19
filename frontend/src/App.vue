<script setup>
import { ref, computed } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useLangStore } from './stores/lang'
import { useGuestStore } from './stores/guest'
import StayAssistantPanel from './components/StayAssistantPanel.vue'

const isMenuOpen = ref(false)
const langStore = useLangStore()
const guestStore = useGuestStore()
const route = useRoute()
const router = useRouter()

const isAdminRoute = computed(() => {
  return route.path.startsWith('/admin')
})

const toggleMenu = () => { isMenuOpen.value = !isMenuOpen.value }
const closeMenu = () => { isMenuOpen.value = false }

const handleGuestNav = () => {
  closeMenu()
  if (guestStore.isLoggedIn) router.push('/moj-nalog')
  else router.push('/prijava')
}
</script>

<template>
  <div class="app-container" v-if="!isAdminRoute">
    <header class="header">
      <div class="header-top">
        <div class="logo">
          <router-link to="/">
            <img src="/logo.svg" alt="Univerzitet u Beogradu - Šumarski fakultet" class="site-logo" />
          </router-link>
        </div>
        <div class="header-right">
          <div class="language-switch">
            <a href="#" :class="{ active: langStore.currentLang === 'en' }" @click.prevent="langStore.setLang('en')">ENG</a> | 
            <a href="#" :class="{ active: langStore.currentLang === 'sr' }" @click.prevent="langStore.setLang('sr')">СРП</a>
          </div>
          <button class="guest-btn" @click="handleGuestNav" :title="guestStore.isLoggedIn ? guestStore.guest?.name : 'Prijava'">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <span class="guest-label">{{ guestStore.isLoggedIn ? (guestStore.guest?.name?.split(' ')[0] || 'Nalog') : langStore.t('common.login') }}</span>
          </button>
        </div>
      </div>
      <div class="header-nav">
        <div class="burger-toggle" @click="toggleMenu">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <nav class="main-nav" :class="{ 'is-open': isMenuOpen }">
          <router-link to="/" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.home') }}</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/smestaj" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.accommodation') }}</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/vesti" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.news') }}</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/edukacija" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.education') }}</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/istrazivanje" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.research') }}</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/kontakt" class="nav-link" @click="closeMenu">
            <span class="nav-bold">{{ langStore.t('nav.contact') }}</span>
          </router-link>
        </nav>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>

    <footer class="footer">
      <div class="footer-col">
        <p><strong>{{ langStore.t('footer.faculty') }}</strong><br>
        {{ langStore.t('footer.university') }}<br>
        {{ langStore.t('footer.address') }}<br>
        {{ langStore.t('footer.city') }}</p>
      </div>
      <div class="footer-col">
        <p>{{ langStore.t('footer.phone') }}: <a href="tel:+38136123456">{{ langStore.t('footer.contact_phone') }}</a><br>
        {{ langStore.t('footer.email') }}: <a href="mailto:info@gvozdac.rs">{{ langStore.t('footer.contact_email') }}</a></p>
      </div>
      <div class="footer-col footer-credits">
        <p v-html="langStore.t('footer.credits')"></p>
      </div>
      <div class="footer-col footer-social">
        <div class="social-icons">
          <a href="#" class="social-icon">In</a>
          <a href="#" class="social-icon">Fb</a>
          <a href="#" class="social-icon">Li</a>
        </div>
      </div>
    </footer>

    <StayAssistantPanel />
  </div>
  <div class="admin-container" v-else>
    <RouterView />
  </div>
</template>
