<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import PasswordInput from '../../components/ui/PasswordInput.vue'

const props = defineProps({
  token: { type: String, required: true },
})

const router = useRouter()
const token = props.token

const newPassword = ref('')
const confirm = ref('')
const error = ref('')
const success = ref(false)
const isLoading = ref(false)

const handleReset = async () => {
  error.value = ''
  if (!newPassword.value || newPassword.value.length < 6) {
    error.value = 'Lozinka mora imati najmanje 6 znakova.'
    return
  }
  if (newPassword.value !== confirm.value) {
    error.value = 'Lozinke se ne poklapaju.'
    return
  }
  isLoading.value = true
  try {
    await api.resetPassword(token, newPassword.value)
    success.value = true
    setTimeout(() => router.push({ name: 'prijava' }), 3000)
  } catch (e) {
    error.value = e.data?.error || 'Greška pri postavljanju lozinke.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <div class="reset-box">
      <div class="brand-bar">
        <router-link :to="{ name: 'home' }" class="brand-logo-link">
          <img src="/logo.svg" alt="Наставна база Гоч" class="brand-logo" />
        </router-link>
      </div>
      <div class="form-body">
        <h1>Нова лозинка</h1>

        <div v-if="success" class="success-state">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">✅</div>
          <p>Лозинка је успешно промењена!</p>
          <p class="small">Аутоматски ћете бити преусмерени на пријаву...</p>
        </div>

        <div v-else>
          <div class="form-group">
            <label>Нова лозинка</label>
            <PasswordInput v-model="newPassword" placeholder="Мин. 6 знакова" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>Потврди лозинку</label>
            <PasswordInput v-model="confirm" autocomplete="new-password" @enter="handleReset" />
          </div>
          <p v-if="error" class="error-msg">{{ error }}</p>
          <button class="btn-primary" @click="handleReset" :disabled="isLoading">
            {{ isLoading ? 'Чувам...' : 'ПОСТАВИ НОВУ ЛОЗИНКУ →' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f3f0; padding: 20px; }
.reset-box { background: #fff; width: 100%; max-width: 400px; border: 1px solid #e8e0d8; }
.brand-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 22px 28px 18px;
  border-bottom: 1px solid #eee;
  background: #fff;
}
.brand-logo-link { display: block; line-height: 0; }
.brand-logo { width: 230px; max-width: 100%; height: auto; display: block; }
.form-body { padding: 35px 30px 30px; }
h1 { font-size: 1.5rem; color: #332317; margin: 0 0 25px; text-align: center; }
.success-state { text-align: center; color: #27ae60; }
.small { font-size: 0.82rem; color: #888; margin-top: 5px; }
.form-group { margin-bottom: 18px; }
.form-group label { display: block; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #666; font-weight: 600; margin-bottom: 6px; }
.form-group input { width: 100%; padding: 11px 14px; border: 1px solid #ddd; font-size: 0.95rem; outline: none; border-radius: 0; box-sizing: border-box; }
.form-group input:focus { border-color: #cdac91; }
.btn-primary { width: 100%; padding: 14px; letter-spacing: 1px; }
/* .btn-primary look: buttons.css */
.error-msg { color: #e74c3c; font-size: 0.85rem; margin-bottom: 10px; text-align: center; }
</style>
