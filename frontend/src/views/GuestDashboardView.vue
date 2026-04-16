<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGuestStore } from '../stores/guest'

const router = useRouter()
const guestStore = useGuestStore()

const reservations = ref([])
const isLoading = ref(true)
const activeTab = ref('rezervacije') // 'rezervacije' | 'lozinka'

// Password change
const pwForm = ref({ current: '', new: '', confirm: '' })
const pwError = ref('')
const pwSuccess = ref('')
const pwLoading = ref(false)

// Cancel
const cancelError = ref('')
const cancellingId = ref(null)

// Vouchers
const voucherLoading = ref(null)

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const fmt = (d) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const daysUntil = (d) => {
  if (!d) return null
  const t = new Date(d + 'T12:00:00')
  const now = new Date(); now.setHours(12,0,0,0)
  return Math.round((t - now) / 86400000)
}

const statusLabel = (inq, res) => {
  if (res && res.reservation_status === 'cancelled') return { text: 'Otkazano', cls: 'cancelled' }
  if (inq === 'obradjeno' && res) return { text: 'Odobreno ✓', cls: 'approved' }
  if (inq === 'odbijeno') return { text: 'Odbijeno', cls: 'rejected' }
  if (inq === 'otkazano') return { text: 'Otkazano', cls: 'cancelled' }
  return { text: 'U obradi...', cls: 'pending' }
}

const canCancel = (row) => {
  if (!row.cancel_token) return false
  if (row.reservation_status === 'cancelled') return false
  if (row.inquiry_status !== 'obradjeno') return false
  return daysUntil(row.res_start) >= 7
}

// Datum krajnjeg roka za otkazivanje (checkin - 7 dana)
const cancelDeadline = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 7)
  return fmt(d.toISOString().split('T')[0])
}

const cancelDeadlinePassed = (dateStr) => {
  if (!dateStr) return false
  return daysUntil(dateStr) < 7
}

onMounted(async () => {
  if (!guestStore.isLoggedIn) {
    router.push('/prijava')
    return
  }
  await guestStore.fetchMe()
  try {
    const res = await fetch(`${BASE}/api/guests/reservations`, {
      headers: guestStore.authHeaders()
    })
    if (!res.ok) { guestStore.logout(); router.push('/prijava'); return }
    reservations.value = await res.json()
  } finally {
    isLoading.value = false
  }
})

const cancelReservation = async (row) => {
  if (!confirm('Da li ste sigurni da želite da otkažete rezervaciju?')) return
  cancelError.value = ''
  cancellingId.value = row.inquiry_id
  try {
    const res = await fetch(`${BASE}/api/cancel/${row.cancel_token}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { cancelError.value = data.error; return }
    // Refresh
    const updated = await fetch(`${BASE}/api/guests/reservations`, { headers: guestStore.authHeaders() })
    reservations.value = await updated.json()
  } finally {
    cancellingId.value = null
  }
}

const redeemVoucher = async (voucher) => {
  if (!confirm(`Iskoristi vaučer "${voucher.title}"?\nUPOZORENJE: Molimo Vas da ovo potvrdite samo u letu pred osobljem restorana ili recepcije!`)) return
  voucherLoading.value = voucher.id
  try {
    const res = await fetch(`${BASE}/api/guests/vouchers/${voucher.id}/redeem`, {
      method: 'POST',
      headers: guestStore.authHeaders()
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    // Update local state
    if (guestStore.guest) {
      guestStore.guest.vouchers = data.vouchers
    }
  } catch (err) {
    alert("Greška: " + err.message)
  } finally {
    voucherLoading.value = null
  }
}

const changePassword = async () => {
  pwError.value = ''; pwSuccess.value = ''
  if (!pwForm.value.current || !pwForm.value.new) { pwError.value = 'Popunite sva polja.'; return }
  if (pwForm.value.new !== pwForm.value.confirm) { pwError.value = 'Nova lozinka i potvrda se ne poklapaju.'; return }
  if (pwForm.value.new.length < 6) { pwError.value = 'Lozinka mora imati najmanje 6 znakova.'; return }
  pwLoading.value = true
  try {
    const res = await fetch(`${BASE}/api/guests/password`, {
      method: 'PUT',
      headers: guestStore.authHeaders(),
      body: JSON.stringify({ currentPassword: pwForm.value.current, newPassword: pwForm.value.new })
    })
    const data = await res.json()
    if (!res.ok) { pwError.value = data.error; return }
    pwSuccess.value = 'Lozinka uspešno promenjena!'
    pwForm.value = { current: '', new: '', confirm: '' }
  } finally {
    pwLoading.value = false
  }
}

const handleLogout = () => {
  guestStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-brand">НАСТАВНА БАЗА ГОЧ</div>
      <div class="dash-user">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <span>{{ guestStore.guest?.name || '...' }}</span>
        <button class="btn-logout" @click="handleLogout">Одјави се</button>
      </div>
    </div>

    <div class="dash-content">
      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', activeTab === 'rezervacije' ? 'active' : '']" @click="activeTab = 'rezervacije'">
          📋 Моје резервације
        </button>
        <button :class="['tab', activeTab === 'vauceri' ? 'active' : '']" @click="activeTab = 'vauceri'">
          <span class="tab-badge" v-if="guestStore.guest?.vouchers && guestStore.guest.vouchers.length">{{ guestStore.guest.vouchers.filter(v=>v.status==='active').length || '' }}</span>
          🎁 Моји Ваучери
        </button>
        <button :class="['tab', activeTab === 'lozinka' ? 'active' : '']" @click="activeTab = 'lozinka'">
          🔒 Промена лозинке
        </button>
      </div>

      <!-- Rezervacije tab -->
      <div v-if="activeTab === 'rezervacije'">
        <div v-if="isLoading" class="loading">Учитавам резервације...</div>

        <div v-else-if="reservations.length === 0" class="empty-state">
          <p>Немате резервација.</p>
          <router-link to="/smestaj" class="btn-primary-sm">Погледај смештај →</router-link>
        </div>

        <div v-else class="res-list">
          <p v-if="cancelError" class="error-msg">{{ cancelError }}</p>
          
          <div v-for="row in reservations" :key="row.inquiry_id" class="res-card">
            <div class="res-card-header">
              <div>
                <strong>{{ row.facility_name || '—' }}</strong>
                <span class="room-name"> / {{ row.room_name || '—' }}</span>
              </div>
              <span :class="['badge', statusLabel(row.inquiry_status, row).cls]">
                {{ statusLabel(row.inquiry_status, row).text }}
              </span>
            </div>

            <div class="res-card-body">
              <div class="date-row">
                <span>📅 Долазак: <strong>{{ fmt(row.check_in || row.res_start) }}</strong></span>
                <span>📅 Одлазак: <strong>{{ fmt(row.check_out || row.res_end) }}</strong></span>
              </div>
              <div class="date-row meta">
                <span>Уpit: {{ new Date(row.created_at).toLocaleDateString('sr-RS') }}</span>
                <span v-if="row.res_start && daysUntil(row.res_start) > 0">
                  За {{ daysUntil(row.res_start) }} дана
                </span>
              </div>
            </div>

            <!-- Footer sa cancel info - uvek prikazujemo za odobrene rezervacije -->
            <div
              v-if="row.inquiry_status === 'obradjeno' && row.reservation_status !== 'cancelled'"
              class="res-card-footer"
              :class="cancelDeadlinePassed(row.res_start) ? 'footer-locked' : 'footer-open'"
            >
              <template v-if="canCancel(row)">
                <button
                  class="btn-cancel"
                  @click="cancelReservation(row)"
                  :disabled="cancellingId === row.inquiry_id"
                >
                  {{ cancellingId === row.inquiry_id ? 'Отказујем...' : '🚫 Откажи резервацију' }}
                </button>
                <span class="cancel-note">
                  ✅ Бесплатно отказивање до <strong>{{ cancelDeadline(row.res_start) }}</strong>
                </span>
              </template>
              <template v-else>
                <span class="cancel-icon">🔒</span>
                <span class="cancel-blocked">
                  Отказивање није могуће — рок је истекао {{ cancelDeadline(row.res_start) }}.
                  За помоћ контактирајте нас.
                </span>
              </template>
            </div>
          </div>
        </div>

        <!-- UPSELL / RECOMMENDED -->
        <div v-if="guestStore.guest?.vouchers?.length || reservations.length > 0" class="recommendation-box">
          <div class="rec-icon">🌲</div>
          <div class="rec-text">
            <h3>Препорука за следећи обилазак</h3>
            <p>Нови Студенац је реновиран! Изненадите се погледом на језеро уз промотивни смештај.</p>
          </div>
          <router-link to="/smestaj" class="btn-primary-sm" style="border-radius:0;">Погледај</router-link>
        </div>
      </div>

      <!-- Vauceri Tab -->
      <div v-if="activeTab === 'vauceri'">
        <div v-if="!guestStore.guest?.vouchers || guestStore.guest.vouchers.length === 0" class="empty-state">
          <p>Тренутно немате доступних ваучера.</p>
          <p class="muted" style="margin-top:10px;">Ваучери се додељују лојалним гостима и током специјалних акција.</p>
        </div>
        <div v-else class="vouchers-grid">
          <div v-for="voucher in guestStore.guest.vouchers" :key="voucher.id" :class="['voucher-card', voucher.status === 'redeemed' ? 'is-redeemed' : 'is-active']">
            <div class="v-header">
              <span class="v-tag">EXCLUSIVE POKLON</span>
              <span v-if="voucher.status === 'redeemed'" class="v-status">Искоришћено</span>
            </div>
            <h3>{{ voucher.title }}</h3>
            <p>{{ voucher.description }}</p>
            
            <div class="v-footer">
              <span class="v-code">#{{ voucher.id.toUpperCase() }}</span>
              <button v-if="voucher.status === 'active'" class="btn-redeem" @click="redeemVoucher(voucher)" :disabled="voucherLoading === voucher.id">
                 {{ voucherLoading === voucher.id ? 'Обрада...' : 'Искористи' }}
              </button>
              <div v-if="voucher.status === 'redeemed'" class="redeem-stamp">
                 ✅ Искоришћено: <br/>{{ new Date(voucher.redeemed_at).toLocaleString('sr-RS') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Lozinka tab -->
      <div v-if="activeTab === 'lozinka'" class="pw-form">
        <h2>Промена лозинке</h2>
        <div class="form-group">
          <label>Тренутна лозинка</label>
          <input v-model="pwForm.current" type="password" placeholder="••••••••" />
        </div>
        <div class="form-group">
          <label>Нова лозинка</label>
          <input v-model="pwForm.new" type="password" placeholder="Мин. 6 знакова" />
        </div>
        <div class="form-group">
          <label>Потврди нову лозинку</label>
          <input v-model="pwForm.confirm" type="password" placeholder="••••••••" />
        </div>
        <p v-if="pwError" class="error-msg">{{ pwError }}</p>
        <p v-if="pwSuccess" class="success-msg">{{ pwSuccess }}</p>
        <button class="btn-primary-full" @click="changePassword" :disabled="pwLoading">
          {{ pwLoading ? 'Чувам...' : 'САЧУВАЈ НОВУ ЛОЗИНКУ' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  background: #f5f3f0;
}

.dash-header {
  background: #332317;
  padding: 0 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 56px;
}

.dash-brand {
  color: #cdac91;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 2px;
}

.dash-user {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #e8e0d8;
  font-size: 0.9rem;
}

.btn-logout {
  background: transparent;
  border: 1px solid #cdac91;
  color: #cdac91;
  padding: 4px 12px;
  font-size: 0.8rem;
  cursor: pointer;
  letter-spacing: 0.5px;
  border-radius: 0;
}
.btn-logout:hover { background: #cdac91; color: #332317; }

.dash-content {
  max-width: 720px;
  margin: 30px auto;
  padding: 0 20px;
}

.tabs {
  display: flex;
  border-bottom: 2px solid #332317;
  margin-bottom: 25px;
}

.tab {
  padding: 12px 22px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #888;
  border-radius: 0;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}
.tab.active {
  color: #332317;
  border-bottom-color: #332317;
  font-weight: bold;
}

.loading, .empty-state {
  text-align: center;
  padding: 50px;
  color: #888;
}

.res-list { display: flex; flex-direction: column; gap: 15px; }

.res-card {
  background: #fff;
  border: 1px solid #e8e0d8;
  border-left: 4px solid #cdac91;
}

.res-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 18px 10px;
  border-bottom: 1px solid #f0ebe4;
}
.room-name { color: #888; font-size: 0.9rem; }

.badge {
  font-size: 0.75rem;
  padding: 3px 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
}
.badge.pending { background: #fff3e0; color: #e65100; }
.badge.approved { background: #e8f5e9; color: #2e7d32; }
.badge.rejected { background: #fce4ec; color: #c62828; }
.badge.cancelled { background: #eceff1; color: #546e7a; }

.res-card-body { padding: 12px 18px; }
.date-row { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 5px; font-size: 0.9rem; }
.date-row.meta { font-size: 0.8rem; color: #aaa; }

.res-card-footer {
  padding: 12px 18px;
  background: #fdf8f3;
  border-top: 1px solid #f0ebe4;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.btn-cancel {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
  border-radius: 0;
}
.btn-cancel:disabled { background: #ccc; cursor: not-allowed; }
.cancel-note { font-size: 0.78rem; color: #2e7d32; }

.footer-open { background: #f0f9f0; border-top-color: #c8e6c9; }
.footer-locked { background: #fff8f0; border-top-color: #ffe0b2; }

.cancel-icon { font-size: 1rem; }
.cancel-blocked { font-size: 0.82rem; color: #bf6000; line-height: 1.4; }

/* Password form */
.pw-form {
  background: #fff;
  border: 1px solid #e8e0d8;
  padding: 30px;
}
.pw-form h2 { color: #332317; margin: 0 0 25px; }

.form-group { margin-bottom: 18px; }
.form-group label {
  display: block;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  font-weight: 600;
  margin-bottom: 6px;
}
.form-group input {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #ddd;
  font-size: 0.95rem;
  outline: none;
  border-radius: 0;
  box-sizing: border-box;
}
.form-group input:focus { border-color: #cdac91; }

.btn-primary-full {
  width: 100%;
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 13px;
  font-weight: bold;
  font-size: 0.9rem;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 0;
}
.btn-primary-full:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary-sm {
  display: inline-block;
  background: #332317;
  color: #cdac91;
  padding: 10px 20px;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: bold;
  margin-top: 10px;
}

.error-msg { color: #e74c3c; font-size: 0.85rem; margin-bottom: 10px; }
.success-msg { color: #27ae60; font-size: 0.85rem; margin-bottom: 10px; background: #e8f5e9; padding: 10px; }

@media (max-width: 600px) {
  .dash-header { padding: 0 15px; }
  .dash-brand { font-size: 0.65rem; }
  .date-row { flex-direction: column; gap: 4px; }
}

/* TAB BADGE */
.tab { position: relative; }
.tab-badge { position: absolute; top: 0px; right: 0px; background: #d81b60; color: white; font-size: 0.65rem; padding: 2px 5px; font-weight: bold; }

/* RECOMMENDATION BOX */
.recommendation-box {
  margin-top: 30px;
  background: #fffdf5;
  border: 1px dashed #e67e22;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.rec-icon { font-size: 2rem; }
.rec-text h3 { margin: 0 0 5px 0; font-size: 1.1rem; color: #e67e22; }
.rec-text p { margin: 0; font-size: 0.9rem; color: #555; }
.btn-primary-sm { background: #e67e22; color: #fff; text-decoration: none; padding: 10px 15px; font-weight: bold; font-size: 0.85rem; white-space: nowrap; transition: 0.2s; }
.btn-primary-sm:hover { background: #d35400; }

/* VOUCHERS */
.vouchers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
.voucher-card {
  background: #fff;
  border: 2px dashed #cdac91;
  padding: 20px;
  position: relative;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.voucher-card.is-active { border-color: #d81b60; box-shadow: 0 4px 10px rgba(216,27,96,0.1); }
.voucher-card.is-redeemed { border-color: #ccc; opacity: 0.7; }
.v-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
.v-tag { background: #332317; color: #cdac91; font-size: 0.7rem; padding: 3px 8px; font-weight: bold; letter-spacing: 1px; }
.v-status { background: #eee; color: #666; font-size: 0.7rem; padding: 3px 8px; font-weight: bold; }
.voucher-card h3 { margin: 0 0 10px; color: #d81b60; font-size: 1.2rem; }
.is-redeemed h3 { color: #888; }
.voucher-card p { margin: 0 0 20px; font-size: 0.9rem; color: #555; flex: 1; }
.v-footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #f0ebe4; padding-top: 15px; }
.v-code { font-family: monospace; font-size: 0.95rem; font-weight: bold; color: #888; }
.btn-redeem { background: #d81b60; color: #fff; border: none; padding: 8px 15px; font-weight: bold; cursor: pointer; border-radius: 0; transition: background 0.2s; }
.btn-redeem:hover { background: #ad1457; }
.btn-redeem:disabled { opacity: 0.5; }
.redeem-stamp { font-size: 0.75rem; color: #2e7d32; font-weight: bold; text-align: right; }
</style>
