import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const useGuestStore = defineStore('guest', () => {
  const token = ref(localStorage.getItem('guest_token') || null)
  const guest = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  const login = async (email, password) => {
    const res = await fetch(`${BASE}/api/guests/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Greška pri prijavi.')
    token.value = data.token
    guest.value = { name: data.name, email: data.email }
    localStorage.setItem('guest_token', data.token)
    return data
  }

  const logout = () => {
    token.value = null
    guest.value = null
    localStorage.removeItem('guest_token')
  }

  const fetchMe = async () => {
    if (!token.value) return
    try {
      const res = await fetch(`${BASE}/api/guests/me`, {
        headers: { Authorization: `Bearer ${token.value}` }
      })
      if (!res.ok) { logout(); return }
      guest.value = await res.json()
    } catch { logout() }
  }

  const authHeaders = () => ({ Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' })

  return { token, guest, isLoggedIn, login, logout, fetchMe, authHeaders }
})
