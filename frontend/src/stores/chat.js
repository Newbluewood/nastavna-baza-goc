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
    alternativeRooms: [],
    showAlternatives: false,
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
     * Pronađena soba → prikaži karticu sa Potvrdi (forma tek na klik).
     * Bez room_id → primarni izbor sobe.
     */
    async prepareReservation(msg, action) {
      const normalized = normalizeReservationAction(action);
      msg.action = normalized;
      msg.needsRoomChoice = false;
      msg.roomCandidates = [];
      msg.alternativeRooms = [];
      msg.showAlternatives = false;
      msg.redirectedToSite = false;

      if (normalized.room_id) {
        msg.alternativeRooms = (normalized.alternative_rooms || [])
          .filter((r) => Number(r.id) !== Number(normalized.room_id));

        if (msg.alternativeRooms.length === 0 && normalized.facility_name) {
          const broad = await agentService.searchRooms(normalized.facility_name.split(/\s+/).pop() || normalized.facility_name, {
            check_in: normalized.check_in,
            check_out: normalized.check_out,
          });
          const opts = broad.room_options || broad.candidates || [];
          msg.alternativeRooms = opts.filter((r) => Number(r.id) !== Number(normalized.room_id));
        }
        return;
      }

      const optionsFromAction = normalized.room_options;
      if (Array.isArray(optionsFromAction) && optionsFromAction.length > 0) {
        msg.roomCandidates = optionsFromAction;
        msg.needsRoomChoice = true;
        return;
      }

      const lookupName = normalized.target_room || normalized.room_name;
      if (!lookupName) return;

      const search = await agentService.searchRooms(lookupName, {
        check_in: normalized.check_in,
        check_out: normalized.check_out,
      });

      const options = search.room_options || search.candidates || [];
      if (options.length > 0) {
        msg.roomCandidates = options;
        msg.needsRoomChoice = true;
        return;
      }

      const broad = await agentService.searchRooms(lookupName.split(/\s+/)[0], {
        check_in: normalized.check_in,
        check_out: normalized.check_out,
      });
      const broadOptions = broad.room_options || broad.candidates || [];
      if (broadOptions.length > 0) {
        msg.roomCandidates = broadOptions;
        msg.needsRoomChoice = true;
      }
    },

    toggleAlternativeRooms(msg) {
      msg.showAlternatives = !msg.showAlternatives;
    },

    async selectRoomForReservation(msg, room) {
      msg.action = this.applyResolvedRoom(msg.action, room);
      msg.needsRoomChoice = false;
      msg.roomCandidates = [];
      msg.redirectedToSite = false;
      msg.alternativeRooms = (msg.alternativeRooms || []).filter(
        (r) => Number(r.id) !== Number(room.id),
      );
      msg.showAlternatives = false;
    },

    async confirmReservation(msg) {
      if (!msg.action?.room_id) return false;
      const opened = this.openInquiryFromAction(msg.action);
      if (opened) {
        msg.action = opened;
        msg.redirectedToSite = true;
      }
      return !!opened;
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
        alternativeRooms: [],
        showAlternatives: false,
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
        let pendingAction = null;
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
            pendingAction = normalizeReservationAction(action);
          },
          {
            sessionId: this.sessionId,
            userContext,
          },
        );

        if (pendingAction && assistantMsg) {
          assistantMsg.action = pendingAction;
          assistantMsg.guestName = pendingAction.guest_name || userContext.guest_name || '';
          assistantMsg.guestEmail = pendingAction.guest_email || userContext.guest_email || '';
          assistantMsg.guestPhone = pendingAction.guest_phone || userContext.guest_phone || '';
          assistantMsg.checkIn = pendingAction.check_in || '';
          assistantMsg.checkOut = pendingAction.check_out || '';
          assistantMsg.boardType = pendingAction.board_type || 'base';
          await this.prepareReservation(assistantMsg, pendingAction);
        }

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
