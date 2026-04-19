<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const sidebarOpen = ref(false)
const isLoading = ref(false)
const selectedDate = ref(new Date().toISOString().split('T')[0])
const facilities = ref([])
const tooltip = ref(null) // { room, x, y }

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const capacityLabels = {
  single: 'Јед.',
  double: 'Дво.',
  triple: 'Тро.',
  multi: 'Мул.'
}

const capacityFullLabels = {
  single: 'Једнокреветна',
  double: 'Двокреветна',
  triple: 'Трокреветна',
  multi: 'Вишекреветна'
}

const capShort = {
  single: 'јед',
  double: 'дво',
  triple: 'тро',
  multi: 'вше'
}

function roomCapLabel(room) {
  const max = room.capacity_max || 1
  return `${max}.${capShort[room.capacity_type] || 'вше'}`
}

async function fetchRoomMap() {
  isLoading.value = true
  tooltip.value = null
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/room-map?date=${selectedDate.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.status === 401) { router.push('/admin/login'); return }
    const data = await res.json()
    facilities.value = data.facilities || []
  } catch (err) {
    console.error('Greška pri učitavanju mape:', err)
  } finally {
    isLoading.value = false
  }
}

function showTooltip(event, room) {
  if (!room.is_occupied) return
  const rect = event.currentTarget.getBoundingClientRect()
  tooltip.value = {
    room,
    x: rect.left + rect.width / 2,
    y: rect.top - 12
  }
}

function hideTooltip() {
  tooltip.value = null
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

const totalRooms = computed(() => facilities.value.reduce((s, f) => s + f.rooms.length, 0))
const occupiedRooms = computed(() => facilities.value.reduce((s, f) => s + f.rooms.filter(r => r.is_occupied).length, 0))

function handleLogout() {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

onMounted(() => fetchRoomMap())
</script>

<template>
  <div class="admin-layout" @click="hideTooltip">
    <!-- SIDEBAR OVERLAY (mobilni) -->
    <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click.stop="sidebarOpen = false"></div>

    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <h2>CMS Panel</h2>
      <nav>
        <router-link to="/admin/vesti">Вести</router-link>
        <router-link to="/admin/rezervacije">Упити/Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
        <router-link to="/admin/mapa-soba" class="active">Мапа Соба</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </aside>

    <!-- MAIN -->
    <main class="main-content">
      <div class="mobile-topbar">
        <button class="burger-admin" @click.stop="sidebarOpen = !sidebarOpen">☰ CMS Panel</button>
      </div>

      <div class="page-header">
        <div>
          <h1>Мапа Соба</h1>
          <p class="subtitle">Преглед попуњености смештајних капацитета по датуму.</p>
        </div>
        <div class="header-controls">
          <input type="date" v-model="selectedDate" @change="fetchRoomMap" class="date-picker" />
          <button class="refresh-btn" @click="fetchRoomMap" :disabled="isLoading">
            {{ isLoading ? 'Учитавам...' : 'Освежи' }}
          </button>
        </div>
      </div>

      <!-- SUMMARY -->
      <div class="summary-bar" v-if="!isLoading">
        <span class="summary-item">
          <strong>{{ totalRooms }}</strong> соба укупно
        </span>
        <span class="summary-item occupied">
          <strong>{{ occupiedRooms }}</strong> заузето
        </span>
        <span class="summary-item free">
          <strong>{{ totalRooms - occupiedRooms }}</strong> слободно
        </span>
      </div>

      <!-- LEGENDA -->
      <div class="legend">
        <span v-for="(label, key) in capacityFullLabels" :key="key" class="legend-item">
          <span class="legend-swatch" :class="`type-${key}`"></span>
          {{ label }}
        </span>
        <span class="legend-item">
          <span class="legend-swatch occupied-swatch"></span>
          Заузето
        </span>
      </div>

      <div v-if="isLoading" class="loading-msg">Учитавам...</div>

      <!-- FACILITIES -->
      <div v-else class="facilities-grid">
        <section v-for="facility in facilities" :key="facility.id" class="facility-section">
          <h2 class="facility-name">{{ facility.name }}</h2>
          <div v-if="facility.rooms.length === 0" class="no-rooms">Нема регистрованих соба.</div>
          <div class="rooms-grid">
            <div
              v-for="(room, roomIndex) in facility.rooms"
              :key="room.id"
              class="room-tile"
              :class="[`type-${room.capacity_type}`, { 'is-occupied': room.is_occupied }]"
              @mouseenter.stop="showTooltip($event, room)"
              @mouseleave="hideTooltip"
              @click.stop="room.is_occupied && showTooltip($event, room)"
            >
              <span class="room-number">{{ roomIndex + 1 }}</span>
              <span class="room-type-label">{{ roomCapLabel(room) }}</span>
              <span v-if="room.is_occupied" class="occupied-icon">●</span>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- TOOLTIP -->
    <Teleport to="body">
      <div
        v-if="tooltip"
        class="room-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <strong>{{ tooltip.room.name }}</strong>
        <span>{{ capacityFullLabels[tooltip.room.capacity_type] }}</span>
        <template v-if="tooltip.room.reservation">
          <hr />
          <span>👤 {{ tooltip.room.reservation.guest_name }}</span>
          <span v-if="tooltip.room.reservation.guest_email" class="tip-email">{{ tooltip.room.reservation.guest_email }}</span>
          <span>📅 {{ fmtDate(tooltip.room.reservation.check_in) }} → {{ fmtDate(tooltip.room.reservation.check_out) }}</span>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ===== LAYOUT ===== */
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f3f0;
  font-family: var(--font-base), sans-serif;
}

/* SIDEBAR */
.sidebar {
  width: 220px;
  background: #332317;
  color: #cdac91;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 100vh;
  position: sticky;
  top: 0;
}
.sidebar h2 { color: #cdac91; font-size: 1rem; letter-spacing: 2px; margin: 0 0 16px; }
.sidebar nav { display: flex; flex-direction: column; gap: 4px; }
.sidebar nav a {
  color: #cdac91;
  text-decoration: none;
  padding: 8px 12px;
  font-size: 0.9rem;
  border-radius: 0;
  transition: background 0.15s;
}
.sidebar nav a:hover, .sidebar nav a.active { background: rgba(255,255,255,0.1); color: #fff; }
.logout-btn {
  margin-top: auto;
  background: none;
  border: 1px solid #cdac91;
  color: #cdac91;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 0.85rem;
}
.logout-btn:hover { background: rgba(255,255,255,0.1); }

.sidebar-overlay { display: none; }

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -240px;
    top: 0;
    z-index: 200;
    transition: left 0.25s;
  }
  .sidebar.sidebar-open { left: 0; }
  .sidebar-overlay.active {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
  }
}

/* MAIN */
.main-content {
  flex: 1;
  padding: 32px 28px;
  max-width: 960px;
}

.mobile-topbar {
  display: none;
  margin-bottom: 16px;
}
@media (max-width: 768px) {
  .mobile-topbar { display: flex; }
  .main-content { padding: 16px; }
}

.burger-admin {
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 0.9rem;
}

/* PAGE HEADER */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.page-header h1 { margin: 0; color: #332317; font-size: 1.6rem; }
.subtitle { color: #67462e; font-size: 0.9rem; margin: 4px 0 0; }

.header-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}
.date-picker {
  border: 1px solid #cdac91;
  background: #fff;
  padding: 7px 12px;
  font-size: 0.9rem;
  color: #332317;
  cursor: pointer;
}
.refresh-btn {
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.85rem;
}
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* SUMMARY BAR */
.summary-bar {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.summary-item { font-size: 0.9rem; color: #332317; }
.summary-item strong { font-size: 1.1rem; }
.summary-item.occupied strong { color: #c0392b; }
.summary-item.free strong { color: #27ae60; }

/* LEGEND */
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  font-size: 0.8rem;
  color: #67462e;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-swatch {
  width: 18px;
  height: 18px;
  border: 1px solid rgba(0,0,0,0.15);
  display: inline-block;
}
.legend-swatch.type-single  { background: #f5e9df; }
.legend-swatch.type-double  { background: #e8d0b3; }
.legend-swatch.type-triple  { background: #cdac91; }
.legend-swatch.type-multi   { background: #a07050; }
.legend-swatch.occupied-swatch { background: #fff; border: 2px solid #c0392b; }

/* LOADING */
.loading-msg { color: #67462e; padding: 20px 0; }

/* FACILITIES */
.facilities-grid { display: flex; flex-direction: column; gap: 32px; }

.facility-section {}
.facility-name {
  font-size: 1.1rem;
  color: #332317;
  border-bottom: 2px solid #cdac91;
  padding-bottom: 6px;
  margin: 0 0 14px;
}
.no-rooms { color: #999; font-size: 0.85rem; }

/* ROOM GRID */
.rooms-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.room-tile {
  width: 64px;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(0,0,0,0.12);
  cursor: default;
  position: relative;
  transition: transform 0.1s, box-shadow 0.1s;
  user-select: none;
  gap: 0;
}
.room-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }

/* TYPE COLORS */
.room-tile.type-single { background: #f5e9df; }
.room-tile.type-double { background: #e8d0b3; }
.room-tile.type-triple { background: #cdac91; }
.room-tile.type-multi  { background: #a07050; color: #fff; }

/* OCCUPIED STATE */
.room-tile.is-occupied {
  border: 4px solid #c0392b;
  cursor: pointer;
}
.room-tile.is-occupied .occupied-icon {
  position: absolute;
  top: 3px;
  right: 5px;
  font-size: 0.5rem;
  color: #c0392b;
}

.room-number { font-size: 1.1rem; font-weight: 700; line-height: 1; flex: 1; display: flex; align-items: center; }
.room-type-label { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.75; border-top: 1px solid rgba(0,0,0,0.15); width: 100%; text-align: center; padding-top: 3px; padding-bottom: 2px; }

/* TOOLTIP */
.room-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  background: #332317;
  color: #f5e9df;
  padding: 10px 14px;
  font-size: 0.8rem;
  font-family: var(--font-base), sans-serif;
  pointer-events: none;
  z-index: 9999;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}
.room-tooltip strong { font-size: 0.9rem; color: #cdac91; }
.room-tooltip hr { border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 4px 0; }
.tip-email { opacity: 0.7; font-size: 0.75rem; }
</style>
