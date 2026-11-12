<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '../../services/api'
import { canAccess, getStoredAdminRole } from '../../auth/permissions'

const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
const smestajOpen = ref(true)
const isPurging = ref(false)
const isRefreshingKnowledge = ref(false)

const role = computed(() => getStoredAdminRole())

const allAdminLinks = [
  { name: 'admin-news', label: 'Вести', permission: 'news' },
  { name: 'admin-pages', label: 'Странице и мени', permission: 'pages' },
  { name: 'admin-staff', label: 'Особље', permission: 'staff' },
  { name: 'admin-projects', label: 'Пројекти', permission: 'projects' },
  { name: 'admin-stats', label: 'Статистике сајта', permission: 'stats' },
  { name: 'admin-ai', label: 'AI Потрошња', permission: 'ai_usage' },
  { name: 'admin-restaurant', label: 'Ресторан', permission: 'restaurant' },
  { name: 'admin-themes', label: 'Теме (Истражи Гоч)', permission: 'themes' },
  { name: 'admin-settings', label: 'Подешавања', permission: 'settings' },
  { name: 'admin-email-templates', label: 'Мејл шаблони', permission: 'settings' },
  { name: 'admin-cms-users', label: 'CMS корисници', permission: 'cms_users' },
]

const allSmestajLinks = [
  { name: 'admin-reservations', label: 'Упити / Резервације', permission: 'inquiries' },
  { name: 'admin-guests', label: 'Гости и CRM', permission: 'guests' },
  { name: 'admin-room-map', label: 'Мапа Соба', permission: 'room_map' },
  { name: 'admin-rooms', label: 'Уређивање соба', permission: 'rooms' },
]

const adminLinks = computed(() =>
  allAdminLinks.filter((link) => canAccess(role.value, link.permission))
)
const smestajLinks = computed(() =>
  allSmestajLinks.filter((link) => canAccess(role.value, link.permission))
)
const canPurge = computed(() => canAccess(role.value, 'system'))
const canRefreshKnowledge = computed(() => canAccess(role.value, 'system'))

function handleLogout() {
  api.logout()
  router.push({ name: 'admin-login' })
}

const handlePurgeCache = async () => {
  if (isPurging.value || !canPurge.value) return
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

const handleRefreshKnowledge = async () => {
  if (isRefreshingKnowledge.value || !canRefreshKnowledge.value) return
  isRefreshingKnowledge.value = true
  try {
    const result = await api.refreshAgentKnowledge()
    alert(result.message || 'Освежавање знања је покренуто.')
  } catch (err) {
    alert(err.data?.error || 'Чет агент није прихватио освежавање.')
  } finally {
    isRefreshingKnowledge.value = false
  }
}

const isSmestajActive = () => smestajLinks.value.some((link) => route.name === link.name)

defineExpose({ sidebarOpen })
</script>

<template>
  <!-- SIDEBAR OVERLAY (mobilni) -->
  <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

  <!-- SIDEBAR -->
  <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
    <h2>CMS Panel</h2>
    <nav>
      <router-link
        v-for="link in adminLinks"
        :key="link.name"
        :to="{ name: link.name }"
      >
        {{ link.label }}
      </router-link>

      <!-- Смештај група -->
      <template v-if="smestajLinks.length">
        <button class="nav-group-toggle" :class="{ 'group-active': isSmestajActive() }" @click="smestajOpen = !smestajOpen">
          Смештај <span class="toggle-arrow">{{ smestajOpen ? '▾' : '▸' }}</span>
        </button>
        <div v-show="smestajOpen" class="nav-group-items">
          <router-link
            v-for="link in smestajLinks"
            :key="link.name"
            :to="{ name: link.name }"
          >
            {{ link.label }}
          </router-link>
        </div>
      </template>
    </nav>
    <div class="sidebar-actions">
      <button v-if="canPurge" class="purge-btn" @click="handlePurgeCache" :disabled="isPurging">
        {{ isPurging ? 'Чистим...' : 'Очисти кеш' }}
      </button>
      <button v-if="canRefreshKnowledge" class="knowledge-btn" @click="handleRefreshKnowledge" :disabled="isRefreshingKnowledge">
        {{ isRefreshingKnowledge ? 'Покрећем...' : 'Освежи знање AI чет агента' }}
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
  color: #cdac91;
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

.knowledge-btn {
  background: transparent;
  color: #cdac91;
  border: 1px solid #cdac91;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.82rem;
  line-height: 1.35;
  transition: all 0.2s;
}

.knowledge-btn:hover:not(:disabled) {
  background: #cdac91;
  color: #332317;
}

.knowledge-btn:disabled {
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
