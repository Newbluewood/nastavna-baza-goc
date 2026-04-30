<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGuestStore } from '../../stores/guest'
import { useLangStore } from '../../stores/lang'
import api from '../../services/api'

const router = useRouter()
const route = useRoute()
const guestStore = useGuestStore()
const langStore = useLangStore()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)
const showForgot = ref(false)

const forgotEmail = ref('')
const forgotPhone = ref('')
const forgotMsg = ref('')
const forgotLoading = ref(false)

const handleLogin = async () => {
  if (!email.value || !password.value) { error.value = 'Unesite email i lozinku.'; return }
  isLoading.value = true
  error.value = ''
  try {
    await guestStore.login(email.value, password.value)
    const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.push(redirectPath && redirectPath.startsWith('/') ? redirectPath : '/moj-nalog')
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

const handleForgot = async () => {
  if (!forgotEmail.value || !forgotPhone.value) { forgotMsg.value = 'Unesite email i telefon.'; return }
  forgotLoading.value = true
  forgotMsg.value = ''
  try {
    const data = await api.forgotPassword(forgotEmail.value)
    forgotMsg.value = data.message || 'Link je poslat.'
  } catch {
    forgotMsg.value = 'Greška. Pokušajte ponovo.'
  } finally {
    forgotLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">

      <div class="brand-bar">
        <span>{{ langStore.currentLang === 'sr' ? 'НАСТАВНА БАЗА ГОЧ' : 'TEACHING BASE GOC' }}</span>
      </div>

      <!-- Login forma -->
      <div v-if="!showForgot" class="form-body">
        <div class="icon-wrap">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cdac91" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <h1>{{ langStore.currentLang === 'sr' ? 'Пријава' : 'Login' }}</h1>
        <p class="subtitle">{{ langStore.currentLang === 'sr' ? 'Пратите статус Ваших резервација' : 'Track your reservation status' }}</p>

        <div class="form-group">
          <label>{{ langStore.currentLang === 'sr' ? 'Е-пошта' : 'Email' }}</label>
          <input v-model="email" type="email" placeholder="ime@email.com" @keyup.enter="handleLogin" />
        </div>
        <div class="form-group">
          <label>{{ langStore.currentLang === 'sr' ? 'Лозинка' : 'Password' }}</label>
          <input v-model="password" type="password" placeholder="••••••••" @keyup.enter="handleLogin" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn-primary" @click="handleLogin" :disabled="isLoading">
          <span v-if="isLoading">{{ langStore.currentLang === 'sr' ? 'Учитавам...' : 'Loading...' }}</span>
          <span v-else>{{ langStore.currentLang === 'sr' ? 'ПРИЈАВИТЕ СЕ →' : 'LOG IN →' }}</span>
        </button>

        <button class="btn-link" @click="showForgot = true">{{ langStore.currentLang === 'sr' ? 'Заборавили сте лозинку?' : 'Forgot password?' }}</button>
      </div>

      <!-- Forgot password forma -->
      <div v-else class="form-body">
        <h1>{{ langStore.currentLang === 'sr' ? 'Ресет лозинке' : 'Reset Password' }}</h1>
        <p class="subtitle">{{ langStore.currentLang === 'sr' ? 'Унесите email и телефон са регистрације' : 'Enter the email and phone from your registration' }}</p>

        <div class="form-group">
          <label>{{ langStore.currentLang === 'sr' ? 'Е-пошта' : 'Email' }}</label>
          <input v-model="forgotEmail" type="email" placeholder="ime@email.com" />
        </div>
        <div class="form-group">
          <label>{{ langStore.currentLang === 'sr' ? 'Телефон' : 'Phone' }}</label>
          <input v-model="forgotPhone" type="tel" placeholder="+381 6x xxx xxxx" />
        </div>

        <p v-if="forgotMsg" class="info-msg">{{ forgotMsg }}</p>

        <button class="btn-primary" @click="handleForgot" :disabled="forgotLoading">
          <span v-if="forgotLoading">{{ langStore.currentLang === 'sr' ? 'Шаљем...' : 'Sending...' }}</span>
          <span v-else>{{ langStore.currentLang === 'sr' ? 'ПОШАЉИ ЛИНК →' : 'SEND LINK →' }}</span>
        </button>
        <button class="btn-link" @click="showForgot = false">{{ langStore.currentLang === 'sr' ? '← Назад на пријаву' : '← Back to Login' }}</button>
      </div>

      <div class="footer-note">
        {{ langStore.currentLang === 'sr' ? 'Немате налог? Аутоматски се креира при резервацији.' : "Don't have an account? It's automatically created upon your first reservation." }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f3f0;
  padding: 20px;
}

.login-box {
  background: #fff;
  width: 100%;
  max-width: 420px;
  border: 1px solid #e8e0d8;
  border-top: 5px solid #332317;
}

.brand-bar {
  background: #332317;
  color: #cdac91;
  padding: 14px 25px;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 2px;
}

.form-body {
  padding: 35px 30px 25px;
}

.icon-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 15px;
  opacity: 0.7;
}

h1 {
  font-size: 1.6rem;
  color: #332317;
  margin: 0 0 6px;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 28px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  font-size: 0.82rem;
  color: #666;
  font-weight: 600;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid #ddd;
  background: #fafafa;
  font-size: 0.95rem;
  color: #332317;
  outline: none;
  border-radius: 0;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #cdac91;
  background: #fff;
}

.btn-primary {
  width: 100%;
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 14px;
  font-weight: bold;
  font-size: 0.9rem;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 0;
  margin-top: 5px;
  transition: opacity 0.2s;
}

.btn-primary:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-link {
  display: block;
  width: 100%;
  background: none;
  border: none;
  color: #888;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 12px;
  text-align: center;
  text-decoration: underline;
}
.btn-link:hover { color: #332317; }

.error-msg {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-bottom: 10px;
  text-align: center;
}

.info-msg {
  color: #27ae60;
  font-size: 0.85rem;
  margin-bottom: 10px;
  text-align: center;
  padding: 10px;
  background: #e8f5e9;
}

.footer-note {
  padding: 14px 25px;
  background: #f5f3f0;
  text-align: center;
  font-size: 0.8rem;
  color: #aaa;
  border-top: 1px solid #eee;
}
</style>
