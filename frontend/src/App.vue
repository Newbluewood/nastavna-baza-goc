<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useLangStore } from './stores/lang'
import { useGuestStore } from './stores/guest'
import { useChatStore } from './stores/chat'
import { useSettingsStore } from './stores/settings'
import { useNavStore } from './stores/nav'
import { useBootstrapStore } from './stores/bootstrap'
import AgentChatWidget from './components/ui/AgentChatWidget.vue'
import InquiryModal from './components/forms/InquiryModal.vue'
import AppNavigation from './components/layout/AppNavigation.vue'
import ColdStartGate from './components/ui/ColdStartGate.vue'

const langStore = useLangStore()
const guestStore = useGuestStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const navStore = useNavStore()
const bootstrap = useBootstrapStore()
const route = useRoute()
const router = useRouter()

const loadShell = (lang) => {
  settingsStore.fetch(lang)
  navStore.fetch(lang)
}

const onWindowFocus = () => {
  if (bootstrap.isReady) navStore.fetch(langStore.currentLang)
}

onMounted(() => {
  bootstrap.start()
})

watch(() => bootstrap.isReady, (ready) => {
  if (!ready) return
  loadShell(langStore.currentLang)
  window.addEventListener('focus', onWindowFocus)
}, { immediate: true })

watch(() => langStore.currentLang, (lang) => {
  if (bootstrap.isReady) loadShell(lang)
})

onUnmounted(() => window.removeEventListener('focus', onWindowFocus))

const inquiryModalOpen = computed({
  get: () => chatStore.inquiryModal.open,
  set: (value) => { chatStore.inquiryModal.open = value },
})

const isAdminRoute = computed(() => route.path.startsWith('/admin'))

const handleGuestNav = () => {
  if (guestStore.isLoggedIn) router.push({ name: 'moj-nalog' })
  else router.push({ name: 'prijava' })
}
</script>

<template>
  <ColdStartGate v-if="bootstrap.isBlocked" />

  <template v-else>
    <div class="app-container" v-if="!isAdminRoute">
      <header class="header">
        <div class="header-top">
          <div class="logo">
            <router-link :to="{ name: 'home' }">
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
        <AppNavigation />
      </header>

      <main class="content">
        <RouterView />
      </main>

      <div class="footer-wrapper">
        <footer class="footer">
          <div class="footer-col">
            <p><strong>{{ settingsStore.get('footer_faculty') }}</strong><br>
            {{ settingsStore.get('footer_university') }}<br>
            {{ settingsStore.get('footer_address') }}<br>
            {{ settingsStore.get('footer_city') }}</p>
          </div>
          <div class="footer-col">
            <p>
              <a :href="`mailto:${settingsStore.get('footer_email')}`">{{ settingsStore.get('footer_email') }}</a><br>
              {{ settingsStore.get('footer_phone') }}<br>
              <a :href="settingsStore.get('footer_website_url')" target="_blank">{{ settingsStore.get('footer_website_label') }}</a>
            </p>
          </div>
          <div class="footer-col footer-credits">
            <p v-html="settingsStore.get('footer_credits')"></p>
          </div>
          <div class="footer-col footer-social">
            <div class="social-icons">
              <a v-if="settingsStore.get('social_facebook')" :href="settingsStore.get('social_facebook')" target="_blank" class="social-icon">Fb</a>
              <a v-if="settingsStore.get('social_instagram')" :href="settingsStore.get('social_instagram')" target="_blank" class="social-icon">In</a>
              <a v-if="settingsStore.get('social_linkedin')" :href="settingsStore.get('social_linkedin')" target="_blank" class="social-icon">Li</a>
            </div>
          </div>
        </footer>
      </div>

      <AgentChatWidget />

      <InquiryModal
        v-if="chatStore.inquiryModal.roomId"
        v-model:isOpen="inquiryModalOpen"
        :roomId="chatStore.inquiryModal.roomId"
        :roomName="chatStore.inquiryModal.roomName"
        :buildingName="chatStore.inquiryModal.buildingName"
        :initialCheckIn="chatStore.inquiryModal.checkIn"
        :initialCheckOut="chatStore.inquiryModal.checkOut"
        :initialGuestName="chatStore.inquiryModal.guestName"
        :initialGuestEmail="chatStore.inquiryModal.guestEmail"
        :initialGuestPhone="chatStore.inquiryModal.guestPhone"
        :initialBoardType="chatStore.inquiryModal.boardType"
      />
    </div>
    <div class="admin-container" v-else>
      <RouterView />
    </div>
  </template>
</template>
