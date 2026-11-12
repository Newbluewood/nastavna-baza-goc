<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const templates = ref([])
const isLoading = ref(true)
const errorMsg = ref('')
const expandedId = ref(null)

const fetchTemplates = async () => {
  isLoading.value = true
  errorMsg.value = ''
  try {
    const data = await api.getEmailTemplates()
    templates.value = Array.isArray(data?.templates) ? data.templates : []
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      router.push({ name: 'admin-login' })
      return
    }
    errorMsg.value = err.data?.error || 'Грешка при учитавању мејлова'
  } finally {
    isLoading.value = false
  }
}

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id
}

onMounted(() => fetchTemplates())
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Мејл шаблони</h1>
        <p class="subtitle">Преглед транзакционих мејлова које систем шаље гостима (узорак података).</p>
      </div>
      <button class="refresh-btn" :disabled="isLoading" @click="fetchTemplates">
        {{ isLoading ? 'Учитавам...' : 'Освежи' }}
      </button>
    </div>

    <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    <div v-if="isLoading" class="loading-msg">Учитавам шаблоне...</div>

    <div v-else class="cards-grid">
      <article
        v-for="tpl in templates"
        :key="tpl.id"
        class="mail-card"
        :class="{ expanded: expandedId === tpl.id }"
      >
        <header class="mail-card-head">
          <div>
            <h2>{{ tpl.title }}</h2>
            <p class="when">{{ tpl.when }}</p>
            <p class="subject"><span>Наслов:</span> {{ tpl.subject }}</p>
          </div>
          <button type="button" class="expand-btn" @click="toggleExpand(tpl.id)">
            {{ expandedId === tpl.id ? 'Скупи' : 'Увећај' }}
          </button>
        </header>
        <div class="preview-frame-wrap">
          <iframe
            class="preview-frame"
            title="Преглед мејла"
            sandbox=""
            :srcdoc="tpl.html"
          />
        </div>
      </article>
    </div>
  </AdminLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}
.subtitle { color: #666; margin: 6px 0 0; max-width: 42rem; }
.refresh-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
}
.error-msg { color: #c62828; margin-bottom: 16px; }
.loading-msg { color: #666; }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.mail-card {
  background: #fff;
  border: 1px solid #e8e0d8;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mail-card.expanded {
  grid-column: 1 / -1;
}

.mail-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.mail-card h2 {
  margin: 0;
  font-size: 1.05rem;
  color: #332317;
}

.when {
  margin: 6px 0 0;
  color: #777;
  font-size: 0.88rem;
  line-height: 1.35;
}

.subject {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: #444;
  word-break: break-word;
}
.subject span { font-weight: 700; color: #332317; }

.expand-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid #cdac91;
  color: #332317;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}
.expand-btn:hover { background: #cdac91; }

.preview-frame-wrap {
  border: 1px solid #e8e0d8;
  background: #faf8f6;
  overflow: hidden;
}

.preview-frame {
  width: 100%;
  height: 280px;
  border: 0;
  background: #fff;
  display: block;
}

.mail-card.expanded .preview-frame {
  height: 560px;
}

@media (max-width: 640px) {
  .cards-grid { grid-template-columns: 1fr; }
  .mail-card.expanded .preview-frame { height: 420px; }
}
</style>
