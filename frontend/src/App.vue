<script setup>
import { ref } from 'vue'
import { RouterView, RouterLink } from 'vue-router'

const isMenuOpen = ref(false)
const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}
const closeMenu = () => {
  isMenuOpen.value = false
}
</script>

<template>
  <div class="app-container">
    <header class="header">
      <div class="header-top">
        <div class="logo">
          <router-link to="/">
            <img src="/logo.svg" alt="Univerzitet u Beogradu - Šumarski fakultet" class="site-logo" />
          </router-link>
        </div>
        <div class="language-switch">
          <a href="#">ENG</a> | <a href="#" class="active">СРП</a>
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
            <span class="nav-bold">ПОЧЕТНА</span>
          </router-link>
          <span class="nav-sep">|</span>
          <router-link to="/smestaj" class="nav-link" @click="closeMenu">
            <span class="nav-bold">СМЕШТАЈ</span>
          </router-link>
        </nav>
      </div>
    </header>

    <main class="content">
      <RouterView />
    </main>

    <footer class="footer">
      <div class="footer-col">
        <p><strong>Шумарски факултет</strong><br>
        Универзитета у Београду<br>
        Кнеза Вишеслава 1<br>
        11 000 Београд, Србија</p>
      </div>
      <div class="footer-col">
        <p><a href="mailto:projektovanje@sfb.bg.ac.rs">projektovanje@sfb.bg.ac.rs</a><br>
        <a href="http://www.sfb.bg.ac.rs" target="_blank">www.sfb.bg.ac.rs</a></p>
      </div>
      <div class="footer-col footer-credits">
        <p>сајт | Небојша Симовић<br>
        мултимедија | Јован Митровић</p>
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
</template>
