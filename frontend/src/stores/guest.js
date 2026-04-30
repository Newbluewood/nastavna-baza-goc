import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'

export const useGuestStore = defineStore('guest', () => {
  const token = ref(localStorage.getItem('guest_token') || null)
  const guest = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  const login = async (email, password) => {
    const data = await api.guestLogin({ email, password })
    token.value = data.token
    guest.value = { name: data.name, email: data.email }
    return data
  }

  const logout = () => {
    token.value = null
    guest.value = null
    api.logout()
  }

  const fetchMe = async () => {
    if (!token.value) return
    try {
      guest.value = await api.getGuestProfile()
    } catch { logout() }
  }

  // Kept for backward compatibility with DashboardView
  const authHeaders = () => ({ Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' })

  return { token, guest, isLoggedIn, login, logout, fetchMe, authHeaders }
})
