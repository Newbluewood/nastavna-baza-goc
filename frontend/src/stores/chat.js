/**
 * chat.js — Pinia store
 *
 * Manages the chat widget state: messages, loading flag, errors, and
 * communication with the primary microservice via agentService.
 *
 * On microservice failure, agentService automatically falls back to
 * Gemini Flash and signals it via the `onFallback` callback, which
 * appends a soft notice to the assistant's message.
 */

import { defineStore } from 'pinia';
import agentService    from '../services/agentService';
import chatApi         from '../services/chatApi';
import { useLangStore } from './lang';

export const useChatStore = defineStore('chat', {
  state: () => ({
    /** @type {Array<Message>} */
    messages:   [],
    isOpen:     false,
    isLoading:  false,
    /** @type {string|null} */
    error:      null,
    /** True when the last response came from the Gemini fallback */
    usedFallback: false,
  }),

  actions: {
    // ── Visibility ────────────────────────────────────────────────────────────

    toggleChat() { this.isOpen = !this.isOpen; },
    openChat()   { this.isOpen = true; },
    closeChat()  { this.isOpen = false; },

    // ── Messages ──────────────────────────────────────────────────────────────

    /**
     * Appends a message to the conversation.
     * @param {'user'|'assistant'} role
     * @param {string} content
     * @param {object|null} [action]
     */
    addMessage(role, content, action = null) {
      this.messages.push({
        role,
        content,
        action,
        timestamp:  new Date().toISOString(),
        checkIn:    action?.check_in  || '',
        checkOut:   action?.check_out || '',
        boardType:  action?.board_type || 'base',
        guestName:  '',
        guestEmail: '',
      });
    },

    clearHistory() {
      this.messages    = [];
      this.error       = null;
      this.usedFallback = false;
    },

    // ── Send ──────────────────────────────────────────────────────────────────

    /**
     * Sends a user message and streams the assistant's reply.
     * Falls back to Gemini Flash automatically on primary service failure.
     *
     * @param {string} content
     */
    async sendMessage(content) {
      this.error       = null;
      this.usedFallback = false;
      this.addMessage('user', content);
      this.isLoading   = true;

      const langStore = useLangStore();

      // Prepare the last 6 turns (excluding the message we just added)
      const history = this.messages
        .slice(-7, -1)
        .map(m => ({ role: m.role, content: m.content }));

      // Pre-create the assistant message so the UI can show it being typed
      this.addMessage('assistant', '');
      const assistantMsg = this.messages[this.messages.length - 1];

      try {
        await agentService.sendMessageStream(
          content,
          history,
          langStore.currentLang,
          // onChunk — append streamed text
          (chunk) => { assistantMsg.content += chunk; },
          // onAction — attach action card to message
          (action) => { assistantMsg.action = action; },
          // onFallback — mark message as coming from fallback
          ({ reason }) => {
            this.usedFallback = true;
            console.info(`[ChatStore] Using Gemini fallback (${reason})`);
          },
        );
      } catch (err) {
        console.error('[ChatStore] Unhandled chat error:', err);
        this.error = err.message;
        assistantMsg.content = langStore.currentLang === 'sr'
          ? 'Greška u komunikaciji. Molimo pokušajte ponovo.'
          : 'Communication error. Please try again.';
      } finally {
        this.isLoading = false;
      }
    },

    // ── Reservation ───────────────────────────────────────────────────────────

    /**
     * Submits a reservation inquiry from the chat widget.
     * Delegates to chatApi so the chat store remains the single
     * entry point for the widget.
     *
     * @param {object} payload
     */
    async reserveStay(payload) {
      return chatApi.reserveStay(payload);
    },
  },
});
