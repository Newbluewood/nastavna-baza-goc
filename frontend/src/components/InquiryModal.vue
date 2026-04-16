<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close">&times;</button>
      
      <!-- SUCCESS PANEL -->
      <div v-if="success" class="success-panel">
        <div class="success-icon">✅</div>
        <h2>{{ langStore.currentLang === 'sr' ? 'Уpit је послат!' : 'Inquiry Sent!' }}</h2>
        <p class="success-sub">{{ langStore.currentLang === 'sr' ? 'Очекујте одговор у року од 24 сата.' : 'Expect a response within 24 hours.' }}</p>

        <!-- Nalog kreiran -->
        <div v-if="newAccount" class="info-box account-box">
          <div class="info-box-title">🔑 {{ langStore.currentLang === 'sr' ? 'Kreiran Vam je nalog' : 'Account Created' }}</div>
          <p>{{ langStore.currentLang === 'sr'
            ? 'Аутоматски смо Вам креирали налог. Лозинку налазите у emailу. Пријавите се да пратите статус резервације.'
            : 'We automatically created an account for you. Check your email for the temporary password.' }}</p>
          <router-link to="/prijava" class="btn-account" @click="close">
            {{ langStore.currentLang === 'sr' ? 'Пријавите се →' : 'Login →' }}
          </router-link>
        </div>

        <!-- Vec ima nalog -->
        <div v-else class="info-box account-box existing">
          <div class="info-box-title">👤 {{ langStore.currentLang === 'sr' ? 'Пратите статус' : 'Track Status' }}</div>
          <p>{{ langStore.currentLang === 'sr'
            ? 'Пратите статус Вашег упита у свом налогу.'
            : 'Track your inquiry status in your account.' }}</p>
          <router-link to="/moj-nalog" class="btn-account" @click="close">
            {{ langStore.currentLang === 'sr' ? 'Мој налог →' : 'My Account →' }}
          </router-link>
        </div>

        <!-- Politika otkazivanja -->
        <div class="info-box cancel-policy">
          <div class="info-box-title">📋 {{ langStore.currentLang === 'sr' ? 'Политика otkazivanja' : 'Cancellation Policy' }}</div>
          <ul>
            <li>{{ langStore.currentLang === 'sr'
              ? '✅ Бесплатно отказивање до 7 дана пре доласка'
              : '✅ Free cancellation up to 7 days before arrival' }}</li>
            <li>{{ langStore.currentLang === 'sr'
              ? '❌ Отказивање у периоду краћем од 7 дана — контактирајте нас директно'
              : '❌ Cancellations within 7 days — contact us directly' }}</li>
          </ul>
        </div>

        <button class="close-success-btn" @click="close">
          {{ langStore.currentLang === 'sr' ? 'Затвори' : 'Close' }}
        </button>
      </div>

      <!-- FORMA (skrivena kad je success) -->
      <template v-else>
        <!-- Istaknuti naslov sa Zgradom i Sobom -->
        <div class="inquiry-header">
          <p class="building-name">{{ buildingName }}</p>
          <h2>{{ roomName }}</h2>
          <span class="subtitle">{{ langStore.currentLang === 'sr' ? 'Резервација смештаја' : 'Accommodation booking' }}</span>
        </div>
        
        <form @submit.prevent="submitForm" class="inquiry-form">
          <!-- Novi Kalendar -->
          <div class="form-group">
            <label>{{ langStore.currentLang === 'sr' ? 'Резервишите период' : 'Select dates' }} *</label>
            <VueDatePicker 
              v-model="dateRange" 
              range 
              :enable-time-picker="false"
              :disabled-dates="disabledDates"
              :min-date="new Date()"
              :placeholder="langStore.currentLang === 'sr' ? 'Изаберите датум доласка и одласка' : 'Select Check-in and Check-out dates'"
              required
              auto-apply
            />
          </div>

          <div class="form-group">
            <label>{{ langStore.currentLang === 'sr' ? 'Име и презиме' : 'Full Name' }} *</label>
            <input type="text" v-model="form.sender_name" required />
          </div>
          
          <div class="form-group-row">
            <div class="form-group half">
              <label>{{ langStore.currentLang === 'sr' ? 'Електронска пошта' : 'Email' }} <span style="color:red">*</span></label>
              <input type="email" v-model="form.email" required :class="{ 'input-error': emailError }" />
              <span v-if="emailError" class="field-error">{{ emailError }}</span>
            </div>
            <div class="form-group half">
              <label>{{ langStore.currentLang === 'sr' ? 'Телефон' : 'Phone' }}</label>
              <input type="text" v-model="form.phone" />
            </div>
          </div>

          <div class="form-group">
            <label>{{ langStore.currentLang === 'sr' ? 'Додатна порука (Опционо)' : 'Additional Message (Optional)' }}</label>
            <textarea v-model="form.message" rows="3" :placeholder="langStore.currentLang === 'sr' ? 'Напишите нам уколико имате специјалне захтеве...' : 'Write us if you have any special requests...'"></textarea>
          </div>

          <!-- Prikaz grešaka -->
          <p v-if="error" class="error-msg">{{ error }}</p>

          <button type="submit" class="submit-btn" :disabled="isSubmitting">
            {{ isSubmitting ? (langStore.currentLang === 'sr' ? 'Шаљем...' : 'Sending...') : (langStore.currentLang === 'sr' ? 'Пошаљи упит' : 'Send Inquiry') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useLangStore } from '../stores/lang'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const props = defineProps({
  isOpen: Boolean,
  roomId: Number,
  roomName: String,
  buildingName: String
})

const emit = defineEmits(['update:isOpen'])
const langStore = useLangStore()

const dateRange = ref(null)
const disabledDates = ref([])

const form = ref({
  sender_name: '',
  email: '',
  phone: '',
  message: ''
})

const isSubmitting = ref(false)
const error = ref('')
const success = ref(false)
const newAccount = ref(false)

// Email validacija
const emailError = ref('')
const validateEmail = (email) => {
  if (!email) return 'Е-пошта је обавезна.'
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!re.test(email)) return 'Унесите исправну е-пошту (нпр. ime@gmail.com)'
  return ''
}

const fetchAvailability = async () => {
  if (!props.roomId) return;
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/rooms/${props.roomId}/availability`)
    const data = await res.json()
    
    let datesToDisable = []
    data.forEach(reservation => {
      // Fix: parsiramo datum kao lokalni (ne UTC) dodavanjem T12:00:00
      // da ne dodje do timezone pomaka (npr. 2026-04-20 ne postane 2026-04-19)
      const startStr = reservation.start_date
        ? reservation.start_date.split('T')[0]  // uzmi samo YYYY-MM-DD deo
        : null
      const endStr = reservation.end_date
        ? reservation.end_date.split('T')[0]
        : null
        
      if (!startStr || !endStr) return;

      let current = new Date(startStr + 'T12:00:00')
      const end = new Date(endStr + 'T12:00:00')
      
      while (current <= end) {
        datesToDisable.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }
    })
    disabledDates.value = datesToDisable
  } catch(err) {
    console.error("Greska pri dobavljanju rezervacija", err)
  }
}

// Reset form kada se otvori and fetch availability
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { sender_name: '', email: '', phone: '', message: '' }
    dateRange.value = null
    error.value = ''
    success.value = ''
    fetchAvailability()
  }
})

const close = () => {
  emit('update:isOpen', false)
}

const submitForm = async () => {
  isSubmitting.value = true
  error.value = ''
  success.value = ''

  try {
    // Validacija emaila
    emailError.value = validateEmail(form.value.email)
    if (emailError.value) {
      isSubmitting.value = false
      return
    }

    let check_in = null
    let check_out = null
    if (dateRange.value && dateRange.value.length === 2) {
       // Konvertuj u YYYY-MM-DD izbegavanjem problema sa vremenskom zonom
       const dt1 = new Date(dateRange.value[0]);
       const dt2 = new Date(dateRange.value[1]);
       dt1.setMinutes(dt1.getMinutes() - dt1.getTimezoneOffset());
       dt2.setMinutes(dt2.getMinutes() - dt2.getTimezoneOffset());
       check_in = dt1.toISOString().split('T')[0];
       check_out = dt2.toISOString().split('T')[0];
    }

    if (!check_in) throw new Error(langStore.currentLang === 'sr' ? "Молимо вас изаберите дане у календару." : "Please select dates in the calendar.")

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        check_in,
        check_out,
        target_room_id: props.roomId
      })
    })
    
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Server error')

    newAccount.value = !!data.newAccount
    success.value = true
    // Bez auto-zatvaranja — korisnik sam cita i klikne Zatvori
    
  } catch (err) {
    error.value = err.message
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: #ffffff; /* Fiksirano providnost: čist bela pozadina */
  padding: 30px;
  width: 90%;
  max-width: 500px;
  border-radius: 0;
  position: relative;
  border: 4px solid var(--color-border);
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}

.close-btn {
  position: absolute;
  top: 10px; right: 15px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #333;
}

.inquiry-header {
  margin-bottom: 25px;
  border-bottom: 2px solid var(--color-border);
  padding-bottom: 15px;
  margin-top: 10px;
}
.building-name {
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #888;
  font-weight: bold;
  margin: 0 0 5px 0;
  font-size: 0.85rem;
}
.inquiry-header h2 {
  margin: 0;
  font-size: 1.8rem;
  color: var(--color-nav);
}
.subtitle {
  display: inline-block;
  margin-top: 5px;
  font-size: 0.9rem;
  color: #555;
}

.inquiry-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  width: 100%;
}
.form-group-row {
  display: flex;
  gap: 15px;
  flex-wrap: wrap; /* Odgovara na mobilne uredjaje da se slomi u novu liniju ako ne stane */
}
.half { 
  flex: 1; 
  min-width: 120px; /* Dodato za mobilni, da bi input zauzeo dobar prostor kad se slomi iz form-group-row */
}

label {
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 5px;
  color: #333;
}

input, textarea {
  padding: 10px;
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 0;
  font-family: inherit;
  width: 100%; /* Dodato za resavanje ispadanja */
  box-sizing: border-box; /* Ključno za responzivnost unosa da ne ispada jer padding gura text van max-width */
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--color-nav);
}

.submit-btn {
  background: var(--color-nav);
  color: #fff;
  padding: 12px;
  border: none;
  font-weight: bold;
  cursor: pointer;
  text-transform: uppercase;
  transition: background 0.3s;
}
.submit-btn:hover {
  background: var(--color-btn-hover);
}
.submit-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-msg {
  color: red;
  font-size: 0.9rem;
  margin: 0;
}
.success-msg {
  color: green;
  font-weight: bold;
  font-size: 0.9rem;
  margin: 0;
}

/* Modifikacija DatePicker stila da se slaze sa ostrim ivicama */
:deep(.dp__input) {
  border-radius: 0;
  border: 1px solid var(--color-border);
  padding: 10px;
}
:deep(.dp__input:focus) {
  border-color: var(--color-nav);
}
.input-error {
  border-color: #e74c3c !important;
}
.field-error {
  color: #e74c3c;
  font-size: 0.8rem;
  margin-top: 4px;
  display: block;
}

/* ===== SUCCESS PANEL ===== */
.success-panel {
  padding: 30px 25px;
  text-align: center;
}

.success-icon {
  font-size: 3rem;
  margin-bottom: 10px;
  animation: pop 0.4s ease;
}

@keyframes pop {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

.success-panel h2 {
  color: #332317;
  margin: 0 0 5px;
  font-size: 1.4rem;
}

.success-sub {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.info-box {
  border: 1px solid #e8e0d8;
  border-radius: 0;
  padding: 15px 18px;
  margin-bottom: 12px;
  text-align: left;
}

.info-box p {
  margin: 6px 0 12px;
  font-size: 0.88rem;
  color: #555;
  line-height: 1.5;
}

.info-box-title {
  font-weight: bold;
  font-size: 0.85rem;
  color: #332317;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.account-box {
  border-left: 4px solid #cdac91;
  background: #fdf8f3;
}

.account-box.existing {
  border-left-color: #9a714e;
  background: #f9f6f2;
}

.btn-account {
  display: inline-block;
  background: #332317;
  color: #cdac91;
  padding: 8px 18px;
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: bold;
  letter-spacing: 0.5px;
}
.btn-account:hover { opacity: 0.85; }

.cancel-policy {
  border-left: 4px solid #aaa;
  background: #f7f7f7;
}

.cancel-policy ul {
  margin: 8px 0 0;
  padding-left: 0;
  list-style: none;
}

.cancel-policy ul li {
  font-size: 0.85rem;
  color: #555;
  padding: 3px 0;
  line-height: 1.5;
}

.close-success-btn {
  margin-top: 10px;
  background: #f5f3f0;
  border: 1px solid #ddd;
  color: #666;
  padding: 10px 30px;
  cursor: pointer;
  font-size: 0.88rem;
  border-radius: 0;
  letter-spacing: 0.5px;
}
.close-success-btn:hover { background: #e8e0d8; color: #332317; }
</style>
