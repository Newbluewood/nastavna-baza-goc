<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  isLoading.value = true
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    
    const data = await res.json()
    if (res.ok) {
      localStorage.setItem('admin_token', data.token)
      router.push('/admin/vesti')
    } else {
      errorMsg.value = data.error || 'Погрешни подаци'
    }
  } catch (err) {
    errorMsg.value = 'Грешка при повезивању са сервером.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-box">
      <h2>Админ Пријава</h2>
      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Корисничко име</label>
          <input type="text" v-model="username" required autocomplete="username">
        </div>
        <div class="form-group">
          <label>Лозинка</label>
          <input type="password" v-model="password" required autocomplete="current-password">
        </div>
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Пријављивање...' : 'Пријави се' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: var(--color-background-soft, #f7f7f7);
}
.login-box {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}
.login-box h2 {
  margin-top: 0;
  margin-bottom: 20px;
  text-align: center;
}
.error-msg {
  background: #ffebee;
  color: #c62828;
  padding: 10px;
  margin-bottom: 15px;
  border-left: 4px solid #c62828;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  box-sizing: border-box;
}
button {
  width: 100%;
  padding: 12px;
  background: var(--color-nav, #333);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
}
</style>
