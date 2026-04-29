<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '../components/AdminSidebar.vue'

const router = useRouter()
const data = ref(null)
const isLoading = ref(true)
const error = ref('')
const sidebar = ref(null)
let refreshTimer = null

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const numberFmt = new Intl.NumberFormat('sr-RS')

const fetchUsage = async () => {
  if (!data.value) isLoading.value = true
  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/ai/usage`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.status === 401) {
      router.push('/admin/login')
      return
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    data.value = json
    error.value = ''
  } catch (err) {
    error.value = err.message || 'Greška pri učitavanju AI potrošnje'
    console.error('Greška pri učitavanju AI potrošnje:', err)
  } finally {
    isLoading.value = false
  }
}

const startTimer = () => {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(fetchUsage, 10000)
}

const refreshNow = () => {
  fetchUsage()
  startTimer()
}

onMounted(() => {
  fetchUsage()
  startTimer()
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const progressColor = (pct) => {
  const p = Number(pct) || 0
  if (p >= 95) return '#c62828'
  if (p >= 80) return '#ef6c00'
  if (p >= 60) return '#f57f17'
  return '#2e7d32'
}

const clampPercent = (pct) => {
  const p = Number(pct) || 0
  if (p < 0) return 0
  if (p > 100) return 100
  return p
}

const toFixedEur = (v) => {
  const n = Number(v)
  if (v === null || v === undefined || Number.isNaN(n)) return '0.00'
  return n.toFixed(2)
}

const formatValue = (v) => {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return numberFmt.format(v)
  if (typeof v === 'boolean') return v ? 'да' : 'не'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

const asEntries = (obj) => {
  if (!obj || typeof obj !== 'object') return []
  return Object.entries(obj)
}
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar ref="sidebar" />

    <main class="main-content">
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebar.sidebarOpen = !sidebar.sidebarOpen">☰ CMS Panel</button>
      </div>

      <div class="page-header">
        <div>
          <h1>AI Потрошња (буџет)</h1>
          <p class="subtitle">Месечни преглед трошкова и токена. Освежава се на сваких 10 секунди.</p>
        </div>
        <button class="refresh-btn" @click="refreshNow" :disabled="isLoading">
          {{ isLoading && !data ? 'Учитавам...' : 'Освежи сада' }}
        </button>
      </div>

      <p v-if="error" class="error-banner">{{ error }}</p>

      <div v-if="isLoading && !data" class="loading-msg">Учитавам...</div>

      <template v-else-if="data">
        <p v-if="data.budgetError" class="error-banner">
          Грешка буџета: {{ data.budgetError.message }}
        </p>

        <section v-if="data.budget" class="card budget-card">
          <div class="card-head">
            <h2 class="card-title">Месечни буџет</h2>
            <span class="month-pill">Месец: {{ data.budget.monthKey }}</span>
          </div>

          <div class="progress-track" role="progressbar" :aria-valuenow="(data.budget.spent.globalEur / 5.00) * 100" aria-valuemin="0" aria-valuemax="100">
            <div
              class="progress-fill"
              :style="{
                width: `${clampPercent((data.budget.spent.globalEur / 5.00) * 100)}%`,
                background: progressColor((data.budget.spent.globalEur / 5.00) * 100)
              }"
            ></div>
          </div>

          <p class="progress-text">
            <strong>{{ toFixedEur(data.budget.spent.globalEur) }}</strong>
            / 5.00 EUR
            <span class="percent-label">({{ ((data.budget.spent.globalEur / 5.00) * 100).toFixed(2) }}%)</span>
          </p>
          <p class="muted">Захтева овог месеца: {{ data.budget.spent.requestCount }}</p>
          <p class="muted">Токена (улаз): {{ formatValue(data.budget.spent.tokensInput) }}</p>
          <p class="muted">Токена (излаз): {{ formatValue(data.budget.spent.tokensOutput) }}</p>
          <p v-if="data.budget.spent.todayEur !== null && data.budget.spent.todayEur !== undefined" class="muted">
            Данас потрошено: {{ toFixedEur(data.budget.spent.todayEur) }} EUR
          </p>
        </section>

        <section class="card">
          <h2 class="card-title">Топ корисници (овај месец)</h2>
          <div
            v-if="!data.budget || !data.budget.topUsers || data.budget.topUsers.length === 0"
            class="empty-msg small"
          >
            Нема активних корисника за овај месец.
          </div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Корисник (кључ)</th>
                  <th>Потрошено (EUR)</th>
                  <th>Захтева</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(u, i) in data.budget.topUsers.slice(0, 10)" :key="u.userKey || `u-${i}`">
                  <td><code>{{ u.userKey }}</code></td>
                  <td>{{ toFixedEur(u.eurSpent) }}</td>
                  <td>{{ u.requestCount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Процена токена</h2>
          <div v-if="asEntries(data.metrics && data.metrics.tokenEstimates).length === 0" class="empty-msg small">
            Нема података.
          </div>
          <table v-else class="kv-table">
            <tbody>
              <tr v-for="[k, v] in asEntries(data.metrics.tokenEstimates)" :key="`te-${k}`">
                <td class="kv-key">{{ k }}</td>
                <td class="kv-val">{{ formatValue(v) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <h2 class="card-title">Укупно</h2>
          <div v-if="asEntries(data.metrics && data.metrics.totals).length === 0" class="empty-msg small">
            Нема података.
          </div>
          <table v-else class="kv-table">
            <tbody>
              <tr v-for="[k, v] in asEntries(data.metrics.totals)" :key="`t-${k}`">
                <td class="kv-key">{{ k }}</td>
                <td class="kv-val">{{ formatValue(v) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="card">
          <h2 class="card-title">Недавне активности</h2>
          <div
            v-if="!data.metrics || !data.metrics.recent || data.metrics.recent.length === 0"
            class="empty-msg small"
          >
            Нема недавних догађаја.
          </div>
          <div v-else class="recent-list">
            <pre
              v-for="(item, i) in data.metrics.recent.slice(0, 20)"
              :key="`r-${i}`"
              class="recent-item"
            >{{ JSON.stringify(item, null, 2) }}</pre>
          </div>
        </section>

        <p v-if="data.generatedAt" class="generated-at muted">
          Генерисано: {{ data.generatedAt }} &middot; schemaVersion {{ data.schemaVersion }}
        </p>
      </template>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f3f0;
  font-family: inherit;
  position: relative;
}

/* MAIN */
.main-content {
  flex: 1;
  padding: 40px;
  overflow-x: auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  gap: 16px;
  flex-wrap: wrap;
}
.page-header h1 { margin: 0 0 5px 0; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }
.refresh-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}
.refresh-btn:hover { opacity: 0.85; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* CARDS */
.card {
  background: #fff;
  padding: 20px 22px;
  margin-bottom: 20px;
  border-left: 4px solid #cdac91;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}
.card-title {
  margin: 0 0 14px 0;
  color: #332317;
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.card-head .card-title { margin-bottom: 0; }
.month-pill {
  background: #f5f3f0;
  color: #332317;
  padding: 4px 10px;
  font-size: 0.82rem;
  font-weight: bold;
  border: 1px solid #cdac91;
}

/* BUDGET */
.budget-card { border-left-color: #332317; }
.progress-track {
  width: 100%;
  height: 18px;
  background: #eee;
  margin: 8px 0 10px 0;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  transition: width 0.4s ease, background 0.3s ease;
}
.progress-text {
  margin: 4px 0 6px 0;
  font-size: 1rem;
  color: #332317;
}
.percent-label { color: #666; font-size: 0.9rem; margin-left: 4px; }
.muted { color: #888; font-size: 0.85rem; margin: 2px 0; }

/* BANNERS */
.error-banner {
  background: #fdecea;
  color: #c62828;
  border: 1px solid #f5c2c0;
  padding: 12px 16px;
  margin: 0 0 20px 0;
  font-size: 0.92rem;
  font-weight: bold;
}

/* TABLES */
.table-wrapper { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  font-size: 0.92rem;
}
.data-table th {
  background: #332317;
  color: #cdac91;
  padding: 10px 12px;
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  vertical-align: middle;
}
.data-table code {
  background: #f5f3f0;
  padding: 2px 6px;
  font-size: 0.85rem;
  color: #332317;
}

.kv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.kv-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f0ece6;
  vertical-align: top;
}
.kv-key {
  width: 40%;
  font-weight: bold;
  color: #332317;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.85rem;
}
.kv-val {
  color: #444;
  word-break: break-word;
}

/* RECENT */
.recent-list {
  max-height: 400px;
  overflow-y: auto;
  background: #f8f5f1;
  padding: 10px;
  border: 1px solid #ece5dc;
}
.recent-item {
  background: #fff;
  border: 1px solid #ece5dc;
  border-left: 3px solid #cdac91;
  margin: 0 0 8px 0;
  padding: 10px 12px;
  font-size: 0.8rem;
  color: #332317;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Menlo', 'Consolas', monospace;
}
.recent-item:last-child { margin-bottom: 0; }

.loading-msg,
.empty-msg {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 1.05rem;
}
.empty-msg.small {
  padding: 20px;
  font-size: 0.9rem;
  color: #888;
  background: #faf8f5;
  border: 1px dashed #e2d8cc;
}
.generated-at {
  margin-top: 24px;
  text-align: right;
  font-size: 0.8rem;
  color: #aaa;
}

@media (max-width: 768px) {
  .mobile-topbar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  .burger-admin {
    background: #332317;
    color: #cdac91;
    border: none;
    padding: 10px 16px;
    font-size: 0.95rem;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0;
  }
  .main-content { padding: 20px 16px !important; }
  .page-header { flex-direction: column; gap: 12px; }
}
</style>
