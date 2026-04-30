<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
  errorMsg.value = ''
  isLoading.value = true
  try {
    await api.adminLogin({ username: username.value, password: password.value })
    router.push('/admin/vesti')
  } catch (err) {
    errorMsg.value = err.data?.error || 'Погрешни подаци'
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
          <input type="text" v-model="username" required>
        </div>
        <div class="form-group">
          <label>Лозинка</label>
          <input type="password" v-model="password" required>
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
