<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const token = route.params.token

const reservation = ref(null)
const isLoading = ref(true)
const error = ref('')
const isCancelling = ref(false)
const cancelled = ref(false)

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const fmt = (d) => {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('sr-RS', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((target - today) / (1000 * 60 * 60 * 24))
}

onMounted(async () => {
  try {
    const res = await fetch(`${baseUrl}/api/cancel/${token}`)
    if (!res.ok) {
      const d = await res.json()
      error.value = d.error || 'Rezervacija nije pronađena.'
      return
    }
    reservation.value = await res.json()
  } catch (e) {
    error.value = 'Greška pri učitavanju. Pokušajte ponovo.'
  } finally {
    isLoading.value = false
  }
})

const cancelReservation = async () => {
  if (!confirm('Da li ste sigurni da želite da otkažete rezervaciju?')) return
  isCancelling.value = true
  try {
    const res = await fetch(`${baseUrl}/api/cancel/${token}`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      error.value = data.error
      return
    }
    cancelled.value = true
  } catch (e) {
    error.value = 'Greška pri otkazivanju. Pokušajte ponovo.'
  } finally {
    isCancelling.value = false
  }
}
</script>

<template>
  <div class="cancel-page">
    <div class="cancel-box">
      <div class="brand">
        <span>НАСТАВНА БАЗА ГОЧ</span>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="state-msg">Учитавам резервацију...</div>

      <!-- Error -->
      <div v-else-if="error && !reservation" class="error-state">
        <div class="big-icon">⚠️</div>
        <h2>Грешка</h2>
        <p>{{ error }}</p>
        <button class="btn-primary" @click="router.push('/smestaj')">Погледај смештај</button>
      </div>

      <!-- Cancelled success -->
      <div v-else-if="cancelled" class="success-state">
        <div class="big-icon">✅</div>
        <h2>Резервација отказана</h2>
        <p>Ваша резервација је успешно отказана. Послали смо Вам потврду на е-пошту.</p>
        <button class="btn-primary" @click="router.push('/smestaj')">Нова резервација</button>
      </div>

      <!-- Reservation details -->
      <div v-else-if="reservation">
        <h2>Отказивање резервације</h2>

        <!-- Already cancelled -->
        <div v-if="reservation.status === 'cancelled'" class="info-box warning">
          <p>Ова резервација је <strong>већ отказана</strong>.</p>
        </div>

        <div v-else>
          <div class="reservation-card">
            <div class="line"><span class="label">📍 Објекат</span><span>{{ reservation.facility_name }}</span></div>
            <div class="line"><span class="label">🛏 Смештај</span><span>{{ reservation.room_name }}</span></div>
            <div class="line"><span class="label">👤 Гост</span><span>{{ reservation.guest_name }}</span></div>
            <div class="line"><span class="label">📅 Долазак</span><span>{{ fmt(reservation.check_in) }}</span></div>
            <div class="line"><span class="label">📅 Одлазак</span><span>{{ fmt(reservation.check_out) }}</span></div>
          </div>

          <!-- 7-day warning -->
          <div v-if="daysUntil(reservation.check_in) !== null && daysUntil(reservation.check_in) < 7" class="info-box danger">
            <strong>Отказивање није могуће.</strong><br>
            До долска је мање од 7 дана ({{ daysUntil(reservation.check_in) }} {{ daysUntil(reservation.check_in) === 1 ? 'дан' : 'дана' }}).
            <br>За помоћ, контактирајте нас директно.
          </div>

          <div v-else class="info-box ok">
            Можете отказати резервацију без накнаде.<br>
            <small>Рок за бесплатно отказивање: {{ fmt(reservation.check_in) }} − 7 дана</small>
          </div>

          <p v-if="error" class="error-msg">{{ error }}</p>

          <div class="actions">
            <button
              class="btn-danger"
              @click="cancelReservation"
              :disabled="isCancelling || daysUntil(reservation.check_in) < 7"
            >
              {{ isCancelling ? 'Отказујем...' : '🚫 Откажи резервацију' }}
            </button>
            <button class="btn-secondary" @click="router.push('/')">Задржи резервацију</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.cancel-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f3f0;
  padding: 20px;
}

.cancel-box {
  background: #fff;
  border: 1px solid #e8e0d8;
  max-width: 500px;
  width: 100%;
  border-top: 5px solid #332317;
}

.brand {
  background: #332317;
  color: #cdac91;
  padding: 15px 25px;
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 2px;
}

h2 {
  padding: 20px 25px 0;
  margin: 0 0 15px 0;
  color: #332317;
  font-size: 1.4rem;
}

.state-msg {
  padding: 40px 25px;
  text-align: center;
  color: #888;
}

.big-icon { font-size: 3rem; padding: 25px 0 10px; text-align: center; }

.error-state, .success-state {
  text-align: center;
  padding: 0 25px 30px;
}
.error-state h2, .success-state h2 { padding-left: 0; text-align: center; }
.error-state p, .success-state p { color: #666; }

.reservation-card {
  margin: 0 25px 20px;
  border: 1px solid #e8e0d8;
  background: #fdf8f3;
}

.line {
  display: flex;
  justify-content: space-between;
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  font-size: 0.92rem;
}
.line:last-child { border-bottom: none; }
.label { color: #888; font-weight: bold; }

.info-box {
  margin: 0 25px 20px;
  padding: 12px 15px;
  font-size: 0.9rem;
  line-height: 1.5;
}
.info-box.ok { background: #e8f5e9; color: #2e7d32; border-left: 4px solid #27ae60; }
.info-box.danger { background: #fce4ec; color: #c62828; border-left: 4px solid #e74c3c; }
.info-box.warning { background: #fff3e0; color: #e65100; border-left: 4px solid #ff9800; }

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 25px 25px;
}

.btn-danger {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 13px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 0;
  font-size: 0.95rem;
  transition: opacity 0.2s;
}
.btn-danger:hover { opacity: 0.85; }
.btn-danger:disabled { background: #ccc; cursor: not-allowed; }

.btn-primary {
  background: #332317;
  color: #fff;
  border: none;
  padding: 12px 24px;
  font-weight: bold;
  cursor: pointer;
  border-radius: 0;
  margin-top: 10px;
}

.btn-secondary {
  background: transparent;
  color: #666;
  border: 1px solid #ccc;
  padding: 12px;
  cursor: pointer;
  border-radius: 0;
  font-size: 0.9rem;
  transition: all 0.2s;
}
.btn-secondary:hover { background: #f5f3f0; }

.error-msg { color: #e74c3c; font-size: 0.9rem; margin: 0 25px 10px; }
</style>
