<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const route = useRoute()
const GUEST_CHAT_STORAGE_KEY = 'stay_assistant_guest_chat_v1'

const isOpen = ref(false)
const busy = ref(false)
const inputText = ref('')
const inputEl = ref(null)
const pendingReserve = ref(null)
const visitsByCard = ref({})

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
    visitsByCard: visitsByCard.value
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
    if (parsed.visitsByCard && typeof parsed.visitsByCard === 'object') {
      visitsByCard.value = parsed.visitsByCard
    }
  } catch {
    localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)
  }
}

onMounted(() => {
  restoreGuestChatState()
})

watch(
  [messages, context, visitsByCard],
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
  return `Predlazem: ${names}. Ako zelite, mogu da suzim izbor po vasim prioritetima.`
}

function pickAssistantMessage(result) {
  const msg = String(result?.assistant_message || '').trim()
  return msg || null
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

function deriveCheckOut(checkIn, stayLengthDays) {
  if (!checkIn || !Number.isFinite(Number(stayLengthDays)) || Number(stayLengthDays) <= 0) {
    return null
  }

  const date = new Date(`${checkIn}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + Number(stayLengthDays))
  return date.toISOString().slice(0, 10)
}

function isWeatherQuestion(text) {
  const source = String(text || '').toLowerCase()
  return /vreme|temperatur|kis|sunc|prognoz|weather/.test(source)
}

function extractPreferredFacilityFromMessages() {
  for (let i = messages.value.length - 1; i >= 0; i -= 1) {
    const msg = messages.value[i]
    if (msg?.type !== 'suggestions' || !Array.isArray(msg?.suggestions) || !msg.suggestions.length) {
      continue
    }

    const recommended = msg.suggestions.find((item) => item?.is_recommended && Number(item?.facility_id) > 0)
    if (recommended) {
      return Number(recommended.facility_id)
    }

    const firstValid = msg.suggestions.find((item) => Number(item?.facility_id) > 0)
    if (firstValid) {
      return Number(firstValid.facility_id)
    }
  }

  return null
}

async function answerWeatherFromContext() {
  const checkIn = context.value.check_in
  if (!checkIn) {
    pushAssistantText('Da bih rekao kakvo ce vreme biti tada, potreban mi je tacan datum dolaska (YYYY-MM-DD).')
    return true
  }

  const facilityId = extractPreferredFacilityFromMessages()
  if (!facilityId) {
    pushAssistantText('Mogu da procenim vreme cim prvo predlozim smestaj za vas termin.')
    return true
  }

  busy.value = true
  try {
    const result = await api.chatSuggestVisit({
      facility_id: facilityId,
      check_in: checkIn,
      weather_mode: 'any',
      family: Boolean(Number(context.value.children || 0) > 0),
      lang: 'sr'
    })

    if (result?.weather?.summary) {
      pushAssistantText(result.weather.summary)
    } else {
      pushAssistantText('Za taj datum trenutno nemam pouzdanu vremensku prognozu, ali mogu da predlozim obilazak.')
    }
  } catch (error) {
    pushAssistantText(error?.data?.error || error?.message || 'Trenutno ne mogu da proverim vremensku prognozu.')
  } finally {
    busy.value = false
  }

  return true
}

function buildInquiryTargetRoute(item, payload) {
  if (!item?.facility_id || !payload?.target_room_id || !payload?.check_in || !payload?.check_out) {
    return null
  }

  return {
    name: 'smestaj-single',
    params: { id: String(item.facility_id) },
    query: {
      openInquiry: '1',
      roomId: String(payload.target_room_id),
      checkIn: String(payload.check_in),
      checkOut: String(payload.check_out)
    }
  }
}

function navigateToInquiry(targetRoute) {
  if (!targetRoute) {
    pushAssistantText('Ne mogu da otvorim formu za ovaj predlog. Posaljite novi upit pa pokusajte ponovo.')
    return
  }

  pendingReserve.value = null
  isOpen.value = false
  router.push(targetRoute)
}

async function sendMessage() {
  if (!canSend.value) return

  const text = inputText.value.trim()
  messages.value.push({ role: 'user', type: 'text', text })
  inputText.value = ''

  if (pendingReserve.value) {
    if (/\b(imam nalog|vec imam nalog|prijava|uloguj|ulogovati|login|log in)\b/i.test(text)) {
      goToLogin()
      return
    }

    if (/\b(nemam nalog|bez naloga|guest|gost)\b/i.test(text)) {
      continueWithoutAccount()
      return
    }

    if (isWeatherQuestion(text)) {
      const handledWeather = await answerWeatherFromContext()
      if (handledWeather) return
    }

    pushAssistantText('Za nastavak rezervacije napišite "imam nalog" ili "nemam nalog", pa vas vodim na formu.')
    return
  }

  busy.value = true
  try {
    const result = await api.chatPlanStay({ message: text, context: context.value })
    rememberContext(result.criteria)

    const aiMessage = pickAssistantMessage(result)

    if (result?.status === 'blocked' || result?.ai_contract?.guard?.class === 'out_of_domain' || result?.ai_contract?.guard?.class === 'unsafe') {
      pushAssistantText(aiMessage || 'Ovde sam za pitanja o smestaju i rezervaciji Nastavne baze Goc.')
      return
    }

    if (result.status === 'needs_input') {
      pushAssistantText(aiMessage || result.follow_up_question || 'Recite mi jos malo detalja pa nastavljamo.')
      return
    }

    if (aiMessage) {
      pushAssistantText(aiMessage)
    } else if (Array.isArray(result.next_actions) && result.next_actions.length) {
      const nonReservationHint = result.next_actions.find((line) => !/rezervacij/i.test(String(line)))
      if (nonReservationHint) {
        pushAssistantText(nonReservationHint)
      }
    }

    const hasSuggestions = Array.isArray(result.suggestions) && result.suggestions.length > 0
    const hasAlternatives = Array.isArray(result.alternatives) && result.alternatives.length > 0
    if (hasSuggestions || hasAlternatives) {
      messages.value.push({
        role: 'assistant',
        type: 'suggestions',
        text: aiMessage || summarizeSuggestions(result.suggestions),
        criteria: result.criteria,
        suggestions: result.suggestions || [],
        alternatives: result.alternatives || []
      })
    }
  } catch (error) {
    pushAssistantText(error?.data?.error || error.message || 'Chat servis trenutno nije dostupan.')
  } finally {
    busy.value = false
  }
}

function askForReservation(item, criteria = null) {
  if (!item || !item.room_id) {
    pushAssistantText('Ne mogu da pokrenem rezervaciju za ovaj predlog. Posaljite novi upit pa pokusavamo ponovo.')
    return
  }

  const payload = {
    ...(item.reservation_payload || {}),
    target_room_id: item.reservation_payload?.target_room_id || item.room_id,
    check_in: item.reservation_payload?.check_in || criteria?.check_in || context.value.check_in,
    check_out: item.reservation_payload?.check_out
      || criteria?.check_out
      || deriveCheckOut(criteria?.check_in || context.value.check_in, criteria?.stay_length_days || context.value.stay_length_days)
  }

  if (!payload.check_in || !payload.check_out) {
    pushAssistantText('Nedostaje termin za rezervaciju. Napisite ponovo datum dolaska i broj dana pa cu odmah pokrenuti rezervaciju.')
    return
  }

  pendingReserve.value = {
    ...item,
    reservation_payload: payload,
    inquiry_target: buildInquiryTargetRoute(item, payload)
  }

  const hasGuestToken = Boolean(localStorage.getItem('guest_token'))
  if (hasGuestToken) {
    navigateToInquiry(pendingReserve.value.inquiry_target)
    return
  }

  pushAssistantText('Pre usmeravanja na formu, recite da li imate nalog.')
}

function closeReservationModal() {
  pendingReserve.value = null
}

function goToLogin() {
  const targetRoute = pendingReserve.value?.inquiry_target
  const redirectTarget = targetRoute ? router.resolve(targetRoute).fullPath : '/smestaj'

  pendingReserve.value = null
  isOpen.value = false
  router.push({
    path: '/prijava',
    query: { redirect: redirectTarget }
  })
}

function continueWithoutAccount() {
  const targetRoute = pendingReserve.value?.inquiry_target
  navigateToInquiry(targetRoute)
}

watch(
  () => route.fullPath,
  () => {
    pendingReserve.value = null
  }
)

function clearChat() {
  messages.value = [
    {
      role: 'assistant',
      type: 'text',
      text: 'Zdravo! Pomazem oko smestaja na Gocu. Napisite broj osoba, termin i koliko dana zelite da ostanete.'
    }
  ]
  context.value = {
    adults: null,
    children: null,
    check_in: null,
    stay_length_days: null,
    pending_slot: null,
    preferences: []
  }
  visitsByCard.value = {}
  pendingReserve.value = null
  inputText.value = ''
  localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)
}

async function loadVisitSuggestions(facilityId, roomId, checkIn) {
  const cardKey = `${facilityId}-${roomId}`

  if (!facilityId) {
    pushAssistantText('Za ovaj predlog nedostaju podaci o objektu. Posaljite novi upit za osvezene predloge.')
    return
  }

  if (busy.value) {
    pushAssistantText('Sacekajte da zavrsim prethodni zahtev pa odmah dajem predloge obilaska.')
    return
  }

  const cached = visitsByCard.value[cardKey]
  if (Array.isArray(cached) && cached.length > 0) return

  const effectiveCheckIn = checkIn || context.value.check_in
  if (!effectiveCheckIn) {
    pushAssistantText('Nedostaje datum dolaska za predlog obilaska. Napisite datum pa nastavljamo.')
    return
  }

  busy.value = true
  try {
    const result = await api.chatSuggestVisit({
      facility_id: facilityId,
      check_in: effectiveCheckIn,
      weather_mode: 'any',
      family: true,
      lang: 'sr'
    })

    if (result?.weather?.summary) {
      pushAssistantText(result.weather.summary)
    }

    visitsByCard.value = {
      ...visitsByCard.value,
      [cardKey]: result.suggestions || []
    }
  } catch (error) {
    pushAssistantText(error?.data?.error || error?.message || 'Predlozi obilaska trenutno nisu dostupni.')
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
        <div class="stay-assistant-head-top">
          <div>
            <strong>Asistent za smestaj</strong>
            <small>Nastavna baza Goc</small>
          </div>
          <button
            type="button"
            class="stay-clear-btn"
            @click="clearChat"
            title="Očisti razgovor i počni ispočetka"
            aria-label="Očisti chat"
          >
            Novi chat
          </button>
        </div>
      </div>

      <div class="stay-assistant-body">
        <div
          v-for="(msg, index) in messages"
          :key="index"
          :class="['stay-bubble', msg.role === 'user' ? 'is-user' : 'is-assistant']"
        >
          <p>{{ msg.text }}</p>

          <div v-if="msg.type === 'suggestions' && msg.suggestions?.length" class="stay-suggestions">
            <div
              v-for="item in msg.suggestions"
              :key="`${item.facility_id}-${item.room_id}`"
              :class="['stay-card', { 'is-recommended': item.is_recommended }]"
            >
              <span v-if="item.is_recommended" class="recommend-badge">Preporuka za Vas</span>
              <strong>{{ item.facility_name }}</strong>
              <span>{{ item.room_name }}</span>
              <small>{{ item.rationale?.join(', ') }}</small>

              <div class="stay-card-actions">
                <button type="button" @click="loadVisitSuggestions(item.facility_id, item.room_id, msg.criteria?.check_in)">Predlozi obilazak</button>
                <button type="button" class="reserve-btn" @click="askForReservation(item, msg.criteria)">Rezervisi</button>
              </div>

              <ul v-if="visitsByCard[`${item.facility_id}-${item.room_id}`]?.length" class="visit-list">
                <li v-for="visit in visitsByCard[`${item.facility_id}-${item.room_id}`]" :key="visit.id">
                  {{ visit.name }}
                  <span v-if="visit.distance_minutes"> ({{ visit.distance_minutes }} min)</span>
                </li>
              </ul>
            </div>
          </div>
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
        <button type="button" @click="sendMessage" :disabled="!canSend">Posalji</button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="pendingReserve && !hasGuestToken()" class="reserve-modal-overlay" @click.self="closeReservationModal">
        <div class="reserve-modal" role="dialog" aria-modal="true" aria-label="Izbor toka za rezervaciju">
          <button type="button" class="reserve-modal-close" @click="closeReservationModal" aria-label="Zatvori">✕</button>
          <strong>Nastavak rezervacije</strong>
          <small>Za nastavak koristimo standardnu formu za rezervaciju. Da li imate nalog?</small>
          <div class="reserve-form-actions">
            <button type="button" @click="goToLogin">Imam nalog</button>
            <button type="button" class="ghost-btn" @click="continueWithoutAccount">Nemam nalog</button>
          </div>
        </div>
      </div>
    </Teleport>
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

.stay-clear-btn {
  background: #e8d5c4;
  color: #67462e;
  border: 1px solid #c8b3a4;
  padding: 4px 10px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: 3px;
  white-space: nowrap;
}

.stay-clear-btn:hover {
  background: #dcc4b3;
  border-color: #b8a39a;
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

.stay-assistant-head-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.stay-assistant-head-top div {
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

.stay-card.is-recommended {
  background: #f3e2d4;
  border-color: #9a714e;
}

.recommend-badge {
  align-self: flex-start;
  border: 1px solid #67462e;
  background: #67462e;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 6px;
  margin-bottom: 2px;
}

.stay-card .recommend-badge {
  color: #fff;
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

<style>
/* Reservation modal — teleported to body, cannot be scoped */
.reserve-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(40, 27, 17, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.reserve-modal {
  position: relative;
  width: min(400px, calc(100vw - 32px));
  background: #fffaf5;
  border: 2px solid #67462e;
  box-shadow: 0 16px 48px rgba(34, 22, 14, 0.32);
  padding: 32px 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: 'Georgia', serif;
}

.reserve-modal strong {
  font-size: 1.1rem;
  color: #332317;
}

.reserve-modal small {
  color: #67462e;
  font-size: 0.85rem;
}

.reserve-modal input {
  border: 1px solid #c8b3a4;
  padding: 10px;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.reserve-modal-close {
  position: absolute;
  top: 10px;
  right: 14px;
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #67462e;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
}
.reserve-modal-close:hover { color: #332317; }

.reserve-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.reserve-form-actions button {
  flex: 1;
  border: 1px solid #67462e;
  background: #cdac91;
  color: #332317;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 9px 10px;
  font-family: 'Georgia', serif;
}

.reserve-form-actions .ghost-btn {
  background: #fff;
}
</style>