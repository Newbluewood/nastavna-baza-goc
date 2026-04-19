<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
const smestajOpen = ref(true)
const sadrzajOpen = ref(true)

function handleLogout() {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const isSmestajActive = () => ['/admin/rezervacije', '/admin/gosti', '/admin/mapa-soba'].some(p => route.path.startsWith(p))
const isSadrzajActive = () => ['/admin/projekti', '/admin/osoblje', '/admin/stranice'].some(p => route.path.startsWith(p))

defineExpose({ sidebarOpen })
</script>

<template>
  <!-- SIDEBAR OVERLAY (mobilni) -->
  <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

  <!-- SIDEBAR -->
  <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
    <h2>CMS Panel</h2>
    <nav>
      <router-link to="/admin/vesti">📰 Вести</router-link>

      <!-- Смештај група -->
      <button class="nav-group-toggle" :class="{ 'group-active': isSmestajActive() }" @click="smestajOpen = !smestajOpen">
        🏠 Смештај <span class="toggle-arrow">{{ smestajOpen ? '▾' : '▸' }}</span>
      </button>
      <div v-show="smestajOpen" class="nav-group-items">
        <router-link to="/admin/rezervacije">Упити / Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
        <router-link to="/admin/mapa-soba">Мапа Соба</router-link>
      </div>

      <!-- Садржај сајта група -->
      <button class="nav-group-toggle" :class="{ 'group-active': isSadrzajActive() }" @click="sadrzajOpen = !sadrzajOpen">
        📋 Садржај сајта <span class="toggle-arrow">{{ sadrzajOpen ? '▾' : '▸' }}</span>
      </button>
        <div v-show="sadrzajOpen" class="nav-group-items">
          <router-link to="/admin/stranice">Странице</router-link>
          <router-link to="/admin/projekti">Пројекти</router-link>
          <router-link to="/admin/osoblje">Особље</router-link>
        </div>
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
.sidebar nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.sidebar nav a {
  color: #ddd;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}
.sidebar nav a.router-link-active { background: #cdac91; color: #fff; font-weight: bold; }
.sidebar nav a:hover:not(.router-link-active) { background: rgba(255,255,255,0.1); color: #fff; }

/* Group toggle buttons */
.nav-group-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  color: #cdac91;
  padding: 10px 12px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-top: 6px;
  transition: color 0.2s;
}
.nav-group-toggle:hover { color: #fff; }
.nav-group-toggle.group-active { color: #fff; }
.toggle-arrow { font-size: 0.8rem; }

/* Sub-items indented */
.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-group-items a {
  padding-left: 28px !important;
  font-size: 0.9rem !important;
}

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
