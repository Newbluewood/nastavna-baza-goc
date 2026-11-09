<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const data = ref(null)
const isLoading = ref(true)
const error = ref('')
const analyticsDays = ref(30)
const analyticsTop = ref(null)
const analyticsMiss = ref(null)
const analyticsError = ref('')
const analyticsLoading = ref(false)
let refreshTimer = null

const numberFmt = new Intl.NumberFormat('sr-RS')

const budget = computed(() => data.value?.budget || null)
const capEur = computed(() => Number(budget.value?.caps?.globalEur) || 20)
const spentEur = computed(() => Number(budget.value?.spent?.globalEur) || 0)
const spentPct = computed(() => {
  const cap = capEur.value
  return cap > 0 ? (spentEur.value / cap) * 100 : 0
})

const analyticsSummary = computed(() => analyticsTop.value?.summary || analyticsMiss.value?.summary || null)

const hasRuntimeMetrics = computed(() => {
  const m = data.value?.metrics
  if (!m) return false
  const totals = m.totals || {}
  const hasTotals = Object.values(totals).some((v) => Number(v) > 0)
  const estimates = m.tokenEstimates || {}
  const hasEstimates = Object.values(estimates).some((v) => Number(v) > 0)
  return hasTotals || hasEstimates || (Array.isArray(m.recent) && m.recent.length > 0)
})

const fetchAnalytics = async () => {
  analyticsLoading.value = true
  try {
    const opts = { days: analyticsDays.value, limit: 15 }
    const [top, miss] = await Promise.all([
      api.getAdminChatAnalyticsTop(opts),
      api.getAdminChatAnalyticsMiss(opts)
    ])
    analyticsTop.value = top
    analyticsMiss.value = miss
    analyticsError.value = ''
  } catch (err) {
    if (err.status === 401) { router.push({ name: 'admin-login' }); return }
    analyticsError.value = err.message || 'Greška pri učitavanju chat analitike'
  } finally {
    analyticsLoading.value = false
  }
}

const fetchUsage = async () => {
  if (!data.value) isLoading.value = true
  try {
    data.value = await api.getAdminAiUsage()
    error.value = ''
  } catch (err) {
    if (err.status === 401) { router.push({ name: 'admin-login' }); return }
    error.value = err.message || 'Greška pri učitavanju AI potrošnje'
  } finally {
    isLoading.value = false
  }
  await fetchAnalytics()
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
  if (n === 0) return '0.00'
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(6)
}

const formatTokens = (v) => numberFmt.format(Number(v) || 0)

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

const formatUpdatedAt = (v) => {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('sr-RS')
}

const formatConfidence = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(0)}%`
}

const setAnalyticsDays = (days) => {
  analyticsDays.value = days
  fetchAnalytics()
}
</script>

<template>
  <AdminLayout>

      <div class="page-header">
        <div>
          <h1>AI Потрошња</h1>
          <p class="subtitle">
            Месечни збир из <code>ai_budget_monthly</code> — исти подаци које chat agent уписује на Render-у (EUR, токени, захтеви).
            Освежава се на сваких 10 секунди.
          </p>
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

        <section v-if="budget" class="card budget-card">
          <div class="card-head">
            <h2 class="card-title">Месечни преглед</h2>
            <span class="month-pill">Месец: {{ budget.monthKey }}</span>
          </div>

          <div class="stat-grid">
            <div class="stat">
              <span class="stat-label">Потрошено</span>
              <span class="stat-value">{{ toFixedEur(spentEur) }} <small>EUR</small></span>
            </div>
            <div class="stat">
              <span class="stat-label">Захтева</span>
              <span class="stat-value">{{ formatTokens(budget.spent.requestCount) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Токени улаз</span>
              <span class="stat-value">{{ formatTokens(budget.spent.tokensInput) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Токени излаз</span>
              <span class="stat-value">{{ formatTokens(budget.spent.tokensOutput) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Токени укупно</span>
              <span class="stat-value">{{ formatTokens(budget.spent.tokensTotal) }}</span>
            </div>
          </div>

          <div class="progress-track" role="progressbar" :aria-valuenow="spentPct" aria-valuemin="0" aria-valuemax="100">
            <div
              class="progress-fill"
              :style="{
                width: `${clampPercent(spentPct)}%`,
                background: progressColor(spentPct)
              }"
            ></div>
          </div>
          <p class="progress-text">
            <strong>{{ toFixedEur(spentEur) }}</strong>
            / {{ toFixedEur(capEur) }} EUR
            <span class="percent-label">({{ spentPct.toFixed(2) }}% месечног лимита)</span>
          </p>
          <p class="muted">
            Лимит по кориснику: {{ toFixedEur(budget.caps.userEur) }} EUR.
            Износ је у EUR, како га агент уписује — widget га не приказује.
          </p>
        </section>

        <section class="card analytics-card">
          <div class="card-head">
            <h2 class="card-title">Chat agent — top / miss</h2>
            <div class="days-pills">
              <button
                v-for="d in [7, 30, 90]"
                :key="`d-${d}`"
                type="button"
                class="day-pill"
                :class="{ active: analyticsDays === d }"
                :disabled="analyticsLoading"
                @click="setAnalyticsDays(d)"
              >
                {{ d }}д
              </button>
            </div>
          </div>
          <p class="muted analytics-hint">
            Питања из <code>site-guide-turn</code>, груписана по нормализованом тексту.
            Miss = нема поготка или ниска поузданост (&lt; {{ formatConfidence(analyticsMiss?.missConfidenceMax ?? 0.35) }}).
          </p>

          <p v-if="analyticsError" class="error-banner">{{ analyticsError }}</p>

          <div v-if="analyticsSummary" class="stat-grid analytics-stats">
            <div class="stat">
              <span class="stat-label">Укупно</span>
              <span class="stat-value">{{ formatTokens(analyticsSummary.total) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Hit</span>
              <span class="stat-value">{{ formatTokens(analyticsSummary.hits) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Miss</span>
              <span class="stat-value miss">{{ formatTokens(analyticsSummary.misses) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Fallback</span>
              <span class="stat-value">{{ formatTokens(analyticsSummary.fallbacks) }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Skip</span>
              <span class="stat-value">{{ formatTokens(analyticsSummary.skips) }}</span>
            </div>
          </div>

          <div class="analytics-grid">
            <div>
              <h3 class="sub-title">Најчешћа питања</h3>
              <div
                v-if="analyticsLoading && !analyticsTop"
                class="empty-msg small"
              >
                Учитавам...
              </div>
              <div
                v-else-if="!(analyticsTop?.items || []).length"
                class="empty-msg small"
              >
                Још нема забележених питања.
              </div>
              <div v-else class="table-wrapper">
                <table class="data-table compact">
                  <thead>
                    <tr>
                      <th>Питање</th>
                      <th>Број</th>
                      <th>Miss</th>
                      <th>Поузданост</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in analyticsTop.items" :key="`top-${item.question_hash}`">
                      <td class="question-cell">{{ item.sample_question || item.question_norm }}</td>
                      <td>{{ formatTokens(item.ask_count) }}</td>
                      <td>{{ formatTokens(item.miss_count) }}</td>
                      <td>{{ formatConfidence(item.avg_confidence) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 class="sub-title">Miss — допунити KB</h3>
              <div
                v-if="analyticsLoading && !analyticsMiss"
                class="empty-msg small"
              >
                Учитавам...
              </div>
              <div
                v-else-if="!(analyticsMiss?.items || []).length"
                class="empty-msg small"
              >
                Нема miss упита у овом периоду.
              </div>
              <div v-else class="table-wrapper">
                <table class="data-table compact">
                  <thead>
                    <tr>
                      <th>Питање</th>
                      <th>Број</th>
                      <th>Разлог</th>
                      <th>Последњи</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="item in analyticsMiss.items" :key="`miss-${item.question_hash}`">
                      <td class="question-cell">{{ item.sample_question || item.question_norm }}</td>
                      <td>{{ formatTokens(item.miss_count) }}</td>
                      <td><code>{{ item.last_reason || '—' }}</code></td>
                      <td class="muted">{{ formatUpdatedAt(item.last_asked_at) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">По функцији</h2>
          <div v-if="!budget.byFeature || budget.byFeature.length === 0" class="empty-msg small">
            Нема уписа за овај месец.
          </div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Функција</th>
                  <th>Потрошено (EUR)</th>
                  <th>Захтева</th>
                  <th>Токени улаз</th>
                  <th>Токени излаз</th>
                  <th>Токени укупно</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(f, i) in budget.byFeature" :key="f.feature || `f-${i}`">
                  <td><code>{{ f.feature }}</code></td>
                  <td>{{ toFixedEur(f.eurSpent) }}</td>
                  <td>{{ formatTokens(f.requestCount) }}</td>
                  <td>{{ formatTokens(f.tokensInput) }}</td>
                  <td>{{ formatTokens(f.tokensOutput) }}</td>
                  <td>{{ formatTokens(f.tokensTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Топ корисници (овај месец)</h2>
          <div
            v-if="!budget.topUsers || budget.topUsers.length === 0"
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
                  <th>Токени улаз</th>
                  <th>Токени излаз</th>
                  <th>Токени укупно</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(u, i) in budget.topUsers" :key="u.userKey || `u-${i}`">
                  <td><code>{{ u.userKey }}</code></td>
                  <td>{{ toFixedEur(u.eurSpent) }}</td>
                  <td>{{ formatTokens(u.requestCount) }}</td>
                  <td>{{ formatTokens(u.tokensInput) }}</td>
                  <td>{{ formatTokens(u.tokensOutput) }}</td>
                  <td>{{ formatTokens(u.tokensTotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card">
          <h2 class="card-title">Сви уписи (корисник × функција)</h2>
          <div v-if="!budget.rows || budget.rows.length === 0" class="empty-msg small">
            Нема редова за овај месец.
          </div>
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Корисник</th>
                  <th>Функција</th>
                  <th>Потрошено (EUR)</th>
                  <th>Захтева</th>
                  <th>Токени улаз</th>
                  <th>Токени излаз</th>
                  <th>Ажурирано</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in budget.rows" :key="`${r.userKey}-${r.feature}-${i}`">
                  <td><code>{{ r.userKey }}</code></td>
                  <td><code>{{ r.feature }}</code></td>
                  <td>{{ toFixedEur(r.eurSpent) }}</td>
                  <td>{{ formatTokens(r.requestCount) }}</td>
                  <td>{{ formatTokens(r.tokensInput) }}</td>
                  <td>{{ formatTokens(r.tokensOutput) }}</td>
                  <td>{{ formatUpdatedAt(r.updatedAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <template v-if="hasRuntimeMetrics">
          <section class="card">
            <h2 class="card-title">Процена токена (API сајта)</h2>
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
            <h2 class="card-title">Укупно (API сајта)</h2>
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
            <h2 class="card-title">Недавне активности (API сајта)</h2>
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
        </template>

        <p v-if="data.generatedAt" class="generated-at muted">
          Генерисано: {{ data.generatedAt }} &middot; schemaVersion {{ data.schemaVersion }}
        </p>
      </template>
  </AdminLayout>
</template>

<style scoped>
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
  gap: 12px;
  flex-wrap: wrap;
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
.subtitle code {
  background: #f5f0ea;
  padding: 1px 6px;
  font-size: 0.85em;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 8px 0 18px;
}
.stat {
  background: #f8f5f1;
  border: 1px solid #ece5dc;
  padding: 12px 14px;
}
.stat-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #888;
  margin-bottom: 6px;
}
.stat-value {
  display: block;
  color: #332317;
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stat-value small {
  font-size: 0.75rem;
  font-weight: 600;
  color: #888;
}

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

.error-banner {
  background: #fdecea;
  color: #c62828;
  border: 1px solid #f5c2c0;
  padding: 12px 16px;
  margin: 0 0 20px 0;
  font-size: 0.92rem;
  font-weight: bold;
}

.data-table code { background: #f5f0ea; padding: 2px 6px; font-size: 0.85rem; }

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

.generated-at {
  margin-top: 24px;
  text-align: right;
  font-size: 0.8rem;
  color: #aaa;
}

.empty-msg.small { padding: 16px; }

.analytics-card { border-left-color: #6d4c41; }
.analytics-hint { margin: 0 0 14px 0; font-size: 0.88rem; line-height: 1.45; }
.analytics-hint code {
  background: #f5f0ea;
  padding: 1px 6px;
  font-size: 0.85em;
}
.analytics-stats { margin-top: 0; }
.stat-value.miss { color: #c62828; }
.days-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.day-pill {
  background: #f5f3f0;
  color: #332317;
  border: 1px solid #cdac91;
  padding: 4px 10px;
  font-size: 0.82rem;
  font-weight: bold;
  cursor: pointer;
}
.day-pill.active {
  background: #332317;
  color: #fff;
  border-color: #332317;
}
.day-pill:disabled { opacity: 0.6; cursor: wait; }
.sub-title {
  margin: 0 0 10px 0;
  color: #332317;
  font-size: 0.95rem;
}
.analytics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}
.question-cell {
  max-width: 280px;
  word-break: break-word;
}
.data-table.compact th,
.data-table.compact td {
  padding: 8px 10px;
  font-size: 0.88rem;
}

@media (min-width: 960px) {
  .analytics-grid {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
}
</style>
