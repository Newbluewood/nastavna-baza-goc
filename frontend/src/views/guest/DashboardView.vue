<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGuestStore } from '../../stores/guest'
import { useLangStore } from '../../stores/lang'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import api from '../../services/api'
import PasswordInput from '../../components/ui/PasswordInput.vue'

const router = useRouter()
const guestStore = useGuestStore()
const langStore = useLangStore()

const reservations = ref([])
const isLoading = ref(true)
const activeTab = ref('rezervacije')

const pwForm = ref({ current: '', new: '', confirm: '' })
const pwError = ref('')
const pwSuccess = ref('')
const pwLoading = ref(false)

const cancelError = ref('')
const cancellingId = ref(null)

const voucherLoading = ref(null)

const isModalOpen = ref(false)
const selectedReservation = ref(null)
const modalDateRange = ref(null)
const modalError = ref('')
const modalLoading = ref(false)

const normalizeDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const raw = String(value).trim()
  if (!raw) return null
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (ymd) {
    const parsed = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const fmt = (d) => {
  const parsed = normalizeDate(d)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const daysUntil = (d) => {
  const t = normalizeDate(d)
  if (!t) return null
  const now = new Date(); now.setHours(12,0,0,0)
  return Math.round((t - now) / 86400000)
}

const statusLabel = (inq, res) => {
  if (res && res.reservation_status === 'cancelled') return { text: langStore.t('guest.statusCancelled'), cls: 'cancelled' }
  if (inq === 'obradjeno' && res) return { text: langStore.t('guest.statusApproved'), cls: 'approved' }
  if (inq === 'odbijeno') return { text: langStore.t('guest.statusRejected'), cls: 'rejected' }
  if (inq === 'otkazano') return { text: langStore.t('guest.statusCancelled'), cls: 'cancelled' }
  return { text: langStore.t('guest.statusPending'), cls: 'pending' }
}

const canModifyOrCancel = (row) => {
  if (row.reservation_status === 'cancelled') return false
  if (row.inquiry_status !== 'obradjeno') return false
  return daysUntil(row.res_start) >= 7
}

const canModifyDates = (row) => {
  if (row.reservation_status === 'cancelled') return false
  if (row.inquiry_status !== 'novo' && row.inquiry_status !== 'obradjeno') return false
  return true
}

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

const loadReservations = async () => {
  reservations.value = await api.getGuestReservations()
}

onMounted(async () => {
  if (!guestStore.isLoggedIn) { router.push({ name: 'prijava' }); return }
  await guestStore.fetchMe()
  try {
    await loadReservations()
  } catch {
    guestStore.logout(); router.push({ name: 'prijava' })
  } finally {
    isLoading.value = false
  }
})

const cancelReservation = async (row) => {
  if (!confirm(langStore.t('guest.confirmCancel'))) return
  cancelError.value = ''
  cancellingId.value = row.inquiry_id
  try {
    await api.cancelReservation(row.cancel_token)
    await loadReservations()
  } catch (e) {
    cancelError.value = e.data?.error || langStore.t('guest.cancelError')
  } finally {
    cancellingId.value = null
  }
}

const openChangeModal = (row) => {
  if (!canModifyDates(row)) {
    alert(langStore.t('guest.cannotChangeDates'))
    return
  }
  selectedReservation.value = row
  modalDateRange.value = null
  modalError.value = ''
  isModalOpen.value = true
}

const closeChangeModal = () => {
  isModalOpen.value = false
  selectedReservation.value = null
  modalDateRange.value = null
  modalError.value = ''
}

const submitChangeDates = async () => {
  if (!selectedReservation.value || !modalDateRange.value || modalDateRange.value.length !== 2) {
    modalError.value = langStore.t('guest.pickStayDates')
    return
  }
  modalError.value = ''
  modalLoading.value = true
  try {
    const dt1 = new Date(modalDateRange.value[0])
    const dt2 = new Date(modalDateRange.value[1])
    dt1.setMinutes(dt1.getMinutes() - dt1.getTimezoneOffset())
    dt2.setMinutes(dt2.getMinutes() - dt2.getTimezoneOffset())
    const checkIn = dt1.toISOString().split('T')[0]
    const checkOut = dt2.toISOString().split('T')[0]
    const wasApproved = selectedReservation.value.inquiry_status === 'obradjeno'

    await api.updateReservationDates(selectedReservation.value.inquiry_id, checkIn, checkOut)
    await loadReservations()
    closeChangeModal()
    alert(wasApproved ? langStore.t('guest.datesChangedReview') : langStore.t('guest.datesChanged'))
  } catch (err) {
    modalError.value = err.data?.error || err.message
  } finally {
    modalLoading.value = false
  }
}

const redeemVoucher = async (voucher) => {
  if (!confirm(langStore.t('guest.redeemConfirm').replace('{title}', voucher.title))) return
  voucherLoading.value = voucher.id
  try {
    const data = await api.redeemVoucher(voucher.id)
    if (guestStore.guest) guestStore.guest.vouchers = data.vouchers
  } catch (err) {
    alert(langStore.t('common.error') + ': ' + err.message)
  } finally {
    voucherLoading.value = null
  }
}

const changePassword = async () => {
  pwError.value = ''; pwSuccess.value = ''
  if (!pwForm.value.current || !pwForm.value.new) { pwError.value = langStore.t('guest.fillAllFields'); return }
  if (pwForm.value.new !== pwForm.value.confirm) { pwError.value = langStore.t('guest.passwordMismatch'); return }
  if (pwForm.value.new.length < 6) { pwError.value = langStore.t('guest.passwordTooShort'); return }
  pwLoading.value = true
  try {
    await api.updateGuestPassword({ currentPassword: pwForm.value.current, newPassword: pwForm.value.new })
    pwSuccess.value = langStore.t('guest.passwordChanged')
    pwForm.value = { current: '', new: '', confirm: '' }
  } catch (err) {
    pwError.value = err.data?.error || err.message
  } finally {
    pwLoading.value = false
  }
}

const handleLogout = () => { guestStore.logout(); router.push({ name: 'home' }) }
</script>

<template>
  <div class="dashboard-page">
    <!-- Header -->
    <div class="dash-header">
      <div class="dash-brand">{{ langStore.t('guest.brand') }}</div>
      <div class="dash-user">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
        <span>{{ guestStore.guest?.name || '...' }}</span>
        <button class="btn-logout" @click="handleLogout">{{ langStore.t('guest.logout') }}</button>
      </div>
    </div>

    <div class="dash-content">
      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', activeTab === 'rezervacije' ? 'active' : '']" @click="activeTab = 'rezervacije'">
          {{ langStore.t('guest.tabReservations') }}
        </button>
        <button :class="['tab', activeTab === 'vauceri' ? 'active' : '']" @click="activeTab = 'vauceri'">
          <span class="tab-badge" v-if="guestStore.guest?.vouchers && guestStore.guest.vouchers.length">{{ guestStore.guest.vouchers.filter(v=>v.status==='active').length || '' }}</span>
          {{ langStore.t('guest.tabVouchers') }}
        </button>
        <button :class="['tab', activeTab === 'lozinka' ? 'active' : '']" @click="activeTab = 'lozinka'">
          {{ langStore.t('guest.tabPassword') }}
        </button>
      </div>

      <!-- Rezervacije tab -->
      <div v-if="activeTab === 'rezervacije'">
        <div v-if="isLoading" class="loading">{{ langStore.t('guest.loadingReservations') }}</div>

        <div v-else-if="reservations.length === 0" class="empty-state">
          <p>{{ langStore.t('guest.noReservations') }}</p>
          <router-link :to="{ name: 'smestaj' }" class="btn-primary-sm">{{ langStore.t('guest.viewAccommodation') }}</router-link>
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
                <span>{{ langStore.t('guest.arrival') }} <strong>{{ fmt(row.check_in || row.res_start) }}</strong></span>
                <span>{{ langStore.t('guest.departure') }} <strong>{{ fmt(row.check_out || row.res_end) }}</strong></span>
              </div>
              <div class="date-row meta">
                <span>{{ langStore.t('guest.inquiryOn') }} {{ new Date(row.created_at).toLocaleDateString('sr-RS') }}</span>
                <span v-if="row.res_start && daysUntil(row.res_start) > 0">
                  {{ langStore.t('guest.inDays').replace('{n}', daysUntil(row.res_start)) }}
                </span>
              </div>
              <div v-if="row.inquiry_status === 'odbijeno' && row.rejection_reason" class="reject-reason">
                <strong>{{ langStore.t('guest.rejectionReason') }}</strong> {{ row.rejection_reason }}
              </div>
            </div>

            <!-- Footer sa cancel info - uvek prikazujemo za odobrene rezervacije -->
            <div
              v-if="row.inquiry_status === 'obradjeno' && row.reservation_status !== 'cancelled'"
              class="res-card-footer"
              :class="cancelDeadlinePassed(row.res_start) ? 'footer-locked' : 'footer-open'"
            >
              <template v-if="canModifyOrCancel(row)">
                <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                  <button
                    class="btn-cancel"
                    @click="cancelReservation(row)"
                    :disabled="cancellingId === row.inquiry_id"
                  >
                    {{ cancellingId === row.inquiry_id ? langStore.t('guest.cancelling') : langStore.t('guest.cancelReservation') }}
                  </button>
                  <button
                    class="btn-change"
                    @click="openChangeModal(row)"
                  >
                    {{ langStore.t('guest.changeDates') }}
                  </button>
                </div>
                <span class="cancel-note">
                  {{ langStore.t('guest.freeCancelUntil') }} <strong>{{ cancelDeadline(row.res_start) }}</strong>
                </span>
              </template>
              <template v-else>
                <span class="cancel-icon">🔒</span>
                <span class="cancel-blocked">
                  {{ langStore.t('guest.cancelBlocked').replace('{date}', cancelDeadline(row.res_start)) }}
                </span>
              </template>
            </div>

            <!-- Change dates button for "novo" status -->
            <div v-if="row.inquiry_status === 'novo' && row.reservation_status !== 'cancelled'" class="res-card-footer footer-novo">
              <button
                class="btn-change"
                @click="openChangeModal(row)"
              >
                {{ langStore.t('guest.changeDates') }}
              </button>
              <span class="change-note">{{ langStore.t('guest.changeBeforeReview') }}</span>
            </div>
          </div>
        </div>

        <!-- UPSELL / RECOMMENDED -->
        <div v-if="guestStore.guest?.vouchers?.length || reservations.length > 0" class="recommendation-box">
          <div class="rec-icon">🌲</div>
          <div class="rec-text">
            <h3>{{ langStore.t('guest.recommendTitle') }}</h3>
            <p>{{ langStore.t('guest.recommendText') }}</p>
          </div>
          <router-link :to="{ name: 'smestaj' }" class="btn-primary-sm" style="border-radius:0;">{{ langStore.t('guest.view') }}</router-link>
        </div>
      </div>

      <!-- Vauceri Tab -->
      <div v-if="activeTab === 'vauceri'">
        <div v-if="!guestStore.guest?.vouchers || guestStore.guest.vouchers.length === 0" class="empty-state">
          <p>{{ langStore.t('guest.noVouchers') }}</p>
          <p class="muted" style="margin-top:10px;">{{ langStore.t('guest.vouchersHint') }}</p>
        </div>
        <div v-else class="vouchers-grid">
          <div v-for="voucher in guestStore.guest.vouchers" :key="voucher.id" :class="['voucher-card', voucher.status === 'redeemed' ? 'is-redeemed' : 'is-active']">
            <div class="v-header">
              <span class="v-tag">{{ langStore.t('guest.exclusiveGift') }}</span>
              <span v-if="voucher.status === 'redeemed'" class="v-status">{{ langStore.t('guest.redeemed') }}</span>
            </div>
            <h3>{{ voucher.title }}</h3>
            <p>{{ voucher.description }}</p>
            
            <div class="v-footer">
              <span class="v-code">#{{ voucher.id.toUpperCase() }}</span>
              <button v-if="voucher.status === 'active'" class="btn-redeem" @click="redeemVoucher(voucher)" :disabled="voucherLoading === voucher.id">
                 {{ voucherLoading === voucher.id ? langStore.t('guest.processing') : langStore.t('guest.redeem') }}
              </button>
              <div v-if="voucher.status === 'redeemed'" class="redeem-stamp">
                 {{ langStore.t('guest.redeemedAt') }} <br/>{{ new Date(voucher.redeemed_at).toLocaleString('sr-RS') }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Lozinka tab -->
      <div v-if="activeTab === 'lozinka'" class="pw-form">
        <h2>{{ langStore.t('guest.changePasswordTitle') }}</h2>
        <div class="form-group">
          <label>{{ langStore.t('guest.currentPassword') }}</label>
          <PasswordInput v-model="pwForm.current" autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.newPassword') }}</label>
          <PasswordInput v-model="pwForm.new" :placeholder="langStore.t('guest.minChars')" autocomplete="new-password" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.confirmPassword') }}</label>
          <PasswordInput v-model="pwForm.confirm" autocomplete="new-password" />
        </div>
        <p v-if="pwError" class="error-msg">{{ pwError }}</p>
        <p v-if="pwSuccess" class="success-msg">{{ pwSuccess }}</p>
        <button class="btn-primary-full" @click="changePassword" :disabled="pwLoading">
          {{ pwLoading ? langStore.t('guest.saving') : langStore.t('guest.savePassword') }}
        </button>
      </div>
    </div>

    <!-- CHANGE DATES MODAL -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeChangeModal">
      <div class="modal-content">
        <button class="close-btn" @click="closeChangeModal">&times;</button>
        <h2>{{ langStore.t('guest.changeDatesTitle') }}</h2>
        <div v-if="selectedReservation" class="modal-info">
          <p><strong>{{ selectedReservation.facility_name }}</strong> / {{ selectedReservation.room_name }}</p>
          <p>{{ langStore.t('guest.currentDates') }} {{ fmt(selectedReservation.check_in || selectedReservation.res_start) }} - {{ fmt(selectedReservation.check_out || selectedReservation.res_end) }}</p>
        </div>
        <form @submit.prevent="submitChangeDates" style="display: flex; flex-direction: column; gap: 15px;">
          <div class="form-group">
            <label>{{ langStore.t('guest.newDates') }}</label>
            <VueDatePicker 
              v-model="modalDateRange" 
              range 
              :enable-time-picker="false"
              :min-date="new Date()"
              :placeholder="langStore.t('guest.selectDates')"
              required
              auto-apply
            />
          </div>
          <p v-if="modalError" class="error-msg">{{ modalError }}</p>
          <button type="submit" class="btn-primary-full" :disabled="modalLoading">
            {{ modalLoading ? langStore.t('guest.saving') : langStore.t('guest.saveDates') }}
          </button>
          <button type="button" class="btn-secondary" @click="closeChangeModal">{{ langStore.t('guest.dismiss') }}</button>
        </form>
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

.reject-reason {
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 4px solid #c62828;
  background: #fff4f4;
  color: #7f1d1d;
  font-size: 0.86rem;
}

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

.btn-change {
  background: #2196F3;
  color: #fff;
  border: none;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
  border-radius: 0;
}
.btn-change:hover { background: #1976D2; }
.btn-change:disabled { background: #ccc; cursor: not-allowed; }

/* MODAL STYLES */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: #fff;
  padding: 30px;
  width: 90%;
  max-width: 450px;
  border: 1px solid #ddd;
  position: relative;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.close-btn {
  position: absolute;
  top: 12px; right: 15px;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-info {
  background: #f9f9f9;
  padding: 12px;
  margin-bottom: 20px;
  border-left: 4px solid #2196F3;
  font-size: 0.9rem;
}
.modal-info p { margin: 5px 0; }

.btn-secondary {
  width: 100%;
  background: #ddd;
  color: #333;
  border: none;
  padding: 11px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 0;
}
.btn-secondary:hover { background: #bbb; }

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

.footer-novo {
  background: #e3f2fd;
  border-top-color: #90caf9;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.change-note {
  font-size: 0.78rem;
  color: #1976D2;
  font-style: italic;
}
</style>
