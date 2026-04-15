<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const newsList = ref([])
const isCreating = ref(false)
const isLoading = ref(false)

const form = ref({
  title: '',
  excerpt: '',
  content: '',
  cover_image: '/placeholder.jpg',
  title_en: '',
  excerpt_en: '',
  content_en: ''
})

const fetchNews = async () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/news`)
  newsList.value = await res.json()
}

onMounted(() => {
  fetchNews()
})

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const translateContent = async () => {
  if (!form.value.title && !form.value.excerpt && !form.value.content) {
    alert("Unesite bar neki tekst na srpskom da bi ga preveli.")
    return
  }
  
  isLoading.value = true
  const token = localStorage.getItem('admin_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  
  const translateField = async (text) => {
    if (!text) return ''
    const res = await fetch(`${baseUrl}/api/admin/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text, target_lang: 'EN' })
    })
    const data = await res.json()
    return data.translated_text || ''
  }

  try {
    form.value.title_en = await translateField(form.value.title)
    form.value.excerpt_en = await translateField(form.value.excerpt)
    form.value.content_en = await translateField(form.value.content)
  } catch (err) {
    alert("Greška pri prevođenju.")
  } finally {
    isLoading.value = false
  }
}

const submitNews = async () => {
  if (!form.value.title_en) {
    alert("Morate generisati engleski prevod pre čuvanja!")
    return
  }

  const token = localStorage.getItem('admin_token')
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
  
  const res = await fetch(`${baseUrl}/api/admin/news`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form.value)
  })

  if (res.ok) {
    isCreating.value = false
    form.value = { title: '', excerpt: '', content: '', cover_image: '/placeholder.jpg', title_en: '', excerpt_en: '', content_en: '' }
    fetchNews()
  } else {
    alert("Greška pri unosu vesti.")
  }
}
</script>

<template>
  <div class="admin-layout">
    <aside class="sidebar">
      <h2>CMS Panel</h2>
      <nav>
        <a href="#" class="active">Вести</a>
        <a href="#">Смештај</a>
        <a href="#">Странице</a>
        <a href="#">Упити/Резервације</a>
      </nav>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </aside>
    
    <main class="main-content">
      <div v-if="!isCreating">
        <div class="header-actions">
          <h1>Управљање вестима</h1>
          <button class="primary-btn" @click="isCreating = true">+ Додај Вест</button>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Слика</th>
              <th>Наслов (СРП)</th>
              <th>Датум</th>
              <th>Акције</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in newsList" :key="n.id">
              <td>{{ n.id }}</td>
              <td><img :src="n.cover_image" width="50" height="50" style="object-fit:cover;"></td>
              <td>{{ n.title }}</td>
              <td>{{ new Date(n.created_at).toLocaleDateString() }}</td>
              <td>
                <button class="small-btn">Измени</button>
                <button class="small-btn danger">Обриши</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="form-container">
        <h2>Додавање нове вести</h2>
        <div class="grid-form">
          <div class="lang-col">
            <h3>Српски (Оригинал)</h3>
            <div class="form-group">
              <label>Наслов</label>
              <input type="text" v-model="form.title" required>
            </div>
            <div class="form-group">
              <label>Кратак Опис (Excerpt)</label>
              <textarea v-model="form.excerpt" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label>Садржај</label>
              <textarea v-model="form.content" rows="6"></textarea>
            </div>
          </div>
          
          <div class="actions-col">
             <button class="translate-btn" @click="translateContent" :disabled="isLoading">
               <span v-if="!isLoading">🌍 ПРЕВЕДИ АУТОМАТСКИ<br><small>(Користи DeepL AI)</small></span>
               <span v-else>Превођење...</span>
             </button>
          </div>

          <div class="lang-col">
            <h3>Енглески (Превод)</h3>
            <div class="form-group">
              <label>Title <span style="color:red">*обавезно</span></label>
              <input type="text" v-model="form.title_en" required readonly class="translated-input">
            </div>
            <div class="form-group">
              <label>Excerpt</label>
              <textarea v-model="form.excerpt_en" rows="2" readonly class="translated-input"></textarea>
            </div>
            <div class="form-group">
              <label>Content</label>
              <textarea v-model="form.content_en" rows="6" readonly class="translated-input"></textarea>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="secondary-btn" @click="isCreating = false">Одустани</button>
          <button class="primary-btn pulse" @click="submitNews" :disabled="!form.title_en">💾 САЧУВАЈ ВЕСТ</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--color-background-soft, #f7f7f7);
  font-family: inherit;
}
.sidebar {
  width: 250px;
  background: #2c3e50;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.sidebar h2 { margin-top: 0; margin-bottom: 30px; border-bottom: 1px solid #34495e; padding-bottom: 10px; }
.sidebar nav { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.sidebar nav a { color: #bdc3c7; text-decoration: none; padding: 10px; border-radius: 4px; }
.sidebar nav a.active, .sidebar nav a:hover { background: #34495e; color: white; }
.logout-btn { padding: 10px; background: #c0392b; color: white; border: none; cursor: pointer; border-radius: 4px; }

.main-content {
  flex: 1;
  padding: 40px;
}
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;}
.primary-btn { background: #27ae60; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: bold;}
.primary-btn:disabled { background: #95a5a6; cursor: not-allowed; }
.secondary-btn { background: #95a5a6; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px;}
.translate-btn { background: #2980b9; color: white; border: none; padding: 15px; cursor: pointer; border-radius: 8px; width: 100%; font-weight: bold; }
.small-btn { background: #f39c12; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-right: 5px; }
.small-btn.danger { background: #e74c3c; }

.data-table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
.data-table th, .data-table td { padding: 12px; border: 1px solid #ecf0f1; text-align: left; }
.data-table th { background: #ecf0f1; }

.grid-form { display: flex; gap: 20px; margin-top: 20px; }
.lang-col { flex: 1; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
.actions-col { display: flex; align-items: center; justify-content: center; width: 150px; }

.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
.form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; box-sizing: border-box; border-radius: 4px; }
.translated-input { background: #f1f8ff; border-color: #bcd5f0; }

.form-actions { margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end; }
.pulse { animation: pulseAnim 2s infinite; }
@keyframes pulseAnim {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
</style>
