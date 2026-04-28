<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';
import { useChatStore } from '../stores/chat';
import { marked } from 'marked';

const chatStore = useChatStore();
const inputMessage = ref('');
const messagesContainer = ref(null);

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

watch(() => chatStore.messages.length, () => {
  scrollToBottom();
});

const renderMarkdown = (text) => {
  if (!text) return '';
  return marked.parse(text);
};

const submitReservation = async (msg) => {
  if (!msg.guestName || !msg.guestEmail || !msg.checkIn || !msg.checkOut) {
    alert("Molimo popunite sva polja (uključujući oba datuma).");
    return;
  }
  msg.showForm = false;
  msg.submitted = true;
  
  // Optionally, you can send an automated message confirming the action to the chat history:
  // await chatStore.addMessage('user', `Poslat upit za rezervaciju na ime ${msg.guestName}.`);
  // And the API could be hooked up here to api.submitInquiry(...)
};

const sendMessage = async () => {
  if (!inputMessage.value.trim() || chatStore.isLoading) return;
  
  const content = inputMessage.value.trim();
  inputMessage.value = '';
  
  await chatStore.sendMessage(content);
};

onMounted(() => {
  if (chatStore.messages.length === 0) {
    chatStore.addMessage('assistant', 'Zdravo! Ja sam vaš AI asistent za Nastavnu Bazu Goč. Kako mogu da vam pomognem danas?');
  }
  scrollToBottom();
});

</script>

<template>
  <div class="agent-chat-wrapper">
    <!-- Chat Toggle Button -->
    <button 
      class="agent-chat-toggle" 
      :class="{ 'is-open': chatStore.isOpen }"
      @click="chatStore.toggleChat()"
      aria-label="Toggle chat"
    >
      <div class="toggle-icon">
        <svg v-if="!chatStore.isOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </div>
    </button>

    <!-- Chat Panel -->
    <div class="agent-chat-panel" :class="{ 'is-visible': chatStore.isOpen }">
      <div class="chat-header">
        <div class="header-info">
          <div class="avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
              <path d="M12 6v6l4 2"></path>
            </svg>
          </div>
          <div class="title-wrap">
            <h3>Goč AI Asistent</h3>
            <span class="status">Uvek na mreži</span>
          </div>
        </div>
        <div class="header-actions">
          <router-link to="/smestaj" class="reserve-link" @click="chatStore.isOpen = false">
            Rezerviši
          </router-link>
          <button class="clear-btn" @click="chatStore.clearHistory()" title="Započni novi razgovor">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <div class="chat-messages" ref="messagesContainer">
        <div 
          v-for="(msg, index) in chatStore.messages" 
          :key="index"
          class="message-wrapper"
          :class="msg.role === 'user' ? 'user-message' : 'assistant-message'"
        >
          <div class="message-bubble" :class="msg.role">
            <div v-if="msg.role === 'assistant'" class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <div v-else class="text-body">{{ msg.content }}</div>
            
            <!-- Action / Tool Card -->
            <div v-if="msg.action && msg.action.type === 'open_reservation_form'" class="action-card">
              <div class="ac-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
                <h4>Pokretanje Rezervacije</h4>
              </div>
              <div class="ac-body">
                <div class="ac-row">
                  <span>Odabrano:</span>
                  <strong>{{ msg.action.target_room || 'Vaš Smeštaj' }}</strong>
                </div>
              </div>
              <div class="ac-actions" v-if="!msg.showForm && !msg.submitted">
                <button class="ac-btn primary" @click="msg.showForm = true">
                  Završi rezervaciju
                </button>
              </div>
              <div class="ac-form" v-if="msg.showForm && !msg.submitted">
                <div class="form-group">
                  <label>Ime i prezime</label>
                  <input type="text" v-model="msg.guestName" placeholder="Unesite vaše ime" class="ac-input" />
                </div>
                <div class="form-group">
                  <label>Email adresa</label>
                  <input type="email" v-model="msg.guestEmail" placeholder="vas@email.com" class="ac-input" />
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Datum dolaska</label>
                    <input type="date" v-model="msg.checkIn" class="ac-input" />
                  </div>
                  <div class="form-group">
                    <label>Datum odlaska</label>
                    <input type="date" v-model="msg.checkOut" class="ac-input" />
                  </div>
                </div>
                <button class="ac-btn success" @click="submitReservation(msg)">Pošalji Upit</button>
                <button class="ac-btn secondary" @click="msg.showForm = false">Odustani</button>
              </div>
              <div class="ac-success" v-if="msg.submitted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                <span>Upit uspešno prosleđen! Uskoro ćete dobiti potvrdni email.</span>
              </div>
            </div>

            <span class="timestamp">{{ new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
        </div>

        <div v-if="chatStore.isLoading" class="message-wrapper assistant-message">
          <div class="message-bubble assistant loading-bubble">
            <div class="typing-indicator">
              <span></span><span></span><span></span>
            </div>
            <span class="loading-text">Agent kuca...</span>
          </div>
        </div>

        <div v-if="chatStore.error" class="error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{{ chatStore.error }}</span>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="input-wrapper">
          <input 
            v-model="inputMessage" 
            type="text" 
            placeholder="Pitajte me bilo šta..." 
            @keyup.enter="sendMessage"
            :disabled="chatStore.isLoading"
          />
          <button 
            @click="sendMessage" 
            :disabled="!inputMessage.trim() || chatStore.isLoading"
            class="send-btn"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.agent-chat-wrapper {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.agent-chat-toggle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6e4529 0%, #4a2c17 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2), 0 8px 30px rgba(110, 69, 41, 0.3);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  z-index: 2;
}

.agent-chat-toggle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25), 0 10px 40px rgba(110, 69, 41, 0.4);
}

.agent-chat-toggle:active {
  transform: scale(0.95);
}

.toggle-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.agent-chat-panel {
  position: absolute;
  bottom: 80px;
  right: 0;
  width: 380px;
  height: 600px;
  max-height: calc(100vh - 120px);
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(20px) scale(0.95);
  transform-origin: bottom right;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 1;
}

.agent-chat-panel.is-visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scale(1);
}

.chat-header {
  padding: 1.25rem;
  background: linear-gradient(135deg, #f8f6f4 0%, #ffffff 100%);
  border-bottom: 1px solid rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #6e4529;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar svg {
  width: 20px;
  height: 20px;
}

.title-wrap h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2c1e16;
}

.title-wrap .status {
  font-size: 0.75rem;
  color: #4caf50;
  display: flex;
  align-items: center;
  gap: 4px;
}

.title-wrap .status::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  background: #4caf50;
  border-radius: 50%;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reserve-link {
  font-size: 0.8rem;
  background: #6e4529;
  color: white;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.reserve-link:hover {
  background: #5a3821;
}

.clear-btn {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  background: rgba(0,0,0,0.05);
  color: #d32f2f;
}

.clear-btn svg {
  width: 18px;
  height: 18px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-behavior: smooth;
  background: #faf9f8;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}

.user-message {
  align-self: flex-end;
}

.assistant-message {
  align-self: flex-start;
}

.message-bubble {
  padding: 0.85rem 1.15rem;
  border-radius: 18px;
  position: relative;
  line-height: 1.5;
  font-size: 0.95rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}

.message-bubble.user {
  background: #6e4529;
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.message-bubble.assistant {
  background: #ffffff;
  color: #333333;
  border: 1px solid rgba(0,0,0,0.05);
  border-bottom-left-radius: 4px;
}

.timestamp {
  display: block;
  font-size: 0.65rem;
  margin-top: 6px;
  opacity: 0.7;
  text-align: right;
}

/* Action Card */
.action-card {
  margin-top: 1rem;
  background: rgba(110, 69, 41, 0.05);
  border: 1px solid rgba(110, 69, 41, 0.15);
  border-radius: 12px;
  overflow: hidden;
}

.ac-header {
  background: rgba(110, 69, 41, 0.1);
  padding: 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #5a3821;
}

.ac-header svg {
  width: 14px;
  height: 14px;
}

.ac-header h4 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ac-body {
  padding: 0.75rem;
  font-size: 0.9rem;
}

.ac-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.ac-row span {
  color: #666;
}

.ac-row strong {
  color: #333;
}

.ac-actions {
  padding: 0 0.75rem 0.75rem;
}

.ac-btn {
  display: block;
  text-align: center;
  padding: 0.6rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
  width: 100%;
}

.ac-btn.primary {
  background: #6e4529;
  color: #fff;
}

.ac-btn.primary:hover {
  background: #5a3821;
}

.ac-btn.success {
  background: #2e7d32;
  color: #fff;
  margin-bottom: 8px;
}

.ac-btn.success:hover {
  background: #1b5e20;
}

.ac-btn.secondary {
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
}

.ac-btn.secondary:hover {
  background: #f5f5f5;
  color: #333;
}

.ac-form {
  padding: 0 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 120px;
}

.form-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6e4529;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.ac-input {
  width: 100%;
  padding: 0.6rem;
  border: 1px solid #dcdcdc;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.ac-input:focus {
  border-color: #6e4529;
  box-shadow: 0 0 0 2px rgba(110, 69, 41, 0.1);
}

.ac-success {
  padding: 0.75rem;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2e7d32;
  font-size: 0.85rem;
  font-weight: 500;
  background: rgba(46, 125, 50, 0.1);
  border-top: 1px solid rgba(46, 125, 50, 0.2);
}

.ac-success svg {
  width: 18px;
  height: 18px;
}

.user .timestamp {
  color: rgba(255,255,255,0.7);
}

.assistant .timestamp {
  color: #999;
}

.markdown-body {
  word-break: break-word;
}

.markdown-body :deep(p) {
  margin: 0 0 0.5em 0;
}
.markdown-body :deep(p:last-child) {
  margin: 0;
}
.markdown-body :deep(ul), .markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.markdown-body :deep(li) {
  margin-bottom: 0.25em;
}
.markdown-body :deep(strong) {
  font-weight: 600;
  color: #111;
}

.loading-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0.75rem 1rem !important;
}

.loading-text {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}

.typing-indicator {
  display: flex;
  gap: 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #6e4529;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
  opacity: 0.6;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); opacity: 1; }
}

.error-banner {
  background: #fff0f0;
  border: 1px solid #ffcdd2;
  color: #d32f2f;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 0.5rem;
  animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}

.error-banner svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.chat-input-area {
  padding: 1rem 1.25rem;
  background: #ffffff;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.input-wrapper {
  display: flex;
  align-items: center;
  background: #f4f2f0;
  border-radius: 24px;
  padding: 0.4rem 0.4rem 0.4rem 1.2rem;
  transition: box-shadow 0.2s, background 0.2s;
}

.input-wrapper:focus-within {
  background: #ffffff;
  box-shadow: 0 0 0 2px rgba(110, 69, 41, 0.2);
}

.input-wrapper input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.5rem 0;
  font-size: 0.95rem;
  color: #333;
  outline: none;
}

.input-wrapper input::placeholder {
  color: #aaa;
}

.send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #6e4529;
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.send-btn:not(:disabled):hover {
  background: #5a3821;
  transform: scale(1.05);
}

.send-btn svg {
  width: 16px;
  height: 16px;
  margin-right: 2px; /* slight visual balance for the paper plane icon */
}

@media (max-width: 480px) {
  .agent-chat-wrapper {
    bottom: 1rem;
    right: 1rem;
  }
  
  .agent-chat-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
    z-index: 10001;
  }
  
  .agent-chat-toggle {
    z-index: 10002;
  }
}
</style>
