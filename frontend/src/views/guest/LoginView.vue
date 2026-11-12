<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGuestStore } from '../../stores/guest'
import { useLangStore } from '../../stores/lang'
import api from '../../services/api'
import PasswordInput from '../../components/ui/PasswordInput.vue'

const router = useRouter()
const route = useRoute()
const guestStore = useGuestStore()
const langStore = useLangStore()

const mode = ref('login') // login | forgot | register

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

const forgotEmail = ref('')
const forgotPhone = ref('')
const forgotMsg = ref('')
const forgotLoading = ref(false)

const regName = ref('')
const regEmail = ref('')
const regPhone = ref('')
const regPassword = ref('')
const regConfirm = ref('')
const regError = ref('')
const regLoading = ref(false)

const redirectAfterAuth = () => {
  const redirectPath = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  router.push(redirectPath && redirectPath.startsWith('/') ? redirectPath : { name: 'moj-nalog' })
}

const setMode = (next) => {
  mode.value = next
  error.value = ''
  forgotMsg.value = ''
  regError.value = ''
}

const handleLogin = async () => {
  if (!email.value || !password.value) {
    error.value = langStore.t('guest.enterEmailPassword')
    return
  }
  isLoading.value = true
  error.value = ''
  try {
    await guestStore.login(email.value, password.value)
    redirectAfterAuth()
  } catch (e) {
    error.value = e.message
  } finally {
    isLoading.value = false
  }
}

const handleForgot = async () => {
  if (!forgotEmail.value || !forgotPhone.value) {
    forgotMsg.value = langStore.t('guest.enterEmailPhone')
    return
  }
  forgotLoading.value = true
  forgotMsg.value = ''
  try {
    const data = await api.forgotPassword(forgotEmail.value)
    forgotMsg.value = data.message || langStore.t('guest.linkSent')
  } catch {
    forgotMsg.value = langStore.t('guest.forgotError')
  } finally {
    forgotLoading.value = false
  }
}

const handleRegister = async () => {
  if (!regName.value || !regEmail.value || !regPassword.value) {
    regError.value = langStore.t('guest.enterNameEmailPassword')
    return
  }
  if (regPassword.value !== regConfirm.value) {
    regError.value = langStore.t('guest.passwordMismatch')
    return
  }
  if (regPassword.value.length < 6) {
    regError.value = langStore.t('guest.passwordTooShort')
    return
  }

  regLoading.value = true
  regError.value = ''
  try {
    await guestStore.register({
      name: regName.value,
      email: regEmail.value,
      phone: regPhone.value || undefined,
      password: regPassword.value
    })
    redirectAfterAuth()
  } catch (e) {
    if (e.status === 409) {
      regError.value = langStore.t('guest.emailTaken')
    } else {
      regError.value = e.message || langStore.t('guest.registerError')
    }
  } finally {
    regLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-box">

      <div class="brand-bar">
        <router-link :to="{ name: 'home' }" class="brand-logo-link">
          <img src="/logo.svg" alt="Наставна база Гоч" class="brand-logo" />
        </router-link>
      </div>

      <!-- Login forma -->
      <div v-if="mode === 'login'" class="form-body">
        <div class="icon-wrap">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cdac91" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <h1>{{ langStore.t('guest.loginTitle') }}</h1>
        <p class="subtitle">{{ langStore.t('guest.loginSubtitle') }}</p>

        <div class="form-group">
          <label>{{ langStore.t('guest.email') }}</label>
          <input v-model="email" type="email" placeholder="ime@email.com" @keyup.enter="handleLogin" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.password') }}</label>
          <PasswordInput v-model="password" autocomplete="current-password" @enter="handleLogin" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="btn-primary" @click="handleLogin" :disabled="isLoading">
          <span v-if="isLoading">{{ langStore.t('guest.loading') }}</span>
          <span v-else>{{ langStore.t('guest.logIn') }}</span>
        </button>

        <button class="btn-link" @click="setMode('forgot')">{{ langStore.t('guest.forgotPassword') }}</button>
        <button class="btn-link" @click="setMode('register')">{{ langStore.t('guest.createAccount') }}</button>
      </div>

      <!-- Forgot password forma -->
      <div v-else-if="mode === 'forgot'" class="form-body">
        <h1>{{ langStore.t('guest.resetTitle') }}</h1>
        <p class="subtitle">{{ langStore.t('guest.resetSubtitle') }}</p>

        <div class="form-group">
          <label>{{ langStore.t('guest.email') }}</label>
          <input v-model="forgotEmail" type="email" placeholder="ime@email.com" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.phone') }}</label>
          <input v-model="forgotPhone" type="tel" placeholder="+381 6x xxx xxxx" />
        </div>

        <p v-if="forgotMsg" class="info-msg">{{ forgotMsg }}</p>

        <button class="btn-primary" @click="handleForgot" :disabled="forgotLoading">
          <span v-if="forgotLoading">{{ langStore.t('guest.sending') }}</span>
          <span v-else>{{ langStore.t('guest.sendLink') }}</span>
        </button>
        <button class="btn-link" @click="setMode('login')">{{ langStore.t('guest.backToLogin') }}</button>
      </div>

      <!-- Register forma -->
      <div v-else class="form-body">
        <div class="icon-wrap">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cdac91" stroke-width="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </div>
        <h1>{{ langStore.t('guest.registerTitle') }}</h1>
        <p class="subtitle">{{ langStore.t('guest.registerSubtitle') }}</p>

        <div class="form-group">
          <label>{{ langStore.t('guest.name') }}</label>
          <input v-model="regName" type="text" autocomplete="name" @keyup.enter="handleRegister" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.email') }}</label>
          <input v-model="regEmail" type="email" placeholder="ime@email.com" autocomplete="email" @keyup.enter="handleRegister" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.phone') }}</label>
          <input v-model="regPhone" type="tel" placeholder="+381 6x xxx xxxx" autocomplete="tel" @keyup.enter="handleRegister" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.password') }}</label>
          <PasswordInput v-model="regPassword" autocomplete="new-password" @enter="handleRegister" />
        </div>
        <div class="form-group">
          <label>{{ langStore.t('guest.confirmPassword') }}</label>
          <PasswordInput v-model="regConfirm" autocomplete="new-password" @enter="handleRegister" />
        </div>

        <p v-if="regError" class="error-msg">{{ regError }}</p>

        <button class="btn-primary" @click="handleRegister" :disabled="regLoading">
          <span v-if="regLoading">{{ langStore.t('guest.loading') }}</span>
          <span v-else>{{ langStore.t('guest.register') }}</span>
        </button>
        <button class="btn-link" @click="setMode('login')">{{ langStore.t('guest.haveAccount') }}</button>
      </div>

      <div class="footer-note">
        {{ langStore.t('guest.noAccountNote') }}
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
}

.brand-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 22px 28px 18px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.brand-logo-link {
  display: block;
  line-height: 0;
}

.brand-logo {
  width: 230px;
  max-width: 100%;
  height: auto;
  display: block;
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
  padding: 14px;
  letter-spacing: 1px;
  margin-top: 5px;
}
/* .btn-primary / .btn-link look: buttons.css */

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
