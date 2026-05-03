/**
 * chatApi.js
 *
 * Thin wrapper around the main backend's chat-related endpoints.
 * Separated from api.js so the chat feature can be toggled or replaced
 * without touching the core site API layer.
 *
 * Base URL: VITE_API_BASE_URL (same backend as the rest of the site).
 *
 * Endpoints:
 *   POST /api/chat/reserve-stay  — writes a room inquiry to the database
 *   POST /api/chat/fallback      — Gemini Flash backup chat
 */

import api from './api';

const chatApi = {
  /**
   * Submit a room reservation inquiry from the chat widget.
   *
   * @param {{
   *   target_room_id: number,
   *   sender_name?: string,
   *   email?: string,
   *   phone?: string,
   *   message?: string,
   *   check_in: string,
   *   check_out: string,
   *   board_type?: 'base' | 'half' | 'full'
   * }} payload
   */
  reserveStay(payload) {
    return api.request('/api/chat/reserve-stay', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Send a message to the Gemini Flash fallback.
   * Called automatically by agentService when the primary stream fails.
   *
   * @param {{ message: string, history?: Array, lang?: string }} payload
   * @returns {Promise<{ reply: string }>}
   */
  fallback({ message, history = [], lang = 'sr' }) {
    return api.request('/api/chat/fallback', {
      method: 'POST',
      authMode: 'none',
      body: JSON.stringify({ message, history, lang }),
    });
  },
};

export default chatApi;
