<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const GUEST_CHAT_STORAGE_KEY = 'stay_assistant_guest_chat_v1'

const isOpen = ref(false)
const busy = ref(false)
const inputText = ref('')
const inputEl = ref(null)
const pendingReserve = ref(null)
const guestName = ref('')
const guestEmail = ref('')
const visitsByFacility = ref({})

watch(isOpen, async (open) => {
  if (!open) return
  await nextTick()
  inputEl.value?.focus()
})

const context = ref({
  adults: null,
  children: null,
  check_in: null,
  stay_length_days: null,
  pending_slot: null,
  preferences: []
})

const messages = ref([
  {
    role: 'assistant',
    type: 'text',
    text: 'Zdravo! Pomazem oko smestaja na Gocu. Napisite broj osoba, termin i koliko dana zelite da ostanete.'
  }
])

function hasGuestToken() {
  return Boolean(localStorage.getItem('guest_token'))
}

function persistGuestChatState() {
  if (hasGuestToken()) {
    localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)
    return
  }

  const payload = {
    messages: messages.value.slice(-80),
    context: context.value,
    visitsByFacility: visitsByFacility.value
  }

  localStorage.setItem(GUEST_CHAT_STORAGE_KEY, JSON.stringify(payload))
}

function restoreGuestChatState() {
  if (hasGuestToken()) {
    localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)
    return
  }

  const raw = localStorage.getItem(GUEST_CHAT_STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.messages) && parsed.messages.length) {
      messages.value = parsed.messages
    }
    if (parsed.context && typeof parsed.context === 'object') {
      context.value = {
        ...context.value,
        ...parsed.context
      }
    }
    if (parsed.visitsByFacility && typeof parsed.visitsByFacility === 'object') {
      visitsByFacility.value = parsed.visitsByFacility
    }
  } catch {
    localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)
  }
}

onMounted(() => {
  restoreGuestChatState()
})

watch(
  [messages, context, visitsByFacility],
  () => {
    persistGuestChatState()
  },
  { deep: true }
)

const canSend = computed(() => inputText.value.trim().length > 0 && !busy.value)

function pushAssistantText(text) {
  messages.value.push({ role: 'assistant', type: 'text', text })
}

function summarizeSuggestions(items) {
  if (!Array.isArray(items) || !items.length) {
    return 'Nemam raspolozive predloge za trazeni period, ali mogu da ponudim alternativu datuma.'
  }

  const names = items.map((item) => `${item.facility_name} / ${item.room_name}`).join('; ')
  return `Predlazem: ${names}. Ako zelite, mogu i da pokrenem rezervaciju.`
}

function rememberContext(criteria) {
  if (!criteria || typeof criteria !== 'object') return
  context.value = {
    ...context.value,
    adults: Number.isFinite(Number(criteria.adults)) ? Number(criteria.adults) : context.value.adults,
    children: Number.isFinite(Number(criteria.children)) ? Number(criteria.children) : context.value.children,
    check_in: criteria.check_in || context.value.check_in,
    stay_length_days: Number.isFinite(Number(criteria.stay_length_days))
      ? Number(criteria.stay_length_days)
      : context.value.stay_length_days,
    pending_slot: criteria.pending_slot ?? context.value.pending_slot,
    preferences: Array.isArray(criteria.preferences) ? criteria.preferences : context.value.preferences
  }
}

async function sendMessage() {
  if (!canSend.value) return

  const text = inputText.value.trim()
  messages.value.push({ role: 'user', type: 'text', text })
  inputText.value = ''

  busy.value = true
  try {
    const result = await api.chatPlanStay({ message: text, context: context.value })
    rememberContext(result.criteria)

    if (result.status === 'needs_input') {
      pushAssistantText(result.follow_up_question || 'Recite mi jos malo detalja pa nastavljamo.')
      return
    }

    if (Array.isArray(result.next_actions) && result.next_actions.length) {
      pushAssistantText(result.next_actions[0])
    }

    messages.value.push({
      role: 'assistant',
      type: 'suggestions',
      text: summarizeSuggestions(result.suggestions),
      criteria: result.criteria,
      suggestions: result.suggestions || [],
      alternatives: result.alternatives || []
    })
  } catch (error) {
    pushAssistantText(error?.data?.error || error.message || 'Chat servis trenutno nije dostupan.')
  } finally {
    busy.value = false
  }
}

function askForReservation(item) {
  pendingReserve.value = item

  const hasGuestToken = Boolean(localStorage.getItem('guest_token'))
  if (hasGuestToken) {
    createReservation()
    return
  }

  pushAssistantText('Za rezervaciju mi trebaju ime i prezime i email. Ako vec imate nalog, prijavite se pa nastavljamo odmah.')
}

async function createReservation() {
  if (!pendingReserve.value) return

  const hasGuestToken = Boolean(localStorage.getItem('guest_token'))
  if (!hasGuestToken && (!guestName.value.trim() || !guestEmail.value.trim())) {
    pushAssistantText('Unesite ime i prezime i email da nastavim rezervaciju.')
    return
  }

  busy.value = true
  try {
    const payload = {
      ...pendingReserve.value.reservation_payload,
      message: 'Rezervacija pokrenuta iz chat panela.',
      sender_name: hasGuestToken ? undefined : guestName.value.trim(),
      email: hasGuestToken ? undefined : guestEmail.value.trim()
    }

    const result = await api.chatReserveStay(payload)
    pushAssistantText(result.message || 'Rezervacija je pokrenuta. Potvrda ce stici na email.')
    pendingReserve.value = null
    guestName.value = ''
    guestEmail.value = ''
  } catch (error) {
    if (error?.data?.status === 'login_required') {
      pushAssistantText('Vec postoji nalog za taj email. Prijavite se da nastavim rezervaciju.')
      return
    }
    pushAssistantText(error?.data?.error || error?.data?.message || error.message || 'Rezervacija trenutno nije uspela.')
  } finally {
    busy.value = false
  }
}

function goToLogin() {
  router.push('/prijava')
}

async function loadVisitSuggestions(facilityId, checkIn) {
  if (!facilityId || busy.value) return
  if (visitsByFacility.value[facilityId]) return

  busy.value = true
  try {
    const result = await api.chatSuggestVisit({
      facility_id: facilityId,
      check_in: checkIn,
      weather_mode: 'any',
      family: true,
      lang: 'sr'
    })

    if (result?.weather?.summary) {
      pushAssistantText(result.weather.summary)
    }

    visitsByFacility.value = {
      ...visitsByFacility.value,
      [facilityId]: result.suggestions || []
    }
  } catch {
    pushAssistantText('Predlozi obilaska trenutno nisu dostupni.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="stay-assistant-wrapper">
    <button
      class="stay-assistant-toggle"
      :class="{ 'is-open': isOpen }"
      @click="isOpen = !isOpen"
      :aria-label="isOpen ? 'Zatvori asistenta' : 'Otvori asistenta za smestaj'"
      :title="isOpen ? 'Zatvori asistenta' : 'Asistent za smestaj'"
    >
      <template v-if="!isOpen">
        <img src="/buble-chat.png" alt="Chat" class="chat-bubble-icon" />
      </template>
      <template v-else>
        Zatvori asistenta
      </template>
    </button>

    <div v-if="isOpen" class="stay-assistant-panel">
      <div class="stay-assistant-head">
        <strong>Asistent za smestaj</strong>
        <small>Nastavna baza Goc</small>
      </div>

      <div class="stay-assistant-body">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['stay-bubble', msg.role === 'user' ? 'is-user' : 'is-assistant']"
        >
          <p>{{ msg.text }}</p>

          <div v-if="msg.type === 'suggestions' && msg.suggestions?.length" class="stay-suggestions">
            <div v-for="item in msg.suggestions" :key="`${item.facility_id}-${item.room_id}`" class="stay-card">
              <strong>{{ item.facility_name }}</strong>
              <span>{{ item.room_name }}</span>
              <small>{{ item.rationale?.join(', ') }}</small>

              <div class="stay-card-actions">
                <button @click="loadVisitSuggestions(item.facility_id, msg.criteria?.check_in)">Predlozi obilazak</button>
                <button class="reserve-btn" @click="askForReservation(item)">Rezervisi</button>
              </div>

              <ul v-if="visitsByFacility[item.facility_id]?.length" class="visit-list">
                <li v-for="visit in visitsByFacility[item.facility_id]" :key="visit.id">
                  {{ visit.name }}
                  <span v-if="visit.distance_minutes"> ({{ visit.distance_minutes }} min)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pendingReserve && !localStorage.getItem('guest_token')" class="reserve-form">
        <input v-model="guestName" type="text" placeholder="Ime i prezime" />
        <input v-model="guestEmail" type="email" placeholder="Email" />
        <div class="reserve-form-actions">
          <button @click="createReservation" :disabled="busy">Potvrdi rezervaciju</button>
          <button class="ghost-btn" @click="goToLogin">Imam nalog, prijava</button>
        </div>
      </div>

      <div class="stay-assistant-input">
        <input
          ref="inputEl"
          v-model="inputText"
          type="text"
          placeholder="Npr. Dolazimo sledece nedelje, 2 odraslih i 2 dece na 3 dana"
          @keyup.enter="sendMessage"
        />
        <button @click="sendMessage" :disabled="!canSend">Posalji</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stay-assistant-wrapper {
  position: fixed;
  right: 8px;
  bottom: 18px;
  z-index: 1200;
  width: min(360px, calc(100vw - 24px));
  transform: scale(1.2);
  transform-origin: bottom right;
}

.stay-assistant-toggle {
  width: 56px;
  height: 56px;
  border: 3px solid var(--c-braon-6);
  background: #fff7f0;
  color: #fff;
  font-family: var(--font-base);
  font-weight: 700;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.stay-assistant-toggle.is-open {
  width: 100%;
  height: auto;
  justify-content: center;
  padding: 10px 12px;
  border: 3px solid var(--c-braon-6);
  background: var(--c-braon-5);
  color: #fff;
}

.chat-bubble-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.stay-assistant-panel {
  margin-top: 8px;
  border: 3px solid var(--c-braon-6);
  background: #fff;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.stay-assistant-head {
  padding: 10px 12px;
  border-bottom: 1px solid #e3c4ad;
  background: #fff7f0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stay-assistant-head small {
  color: #67462e;
}

.stay-assistant-body {
  padding: 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stay-bubble {
  padding: 8px;
  border: 1px solid #e3c4ad;
}

.stay-bubble p {
  margin: 0;
  text-align: left;
  font-size: 0.84rem;
}

.stay-bubble.is-user {
  align-self: flex-end;
  background: #fff1e6;
  max-width: 95%;
}

.stay-bubble.is-assistant {
  align-self: flex-start;
  background: #fdf9f5;
  max-width: 100%;
}

.stay-suggestions {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stay-card {
  border: 1px solid #d8c3b3;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stay-card strong {
  color: #332317;
  font-size: 0.86rem;
}

.stay-card span,
.stay-card small {
  color: #4d3a2b;
  font-size: 0.78rem;
}

.stay-card-actions {
  margin-top: 4px;
  display: flex;
  gap: 6px;
}

.stay-card-actions button {
  border: 1px solid #9a714e;
  background: #fff;
  color: #67462e;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 4px 8px;
}

.stay-card-actions .reserve-btn {
  background: #67462e;
  color: #fff;
}

.visit-list {
  margin: 6px 0 0;
  padding-left: 16px;
  color: #4d3a2b;
  font-size: 0.76rem;
}

.reserve-form {
  border-top: 1px solid #e3c4ad;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reserve-form input {
  border: 1px solid #c8b3a4;
  padding: 8px;
  font-size: 0.8rem;
}

.reserve-form-actions {
  display: flex;
  gap: 6px;
}

.reserve-form-actions button {
  flex: 1;
  border: 1px solid #67462e;
  background: #cdac91;
  color: #332317;
  cursor: pointer;
  font-size: 0.76rem;
  padding: 7px 8px;
}

.reserve-form-actions .ghost-btn {
  background: #fff;
}

.stay-assistant-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
  padding: 8px;
  border-top: 1px solid #e3c4ad;
}

.stay-assistant-input input {
  border: 1px solid var(--c-braon-6);
  background: transparent;
  padding: 9px;
  font-size: 0.8rem;
}

.stay-assistant-input input:focus {
  outline: none;
  border-color: var(--c-braon-6);
}

.stay-assistant-input button {
  border: 1px solid #67462e;
  background: #67462e;
  color: #fff;
  cursor: pointer;
  padding: 0 12px;
  font-size: 0.78rem;
}

.stay-assistant-input button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .stay-assistant-wrapper {
    right: 4px;
    bottom: 10px;
    width: calc(100vw - 20px);
  }

  .stay-assistant-toggle {
    width: 52px;
    height: 52px;
  }

  .stay-assistant-toggle.is-open {
    width: 100%;
    height: auto;
  }
}
</style>