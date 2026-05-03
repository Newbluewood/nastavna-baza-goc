<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../services/api'

const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
const smestajOpen = ref(true)
const isPurging = ref(false)

function handleLogout() {
  api.logout()
  router.push('/admin/login')
}

const handlePurgeCache = async () => {
  if (isPurging.value) return
  isPurging.value = true
  try {
    await api.purgeCache()
    alert('Кеш меморија је успешно очишћена. Промене ће бити видљиве јавно.')
  } catch (err) {
    alert(err.data?.error || 'Дошло је до грешке приликом чишћења кеша.')
  } finally {
    isPurging.value = false
  }
}

const isSmestajActive = () => ['/admin/rezervacije', '/admin/gosti', '/admin/mapa-soba', '/admin/sobe'].some(p => route.path.startsWith(p))

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
      <router-link to="/admin/stranice">Странице</router-link>
      <router-link to="/admin/osoblje">Особље</router-link>
      <router-link to="/admin/projekti">Пројекти</router-link>
      <router-link to="/admin/ai">AI Потрошња</router-link>
      <router-link to="/admin/restoran">Ресторан</router-link>

      <!-- Смештај група -->
      <button class="nav-group-toggle" :class="{ 'group-active': isSmestajActive() }" @click="smestajOpen = !smestajOpen">
        Смештај <span class="toggle-arrow">{{ smestajOpen ? '▾' : '▸' }}</span>
      </button>
      <div v-show="smestajOpen" class="nav-group-items">
        <router-link to="/admin/rezervacije">Упити / Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
        <router-link to="/admin/mapa-soba">Мапа Соба</router-link>
        <router-link to="/admin/sobe">Уређивање соба</router-link>
      </div>
    </nav>
    <div class="sidebar-actions">
      <button class="purge-btn" @click="handlePurgeCache" :disabled="isPurging">
        {{ isPurging ? 'Чистим...' : 'Очисти кеш' }}
      </button>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </div>
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

/* Sidebar Akcije (dno) */
.sidebar-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.purge-btn {
  background: transparent;
  color: #e67e22;
  border: 1px solid #e67e22;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.purge-btn:hover:not(:disabled) {
  background: #e67e22;
  color: #fff;
}

.purge-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logout-btn {
  margin-top: 10px;
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
