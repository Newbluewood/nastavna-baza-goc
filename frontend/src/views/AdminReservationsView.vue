<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inquiries = ref([])
const isLoading = ref(true)
const filterStatus = ref('sve')
const quickFilter = ref('all')
const searchQuery = ref('')
const savedViews = ref([])
const activityLoading = ref(null)
const activityOpen = ref({})
const activityData = ref({})
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

onMounted(() => {
  try {
    const raw = localStorage.getItem('admin_inquiry_saved_views')
    savedViews.value = raw ? JSON.parse(raw) : []
  } catch {
    savedViews.value = []
  }
})

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const parseVouchers = (inquiry) => {
  if (!inquiry?.guest_vouchers) return []
  if (Array.isArray(inquiry.guest_vouchers)) return inquiry.guest_vouchers
  try {
    const parsed = JSON.parse(inquiry.guest_vouchers)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const hasLoyaltyVoucher = (inquiry) => {
  const vouchers = parseVouchers(inquiry)
  return vouchers.some((v) => (v?.title || '').toLowerCase().includes('loyalty popust'))
}

const matchesSearch = (inquiry, q) => {
  if (!q) return true
  const haystack = [
    inquiry.sender_name,
    inquiry.email,
    inquiry.phone,
    inquiry.facility_name,
    inquiry.room_name,
    inquiry.message,
    inquiry.rejection_reason
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

const persistSavedViews = () => {
  localStorage.setItem('admin_inquiry_saved_views', JSON.stringify(savedViews.value.slice(0, 8)))
}

const applySavedView = (view) => {
  filterStatus.value = view.filterStatus || 'sve'
  quickFilter.value = view.quickFilter || 'all'
  searchQuery.value = view.searchQuery || ''
}

const saveCurrentView = () => {
  const name = prompt('Naziv pogleda (npr. CRM prioritet):')
  if (!name || !name.trim()) return

  const trimmed = name.trim()
  const existingIdx = savedViews.value.findIndex((v) => v.name.toLowerCase() === trimmed.toLowerCase())
  const snapshot = {
    name: trimmed,
    filterStatus: filterStatus.value,
    quickFilter: quickFilter.value,
    searchQuery: searchQuery.value.trim()
  }

  if (existingIdx >= 0) {
    savedViews.value[existingIdx] = snapshot
  } else {
    savedViews.value.unshift(snapshot)
  }
  persistSavedViews()
}

const removeSavedView = (idx) => {
  savedViews.value.splice(idx, 1)
  persistSavedViews()
}

const filteredInquiries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  return inquiries.value.filter((i) => {
    const statusOk = filterStatus.value === 'sve' || i.status === filterStatus.value

    let quickOk = true
    if (quickFilter.value === 'with-rejections') {
      quickOk = Number(i.guest_rejected_inquiries || 0) > 0
    } else if (quickFilter.value === 'without-rejections') {
      quickOk = Number(i.guest_rejected_inquiries || 0) === 0
    } else if (quickFilter.value === 'voucher-assigned') {
      quickOk = hasLoyaltyVoucher(i)
    } else if (quickFilter.value === 'voucher-missing') {
      quickOk = !hasLoyaltyVoucher(i)
    }

    return statusOk && quickOk && matchesSearch(i, q)
  })
})

const statusCounts = computed(() => ({
  sve: inquiries.value.length,
  novo: inquiries.value.filter(i => i.status === 'novo').length,
  obradjeno: inquiries.value.filter(i => i.status === 'obradjeno').length,
  odbijeno: inquiries.value.filter(i => i.status === 'odbijeno').length,
  otkazano: inquiries.value.filter(i => i.status === 'otkazano').length,
}))

const fixedViews = [
  { name: 'CRM prioritet', filterStatus: 'sve', quickFilter: 'with-rejections', searchQuery: '' },
  { name: 'Novi bez vaučera', filterStatus: 'novo', quickFilter: 'voucher-missing', searchQuery: '' },
  { name: 'Odbijeni bez vaučera', filterStatus: 'odbijeno', quickFilter: 'voucher-missing', searchQuery: '' }
]

const exportFilteredCsv = () => {
  const rows = filteredInquiries.value.map((i) => ({
    id: i.id,
    gost: i.sender_name || '',
    email: i.email || '',
    telefon: i.phone || '',
    objekat: i.facility_name || '',
    soba: i.room_name || '',
    check_in: i.check_in || '',
    check_out: i.check_out || '',
    status: i.status || '',
    rejection_reason: i.rejection_reason || '',
    rejected_count: i.guest_rejected_inquiries || 0
  }))

  const headers = Object.keys(rows[0] || {
    id: '', gost: '', email: '', telefon: '', objekat: '', soba: '', check_in: '', check_out: '', status: '', rejection_reason: '', rejected_count: ''
  })

  const esc = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `admin-upiti-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const actionLoading = ref(null)
const voucherLoading = ref(null)

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
      const data = await res.json().catch(() => ({}))
      // Lokalno azuriraj status bez ponovnog fetcha
      const idx = inquiries.value.findIndex(i => i.id === inquiry.id)
      if (idx !== -1) inquiries.value[idx].status = newStatus
      if (data.emailWarning) {
        alert(`⚠️ Status je ažuriran, ali email NIJE poslat gostu:\n${data.emailWarning}`)
      }
    } else {
      const errData = await res.json().catch(() => ({}))
      if (res.status === 409 && errData.autoRejected) {
        const idx = inquiries.value.findIndex(i => i.id === inquiry.id)
        if (idx !== -1) inquiries.value[idx].status = errData.newStatus || 'odbijeno'
        alert(`Termin je u međuvremenu zauzet i ovaj upit je automatski odbijen.\n${errData.error || ''}`)
        return
      }
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

const hasRejectionHistory = (inq) => Number(inq.guest_rejected_inquiries || 0) > 0

const statusLabelShort = (s) => ({
  novo: 'Novo',
  obradjeno: 'Odobreno',
  odbijeno: 'Odbijeno',
  otkazano: 'Otkazano',
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled'
}[s] || s)

const toggleActivity = async (inquiry) => {
  const id = inquiry.id
  if (activityOpen.value[id]) {
    activityOpen.value[id] = false
    return
  }

  if (!activityData.value[id]) {
    activityLoading.value = id
    try {
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${baseUrl}/api/admin/inquiries/${id}/activity`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(`Ne mogu da učitam istoriju:\n${data.error || res.statusText}`)
        return
      }
      activityData.value[id] = data
    } catch (err) {
      alert(`Greška pri učitavanju istorije:\n${err.message}`)
      return
    } finally {
      activityLoading.value = null
    }
  }

  activityOpen.value[id] = true
}

const assignLoyaltyVoucher = async (inquiry) => {
  if (!inquiry.guest_id) {
    alert('Za ovog korisnika nije vezan guest nalog (guest_id nedostaje).')
    return
  }

  const rejectedCount = Number(inquiry.guest_rejected_inquiries || 0)
  const voucherTitle = rejectedCount >= 2
    ? 'Loyalty popust 15% (ponovni upit)'
    : 'Loyalty popust 10% (ponovni upit)'

  if (!confirm(`Dodeliti vaučer "${voucherTitle}" gostu "${inquiry.sender_name}"?`)) return

  voucherLoading.value = inquiry.id
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/guests/${inquiry.guest_id}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: voucherTitle })
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(`Greška pri dodeli vaučera:\n${data.error || res.statusText}`)
      return
    }

    alert(`Vaučer je uspešno dodeljen gostu ${inquiry.sender_name}.`)

    const vouchers = parseVouchers(inquiry)
    vouchers.push({
      id: data.voucherId || `local-${Date.now()}`,
      title: voucherTitle,
      status: 'active',
      created_at: new Date().toISOString()
    })
    inquiry.guest_vouchers = JSON.stringify(vouchers)
  } catch (err) {
    alert(`Greška pri komunikaciji sa serverom:\n${err.message}`)
  } finally {
    voucherLoading.value = null
  }
}
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
        <router-link to="/admin/rezervacije" class="active">Упити/Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
        <router-link to="/admin/mapa-soba">Мапа Соба</router-link>
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

      <div class="table-tools">
        <div class="quick-filters-wrap">
          <div class="quick-filters">
            <button class="quick-btn" :class="{ active: quickFilter === 'all' }" @click="quickFilter = 'all'">Sve</button>
            <button class="quick-btn" :class="{ active: quickFilter === 'with-rejections' }" @click="quickFilter = 'with-rejections'">Ranije odbijani</button>
            <button class="quick-btn" :class="{ active: quickFilter === 'without-rejections' }" @click="quickFilter = 'without-rejections'">Bez odbijanja</button>
            <button class="quick-btn" :class="{ active: quickFilter === 'voucher-assigned' }" @click="quickFilter = 'voucher-assigned'">Ima loyalty vaučer</button>
            <button class="quick-btn" :class="{ active: quickFilter === 'voucher-missing' }" @click="quickFilter = 'voucher-missing'">Bez loyalty vaučera</button>
          </div>
          <div class="saved-views">
            <span class="saved-title">Pogledi:</span>
            <button
              v-for="view in fixedViews"
              :key="`fixed-${view.name}`"
              class="saved-btn"
              @click="applySavedView(view)"
            >{{ view.name }}</button>
            <button
              v-for="(view, idx) in savedViews"
              :key="`saved-${view.name}-${idx}`"
              class="saved-btn"
              @click="applySavedView(view)"
              :title="`Status: ${view.filterStatus}, Quick: ${view.quickFilter}`"
            >{{ view.name }}</button>
            <button class="saved-btn save" @click="saveCurrentView">+ Sačuvaj trenutni</button>
            <button v-if="savedViews.length" class="saved-btn danger" @click="removeSavedView(0)">Ukloni poslednji</button>
          </div>
        </div>
        <div class="tools-right">
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="Pretraga: ime, email, telefon, soba..."
          />
          <button class="export-btn" @click="exportFilteredCsv">⬇ CSV ({{ filteredInquiries.length }})</button>
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
            <template v-for="inq in filteredInquiries" :key="inq.id">
              <tr :class="{ 'row-novo': inq.status === 'novo' }">
                <td class="id-col">{{ inq.id }}</td>
                <td>
                  <strong>{{ inq.sender_name }}</strong>
                  <p v-if="inq.message" class="msg-preview">{{ inq.message.slice(0, 60) }}{{ inq.message.length > 60 ? '...' : '' }}</p>
                  <div v-if="hasRejectionHistory(inq)" class="history-hint" :title="`Ukupno upita: ${inq.guest_total_inquiries}`">
                    ⚠️ Ranije odbijan: {{ inq.guest_rejected_inquiries }}x
                    <span class="crm-tip">CRM hint: razmotri vaučer/popust</span>
                  </div>
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
                  <div v-if="inq.status === 'odbijeno' && inq.rejection_reason" class="reject-reason">
                    {{ inq.rejection_reason }}
                  </div>
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

                    <button
                      v-if="hasRejectionHistory(inq)"
                      class="action-btn voucher"
                      :disabled="voucherLoading === inq.id"
                      @click="assignLoyaltyVoucher(inq)"
                    >{{ voucherLoading === inq.id ? '⏳ Dodela...' : '🎁 Dodeli loyalty vaučer' }}</button>

                    <button
                      class="action-btn timeline"
                      :disabled="activityLoading === inq.id"
                      @click="toggleActivity(inq)"
                    >{{ activityLoading === inq.id ? '⏳ Učitavam...' : (activityOpen[inq.id] ? '📜 Sakrij istoriju' : '📜 Prikaži istoriju') }}</button>

                    <span v-if="['odbijeno', 'otkazano'].includes(inq.status) && !hasRejectionHistory(inq)" class="muted">—</span>
                  </div>
                </td>
              </tr>

              <tr v-if="activityOpen[inq.id]" class="activity-row">
                <td colspan="8">
                  <div class="activity-box">
                    <div class="activity-columns">
                      <div>
                        <h4>Istorija upita</h4>
                        <div v-if="!(activityData[inq.id]?.inquiryHistory || []).length" class="muted">Nema podataka.</div>
                        <ul v-else class="timeline-list">
                          <li v-for="h in activityData[inq.id].inquiryHistory" :key="`iq-${inq.id}-${h.id}`">
                            <strong>#{{ h.id }}</strong> · {{ statusLabelShort(h.status) }} ·
                            {{ formatDate(h.check_in) }} → {{ formatDate(h.check_out) }} ·
                            {{ formatDate(h.created_at) }}
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h4>Istorija rezervacija</h4>
                        <div v-if="!(activityData[inq.id]?.reservationHistory || []).length" class="muted">Nema podataka.</div>
                        <ul v-else class="timeline-list">
                          <li v-for="r in activityData[inq.id].reservationHistory" :key="`rs-${inq.id}-${r.id}`">
                            <strong>#{{ r.id }}</strong> · {{ statusLabelShort(r.status) }} ·
                            {{ formatDate(r.start_date) }} → {{ formatDate(r.end_date) }} ·
                            upit {{ r.inquiry_id }}
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
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
  .table-tools {
    flex-direction: column;
    align-items: stretch;
  }
  .tools-right {
    width: 100%;
    justify-content: space-between;
  }
  .export-btn {
    width: 100%;
  }
  .activity-columns {
    grid-template-columns: 1fr;
  }
  .search-input {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
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

.table-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.quick-filters-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.saved-views {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.saved-title {
  font-size: 0.75rem;
  color: #8d6e63;
  font-weight: 700;
}

.saved-btn {
  border: 1px solid #d7c5b5;
  background: #fffdf9;
  color: #6d4c41;
  padding: 5px 8px;
  font-size: 0.74rem;
  font-weight: 700;
  cursor: pointer;
}

.saved-btn.save {
  background: #f2eadf;
}

.saved-btn.danger {
  background: #fff1f1;
  color: #9d2d2d;
}

.quick-btn {
  border: 1px solid #d7c5b5;
  background: #fff;
  color: #6d4c41;
  padding: 7px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.quick-btn.active {
  background: #6d4c41;
  color: #f3e9df;
  border-color: #6d4c41;
}

.search-input {
  min-width: 260px;
  padding: 8px 10px;
  border: 1px solid #d8cec4;
  background: #fff;
  font-size: 0.86rem;
}

.tools-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.export-btn {
  border: 1px solid #bfa58f;
  background: #4e342e;
  color: #f7e7d3;
  padding: 8px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

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
.history-hint {
  margin-top: 6px;
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  background: #fff8e1;
  border-left: 3px solid #f39c12;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: #8a5a00;
}
.crm-tip {
  font-size: 0.72rem;
  color: #b06500;
}
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
.reject-reason {
  margin-top: 6px;
  max-width: 220px;
  font-size: 0.74rem;
  color: #8b1e1e;
  line-height: 1.35;
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
.action-btn.voucher { background: #b9770e; color: #fff; }
.action-btn.voucher:hover { opacity: 0.85; }
.action-btn.timeline { background: #795548; color: #fff; }
.action-btn.timeline:hover { opacity: 0.85; }

.activity-row td {
  background: #faf7f3;
  border-bottom: 1px solid #e9dfd6;
}

.activity-box {
  padding: 10px 12px;
}

.activity-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.activity-columns h4 {
  margin: 0 0 8px;
  color: #5d4037;
  font-size: 0.9rem;
}

.timeline-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.82rem;
  color: #4e342e;
}

.loading-msg, .empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 1.1rem;
}
</style>
