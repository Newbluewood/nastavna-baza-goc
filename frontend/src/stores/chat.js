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
      // Add user message to UI immediately
      this.addMessage('user', content);
      this.isLoading = true;

      try {
        // Sliding window: get last 5 messages for history
        // Wait, history should be mapped to the format expected by the backend
        // Format expected by agent (Anthropic style or general): { role: 'user' | 'assistant', content: string }
        const history = this.messages
          .slice(-6, -1) // get last 5 messages, excluding the one we just added? Wait, the one we just added is included in history or sent as current message?
          // The prompt says: Payload: { "message": "Ima li slobodnih soba?", "history": [...] }
          // So history should be previous messages. Let's send the last 5 BEFORE this message.
          // Since we pushed the user message, it's at length-1.
          .map(m => ({ role: m.role, content: m.content }));

        const langStore = useLangStore();
        const response = await agentService.sendMessage(content, history, langStore.currentLang);
        
        // Ensure response format: { reply: "..." } or { text: "..." }
        // Depending on backend response
        const replyText = response.reply || response.text || response.message || response.answer || "Agent returned an empty response";
        const action = response.action || null;
        
        this.addMessage('assistant', replyText, action);
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
