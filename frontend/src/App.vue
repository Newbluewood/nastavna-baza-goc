<script setup>
import { ref, computed } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { useLangStore } from './stores/lang'
import { useGuestStore } from './stores/guest'

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
            <span class="guest-label">{{ guestStore.isLoggedIn ? (guestStore.guest?.name?.split(' ')[0] || 'Nalog') : (langStore.currentLang === 'sr' ? 'Prijava' : 'Login') }}</span>
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
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">ПОЧЕТНА</span>
            <span class="nav-bold" v-else>HOME</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/smestaj" class="nav-link" @click="closeMenu">
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">СМЕШТАЈ</span>
            <span class="nav-bold" v-else>ACCOMMODATION</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/vesti" class="nav-link" @click="closeMenu">
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">ВЕСТИ</span>
            <span class="nav-bold" v-else>NEWS</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/edukacija" class="nav-link" @click="closeMenu">
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">ЕДУКАЦИЈА</span>
            <span class="nav-bold" v-else>EDUCATION</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/istrazivanje" class="nav-link" @click="closeMenu">
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">ИСТРАЖИВАЊE</span>
            <span class="nav-bold" v-else>RESEARCH</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/kontakt" class="nav-link" @click="closeMenu">
            <span class="nav-bold" v-if="langStore.currentLang === 'sr'">КОНТАКТ</span>
            <span class="nav-bold" v-else>CONTACT</span>
          </router-link>
        </nav>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>

    <footer class="footer">
      <div class="footer-col" v-if="langStore.currentLang === 'sr'">
        <p><strong>Шумарски факултет</strong><br>
        Универзитета у Београду<br>
        Кнеза Вишеслава 1<br>
        11 000 Београд, Србија</p>
      </div>
      <div class="footer-col" v-else>
        <p><strong>Faculty of Forestry</strong><br>
        University of Belgrade<br>
        Kneza Višeslava 1<br>
        11000 Belgrade, Serbia</p>
      </div>
      <div class="footer-col">
        <p><a href="mailto:projektovanje@sfb.bg.ac.rs">projektovanje@sfb.bg.ac.rs</a><br>
        <a href="http://www.sfb.bg.ac.rs" target="_blank">www.sfb.bg.ac.rs</a></p>
      </div>
      <div class="footer-col footer-credits" v-if="langStore.currentLang === 'sr'">
        <p>сајт | Небојша Симовић<br>
        мултимедија | Јован Митровић</p>
      </div>
      <div class="footer-col footer-credits" v-else>
        <p>website | Nebojša Simović<br>
        multimedia | Jovan Mitrović</p>
      </div>
      <div class="footer-col footer-social">
        <div class="social-icons">
          <a href="#" class="social-icon">In</a>
          <a href="#" class="social-icon">Fb</a>
          <a href="#" class="social-icon">Li</a>
        </div>
      </div>
    </footer>
  </div>
  <div class="admin-container" v-else>
    <RouterView />
  </div>
</template>
