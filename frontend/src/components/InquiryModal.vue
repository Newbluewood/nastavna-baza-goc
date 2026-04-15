<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <button class="close-btn" @click="close">&times;</button>
      <h2>{{ langStore.currentLang === 'sr' ? 'Пошаљите упит за' : 'Send inquiry for' }} <span style="color: var(--color-nav);">{{ facilityName }}</span></h2>
      
      <form @submit.prevent="submitForm" class="inquiry-form">
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
          <label>{{ langStore.currentLang === 'sr' ? 'Ваша порука' : 'Your Message' }} *</label>
          <!-- Sutra ćemo ovde dodati kalendar datuma -->
          <textarea v-model="form.message" rows="4" :placeholder="langStore.currentLang === 'sr' ? 'Напишите нам за који период сте заинтересовани...' : 'Write us the dates you are interested in...'" required></textarea>
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
import { ref, watch } from 'vue'
import { useLangStore } from '../stores/lang'

const props = defineProps({
  isOpen: Boolean,
  facilityId: Number,
  facilityName: String
})

const emit = defineEmits(['update:isOpen'])
const langStore = useLangStore()

const form = ref({
  sender_name: '',
  email: '',
  phone: '',
  message: ''
})

const isSubmitting = ref(false)
const error = ref('')
const success = ref('')

// Reset form kada se otvori
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = { sender_name: '', email: '', phone: '', message: '' }
    error.value = ''
    success.value = ''
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
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        target_facility_id: props.facilityId
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
  background: var(--color-bg);
  padding: 30px;
  width: 90%;
  max-width: 500px;
  border-radius: 0;
  position: relative;
  border: 4px solid var(--color-border);
}

.close-btn {
  position: absolute;
  top: 10px; right: 15px;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text);
}

h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.5rem;
}

.inquiry-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}
.form-group-row {
  display: flex;
  gap: 15px;
}
.half { flex: 1; }

label {
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 5px;
  color: var(--color-text);
}

input, textarea {
  padding: 10px;
  border: 1px solid var(--color-border);
  background: #fff;
  border-radius: 0;
  font-family: inherit;
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
</style>
