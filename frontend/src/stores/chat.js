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
        guestName: '',
        guestEmail: ''
      });
    },

    async sendMessage(content) {
      this.error = null;
      this.addMessage('user', content);
      this.isLoading = true;

      try {
        const history = this.messages
          .slice(-6, -1)
          .map(m => ({ role: m.role, content: m.content }));

        const langStore = useLangStore();
        
        // Create an empty assistant message that we will populate
        this.addMessage('assistant', '');
        const assistantMsg = this.messages[this.messages.length - 1];

        await agentService.sendMessageStream(
          content, 
          history, 
          langStore.currentLang,
          (chunk) => {
            assistantMsg.content += chunk;
          },
          (action) => {
            assistantMsg.action = action;
          }
        );
      } catch (err) {
        console.error('Chat Agent error:', err);
        this.error = err.message;
        this.addMessage('assistant', 'Sorry, I encountered an error. Please try again later.');
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
