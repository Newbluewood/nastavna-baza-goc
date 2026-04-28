<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '../components/AdminSidebar.vue'

const router = useRouter()
const sidebar = ref(null)
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
  const raw = String(d).trim()
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const parsed = ymd ? new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`) : new Date(raw)
  return isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

const totalRooms = computed(() => facilities.value.reduce((s, f) => s + f.rooms.length, 0))
const occupiedRooms = computed(() => facilities.value.reduce((s, f) => s + f.rooms.filter(r => r.is_occupied).length, 0))

onMounted(() => fetchRoomMap())
</script>

<template>
  <div class="admin-layout" @click="hideTooltip">
    <AdminSidebar ref="sidebar" />

    <!-- MAIN -->
    <main class="main-content">
      <div class="mobile-topbar">
        <button class="burger-admin" @click.stop="sidebar.sidebarOpen = !sidebar.sidebarOpen">☰ CMS Panel</button>
      </div>

      <div class="page-header">
        <div>
          <h1>Мапа Соба</h1>
          <p class="subtitle">Преглед попуњености смештајних капацитета по датуму.</p>
        </div>
      </div>

      <!-- DATE PICKER — PROMINENT -->
      <div class="date-picker-section">
        <label class="date-picker-label">Провери стање за одређени датум:</label>
        <div class="date-picker-row">
          <input type="date" v-model="selectedDate" @change="fetchRoomMap" class="date-picker" />
          <button class="refresh-btn" @click="fetchRoomMap" :disabled="isLoading">
            {{ isLoading ? 'Учитавам...' : 'Прикажи' }}
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
  font-family: inherit;
  position: relative;
}

@media (max-width: 768px) {
  .mobile-topbar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  .burger-admin {
    background: #332317;
    color: #cdac91;
    border: none;
    padding: 10px 16px;
    font-size: 0.95rem;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0;
  }
  .main-content { padding: 20px 16px !important; }
  .page-header { flex-direction: column; gap: 12px; }
  .date-picker-section { padding: 16px; }
  .date-picker-row { flex-direction: column; gap: 10px; }
  .date-picker { min-width: 0; width: 100%; }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
}

/* MAIN */
.main-content {
  flex: 1;
  padding: 40px;
  overflow-x: auto;
}

/* PAGE HEADER */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}
.page-header h1 { margin: 0 0 5px 0; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }

/* DATE PICKER SECTION */
.date-picker-section {
  background: #fdfaf7;
  border: 2px solid #cdac91;
  padding: 20px 24px;
  margin-bottom: 30px;
  text-align: center;
}
.date-picker-label {
  display: block;
  font-size: 1.05rem;
  font-weight: 700;
  color: #332317;
  margin-bottom: 12px;
}
.date-picker-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}
.date-picker {
  border: 2px solid #cdac91;
  background: #fff;
  padding: 10px 18px;
  font-size: 1.1rem;
  color: #332317;
  cursor: pointer;
  min-width: 200px;
  text-align: center;
}
.date-picker:focus {
  outline: none;
  border-color: #332317;
}
.refresh-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}
.refresh-btn:hover { opacity: 0.8; }
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
  font-family: inherit;
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
