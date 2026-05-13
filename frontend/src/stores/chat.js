import { defineStore } from 'pinia';
import agentService from '../services/agentService';
import { useLangStore } from './lang';

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [],
    isOpen: false,
    isLoading: false,
    error: null
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
      const userContext = {
        guest_name: '',
        guest_email: '',
      };

      this.error = null;
      this.addMessage('user', content);
      this.isLoading = true;

      try {
        const history = this.messages
          .slice(-6, -1)
          .map(m => ({ role: m.role, content: m.content }));

        const langStore = useLangStore();
        this.addMessage('assistant', '');
        const assistantMsg = this.messages[this.messages.length - 1];

        await agentService.sendMessageStream(
          content, 
          history, 
          langStore.currentLang,
          (chunk) => { assistantMsg.content += chunk; },
          (action) => {
            if (action && !action.target_room && action.room_name) {
              action.target_room = action.room_name;
            }
            assistantMsg.action = action;
            assistantMsg.guestName = action?.guest_name || userContext.guest_name || '';
            assistantMsg.guestEmail = action?.guest_email || userContext.guest_email || '';
            assistantMsg.guestPhone = action?.guest_phone || '';
            assistantMsg.checkIn = action?.check_in || '';
            assistantMsg.checkOut = action?.check_out || '';
            assistantMsg.boardType = action?.board_type || 'base';
            assistantMsg.showForm = true;
          }
        );
      } catch (err) {
        console.error('Chat Agent error:', err);
        this.error = err.message;
        // Fallback bi trebao biti ovde, ali za sada samo poruka
        assistantMsg.content = 'Žao mi je, došlo je do greške. Molim vas pokušajte ponovo.';
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
    }
  }
});
