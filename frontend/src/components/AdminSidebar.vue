<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sidebarOpen = ref(false)

function handleLogout() {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

defineExpose({ sidebarOpen })
</script>

<template>
  <!-- SIDEBAR OVERLAY (mobilni) -->
  <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

  <!-- SIDEBAR -->
  <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
    <h2>CMS Panel</h2>
    <nav>
      <router-link to="/admin/vesti">Вести</router-link>
      <router-link to="/admin/rezervacije">Упити/Резервације</router-link>
      <router-link to="/admin/gosti">Гости и CRM</router-link>
      <router-link to="/admin/mapa-soba">Мапа Соба</router-link>
      <router-link to="/admin/projekti">Пројекти</router-link>
      <router-link to="/admin/osoblje">Особље</router-link>
    </nav>
    <button class="logout-btn" @click="handleLogout">Одјави се</button>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 250px;
  background: #332317;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(-100%);
    width: 240px;
  }
  .sidebar.sidebar-open { transform: translateX(0); }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
  }
  .sidebar-overlay.active { display: block; }
}

@media (min-width: 769px) {
  .sidebar-overlay { display: none !important; }
}

.sidebar h2 {
  margin-top: 0;
  margin-bottom: 30px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 10px;
  font-size: 1.1rem;
  letter-spacing: 1px;
}
.sidebar nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.sidebar nav a {
  color: #ddd;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}
.sidebar nav a.router-link-active { background: #cdac91; color: #fff; font-weight: bold; }
.sidebar nav a:hover:not(.router-link-active) { background: #fff; color: #332317; }
.logout-btn {
  margin-top: 20px;
  padding: 10px;
  background: transparent;
  color: #cdac91;
  border: 1px solid #cdac91;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}
.logout-btn:hover { background: #cdac91; color: #332317; }
</style>
