<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'
import { fmt } from '../../utils/dateFormat'

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

const fetchInquiries = async () => {
  isLoading.value = true
  try {
    inquiries.value = await api.getInquiries()
  } catch (err) {
    if (err.status === 401) { router.push('/admin/login'); return }
    console.error('Greška pri učitavanju upita:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchInquiries()
  try {
    savedViews.value = JSON.parse(localStorage.getItem('admin_inquiry_saved_views')) || []
  } catch {
    savedViews.value = []
  }
})

const handleLogout = () => { api.logout(); router.push('/admin/login') }

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
    if (filterStatus.value !== 'sve' && i.status !== filterStatus.value) return false

    if (quickFilter.value !== 'all') {
      const rejections = Number(i.guest_rejected_inquiries || 0)
      if (quickFilter.value === 'with-rejections' && rejections === 0) return false
      if (quickFilter.value === 'without-rejections' && rejections > 0) return false
      
      const hasVoucher = hasLoyaltyVoucher(i)
      if (quickFilter.value === 'voucher-assigned' && !hasVoucher) return false
      if (quickFilter.value === 'voucher-missing' && hasVoucher) return false
    }

    return matchesSearch(i, q)
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
    await api.updateInquiryStatus(inquiry.id, newStatus)
    const idx = inquiries.value.findIndex(i => i.id === inquiry.id)
    if (idx !== -1) inquiries.value[idx].status = newStatus
  } catch (err) {
    if (err.status === 409 && err.data?.autoRejected) {
      const idx = inquiries.value.findIndex(i => i.id === inquiry.id)
      if (idx !== -1) inquiries.value[idx].status = err.data.newStatus || 'odbijeno'
      alert(`Termin je u međuvremenu zauzet i ovaj upit je automatski odbijen.\n${err.data.error || ''}`)
      return
    }
    alert(`Greška pri promeni statusa:\n${err.data?.error || err.message}`)
  } finally {
    actionLoading.value = null
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_LABELS = { novo: '🔔 Novo', obradjeno: '✅ Odobreno', odbijeno: '❌ Odbijeno', otkazano: '🚫 Otkazano' }
const STATUS_CLASSES = { novo: 'badge-novo', obradjeno: 'badge-ok', odbijeno: 'badge-bad', otkazano: 'badge-cancel' }
const STATUS_SHORT = { novo: 'Novo', obradjeno: 'Odobreno', odbijeno: 'Odbijeno', otkazano: 'Otkazano', pending: 'Pending', confirmed: 'Confirmed', cancelled: 'Cancelled' }

const statusLabel = (s) => STATUS_LABELS[s] || s
const statusClass = (s) => STATUS_CLASSES[s] || ''
const statusLabelShort = (s) => STATUS_SHORT[s] || s

const hasRejectionHistory = (inq) => Number(inq.guest_rejected_inquiries || 0) > 0

const toggleActivity = async (inquiry) => {
  const id = inquiry.id
  if (activityOpen.value[id]) { activityOpen.value[id] = false; return }

  if (!activityData.value[id]) {
    activityLoading.value = id
    try {
      activityData.value[id] = await api.getInquiryActivity(id)
    } catch (err) {
      alert(`Ne mogu da učitam istoriju:\n${err.data?.error || err.message}`)
      return
    } finally {
      activityLoading.value = null
    }
  }
  activityOpen.value[id] = true
}

const assignLoyaltyVoucher = async (inquiry) => {
  if (!inquiry.guest_id) { alert('Za ovog korisnika nije vezan guest nalog (guest_id nedostaje).'); return }

  const rejectedCount = Number(inquiry.guest_rejected_inquiries || 0)
  const voucherTitle = rejectedCount >= 2 ? 'Loyalty popust 15% (ponovni upit)' : 'Loyalty popust 10% (ponovni upit)'
  if (!confirm(`Dodeliti vaučer "${voucherTitle}" gostu "${inquiry.sender_name}"?`)) return

  voucherLoading.value = inquiry.id
  try {
    const data = await api.addVoucher(inquiry.guest_id, { title: voucherTitle })
    alert(`Vaučer je uspešno dodeljen gostu ${inquiry.sender_name}.`)
    const vouchers = parseVouchers(inquiry)
    vouchers.push({ id: data.voucherId || `local-${Date.now()}`, title: voucherTitle, status: 'active', created_at: new Date().toISOString() })
    inquiry.guest_vouchers = JSON.stringify(vouchers)
  } catch (err) {
    alert(`Greška pri dodeli vaučera:\n${err.data?.error || err.message}`)
  } finally {
    voucherLoading.value = null
  }
}
</script>

<template>
  <AdminLayout>

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
                    <span class="date-from">{{ fmt(inq.check_in) }}</span>
                    <span class="date-arrow"> → </span>
                    <span class="date-to">{{ fmt(inq.check_out) }}</span>
                  </div>
                  <span v-else class="muted">—</span>
                </td>
                <td class="muted">{{ fmt(inq.created_at) }}</td>
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
                            {{ fmt(h.check_in) }} → {{ fmt(h.check_out) }} ·
                            {{ fmt(h.created_at) }}
                          </li>
                        </ul>
                      </div>
                      <div>
                        <h4>Istorija rezervacija</h4>
                        <div v-if="!(activityData[inq.id]?.reservationHistory || []).length" class="muted">Nema podataka.</div>
                        <ul v-else class="timeline-list">
                          <li v-for="r in activityData[inq.id].reservationHistory" :key="`rs-${inq.id}-${r.id}`">
                            <strong>#{{ r.id }}</strong> · {{ statusLabelShort(r.status) }} ·
                            {{ fmt(r.start_date) }} → {{ fmt(r.end_date) }} ·
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
  </AdminLayout>
</template>

<style scoped>

/* MAIN */

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
.id-col { color: #aaa; font-size: 0.85rem; }
.msg-preview { color: #888; font-size: 0.82rem; margin: 4px 0 0 0; font-style: italic; }
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



@media (min-width: 769px) {
  .mobile-topbar { display: none; }
}
</style>
