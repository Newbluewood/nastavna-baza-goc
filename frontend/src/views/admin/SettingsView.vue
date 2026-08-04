<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const isLoading = ref(true)
const isSaving = ref(false)
const settings = ref({})

const LABELS = {
  footer_faculty: 'Назив базе (footer)',
  footer_university: 'Универзитет/факултет (footer)',
  footer_address: 'Адреса (footer)',
  footer_city: 'Град (footer)',
  footer_phone: 'Телефон (footer)',
  footer_email: 'Е-маил (footer)',
  footer_website_label: 'Текст линка ка сајту факултета',
  footer_website_url: 'URL сајта факултета',
  footer_credits: 'Кредити (HTML, footer)',
  contact_address: 'Адреса (страна Контакт)',
  contact_phone: 'Телефон (страна Контакт)',
  contact_email: 'Е-маил (страна Контакт)',
  social_facebook: 'Facebook URL',
  social_instagram: 'Instagram URL',
  social_linkedin: 'LinkedIn URL'
}

const GROUPS = [
  { title: 'Подножје сајта (footer)', keys: ['footer_faculty', 'footer_university', 'footer_address', 'footer_city', 'footer_phone', 'footer_email', 'footer_website_label', 'footer_website_url', 'footer_credits'] },
  { title: 'Страна Контакт', keys: ['contact_address', 'contact_phone', 'contact_email'] },
  { title: 'Друштвене мреже', keys: ['social_facebook', 'social_instagram', 'social_linkedin'] }
]

const isSocial = (key) => key.startsWith('social_')
const isBilingual = (key) => !isSocial(key)

const fetchSettings = async () => {
  isLoading.value = true
  try {
    const rows = await api.getAdminSettings()
    const map = {}
    rows.forEach(r => { map[r.setting_key] = { value_sr: r.value_sr || '', value_en: r.value_en || '' } })
    settings.value = map
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
    console.error('Failed to load settings:', err)
  } finally {
    isLoading.value = false
  }
}

const save = async () => {
  isSaving.value = true
  try {
    const payload = Object.entries(settings.value).map(([setting_key, v]) => ({
      setting_key,
      value_sr: v.value_sr,
      value_en: isSocial(setting_key) ? v.value_sr : v.value_en
    }))
    await api.updateSettings(payload)
    alert('Подешавања су сачувана.')
  } catch (err) {
    alert(err.data?.error || 'Грешка при чувању')
  } finally {
    isSaving.value = false
  }
}

onMounted(fetchSettings)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Подешавања сајта</h1>
        <p class="subtitle">Контакт подаци, подножје сајта (footer) и линкови ка друштвеним мрежама.</p>
      </div>
    </div>

    <div v-if="isLoading" class="loading-msg">Учитавам...</div>

    <div v-else class="settings-form">
      <div v-for="group in GROUPS" :key="group.title" class="settings-group">
        <h2>{{ group.title }}</h2>
        <div v-for="key in group.keys" :key="key" class="setting-row">
          <label>{{ LABELS[key] || key }}</label>
          <div v-if="isBilingual(key)" class="bilingual-inputs">
            <input v-model="settings[key].value_sr" type="text" placeholder="Српски" />
            <input v-model="settings[key].value_en" type="text" placeholder="English" />
          </div>
          <input v-else v-model="settings[key].value_sr" type="text" placeholder="https://..." />
        </div>
      </div>

      <div class="form-actions">
        <button class="save-btn" :disabled="isSaving" @click="save">{{ isSaving ? 'Чувам...' : 'Сачувај' }}</button>
      </div>
    </div>
  </AdminLayout>
</template>

<style scoped>
.page-header { margin-bottom: 24px; }
.subtitle { color: #888; font-size: 0.9rem; margin-top: 4px; }
.loading-msg { color: #999; padding: 40px 0; }

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 32px;
  max-width: 800px;
}
.settings-group h2 {
  font-size: 1.1rem;
  color: #332317;
  border-left: 4px solid #cdac91;
  padding-left: 12px;
  margin: 0 0 16px;
}
.setting-row {
  display: grid;
  grid-template-columns: 220px 1fr;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}
.setting-row label {
  font-size: 0.85rem;
  color: #555;
  font-weight: 600;
}
.setting-row input {
  padding: 8px 10px;
  border: 1px solid #ddd;
  font-size: 0.9rem;
}
.bilingual-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.form-actions { margin-top: 8px; }
.save-btn {
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 10px 24px;
  font-weight: bold;
  cursor: pointer;
}
.save-btn:hover { opacity: 0.85; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 640px) {
  .setting-row { grid-template-columns: 1fr; }
  .bilingual-inputs { grid-template-columns: 1fr; }
}
</style>
