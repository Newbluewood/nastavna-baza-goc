<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close">&times;</button>
      
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
            <label>{{ langStore.currentLang === 'sr' ? 'Електронска пошта' : 'Email' }}</label>
            <input type="email" v-model="form.email" />
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

        <!-- Prikaz grešaka i uspeha -->
        <p v-if="error" class="error-msg">{{ error }}</p>
        <p v-if="success" class="success-msg">{{ success }}</p>

        <button type="submit" class="submit-btn" :disabled="isSubmitting">
          {{ isSubmitting ? (langStore.currentLang === 'sr' ? 'Шаљем...' : 'Sending...') : (langStore.currentLang === 'sr' ? 'Пошаљи упит' : 'Send Inquiry') }}
        </button>
      </form>
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
const success = ref('')

const fetchAvailability = async () => {
  if (!props.roomId) return;
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/rooms/${props.roomId}/availability`)
    const data = await res.json()
    
    let datesToDisable = []
    data.forEach(res => {
      let current = new Date(res.start_date)
      const end = new Date(res.end_date)
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

    success.value = langStore.currentLang === 'sr' ? 'Ваш упит је успешно послат!' : 'Your inquiry was sent successfully!'
    
    // Automatsko zatvaranje nakon par sekundi
    setTimeout(() => {
      close()
    }, 2500)
    
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
</style>
