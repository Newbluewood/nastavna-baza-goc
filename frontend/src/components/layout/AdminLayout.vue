<script setup>
import { ref } from 'vue'
import AdminSidebar from './AdminSidebar.vue'

const sidebar = ref(null)

defineExpose({ sidebar })
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar ref="sidebar" />
    <main class="main-content">
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebar.sidebarOpen = !sidebar.sidebarOpen">☰ CMS Panel</button>
      </div>
      <slot />
    </main>
  </div>
</template>

<style>
@import '../../assets/admin-common.css';
</style>
