/**
 * agentService.js
 *
 * Frontend client for the primary chat microservice (Render).
 *
 * Features:
 *   - SSE streaming via `sendMessageStream()`
 *   - 15-second AbortController timeout on every request
 *   - On failure, automatically calls the Gemini Flash fallback
 *     via chatApi.fallback() and invokes the `onFallback` callback
 *
 * Env:
 *   VITE_CHAT_API_URL — URL of the primary microservice
 *                       (default: https://chat-agent-kbjc.onrender.com)
 */

import chatApi from './chatApi';

const MICROSERVICE_URL  = import.meta.env.VITE_CHAT_API_URL || 'https://chat-agent-kbjc.onrender.com';
const STREAM_TIMEOUT_MS = 15_000;

class AgentService {
  constructor() {
    this.baseURL = MICROSERVICE_URL;
  }

  /**
   * Streams a response from the primary microservice using Server-Sent Events.
   * Automatically falls back to Gemini Flash on timeout or network error.
   *
   * @param {string}   message            — user message
   * @param {Array}    [history=[]]        — recent conversation turns [{role, content}]
   * @param {string}   [lang='sr']         — 'sr' | 'en'
   * @param {Function} onChunk            — called with each streamed text chunk (string)
   * @param {Function} onAction           — called when the agent emits an action payload
   * @param {Function} [onFallback]        — called when fallback is used ({ reason: string })
   * @returns {Promise<void>}
   */
  async sendMessageStream(message, history = [], lang = 'sr', onChunk, onAction, onFallback) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseURL}/api/chat/stream`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({ message, history, lang }),
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Microservice HTTP ${response.status}`);
      }

      await this._consumeStream(response, onChunk, onAction);

    } catch (err) {
      clearTimeout(timer);

      const reason = controller.signal.aborted ? 'timeout' : 'network_error';
      console.warn(`[AgentService] Primary microservice unavailable (${reason}). Falling back to Gemini.`);

      if (typeof onFallback === 'function') onFallback({ reason });

      await this._callFallback(message, history, lang, onChunk);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Reads an SSE stream and dispatches text/action events.
   * @private
   */
  async _consumeStream(response, onChunk, onAction) {
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const dataStr = trimmed.slice('data: '.length).trim();
        if (dataStr === '[DONE]') continue;

        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'text')   onChunk(data.content);
          if (data.type === 'action') onAction(data.content);
          if (data.type === 'error')  throw new Error(data.content);
        } catch {
          console.warn('[AgentService] Could not parse SSE frame:', dataStr);
        }
      }
    }
  }

  /**
   * Calls the Gemini Flash backend fallback and streams the reply word-by-word
   * so the UI typing effect still works.
   * @private
   */
  async _callFallback(message, history, lang, onChunk) {
    const data = await chatApi.fallback({ message, history, lang });

    if (!data?.reply) {
      onChunk('Izvините, тренутно нисам доступан. Покушајте поново за тренутак.');
      return;
    }

    // Simulate streaming by yielding words with short delays
    const words = data.reply.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise(r => setTimeout(r, 18));
    }
  }
}

export default new AgentService();
