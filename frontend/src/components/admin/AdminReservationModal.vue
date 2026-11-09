<script setup>
import { ref, watch, computed } from 'vue'
import api from '../../services/api'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  room: { type: Object, default: null },
  facilityName: { type: String, default: '' },
})

const emit = defineEmits(['update:isOpen', 'created'])

const form = ref({
  sender_name: '',
  email: '',
  phone: '',
  check_in: '',
  check_out: '',
  board_type: 'base',
  message: '',
  send_email: true,
})

const isSubmitting = ref(false)
const error = ref('')

const title = computed(() => {
  const roomName = props.room?.name || 'soba'
  const facility = props.facilityName ? `${props.facilityName} · ` : ''
  return `Rezervacija: ${facility}${roomName}`
})

const resetForm = () => {
  form.value = {
    sender_name: '',
    email: '',
    phone: '',
    check_in: '',
    check_out: '',
    board_type: 'base',
    message: '',
    send_email: true,
  }
  error.value = ''
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) resetForm()
  }
)

const close = () => emit('update:isOpen', false)

const submit = async () => {
  error.value = ''
  if (!props.room?.id) {
    error.value = 'Soba nije izabrana.'
    return
  }
  if (!form.value.sender_name.trim() || !form.value.email.trim()) {
    error.value = 'Ime i email su obavezni.'
    return
  }
  if (!form.value.check_in || !form.value.check_out) {
    error.value = 'Izaberite datume dolaska i odlaska.'
    return
  }
  if (form.value.check_in >= form.value.check_out) {
    error.value = 'Datum odlaska mora biti posle dolaska.'
    return
  }

  isSubmitting.value = true
  try {
    const result = await api.createAdminReservation({
      sender_name: form.value.sender_name.trim(),
      email: form.value.email.trim(),
      phone: form.value.phone.trim() || undefined,
      message: form.value.message.trim() || undefined,
      target_room_id: props.room.id,
      check_in: form.value.check_in,
      check_out: form.value.check_out,
      board_type: form.value.board_type,
      send_email: form.value.send_email,
    })
    emit('created', result)
    close()
  } catch (err) {
    error.value = err.data?.error || err.message || 'Greška pri kreiranju rezervacije'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="arm-overlay" @click.self="close">
    <div class="arm-modal" role="dialog" aria-modal="true">
      <header class="arm-header">
        <h3>{{ title }}</h3>
        <button type="button" class="arm-close" @click="close" aria-label="Zatvori">×</button>
      </header>

      <p class="arm-hint">
        Rezervacija se odmah potvrđuje. U evidenciji ostaje potpis ulogovanog admina.
      </p>

      <form class="arm-form" @submit.prevent="submit">
        <label>
          Ime gosta *
          <input v-model="form.sender_name" type="text" required maxlength="120" />
        </label>
        <label>
          Email *
          <input v-model="form.email" type="email" required maxlength="150" />
        </label>
        <label>
          Telefon
          <input v-model="form.phone" type="tel" maxlength="40" />
        </label>
        <div class="arm-row">
          <label>
            Dolazak *
            <input v-model="form.check_in" type="date" required />
          </label>
          <label>
            Odlazak *
            <input v-model="form.check_out" type="date" required />
          </label>
        </div>
        <label>
          Usluga
          <select v-model="form.board_type">
            <option value="base">Samo noćenje</option>
            <option value="half">Polupansion</option>
            <option value="full">Pun pansion</option>
          </select>
        </label>
        <label>
          Napomena
          <textarea v-model="form.message" rows="2" maxlength="2000" />
        </label>
        <label class="arm-check">
          <input v-model="form.send_email" type="checkbox" />
          Pošalji mejl gostu (nalog / potvrda)
        </label>

        <p v-if="error" class="arm-error">{{ error }}</p>

        <div class="arm-actions">
          <button type="button" class="arm-btn ghost" @click="close">Otkaži</button>
          <button type="submit" class="arm-btn primary" :disabled="isSubmitting">
            {{ isSubmitting ? 'Čuvam…' : 'Potvrdi rezervaciju' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.arm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 12000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.arm-modal {
  width: min(480px, 100%);
  background: #fff;
  border-radius: 10px;
  padding: 1.25rem 1.35rem 1.4rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
}
.arm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}
.arm-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #2c3e50;
}
.arm-close {
  border: none;
  background: transparent;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #888;
}
.arm-hint {
  margin: 0 0 1rem;
  font-size: 0.82rem;
  color: #7f8c8d;
}
.arm-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.arm-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: #555;
}
.arm-form input,
.arm-form select,
.arm-form textarea {
  padding: 0.55rem 0.65rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font: inherit;
}
.arm-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.arm-check {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem !important;
}
.arm-error {
  margin: 0;
  color: #c0392b;
  font-size: 0.85rem;
}
.arm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
.arm-btn {
  border: none;
  padding: 0.55rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.arm-btn.ghost {
  background: #ececec;
  color: #444;
}
.arm-btn.primary {
  background: #27ae60;
  color: #fff;
}
.arm-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
