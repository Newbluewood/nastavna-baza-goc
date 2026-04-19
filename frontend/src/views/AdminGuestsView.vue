<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '../components/AdminSidebar.vue'

const router = useRouter()
const sidebar = ref(null)
const guests = ref([])
const isLoading = ref(true)

// Vaucer modal state
const showVoucherModal = ref(false)
const selectedGuest = ref(null)
const voucherForm = ref({ title: '', description: '' })
const isSending = ref(false)
const voucherError = ref('')
const voucherSuccess = ref('')

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const fetchGuests = async () => {
  isLoading.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/guests`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.status === 401) {
      router.push('/admin/login')
      return
    }
    const data = await res.json()
    guests.value = data
  } catch (err) {
    console.error('Greška pri učitavanju gostiju:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => { fetchGuests() })

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
  if (!voucherForm.value.title) {
    voucherError.value = 'Naslov je obavezan.'
    return
  }
  isSending.value = true
  voucherError.value = ''
  voucherSuccess.value = ''

  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/guests/${selectedGuest.value.id}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(voucherForm.value)
    })
    
    if (res.ok) {
      const data = await res.json()
      voucherSuccess.value = 'Vaučer je uspešno dodeljen!'
      
      // Update local state to show +1 voucher
      const guestIdx = guests.value.findIndex(g => g.id === selectedGuest.value.id)
      if (guestIdx !== -1) {
        if (!guests.value[guestIdx].vouchers) guests.value[guestIdx].vouchers = []
        guests.value[guestIdx].vouchers.push(data.voucher)
      }
      
      setTimeout(closeVoucherModal, 1500)
    } else {
      const errData = await res.json()
      voucherError.value = errData.error || 'Server error'
    }
  } catch (err) {
    voucherError.value = err.message
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
  <div class="admin-layout">
    <AdminSidebar ref="sidebar" />

    <!-- MAIN -->
    <main class="main-content">
      <!-- MOBILE TOP BAR -->
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebar.sidebarOpen = !sidebar.sidebarOpen">☰ CMS Panel</button>
      </div>

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
              <td class="muted">{{ formatDate(guest.created_at) }}</td>
              <td>
                <button class="action-btn gift-btn" @click="openVoucherModal(guest)">
                  🎁 Поклони Ваучер
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

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

@media (max-width: 768px) {
  .mobile-topbar { display: flex; align-items: center; margin-bottom: 20px; }
  .burger-admin {
    background: #332317; color: #cdac91; border: none; padding: 10px 16px;
    font-size: 0.95rem; font-weight: bold; cursor: pointer; border-radius: 0;
  }
  .main-content { padding: 20px 16px !important; }
}
@media (min-width: 769px) {
  .mobile-topbar { display: none; }
}

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
.page-header h1 { margin: 0 0 5px 0; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }
.refresh-btn {
  background: #332317; color: #fff; border: none; padding: 10px 20px; cursor: pointer; font-weight: bold; transition: opacity 0.2s;
}
.refresh-btn:hover { opacity: 0.8; }

.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; font-size: 0.92rem; }
.data-table th { background: #332317; color: #cdac91; padding: 12px 14px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid #eee; vertical-align: middle; }
.data-table tr:hover { background: #fdf8f3; }
.contact-info { font-size: 0.85rem; color: #333; }
.muted { color: #888; font-size: 0.82rem; }

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

.action-btn { border: none; padding: 7px 12px; cursor: pointer; font-size: 0.83rem; font-weight: bold; border-radius: 0; transition: opacity 0.2s; white-space: nowrap; }
.gift-btn { background: #332317; color: #cdac91; border: 1px solid #332317; }
.gift-btn:hover { background: #cdac91; color: #332317; }

.loading-msg, .empty-msg { text-align: center; padding: 60px 20px; color: #999; font-size: 1.1rem; }

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

.form-group { margin-bottom: 15px; }
.form-group label { display: block; font-size: 0.8rem; font-weight: bold; color: #555; margin-bottom: 5px; text-transform: uppercase; }
.form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; outline: none; font-family: inherit; box-sizing: border-box; }
.form-group input:focus, .form-group textarea:focus { border-color: #d81b60; }

.error-msg { color: #e74c3c; font-size: 0.85rem; margin-bottom: 10px; }
.success-msg { color: #27ae60; background: #e8f5e9; padding: 10px; font-size: 0.85rem; margin-bottom: 10px; }

.submit-btn { width: 100%; background: #d81b60; color: #fff; padding: 12px; border: none; font-weight: bold; cursor: pointer; letter-spacing: 1px; margin-top: 10px; }
.submit-btn:disabled { opacity: 0.5; }
.submit-btn:hover:not(:disabled) { background: #ad1457; }
</style>
