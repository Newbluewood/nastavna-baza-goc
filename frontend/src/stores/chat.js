import { defineStore } from 'pinia';
import agentService from '../services/agentService';
import { useLangStore } from './lang';
import { useGuestStore } from './guest';
import { canOpenSiteReservationForm } from '../utils/reservationDeepLink';

const SESSION_KEY = 'goc_chat_session_id';

function emptyInquiryModal() {
  return {
    open: false,
    roomId: null,
    roomName: '',
    buildingName: '',
    checkIn: '',
    checkOut: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    boardType: 'base',
  };
}

function getOrCreateSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function toIsoDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  return s;
}

function normalizeReservationAction(action) {
  if (!action || action.type !== 'open_reservation_form') return action;
  const normalized = { ...action };
  if (!normalized.target_room && normalized.room_name) {
    normalized.target_room = normalized.room_name;
  }
  normalized.check_in = toIsoDate(normalized.check_in);
  normalized.check_out = toIsoDate(normalized.check_out);
  return normalized;
}

function parseMeta(meta) {
  if (!meta) return null;
  if (typeof meta === 'string') {
    try {
      return JSON.parse(meta);
    } catch {
      return null;
    }
  }
  return meta;
}

function dedupeHistoryRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = `${row.role}::${row.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapHistoryRow(row) {
  const meta = parseMeta(row.meta);
  const action = normalizeReservationAction(meta?.action || null);

  return {
    role: row.role,
    content: row.message,
    action,
    timestamp: row.created_at || new Date().toISOString(),
    checkIn: action?.check_in || '',
    checkOut: action?.check_out || '',
    boardType: action?.board_type || 'base',
    guestName: action?.guest_name || '',
    guestEmail: action?.guest_email || '',
    guestPhone: action?.guest_phone || '',
    showForm: !!action,
    redirectedToSite: false,
    submitted: false,
    needsRoomChoice: false,
    roomCandidates: [],
  };
}

function buildUserContext(guestStore) {
  return {
    logged_in: guestStore.isLoggedIn,
    guest_id: guestStore.guest?.id || null,
    guest_name: guestStore.guest?.name || '',
    guest_email: guestStore.guest?.email || '',
    guest_phone: guestStore.guest?.phone || '',
  };
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isOpen: false,
    isLoading: false,
    error: null,
    sessionId: getOrCreateSessionId(),
    inquiryModal: emptyInquiryModal(),
  }),

  actions: {
    toggleChat() {
      this.isOpen = !this.isOpen;
    },

    openChat() {
      this.isOpen = true;
    },

    closeChat() {
      this.isOpen = false;
    },

    applyResolvedRoom(action, room) {
      return normalizeReservationAction({
        ...action,
        room_id: room.id,
        facility_id: room.facility_id,
        facility_name: room.facility_name,
        target_room: room.name,
      });
    },

    openInquiryFromAction(action) {
      if (!canOpenSiteReservationForm(action)) return false;
      this.inquiryModal = {
        open: true,
        roomId: Number(action.room_id),
        roomName: action.target_room || action.room_name || '',
        buildingName: action.facility_name || '',
        checkIn: action.check_in || '',
        checkOut: action.check_out || '',
        guestName: action.guest_name || '',
        guestEmail: action.guest_email || '',
        guestPhone: action.guest_phone || '',
        boardType: action.board_type || 'base',
      };
      this.isOpen = false;
      return action;
    },

    /**
     * Ako nema room_id ili match nije siguran — ponudi izbor soba pre forme.
     */
    async prepareReservation(msg, action, { autoOpen = false } = {}) {
      const normalized = normalizeReservationAction(action);
      msg.action = normalized;
      msg.needsRoomChoice = false;
      msg.roomCandidates = [];

      if (normalized.room_id) {
        if (autoOpen) {
          const opened = this.openInquiryFromAction(normalized);
          if (opened) {
            msg.action = opened;
            msg.redirectedToSite = true;
          }
        }
        return;
      }

      const lookupName = normalized.target_room || normalized.room_name;
      if (!lookupName) return;

      const search = await agentService.searchRooms(lookupName);
      msg.roomCandidates = search.candidates || [];

      if (search.certain) {
        msg.action = this.applyResolvedRoom(normalized, search.certain);
        if (autoOpen) {
          const opened = this.openInquiryFromAction(msg.action);
          if (opened) {
            msg.action = opened;
            msg.redirectedToSite = true;
          }
        }
        return;
      }

      if (msg.roomCandidates.length > 0) {
        msg.needsRoomChoice = true;
        return;
      }

      this.error = 'Nismo pronašli sobu u bazi. Pokušajte preciznije (npr. „Piramida apartman“ ili broj sobe).';
    },

    async selectRoomForReservation(msg, room) {
      msg.action = this.applyResolvedRoom(msg.action, room);
      msg.needsRoomChoice = false;
      msg.roomCandidates = [];
      const opened = this.openInquiryFromAction(msg.action);
      if (opened) {
        msg.action = opened;
        msg.redirectedToSite = true;
      }
    },

    async openSiteReservationForm(action) {
      const normalized = normalizeReservationAction(action);
      if (!canOpenSiteReservationForm(normalized)) return false;
      return this.openInquiryFromAction(normalized);
    },

    closeInquiryModal() {
      this.inquiryModal.open = false;
    },

    addMessage(role, content, action = null) {
      this.messages.push({ 
        role, 
        content, 
        action, 
        timestamp: new Date().toISOString(),
        checkIn: action?.check_in || '',
        checkOut: action?.check_out || '',
        boardType: action?.board_type || 'base',
        guestName: action?.guest_name || '',
        guestEmail: action?.guest_email || '',
        guestPhone: action?.guest_phone || '',
        showForm: !!action,
        redirectedToSite: false,
        submitted: false,
        needsRoomChoice: false,
        roomCandidates: [],
      });
    },
    
    async sendMessage(content) {
      const guestStore = useGuestStore();
      const userContext = buildUserContext(guestStore);

      this.error = null;
      this.addMessage('user', content);
      await this.persistMessageToSite('user', content);
      this.isLoading = true;

      let assistantMsg = null;
      try {
        const history = this.messages
          .slice(-6, -1)
          .map(m => ({ role: m.role, content: m.content }));

        const langStore = useLangStore();
        this.addMessage('assistant', '');
        assistantMsg = this.messages[this.messages.length - 1];

        await agentService.sendMessageStream(
          content, 
          history, 
          langStore.currentLang,
          (chunk) => { assistantMsg.content += chunk; },
          (action) => {
            const normalized = normalizeReservationAction(action);
            assistantMsg.action = normalized;
            assistantMsg.guestName = normalized?.guest_name || userContext.guest_name || '';
            assistantMsg.guestEmail = normalized?.guest_email || userContext.guest_email || '';
            assistantMsg.guestPhone = normalized?.guest_phone || userContext.guest_phone || '';
            assistantMsg.checkIn = normalized?.check_in || '';
            assistantMsg.checkOut = normalized?.check_out || '';
            assistantMsg.boardType = normalized?.board_type || 'base';
            assistantMsg.showForm = false;
            this.prepareReservation(assistantMsg, normalized, { autoOpen: true });
          },
          {
            sessionId: this.sessionId,
            userContext,
          },
        );

        if (assistantMsg?.content) {
          const meta = assistantMsg.action
            ? { action: assistantMsg.action, profile: userContext }
            : null;
          await this.persistMessageToSite('assistant', assistantMsg.content, meta);
        }
      } catch (err) {
        console.error('Chat Agent error:', err);
        this.error = err.message;
        if (assistantMsg) {
          assistantMsg.content = 'Žao mi je, došlo je do greške. Molim vas pokušajte ponovo.';
        }
      } finally {
        this.isLoading = false;
      }
    },
    
    async chatReserveStay(payload) {
      const { default: api } = await import('../services/api');
      return api.chatReserveStay(payload);
    },

    clearHistory() {
      this.messages = [];
      this.error = null;
      this.sessionId = getOrCreateSessionId();
      sessionStorage.setItem(SESSION_KEY, this.sessionId);
      this.inquiryModal = emptyInquiryModal();
    },

    async persistMessageToSite(role, message, meta = null) {
      const guestStore = useGuestStore();
      if (!guestStore.isLoggedIn) return;

      try {
        const { default: api } = await import('../services/api');
        await api.saveChatMessage({
          role,
          message,
          session_id: this.sessionId,
          meta,
        });
      } catch (err) {
        console.warn('Chat history save failed:', err.message);
      }
    },

    async loadHistory() {
      const guestStore = useGuestStore();
      if (!guestStore.isLoggedIn) return false;

      try {
        const { default: api } = await import('../services/api');
        const rows = await api.getChatHistory(this.sessionId);
        if (!Array.isArray(rows) || rows.length === 0) return false;

        this.messages = dedupeHistoryRows(rows).map(mapHistoryRow);
        return true;
      } catch (err) {
        console.warn('Chat history load failed:', err.message);
        return false;
      }
    },
  }
});
