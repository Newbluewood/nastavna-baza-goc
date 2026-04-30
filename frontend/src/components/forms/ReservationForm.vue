<script setup>
import { ref, computed } from 'vue'
import { useLangStore } from '../../stores/lang'

const langStore = useLangStore()

const props = defineProps({
  facilityId: { type: Number, default: null },
  facilityName: { type: String, default: '' }
})

const form = ref({
  sender_name: '',
  email: '',
  phone: '',
  message: ''
})

const statusMessage = ref('')
const isError = ref(false)
const isSubmitting = ref(false)

const submitForm = async () => {
  if (!form.value.sender_name || !form.value.message) {
    statusMessage.value = langStore.currentLang === 'sr' ? "Име и порука су обавезни." : "Name and message are required."
    isError.value = true
    return
  }

  isSubmitting.value = true
  statusMessage.value = ""
  
  try {
    const payload = { ...form.value, target_facility_id: props.facilityId }
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    const result = await response.json()
    
    if (response.ok) {
      statusMessage.value = langStore.currentLang === 'sr' ? "Упит је успешно послат! Контактираћемо вас у најкраћем року." : "Inquiry sent successfully! We will contact you soon."
      isError.value = false
      // Clear form
      form.value = { sender_name: '', email: '', phone: '', message: '' }
    } else {
      statusMessage.value = result.error || (langStore.currentLang === 'sr' ? "Дошло је до грешке при слању." : "An error occurred while sending.")
      isError.value = true
    }
  } catch (error) {
    statusMessage.value = langStore.currentLang === 'sr' ? "Грешка у комуникацији са сервером." : "Error communicating with server."
    isError.value = true
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="reservation-form" style="background: var(--color-background); padding: 30px; border: 1px solid var(--color-border);">
    <h3 style="margin-top: 0; margin-bottom: 20px; font-weight: bold; border-left: 4px solid var(--color-nav); padding-left: 10px;">
      <span v-if="langStore.currentLang === 'sr'">{{ facilityName ? `Упит за: ${facilityName}` : 'Пошаљите Упит / Резервацију' }}</span>
      <span v-else>{{ facilityName ? `Inquiry for: ${facilityName}` : 'Send Inquiry / Reservation' }}</span>
    </h3>
    
    <div v-if="statusMessage" :style="{ padding: '15px', marginBottom: '20px', backgroundColor: isError ? '#ffebee' : '#e8f5e9', color: isError ? '#c62828' : '#2e7d32', borderLeft: '4px solid ' + (isError ? '#c62828' : '#2e7d32') }">
      {{ statusMessage }}
    </div>

    <form @submit.prevent="submitForm" style="display: flex; flex-direction: column; gap: 15px;">
      
      <div>
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">{{ langStore.currentLang === 'sr' ? 'Име и презиме *' : 'Full Name *' }}</label>
        <input v-model="form.sender_name" type="text" required style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 0; font-family: inherit; box-sizing: border-box;" />
      </div>

      <div class="contact-row">
        <div class="input-group">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">Е-mail</label>
          <input v-model="form.email" type="email" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 0; font-family: inherit; box-sizing: border-box;" />
        </div>
        <div class="input-group">
          <label style="display: block; font-weight: bold; margin-bottom: 5px;">{{ langStore.currentLang === 'sr' ? 'Телефон' : 'Phone Number' }}</label>
          <input v-model="form.phone" type="tel" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 0; font-family: inherit; box-sizing: border-box;" />
        </div>
      </div>

      <div>
        <label style="display: block; font-weight: bold; margin-bottom: 5px;">{{ langStore.currentLang === 'sr' ? 'Ваша порука (датуми, број особа) *' : 'Your message (dates, number of people) *' }}</label>
        <textarea v-model="form.message" required rows="5" style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 0; font-family: inherit; resize: vertical; box-sizing: border-box;"></textarea>
      </div>

      <button type="submit" :disabled="isSubmitting" style="margin-top: 10px; padding: 12px 25px; background: var(--color-nav); color: #fff; border: none; border-radius: 0; font-family: inherit; font-weight: bold; font-size: 1rem; cursor: pointer; transition: opacity 0.3s;">
        <span v-if="langStore.currentLang === 'sr'">{{ isSubmitting ? 'Слање...' : 'ПОШАЉИ УПИТ' }}</span>
        <span v-else>{{ isSubmitting ? 'Sending...' : 'SEND INQUIRY' }}</span>
      </button>

    </form>
  </div>
</template>

<style scoped>
.contact-row {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}
.input-group {
  flex: 1;
  min-width: 250px;
}
@media (max-width: 600px) {
  .input-group {
    min-width: 100%;
  }
}
</style>
