<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inquiries = ref([])
const isLoading = ref(true)
const filterStatus = ref('sve')
const sidebarOpen = ref(false)

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const fetchInquiries = async () => {
  isLoading.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/inquiries`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.status === 401) {
      router.push('/admin/login')
      return
    }
    inquiries.value = await res.json()
  } catch (err) {
    console.error('Greška pri učitavanju upita:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => { fetchInquiries() })

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const filteredInquiries = computed(() => {
  if (filterStatus.value === 'sve') return inquiries.value
  return inquiries.value.filter(i => i.status === filterStatus.value)
})

const statusCounts = computed(() => ({
  sve: inquiries.value.length,
  novo: inquiries.value.filter(i => i.status === 'novo').length,
  obradjeno: inquiries.value.filter(i => i.status === 'obradjeno').length,
  odbijeno: inquiries.value.filter(i => i.status === 'odbijeno').length,
  otkazano: inquiries.value.filter(i => i.status === 'otkazano').length,
}))

const actionLoading = ref(null)

const changeStatus = async (inquiry, newStatus) => {
  const confirmMap = {
    obradjeno: `Odobriti rezervaciju za "${inquiry.sender_name}"? Ovo će automatski zaključati izabrane datume za tu sobu.`,
    odbijeno: `Odbiti upit od "${inquiry.sender_name}"?`,
    otkazano: `Otkazati rezervaciju za "${inquiry.sender_name}"? Datumi će biti oslobođeni.`
  }
  if (!confirm(confirmMap[newStatus])) return

  actionLoading.value = inquiry.id
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/inquiries/${inquiry.id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    })
    if (res.ok) {
      // Lokalno azuriraj status bez ponovnog fetcha
      const idx = inquiries.value.findIndex(i => i.id === inquiry.id)
      if (idx !== -1) inquiries.value[idx].status = newStatus
    } else {
      const errData = await res.json().catch(() => ({}))
      alert(`Greška pri promeni statusa:\n${errData.error || res.statusText}`)
    }
  } catch (err) {
    alert(`Greška pri komunikaciji sa serverom:\n${err.message}`)
  } finally {
    actionLoading.value = null
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const statusLabel = (s) => ({
  novo: '🔔 Novo',
  obradjeno: '✅ Odobreno',
  odbijeno: '❌ Odbijeno',
  otkazano: '🚫 Otkazano'
}[s] || s)

const statusClass = (s) => ({
  novo: 'badge-novo',
  obradjeno: 'badge-ok',
  odbijeno: 'badge-bad',
  otkazano: 'badge-cancel'
}[s] || '')
</script>

<template>
  <div class="admin-layout">
    <!-- SIDEBAR OVERLAY (mobilni) -->
    <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

    <!-- SIDEBAR -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <h2>CMS Panel</h2>
      <nav>
        <router-link to="/admin/vesti">Вести</router-link>
        <a href="#">Смештај</a>
        <a href="#">Странице</a>
        <router-link to="/admin/rezervacije" class="active">Упити/Резервације</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </aside>

    <!-- MAIN -->
    <main class="main-content">
      <!-- MOBILE TOP BAR -->
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebarOpen = !sidebarOpen">☰ CMS Panel</button>
      </div>

      <div class="page-header">
        <div>
          <h1>Управљање Упитима</h1>
          <p class="subtitle">Прегледај, одобри или откажи захтеве госта за смештај.</p>
        </div>
        <button class="refresh-btn" @click="fetchInquiries" :disabled="isLoading">
          {{ isLoading ? 'Учитавам...' : 'Освежи листу' }}
        </button>
      </div>

      <!-- SUMMARY CARDS -->
      <div class="summary-cards">
        <div
          v-for="(count, key) in statusCounts"
          :key="key"
          class="summary-card"
          :class="{ active: filterStatus === key, [`card-${key}`]: true }"
          @click="filterStatus = key"
        >
          <span class="card-count">{{ count }}</span>
          <span class="card-label">{{ { sve: 'Сви', novo: 'Нови', obradjeno: 'Одобрени', odbijeno: 'Одбијени', otkazano: 'Отказани' }[key] }}</span>
        </div>
      </div>

      <!-- TABLE -->
      <div v-if="isLoading" class="loading-msg">Учитавам упите...</div>

      <div v-else-if="filteredInquiries.length === 0" class="empty-msg">
        Нема упита у овој категорији.
      </div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Гост</th>
              <th>Контакт</th>
              <th>Смештај / Соба</th>
              <th>Период</th>
              <th>Датум упита</th>
              <th>Статус</th>
              <th>Акције</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inq in filteredInquiries" :key="inq.id" :class="{ 'row-novo': inq.status === 'novo' }">
              <td class="id-col">{{ inq.id }}</td>
              <td>
                <strong>{{ inq.sender_name }}</strong>
                <p v-if="inq.message" class="msg-preview">{{ inq.message.slice(0, 60) }}{{ inq.message.length > 60 ? '...' : '' }}</p>
              </td>
              <td>
                <div v-if="inq.email"><a :href="'mailto:' + inq.email">{{ inq.email }}</a></div>
                <div v-if="inq.phone"><a :href="'tel:' + inq.phone">{{ inq.phone }}</a></div>
                <span v-if="!inq.email && !inq.phone" class="muted">—</span>
              </td>
              <td>
                <div class="facility-tag" v-if="inq.facility_name">{{ inq.facility_name }}</div>
                <div v-if="inq.room_name">{{ inq.room_name }}</div>
                <span v-else class="muted">Није наведено</span>
              </td>
              <td>
                <div v-if="inq.check_in || inq.check_out">
                  <span class="date-from">{{ formatDate(inq.check_in) }}</span>
                  <span class="date-arrow"> → </span>
                  <span class="date-to">{{ formatDate(inq.check_out) }}</span>
                </div>
                <span v-else class="muted">—</span>
              </td>
              <td class="muted">{{ formatDate(inq.created_at) }}</td>
              <td>
                <span class="status-badge" :class="statusClass(inq.status)">{{ statusLabel(inq.status) }}</span>
              </td>
              <td>
                <div class="actions-cell">
                  <button
                    v-if="inq.status === 'novo'"
                    class="action-btn approve"
                    :disabled="actionLoading === inq.id"
                    @click="changeStatus(inq, 'obradjeno')"
                  >✅ Одобри</button>

                  <button
                    v-if="inq.status === 'novo'"
                    class="action-btn reject"
                    :disabled="actionLoading === inq.id"
                    @click="changeStatus(inq, 'odbijeno')"
                  >❌ Одбиј</button>

                  <button
                    v-if="inq.status === 'obradjeno'"
                    class="action-btn cancel"
                    :disabled="actionLoading === inq.id"
                    @click="changeStatus(inq, 'otkazano')"
                  >🚫 Откажи</button>

                  <span v-if="['odbijeno', 'otkazano'].includes(inq.status)" class="muted">—</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f3f0;
  font-family: inherit;
  position: relative;
}

/* SIDEBAR */
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

/* MOBILNI: sidebar je skriven van ekrana */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(-100%);
    width: 240px;
  }
  .sidebar.sidebar-open {
    transform: translateX(0);
  }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
  }
  .sidebar-overlay.active {
    display: block;
  }
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
  .main-content {
    padding: 20px 16px !important;
  }
  .summary-cards {
    gap: 8px;
  }
  .summary-card {
    min-width: 70px;
    padding: 10px 12px;
  }
  .card-count {
    font-size: 1.4rem;
  }
  .data-table th, .data-table td {
    padding: 8px 10px;
    font-size: 0.82rem;
  }
  .actions-cell {
    min-width: 80px;
  }
  .action-btn {
    padding: 6px 8px;
    font-size: 0.78rem;
  }
  .page-header {
    flex-direction: column;
    gap: 12px;
  }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none !important; }
}

/* SIDEBAR */
.sidebar {
  width: 250px;
  background: #332317;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.sidebar h2 {
  margin-top: 0;
  margin-bottom: 30px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 10px;
  font-size: 1.1rem;
  letter-spacing: 1px;
}
.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.sidebar nav a {
  color: #ddd;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}
.sidebar nav a.active {
  background: #cdac91;
  color: #fff;
  font-weight: bold;
}
.sidebar nav a:hover:not(.active) {
  background: #fff;
  color: #332317;
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
.logout-btn:hover {
  background: #cdac91;
  color: #332317;
}

/* MAIN */
.main-content {
  flex: 1;
  padding: 40px;
  overflow-x: auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}
.page-header h1 {
  margin: 0 0 5px 0;
  font-size: 1.8rem;
  color: #332317;
}
.subtitle {
  color: #888;
  margin: 0;
  font-size: 0.95rem;
}
.refresh-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}
.refresh-btn:hover { opacity: 0.8; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* SUMMARY CARDS */
.summary-cards {
  display: flex;
  gap: 15px;
  margin-bottom: 30px;
  flex-wrap: wrap;
}
.summary-card {
  background: #fff;
  border: 2px solid transparent;
  padding: 15px 20px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 90px;
  transition: all 0.2s;
  border-radius: 0;
}
.summary-card:hover { border-color: #cdac91; }
.summary-card.active { border-color: #332317; background: #332317; color: #fff; }
.card-count { font-size: 1.8rem; font-weight: bold; line-height: 1; }
.card-label { font-size: 0.78rem; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
.card-novo .card-count { color: #e67e22; }
.summary-card.active .card-count { color: #cdac91; }

/* TABLE */
.table-wrapper { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  font-size: 0.92rem;
}
.data-table th {
  background: #332317;
  color: #cdac91;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  white-space: nowrap;
}
.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
.data-table tr.row-novo { background: #fffbf5; }
.data-table tr:hover { background: #fdf8f3; }
.id-col { color: #aaa; font-size: 0.85rem; }
.msg-preview { color: #888; font-size: 0.82rem; margin: 4px 0 0 0; font-style: italic; }
.muted { color: #aaa; font-size: 0.88rem; }
.facility-tag {
  display: inline-block;
  background: #f1ece7;
  color: #332317;
  padding: 2px 7px;
  font-size: 0.78rem;
  font-weight: bold;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.date-from, .date-to { font-weight: bold; color: #332317; }
.date-arrow { color: #aaa; }

/* STATUS BADGE */
.status-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 0.8rem;
  font-weight: bold;
  white-space: nowrap;
}
.badge-novo { background: #fff3e0; color: #e67e22; }
.badge-ok { background: #e8f5e9; color: #27ae60; }
.badge-bad { background: #fce4ec; color: #c0392b; }
.badge-cancel { background: #eceff1; color: #607d8b; }

/* ACTION BUTTONS */
.actions-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 110px;
}
.action-btn {
  border: none;
  padding: 7px 12px;
  cursor: pointer;
  font-size: 0.83rem;
  font-weight: bold;
  transition: opacity 0.2s;
  border-radius: 0;
  white-space: nowrap;
}
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-btn.approve { background: #27ae60; color: #fff; }
.action-btn.approve:hover { opacity: 0.85; }
.action-btn.reject { background: #e74c3c; color: #fff; }
.action-btn.reject:hover { opacity: 0.85; }
.action-btn.cancel { background: #607d8b; color: #fff; }
.action-btn.cancel:hover { opacity: 0.85; }

.loading-msg, .empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 1.1rem;
}
</style>
