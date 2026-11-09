<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const numberFmt = new Intl.NumberFormat('sr-RS')

/** Demo dataset — zameniti realnim API-jem kad bude spreman. */
const DEMO = {
  periodLabel: 'последњих 30 дана (демо)',
  kpis: [
    { key: 'visits', label: 'Јединствени посетиоци', value: 1842, delta: '+12%' },
    { key: 'views', label: 'Прегледи страница', value: 6310, delta: '+8%' },
    { key: 'rag', label: 'RAG упити', value: 276, delta: '+21%' },
    { key: 'topRoom', label: 'Најтраженија соба', value: 'Апартман Делукс', delta: '84 клика' },
    { key: 'dwell', label: 'Просечно задржавање', value: '2м 48с', delta: '+0:18' },
  ],
  trafficByDay: [
    { day: 'Пон', visits: 210 },
    { day: 'Уто', visits: 248 },
    { day: 'Сре', visits: 231 },
    { day: 'Чет', visits: 265 },
    { day: 'Пет', visits: 298 },
    { day: 'Суб', visits: 312 },
    { day: 'Нед', visits: 278 },
  ],
  geo: [
    { country: 'Србија', pct: 48, flag: '🇷🇸' },
    { country: 'Немачка', pct: 16, flag: '🇩🇪' },
    { country: 'БиХ', pct: 11, flag: '🇧🇦' },
    { country: 'Аустрија', pct: 8, flag: '🇦🇹' },
    { country: 'Остало', pct: 17, flag: '🌍' },
  ],
  topPages: [
    { path: '/smestaj/deluxe-apartman', views: 1240 },
    { path: '/smestaj', views: 980 },
    { path: '/o-nama', views: 640 },
    { path: '/restoran', views: 510 },
    { path: '/istrazi', views: 430 },
  ],
  topRooms: [
    { name: 'Апартман Делукс', clicks: 84, inquiries: 12 },
    { name: 'Двокреветна соба', clicks: 71, inquiries: 9 },
    { name: 'Породични апартман', clicks: 58, inquiries: 7 },
    { name: 'Једнокреветна соба', clicks: 41, inquiries: 4 },
  ],
  ragTop: [
    { q: 'Да ли је дозвољен боравак кућним љубимцима?', count: 34 },
    { q: 'Какво је радно време рецепције?', count: 28 },
    { q: 'Има ли Wi‑Fi у собама?', count: 22 },
    { q: 'Колико кошта полупансион?', count: 19 },
    { q: 'Како доћи до Гоча аутобусом?', count: 15 },
  ],
  ragMiss: [
    { q: 'Да ли имате базен?', reason: 'no_vector_hits', count: 9 },
    { q: 'Могу ли да платим криптовалутом?', reason: 'low_confidence', count: 6 },
    { q: 'Имате ли трансфер са аеродрома?', reason: 'no_vector_hits', count: 5 },
    { q: 'Да ли ради ски-лифт ноћу?', reason: 'low_confidence', count: 4 },
  ],
}

const liveTop = ref([])
const liveMiss = ref([])
const liveSummary = ref(null)
const liveError = ref('')
const liveLoading = ref(false)

const maxTraffic = computed(() =>
  Math.max(...DEMO.trafficByDay.map((d) => d.visits), 1)
)

const formatNum = (v) => {
  if (typeof v === 'number') return numberFmt.format(v)
  return String(v)
}

const barWidth = (visits) => `${Math.round((visits / maxTraffic.value) * 100)}%`

const fetchLiveChat = async () => {
  liveLoading.value = true
  try {
    const [top, miss] = await Promise.all([
      api.getAdminChatAnalyticsTop({ days: 30, limit: 8 }),
      api.getAdminChatAnalyticsMiss({ days: 30, limit: 8 }),
    ])
    liveTop.value = top?.items || []
    liveMiss.value = miss?.items || []
    liveSummary.value = top?.summary || miss?.summary || null
    liveError.value = ''
  } catch (err) {
    if (err.status === 401) {
      router.push({ name: 'admin-login' })
      return
    }
    liveError.value = err.message || 'Live chat аналитика није доступна'
  } finally {
    liveLoading.value = false
  }
}

onMounted(fetchLiveChat)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Статистике сајта</h1>
        <p class="subtitle">
          Преглед посета, соба и RAG питања.
          <span class="demo-pill">ДЕМО ПОДАЦИ</span>
          — замењују се правим када аналитика буде повезана.
        </p>
      </div>
      <button class="refresh-btn" type="button" :disabled="liveLoading" @click="fetchLiveChat">
        {{ liveLoading ? 'Учитавам...' : 'Освежи live RAG' }}
      </button>
    </div>

    <p class="demo-banner">
      Приказани KPI, географија, странице и собе су <strong>лажни (dummy)</strong> ради прегледа UI-а.
      Chat top/miss испод може да покаже реалне податке ако их има у <code>chat_query_events</code>.
    </p>

    <section class="kpi-grid">
      <div v-for="kpi in DEMO.kpis" :key="kpi.key" class="kpi-card">
        <span class="kpi-label">{{ kpi.label }}</span>
        <span class="kpi-value">{{ formatNum(kpi.value) }}</span>
        <span class="kpi-delta">{{ kpi.delta }} · {{ DEMO.periodLabel }}</span>
      </div>
    </section>

    <div class="two-col">
      <section class="card">
        <h2 class="card-title">Посећеност (недеља) — демо</h2>
        <div class="bars">
          <div v-for="d in DEMO.trafficByDay" :key="d.day" class="bar-row">
            <span class="bar-label">{{ d.day }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(d.visits) }"></div>
            </div>
            <span class="bar-val">{{ formatNum(d.visits) }}</span>
          </div>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Географија посетилаца — демо</h2>
        <ul class="geo-list">
          <li v-for="g in DEMO.geo" :key="g.country">
            <span class="geo-name">{{ g.flag }} {{ g.country }}</span>
            <div class="geo-track">
              <div class="geo-fill" :style="{ width: `${g.pct}%` }"></div>
            </div>
            <span class="geo-pct">{{ g.pct }}%</span>
          </li>
        </ul>
      </section>
    </div>

    <div class="two-col">
      <section class="card">
        <h2 class="card-title">Најгледаније странице — демо</h2>
        <table class="data-table compact">
          <thead>
            <tr>
              <th>Путања</th>
              <th>Прегледи</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in DEMO.topPages" :key="p.path">
              <td><code>{{ p.path }}</code></td>
              <td>{{ formatNum(p.views) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2 class="card-title">Најтраженије собе — демо</h2>
        <table class="data-table compact">
          <thead>
            <tr>
              <th>Соба</th>
              <th>Кликови</th>
              <th>Упити</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in DEMO.topRooms" :key="r.name">
              <td>{{ r.name }}</td>
              <td>{{ formatNum(r.clicks) }}</td>
              <td>{{ formatNum(r.inquiries) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">RAG / chat agent</h2>
        <span v-if="liveSummary" class="live-pill">
          live: {{ formatNum(liveSummary.total) }} упита
          (miss {{ formatNum(liveSummary.misses) }})
        </span>
        <span v-else class="demo-pill small">демо fallback</span>
      </div>
      <p v-if="liveError" class="error-banner">{{ liveError }}</p>

      <div class="two-col inner">
        <div>
          <h3 class="sub-title">Најчешћа питања</h3>
          <table v-if="liveTop.length" class="data-table compact">
            <thead>
              <tr><th>Питање</th><th>Број</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in liveTop" :key="`lt-${item.question_hash}`">
                <td>{{ item.sample_question || item.question_norm }}</td>
                <td>{{ formatNum(item.ask_count) }}</td>
              </tr>
            </tbody>
          </table>
          <table v-else class="data-table compact">
            <thead>
              <tr><th>Питање</th><th>Број</th></tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in DEMO.ragTop" :key="`dt-${i}`">
                <td>{{ item.q }}</td>
                <td>{{ formatNum(item.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 class="sub-title">Miss — допунити KB</h3>
          <table v-if="liveMiss.length" class="data-table compact">
            <thead>
              <tr><th>Питање</th><th>Разлог</th><th>Број</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in liveMiss" :key="`lm-${item.question_hash}`">
                <td>{{ item.sample_question || item.question_norm }}</td>
                <td><code>{{ item.last_reason || '—' }}</code></td>
                <td>{{ formatNum(item.miss_count) }}</td>
              </tr>
            </tbody>
          </table>
          <table v-else class="data-table compact">
            <thead>
              <tr><th>Питање</th><th>Разлог</th><th>Број</th></tr>
            </thead>
            <tbody>
              <tr v-for="(item, i) in DEMO.ragMiss" :key="`dm-${i}`">
                <td>{{ item.q }}</td>
                <td><code>{{ item.reason }}</code></td>
                <td>{{ formatNum(item.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  </AdminLayout>
</template>

<style scoped>
.demo-pill {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffcc80;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  vertical-align: middle;
}
.demo-pill.small { margin-left: 0; }
.live-pill {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
  padding: 4px 10px;
  font-size: 0.82rem;
  font-weight: 700;
}
.demo-banner {
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #6d4c41;
  padding: 12px 14px;
  margin: 0 0 20px;
  font-size: 0.9rem;
  line-height: 1.45;
}
.demo-banner code {
  background: #f5f0ea;
  padding: 1px 6px;
  font-size: 0.85em;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.kpi-card {
  background: #fff;
  border-left: 4px solid #cdac91;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  padding: 14px 16px;
}
.kpi-label {
  display: block;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-bottom: 6px;
}
.kpi-value {
  display: block;
  font-size: 1.35rem;
  font-weight: 700;
  color: #332317;
  font-variant-numeric: tabular-nums;
}
.kpi-delta {
  display: block;
  margin-top: 6px;
  font-size: 0.78rem;
  color: #888;
}

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
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.card-head .card-title { margin-bottom: 0; }
.sub-title {
  margin: 0 0 10px;
  color: #332317;
  font-size: 0.95rem;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0 20px;
}
.two-col.inner { gap: 18px; }

.bars { display: flex; flex-direction: column; gap: 8px; }
.bar-row {
  display: grid;
  grid-template-columns: 40px 1fr 48px;
  gap: 10px;
  align-items: center;
}
.bar-label { font-size: 0.82rem; color: #555; }
.bar-track {
  height: 12px;
  background: #eee;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: #332317;
}
.bar-val {
  font-size: 0.82rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: #332317;
}

.geo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.geo-list li {
  display: grid;
  grid-template-columns: 120px 1fr 44px;
  gap: 10px;
  align-items: center;
}
.geo-name { font-size: 0.88rem; color: #332317; }
.geo-track {
  height: 10px;
  background: #eee;
  overflow: hidden;
}
.geo-fill {
  height: 100%;
  background: #cdac91;
}
.geo-pct {
  text-align: right;
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
}

.data-table.compact th,
.data-table.compact td {
  padding: 8px 10px;
  font-size: 0.88rem;
}
.data-table code {
  background: #f5f0ea;
  padding: 2px 6px;
  font-size: 0.85rem;
}

.error-banner {
  background: #fdecea;
  color: #c62828;
  border: 1px solid #f5c2c0;
  padding: 10px 12px;
  margin: 0 0 14px;
  font-size: 0.9rem;
  font-weight: bold;
}

@media (min-width: 900px) {
  .two-col {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
