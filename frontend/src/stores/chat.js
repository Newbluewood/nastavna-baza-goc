import { defineStore } from 'pinia';
import agentService from '../services/agentService';
import { useLangStore } from './lang';
import { useGuestStore } from './guest';

const SESSION_KEY = 'goc_chat_session_id';

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

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isOpen: false,
    isLoading: false,
    error: null,
    sessionId: getOrCreateSessionId(),
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
        submitted: false
      });
    },
    
    async sendMessage(content) {
      const guestStore = useGuestStore();
      const userContext = {
        logged_in: guestStore.isLoggedIn,
        guest_name: guestStore.guest?.name || '',
        guest_email: guestStore.guest?.email || '',
        guest_phone: guestStore.guest?.phone || '',
      };

      this.error = null;
      this.addMessage('user', content);
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
            assistantMsg.showForm = normalized?.type === 'open_reservation_form';
          },
          {
            sessionId: this.sessionId,
            userContext,
          },
        );
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
    }
  }
});
