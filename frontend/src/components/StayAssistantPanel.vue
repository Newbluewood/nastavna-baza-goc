<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'
import { useGuestStore } from '../stores/guest'
import { useLangStore } from '../stores/lang'

const emit = defineEmits(['chip-action'])

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMessageText(text) {
  if (!text) return ''
  // Escape HTML first
  let safe = escapeHtml(text)
  // Regex for URLs
  const urlRegex = /(https?:\/\/[\w\-\.\/?#&=;%+~:@!$'*(),]+|www\.[\w\-\.\/?#&=;%+~:@!$'*(),]+)/gi
  safe = safe.replace(urlRegex, (url) => {
    let href = url
    if (!href.startsWith('http')) href = 'http://' + href
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
  return safe
}

const router = useRouter()
/** Bump when guest offline state shape or default UX should reset for all visitors. */
const GUEST_CHAT_STORAGE_KEY = 'stay_assistant_guest_chat_v2'

const isOpen = ref(false)
const busy = ref(false)
const inputText = ref('')
const inputEl = ref(null)
const pendingReserve = ref(null)
const guestName = ref('')
const guestEmail = ref('')
const visitsByCard = ref({})

// --- Guide mode state (site-guide agent) ---------------------------------
const langStore = useLangStore()
const t = (key) => langStore.t(key)

const currentMode = ref('booking')
const guideMessages = ref([])
const guideInputText = ref('')
const guideInputEl = ref(null)
const guideBodyEl = ref(null)
const guideLoading = ref(false)

/** Vite dev only: show how site-guide was produced (RAG vs keyword fallback). */
const showGuideDevHud = import.meta.env.DEV

function buildGuideDevHud(meta) {
  if (!meta || typeof meta !== 'object') return null
  if (meta.fallback === 'keyword' || meta.fallback === 'generic') {
    const r = meta.reason ? ` · ${meta.reason}` : ''
    return `dev · fallback=${meta.fallback}${r}`
  }
  const bits = ['dev · RAG']
  if (meta.model) bits.push(String(meta.model))
  if (meta.hits != null) bits.push(`${meta.hits} vec hits`)
  if (meta.tokensIn != null || meta.tokensOut != null) {
    bits.push(`tokens ${meta.tokensIn ?? '?'}/${meta.tokensOut ?? '?'}`)
  }
  return bits.join(' · ')
}

const panelRoot = ref(null)
const panelHeaderEl = ref(null)
const previouslyFocused = ref(null)

const canSendGuide = computed(
  () => guideInputText.value.trim().length > 0 && !guideLoading.value
)

watch(isOpen, async (open) => {
  if (open) {
    // Remember opener so we can restore focus on close.
    previouslyFocused.value = document.activeElement
    await nextTick()
    if (currentMode.value === 'guide') {
      guideInputEl.value?.focus()
    } else {
      inputEl.value?.focus()
    }
  } else {
    const prev = previouslyFocused.value
    previouslyFocused.value = null
    if (prev && typeof prev.focus === 'function') {
      try { prev.focus() } catch { /* noop */ }
    }
  }
})

async function setMode(mode) {
  if (mode !== 'booking' && mode !== 'guide') return
  if (currentMode.value === mode) return
  currentMode.value = mode
  await nextTick()
  if (mode === 'guide') {
    guideInputEl.value?.focus()
    scrollGuideToBottom()
  } else {
    inputEl.value?.focus()
  }
}

function scrollGuideToBottom() {
  const el = guideBodyEl.value
  if (!el) return
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight
  })
}

async function sendGuideMessage() {
  if (!canSendGuide.value) return
  const text = guideInputText.value.trim()
  guideMessages.value.push({
    role: 'user',
    text,
    ts: Date.now()
  })
  guideInputText.value = ''
  guideLoading.value = true
  scrollGuideToBottom()
  try {
    const result = await api.chatSiteGuideTurn({
      message: text,
      lang: langStore.currentLang
    })
    guideMessages.value.push({
      role: 'assistant',
      text: result?.answer || t('assistant.guideError'),
      suggestions: Array.isArray(result?.suggestions) ? result.suggestions : [],
      guideDevHud: showGuideDevHud ? buildGuideDevHud(result?.meta) : null,
      ts: Date.now()
    })
  } catch (_err) {
    guideMessages.value.push({
      role: 'assistant',
      text: t('assistant.guideError'),
      suggestions: [],
      guideDevHud: showGuideDevHud ? 'dev · request failed (network or HTTP)' : null,
      ts: Date.now()
    })
  } finally {
    guideLoading.value = false
    await nextTick()
    scrollGuideToBottom()
  }
}

function handleChipClick(suggestion) {
  if (!suggestion || !suggestion.type || !suggestion.route) return
  if (suggestion.type === 'navigate') {
    router.push(suggestion.route)
    isOpen.value = false
  } else if (suggestion.type === 'external') {
    window.open(suggestion.route, '_blank', 'noopener,noreferrer')
  } else if (suggestion.type === 'action') {
    emit('chip-action', { action: suggestion.route, label: suggestion.label })
  }
}

// --- Panel keyboard handling (Esc + focus trap) ---------------------------
function getFocusableElements() {
  const root = panelRoot.value
  if (!root) return []
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',')
  const nodes = Array.from(root.querySelectorAll(selector))
  return nodes.filter((el) => !el.hasAttribute('disabled') && !el.hidden && el.offsetParent !== null)
}

function handlePanelKeydown(e) {
  if (!isOpen.value) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    isOpen.value = false
    return
  }
  if (e.key === 'Tab') {
    const items = getFocusableElements()
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || !panelRoot.value?.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

// --- Mobile: visual viewport + swipe-down dismiss ------------------------
function handleViewportResize() {
  if (!isOpen.value) return
  if (currentMode.value === 'guide') {
    scrollGuideToBottom()
  }
}

let touchStartY = 0
let touchTracking = false
function onHeaderTouchStart(e) {
  if (!e.touches || !e.touches.length) return
  touchStartY = e.touches[0].clientY
  touchTracking = true
}
function onHeaderTouchEnd(e) {
  if (!touchTracking) return
  touchTracking = false
  const endY = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : touchStartY
  if (endY - touchStartY > 50) isOpen.value = false
}

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
  guestName.value = ''
  guestEmail.value = ''
  localStorage.removeItem(GUEST_CHAT_STORAGE_KEY)

  // For logged-in guests, start a fresh chat thread after reset.
  if (isLoggedIn.value) {
    sessionId.value = `session-${Date.now()}`
  }
}

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

const guestStore = useGuestStore()
const isLoggedIn = computed(() => guestStore.isLoggedIn)
const sessionId = ref(null)

// Load chat history for logged-in users
async function loadUserChatHistory() {
  if (!isLoggedIn.value) return
  try {
    const history = await api.getChatHistory(sessionId.value)
    if (Array.isArray(history) && history.length) {
      messages.value = history.map(msg => ({
        role: msg.role,
        type: 'text',
        text: msg.message
      }))
    }
  } catch (e) {
    // fallback: do nothing
  }
}

onMounted(async () => {
  if (isLoggedIn.value) {
    await loadUserChatHistory()
  } else {
    restoreGuestChatState()
  }
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportResize)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportResize)
  }
})

// Save message to backend for logged-in users
async function saveUserMessage(role, text) {
  if (!isLoggedIn.value) return
  try {
    await api.saveChatMessage({ role, message: text, session_id: sessionId.value })
  } catch (e) {}
}

// Patch sendMessage to save messages for logged-in users
async function sendMessage() {
  if (!canSend.value) return
  const text = inputText.value.trim()
  messages.value.push({ role: 'user', type: 'text', text })
  inputText.value = ''
  if (isLoggedIn.value) await saveUserMessage('user', text)
  busy.value = true
  try {
    const result = await api.chatPlanStay({ message: text, context: context.value })
    rememberContext(result.criteria)
    if (result.assistant_message) {
      pushAssistantText(result.assistant_message)
      if (isLoggedIn.value) await saveUserMessage('assistant', result.assistant_message)
    }
    if (result.status === 'needs_input' && result.follow_up_question) {
      pushAssistantText(result.follow_up_question)
      if (isLoggedIn.value) await saveUserMessage('assistant', result.follow_up_question)
      return
    }
    if (Array.isArray(result.next_actions) && result.next_actions.length) {
      pushAssistantText(result.next_actions[0])
      if (isLoggedIn.value) await saveUserMessage('assistant', result.next_actions[0])
    }
    if (Array.isArray(result.suggestions) && result.suggestions.length) {
      messages.value.push({
        role: 'assistant',
        type: 'suggestions',
        text: summarizeSuggestions(result.suggestions),
        criteria: result.criteria,
        suggestions: result.suggestions || [],
        alternatives: result.alternatives || []
      })
      if (isLoggedIn.value) await saveUserMessage('assistant', summarizeSuggestions(result.suggestions))
    }
  } catch (error) {
    pushAssistantText(error?.data?.error || error.message || 'Chat servis trenutno nije dostupan.')
    if (isLoggedIn.value) await saveUserMessage('assistant', error?.data?.error || error.message || 'Chat servis trenutno nije dostupan.')
  } finally {
    busy.value = false
  }
}

// Patch persist/restore for guests only
watch(
  [messages, context, visitsByCard],
  () => {
    if (!isLoggedIn.value) persistGuestChatState()
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

function deriveCheckOut(checkIn, stayLengthDays) {
  if (!checkIn || !Number.isFinite(Number(stayLengthDays)) || Number(stayLengthDays) <= 0) {
    return null
  }

  const date = new Date(`${checkIn}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + Number(stayLengthDays))
  return date.toISOString().slice(0, 10)
}

async function askForReservation(item, criteria = null) {
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
    reservation_payload: payload
  }

  const hasGuestToken = Boolean(localStorage.getItem('guest_token'))
  if (hasGuestToken) {
    createReservation()
    return
  }

  pushAssistantText('Za rezervaciju mi trebaju ime i prezime i email. Ako vec imate nalog, prijavite se pa nastavljamo odmah.')
}

async function createReservation() {
  if (busy.value) return
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
    if (error?.status === 401 || error?.status === 403) {
      localStorage.removeItem('guest_token')
      pushAssistantText('Sesija je istekla. Unesite ime i email pa cu nastaviti rezervaciju, ili se prijavite ponovo.')
      return
    }

    if (error?.status === 400 && String(error?.data?.error || '').includes('sender_name and email are required')) {
      localStorage.removeItem('guest_token')
      pushAssistantText('Sesija vise nije vazeca. Unesite ime i email pa cu odmah nastaviti rezervaciju.')
      return
    }

    if (error?.status === 409 && error?.data?.status === 'unavailable') {
      pushAssistantText('Naiskrenije se izvinjavamo — zbog internih reorganizacija, ponudjeni smestaj trenutno nije dostupan. Mozete potraziti drugi termin ili nas kontaktirati za vise informacija. Hvala na razumevanju.')
      pendingReserve.value = null
      return
    }

    if (error?.data?.status === 'login_required') {
      pushAssistantText('Vec postoji nalog za taj email. Prijavite se da nastavim rezervaciju.')
      return
    }

    const backendError = String(error?.data?.error || error?.data?.message || error?.message || '')
    if (backendError.includes('target_room_id, check_in and check_out are required')) {
      pushAssistantText('Nedostaju podaci o terminu ili sobi. Posaljite novi upit pa pokusajte ponovo.')
      return
    }

    if (backendError.includes('sender_name and email are required')) {
      pushAssistantText('Unesite ime i email pa kliknite ponovo na slanje rezervacije.')
      return
    }

    pushAssistantText('Rezervacija trenutno nije uspela. Pokusajte ponovo za nekoliko sekundi.')
  } finally {
    busy.value = false
  }
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

function closeReservationModal() {
  if (busy.value) return
  pendingReserve.value = null
}

function goToLogin() {
  router.push('/prijava')
}

// ...
</script>
<template>
  <div class="stay-assistant-wrapper">
    <button
      class="stay-assistant-toggle"
      :class="{ 'is-open': isOpen }"
      @click="isOpen = !isOpen"
      :aria-label="isOpen ? t('assistant.closeAssistant') : t('assistant.openAssistant')"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :title="isOpen ? t('assistant.closeAssistant') : t('assistant.openAssistant')"
    >
      <template v-if="!isOpen">
        <img src="/buble-chat.png" alt="Chat" class="chat-bubble-icon" />
      </template>
      <template v-else>
        {{ t('assistant.closeAssistant') }}
      </template>
    </button>

    <div
      v-if="isOpen"
      ref="panelRoot"
      class="stay-assistant-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stay-assistant-title"
      @keydown="handlePanelKeydown"
    >
      <div
        ref="panelHeaderEl"
        class="stay-assistant-head"
        @touchstart.passive="onHeaderTouchStart"
        @touchend.passive="onHeaderTouchEnd"
      >
        <div class="stay-assistant-head-top">
          <div>
            <strong id="stay-assistant-title">Asistent za smestaj</strong>
            <small>Nastavna baza Goc</small>
          </div>
          <button
            v-if="currentMode === 'booking'"
            type="button"
            class="stay-clear-btn"
            @click="clearChat"
            title="Novi chat"
            aria-label="Pokreni novi chat"
          >
            Novi chat
          </button>
        </div>

        <div class="assistant-mode-switcher" role="tablist" :aria-label="t('assistant.modeBooking') + ' / ' + t('assistant.modeGuide')">
          <button
            type="button"
            id="tab-booking"
            class="assistant-mode-btn"
            :class="{ 'is-active': currentMode === 'booking' }"
            role="tab"
            :aria-selected="currentMode === 'booking' ? 'true' : 'false'"
            :tabindex="currentMode === 'booking' ? 0 : -1"
            aria-controls="panel-booking"
            @click="setMode('booking')"
          >
            {{ t('assistant.modeBooking') }}
          </button>
          <button
            type="button"
            id="tab-guide"
            class="assistant-mode-btn"
            :class="{ 'is-active': currentMode === 'guide' }"
            role="tab"
            :aria-selected="currentMode === 'guide' ? 'true' : 'false'"
            :tabindex="currentMode === 'guide' ? 0 : -1"
            aria-controls="panel-guide"
            @click="setMode('guide')"
          >
            {{ t('assistant.modeGuide') }}
          </button>
        </div>
      </div>

      <div
        v-show="currentMode === 'booking'"
        id="panel-booking"
        role="tabpanel"
        aria-labelledby="tab-booking"
        class="stay-assistant-tabpanel"
      >
        <div class="stay-assistant-body" aria-live="polite">
          <div
            v-for="(msg, index) in messages"
            :key="index"
            :class="['stay-bubble', msg.role === 'user' ? 'is-user' : 'is-assistant']"
          >
            <p v-html="renderMessageText(msg.text)"></p>

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

      <div
        v-show="currentMode === 'guide'"
        id="panel-guide"
        role="tabpanel"
        aria-labelledby="tab-guide"
        class="stay-assistant-tabpanel assistant-guide"
      >
        <p class="assistant-guide-intro">{{ t('assistant.guideIntro') }}</p>

        <div
          ref="guideBodyEl"
          class="assistant-guide-body"
          aria-live="polite"
        >
          <p v-if="!guideMessages.length && !guideLoading" class="assistant-guide-empty">
            {{ t('assistant.guideEmpty') }}
          </p>

          <div
            v-for="(msg, index) in guideMessages"
            :key="`g-${index}`"
            :class="['assistant-guide-bubble', msg.role === 'user' ? 'is-user' : 'is-assistant']"
          >
            <p class="assistant-guide-text">{{ msg.text }}</p>
            <p
              v-if="showGuideDevHud && msg.role === 'assistant' && msg.guideDevHud"
              class="assistant-guide-dev-hud"
            >{{ msg.guideDevHud }}</p>

            <div
              v-if="msg.role === 'assistant' && msg.suggestions && msg.suggestions.length"
              class="assistant-chip-row"
            >
              <button
                v-for="(sug, sIdx) in msg.suggestions"
                :key="`s-${index}-${sIdx}`"
                type="button"
                class="assistant-chip"
                :aria-label="sug.label"
                @click="handleChipClick(sug)"
              >
                {{ sug.label }}
              </button>
            </div>
          </div>

          <p v-if="guideLoading" class="assistant-guide-loading" aria-live="polite">…</p>
        </div>

        <div class="stay-assistant-input assistant-guide-input-row">
          <input
            ref="guideInputEl"
            v-model="guideInputText"
            type="text"
            :placeholder="t('assistant.guidePlaceholder')"
            :aria-label="t('assistant.guidePlaceholder')"
            @keyup.enter="sendGuideMessage"
          />
          <button
            type="button"
            class="assistant-send"
            @click="sendGuideMessage"
            :disabled="!canSendGuide"
          >
            {{ t('assistant.send') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="pendingReserve && !hasGuestToken()" class="reserve-modal-overlay" @click.self="closeReservationModal">
      <div class="reserve-modal" role="dialog" aria-modal="true" aria-label="Unos podataka za rezervaciju">
        <button type="button" class="reserve-modal-close" @click="closeReservationModal" aria-label="Zatvori">✕</button>
        <strong>Podaci za rezervaciju</strong>
        <small>Unesite ime i email da zavrsim rezervaciju.</small>
        <input v-model="guestName" type="text" placeholder="Ime i prezime" />
        <input v-model="guestEmail" type="email" placeholder="Email" />
        <div class="reserve-form-actions">
          <button type="button" @click="createReservation" :disabled="busy">Posalji rezervaciju</button>
          <button type="button" class="ghost-btn" @click="goToLogin" :disabled="busy">Imam nalog, prijava</button>
        </div>
      </div>
    </div>
  </div>
 </template>
<style scoped>
/* Stilovi za rezervacioni modal i dugmad */
.stay-assistant-wrapper {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 1200;
  width: 360px;
  max-width: calc(100vw - 32px);
  transform: none;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.stay-card-actions .reserve-btn {
  background: #2e7d32;
  color: #fff;
  border-radius: 4px;
  padding: 4px 12px;
  margin-left: 8px;
  border: none;
  cursor: pointer;
  font-weight: bold;
}
.reserve-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.35);
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
}
.reserve-modal {
  background: #fff;
  border-radius: 8px;
  padding: 32px 24px 24px 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.reserve-modal-close {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  font-size: 22px;
  cursor: pointer;
}
.reserve-form-actions {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}
.ghost-btn {
  background: #eee;
  color: #333;
  border-radius: 4px;
  border: none;
  padding: 4px 12px;
  cursor: pointer;
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
  min-height: 320px;
  min-width: 320px;
  box-sizing: border-box;
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

.reserve-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(40, 27, 17, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1500;
}

.reserve-modal {
  position: relative;
  width: min(360px, calc(100vw - 24px));
  background: #fffaf5;
  border: 2px solid var(--c-braon-6);
  box-shadow: 0 12px 32px rgba(34, 22, 14, 0.24);
  padding: 28px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reserve-modal-close {
  position: absolute;
  top: 6px;
  right: 8px;
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #67462e;
  cursor: pointer;
  line-height: 1;
  padding: 2px 6px;
}
.reserve-modal-close:hover {
  color: #332317;
}

.reserve-modal strong {
  color: #332317;
}

.reserve-modal small {
  color: #67462e;
}

.reserve-modal input {
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
    right: 0;
    bottom: 0;
    width: 100vw;
  }

  .stay-assistant-toggle {
    width: 48px;
    height: 48px;
    position: fixed;
    right: 10px;
    bottom: 10px;
  }

  .stay-assistant-toggle.is-open {
    position: static;
    width: 100%;
    height: auto;
  }

  .stay-assistant-panel {
    max-height: 80vh;
    border-left: none;
    border-right: none;
    border-bottom: none;
    min-width: 0;
  }

  .chat-bubble-icon {
    width: 28px;
    height: 28px;
  }
}

/* =========================================================================
 * Site-guide mode: mode switcher, guide panel, chips.
 * Additive only — does not override existing booking styles.
 * ========================================================================= */
.stay-assistant-tabpanel {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.assistant-mode-switcher {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-top: 8px;
}

.assistant-mode-btn {
  border: 1px solid #67462e;
  background: #fff;
  color: #332317;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 2px;
  min-height: 34px;
}

.assistant-mode-btn:hover {
  background: #f3e2d4;
}

.assistant-mode-btn.is-active {
  background: #332317;
  color: #fff;
  border-color: #332317;
}

.assistant-guide {
  background: #fff;
}

.assistant-guide-intro {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.8rem;
  color: #4d3a2b;
  background: #fdf9f5;
  border-bottom: 1px solid #e3c4ad;
}

.assistant-guide-body {
  padding: 10px;
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assistant-guide-empty {
  margin: 0;
  color: #67462e;
  font-size: 0.82rem;
  font-style: italic;
}

.assistant-guide-bubble {
  padding: 8px;
  border: 1px solid #e3c4ad;
  border-radius: 2px;
  max-width: 100%;
}

.assistant-guide-bubble.is-user {
  align-self: flex-end;
  background: #fff1e6;
  max-width: 95%;
}

.assistant-guide-bubble.is-assistant {
  align-self: flex-start;
  background: #fdf9f5;
}

.assistant-guide-text {
  margin: 0;
  text-align: left;
  font-size: 0.84rem;
  color: #332317;
  white-space: pre-line;
  word-break: break-word;
}

.assistant-guide-loading {
  margin: 0;
  color: #67462e;
  font-size: 0.9rem;
  text-align: left;
}

.assistant-chip-row {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.assistant-chip {
  border: 1px solid #332317;
  background: #cdac91;
  color: #332317;
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 2px;
  line-height: 1.2;
  text-align: left;
}

.assistant-chip:hover {
  background: #b9946f;
}

.assistant-send {
  border: 1px solid #67462e;
  background: #67462e;
  color: #fff;
  cursor: pointer;
  padding: 0 12px;
  font-size: 0.78rem;
  border-radius: 2px;
}

.assistant-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.assistant-guide-input-row input {
  border: 1px solid var(--c-braon-6, #67462e);
  background: transparent;
  padding: 9px;
  font-size: 0.8rem;
}

/* ---- Focus-visible: every interactive element gets a clear outline ---- */
.assistant-mode-btn:focus-visible,
.assistant-chip:focus-visible,
.assistant-send:focus-visible,
.assistant-guide-input-row input:focus-visible,
.stay-assistant-input input:focus-visible,
.stay-assistant-input button:focus-visible,
.stay-clear-btn:focus-visible,
.stay-assistant-toggle:focus-visible,
.reserve-modal input:focus-visible,
.reserve-form-actions button:focus-visible,
.reserve-modal-close:focus-visible,
.stay-card-actions button:focus-visible {
  outline: 2px solid #332317;
  outline-offset: 2px;
}

/* Reduced-motion: suppress transitions/animations inside the panel. */
@media (prefers-reduced-motion: reduce) {
  .stay-assistant-panel,
  .stay-assistant-panel *,
  .reserve-modal,
  .reserve-modal * {
    transition: none !important;
    animation: none !important;
  }
}

/* ---- Mobile rules for the assistant dialog as a whole ---- */
@media (max-width: 640px) {
  .stay-assistant-panel {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;
    padding-top: max(12px, env(safe-area-inset-top));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    box-sizing: border-box;
  }

  .assistant-chip,
  .assistant-mode-btn,
  .assistant-send,
  .stay-assistant-input button {
    min-height: 44px;
    min-width: 44px;
  }

  .stay-assistant-input,
  .assistant-guide-input-row {
    position: sticky;
    bottom: 0;
    background: #fff;
    z-index: 2;
  }

  .stay-assistant-body,
  .assistant-guide-body {
    flex: 1 1 auto;
    overflow-y: auto;
  }
}
</style>