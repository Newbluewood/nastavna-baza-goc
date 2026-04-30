<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'
import { fmt } from '../../utils/dateFormat'

const router = useRouter()
const guests = ref([])
const isLoading = ref(true)

const showVoucherModal = ref(false)
const selectedGuest = ref(null)
const voucherForm = ref({ title: '', description: '' })
const isSending = ref(false)
const voucherError = ref('')
const voucherSuccess = ref('')

const fetchGuests = async () => {
  isLoading.value = true
  try {
    guests.value = await api.getGuests()
  } catch (err) {
    if (err.status === 401) { router.push('/admin/login'); return }
    console.error('Greška pri učitavanju gostiju:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => { fetchGuests() })

const handleLogout = () => { api.logout(); router.push('/admin/login') }

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const openVoucherModal = (guest) => {
  selectedGuest.value = guest
  voucherForm.value = { title: '', description: '' }
  voucherError.value = ''
  voucherSuccess.value = ''
  showVoucherModal.value = true
}

const closeVoucherModal = () => {
  showVoucherModal.value = false
  selectedGuest.value = null
}

const presetVouchers = [
  { title: 'Besplatna kafa u restoranu', desc: 'Iskoristite ovaj vaučer za besplatnu kafu po izboru u restoranu.' },
  { title: '10% popusta na smeštaj', desc: 'Vaučer za 10% popusta prilikom sledeće rezervacije.' },
  { title: 'Vaučer izvinjenja', desc: 'Zbog kašnjenja, poklanjamo Vam besplatan ručak u Piramidi.' }
]

const applyPreset = (preset) => {
  voucherForm.value.title = preset.title
  voucherForm.value.description = preset.desc
}

const sendVoucher = async () => {
  if (!voucherForm.value.title) { voucherError.value = 'Naslov je obavezan.'; return }
  isSending.value = true
  voucherError.value = ''
  voucherSuccess.value = ''
  try {
    const data = await api.addVoucher(selectedGuest.value.id, voucherForm.value)
    voucherSuccess.value = 'Vaučer je uspešno dodeljen!'
    const idx = guests.value.findIndex(g => g.id === selectedGuest.value.id)
    if (idx !== -1) {
      if (!guests.value[idx].vouchers) guests.value[idx].vouchers = []
      guests.value[idx].vouchers.push(data.voucher)
    }
    setTimeout(closeVoucherModal, 1500)
  } catch (err) {
    voucherError.value = err.data?.error || err.message
  } finally {
    isSending.value = false
  }
}

const getActiveVouchersCount = (vouchers) => {
  if (!vouchers || !Array.isArray(vouchers)) return 0
  return vouchers.filter(v => v.status === 'active').length
}
</script>

<template>
  <AdminLayout>

      <div class="page-header">
        <div>
          <h1>Гости и CRM</h1>
          <p class="subtitle">Прати статистику долазака и додели ваучере лојалним гостима.</p>
        </div>
        <button class="refresh-btn" @click="fetchGuests" :disabled="isLoading">
          {{ isLoading ? 'Учитавам...' : 'Освежи листу' }}
        </button>
      </div>

      <!-- TABLE -->
      <div v-if="isLoading" class="loading-msg">Учитавам госте...</div>
      <div v-else-if="guests.length === 0" class="empty-msg">Нема регистрованих гостију.</div>

      <div v-else class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Гост</th>
              <th>Контакт</th>
              <th>Доласци (Rezervacije)</th>
              <th>Активни Ваучери</th>
              <th>Датум рег.</th>
              <th>Акције</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="guest in guests" :key="guest.id">
              <td><strong>{{ guest.name }}</strong></td>
              <td>
                <div class="contact-info">{{ guest.email }}</div>
                <div class="contact-info muted" v-if="guest.phone">{{ guest.phone }}</div>
              </td>
              <td>
                <span class="loyalty-badge" :class="{'loyalty-high': guest.reservation_count > 2, 'loyalty-med': guest.reservation_count > 0}">
                  {{ guest.reservation_count }} резервација
                </span>
              </td>
              <td>
                <span v-if="getActiveVouchersCount(guest.vouchers) > 0" class="voucher-indicator">
                  🎟️ {{ getActiveVouchersCount(guest.vouchers) }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td class="muted">{{ fmt(guest.created_at) }}</td>
              <td>
                <button class="action-btn gift-btn" @click="openVoucherModal(guest)">
                  🎁 Поклони Ваучер
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    <!-- VOUCHER MODAL -->
    <div v-if="showVoucherModal" class="modal-overlay" @click.self="closeVoucherModal">
      <div class="voucher-modal">
        <div class="modal-header">
          <h3>🎁 Поклон Ваучер</h3>
          <button class="modal-close" @click="closeVoucherModal">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-intro">Корисник: <strong>{{ selectedGuest?.name }}</strong> ({{ selectedGuest?.email }})</p>
          
          <div class="preset-buttons">
            <button v-for="(p, i) in presetVouchers" :key="i" class="preset-btn" @click="applyPreset(p)">
              {{ p.title }}
            </button>
          </div>

          <div class="form-group">
            <label>Наслов ваучера *</label>
            <input v-model="voucherForm.title" type="text" placeholder="Нпр. Бесплатна кафа" />
          </div>
          <div class="form-group">
            <label>Опис / Услови (опционо)</label>
            <textarea v-model="voucherForm.description" rows="3" placeholder="Детаљи..."></textarea>
          </div>

          <p v-if="voucherError" class="error-msg">{{ voucherError }}</p>
          <p v-if="voucherSuccess" class="success-msg">{{ voucherSuccess }}</p>

          <button class="submit-btn" :disabled="isSending" @click="sendVoucher">
            {{ isSending ? 'Шаљем...' : 'ДОДЕЛИ ВАУЧЕР ГОСТУ' }}
          </button>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>

/* SIDEBAR START */
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
@media (min-width: 769px) {
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none !important; }
}
.sidebar h2 { margin-top: 0; margin-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px; font-size: 1.1rem; letter-spacing: 1px;}
.sidebar nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.sidebar nav a { color: #ddd; text-decoration: none; padding: 10px 12px; transition: all 0.2s; font-size: 0.95rem; }
.sidebar nav a.active { background: #cdac91; color: #fff; font-weight: bold; }
.sidebar nav a:hover:not(.active) { background: #fff; color: #332317; }
.logout-btn { margin-top: 20px; padding: 10px; background: transparent; color: #cdac91; border: 1px solid #cdac91; cursor: pointer; font-weight: bold; transition: all 0.2s; }
.logout-btn:hover { background: #cdac91; color: #332317; }
/* SIDEBAR END */


.table-wrapper { overflow-x: auto; }
.contact-info { font-size: 0.85rem; color: #333; }

.loyalty-badge {
  display: inline-block;
  padding: 4px 8px;
  background: #eee;
  font-size: 0.8rem;
  font-weight: bold;
}
.loyalty-high { background: #e8f5e9; color: #2e7d32; border-left: 3px solid #2e7d32; }
.loyalty-med { background: #fff8e1; color: #f57f17; border-left: 3px solid #f57f17; }

.voucher-indicator { background: #fff0f5; color: #d81b60; padding: 3px 6px; font-weight: bold; font-size: 0.8rem; border: 1px dashed #d81b60; }

.gift-btn { background: #332317; color: #cdac91; border: 1px solid #332317; }
.gift-btn:hover { background: #cdac91; color: #332317; }


/* MODAL */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.voucher-modal { background: #fff; width: 100%; max-width: 450px; border-top: 5px solid #d81b60; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #fafafa; border-bottom: 1px solid #eee; }
.modal-header h3 { margin: 0; color: #d81b60; font-size: 1.1rem; }
.modal-close { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #888; }
.modal-close:hover { color: #333; }
.modal-body { padding: 20px; }
.modal-intro { margin: 0 0 15px; font-size: 0.9rem; color: #555; border-bottom: 1px dashed #eee; padding-bottom: 10px;}

.preset-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.preset-btn { background: #fdf8f3; border: 1px dashed #cdac91; color: #9a714e; padding: 5px 10px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
.preset-btn:hover { background: #cdac91; color: #fff; }


.error-msg { color: #e74c3c; font-size: 0.85rem; margin-bottom: 10px; }
.success-msg { color: #27ae60; background: #e8f5e9; padding: 10px; font-size: 0.85rem; margin-bottom: 10px; }

.submit-btn { width: 100%; background: #d81b60; color: #fff; padding: 12px; border: none; font-weight: bold; cursor: pointer; letter-spacing: 1px; margin-top: 10px; }
.submit-btn:disabled { opacity: 0.5; }
.submit-btn:hover:not(:disabled) { background: #ad1457; }
</style>
