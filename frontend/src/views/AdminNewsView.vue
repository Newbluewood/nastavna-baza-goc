<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const newsList = ref([])
const isCreating = ref(false)
const isLoading = ref(false)
const sidebarOpen = ref(false)

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
    <!-- SIDEBAR OVERLAY (mobilni) -->
    <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <h2>CMS Panel</h2>
      <nav>
        <router-link to="/admin/vesti" class="active">Вести</router-link>
        <a href="#">Смештај</a>
        <a href="#">Странице</a>
        <router-link to="/admin/rezervacije">Упити/Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </aside>
    
    <main class="main-content">
      <!-- MOBILE TOP BAR -->
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebarOpen = !sidebarOpen">☰ CMS Panel</button>
      </div>

      <div v-if="!isCreating">
        <div class="page-header">
          <div>
            <h1>Управљање вестима</h1>
            <p class="subtitle">Додај, уреди или обриши вести на порталу.</p>
          </div>
          <button class="add-btn" @click="isCreating = true">+ Додај Вест</button>
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
  background: #f5f3f0;
  font-family: inherit;
  position: relative;
}

/* SIDEBAR */
.sidebar {
  width: 250px;
  background: #332317;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(-100%);
    width: 240px;
  }
  .sidebar.sidebar-open { transform: translateX(0); }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
  }
  .sidebar-overlay.active { display: block; }
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
  .grid-form { flex-direction: column; }
  .actions-col { width: 100%; }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none !important; }
}

.sidebar h2 {
  margin-top: 0;
  margin-bottom: 30px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 10px;
  font-size: 1.1rem;
  letter-spacing: 1px;
}
.sidebar nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.sidebar nav a {
  color: #ddd;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}
.sidebar nav a.active { background: #cdac91; color: #fff; font-weight: bold; }
.sidebar nav a:hover:not(.active) { background: #fff; color: #332317; }
.logout-btn {
  margin-top: 20px;
  padding: 10px;
  background: transparent;
  color: #cdac91;
  border: 1px solid #cdac91;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}
.logout-btn:hover { background: #cdac91; color: #332317; }

/* MAIN */
.main-content { flex: 1; padding: 40px; overflow-x: auto; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}
.page-header h1 { margin: 0 0 5px 0; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }
.add-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}
.add-btn:hover { opacity: 0.8; }

/* TABLE */
.data-table { width: 100%; border-collapse: collapse; background: white; }
.data-table th {
  background: #332317;
  color: #cdac91;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid #eee; vertical-align: middle; }
.data-table tr:hover { background: #fdf8f3; }

/* FORM BUTTONS */
.primary-btn { background: #27ae60; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 0; font-weight: bold; }
.primary-btn:disabled { background: #95a5a6; cursor: not-allowed; }
.secondary-btn { background: #aaa; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 0; }
.translate-btn {
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 15px;
  cursor: pointer;
  border-radius: 0;
  width: 100%;
  font-weight: bold;
  transition: opacity 0.2s;
}
.translate-btn:hover { opacity: 0.85; }
.small-btn { background: #cdac91; color: #332317; border: none; padding: 6px 12px; cursor: pointer; border-radius: 0; margin-right: 5px; font-weight: bold; font-size: 0.82rem; }
.small-btn.danger { background: #e74c3c; color: #fff; }

/* FORM */
.grid-form { display: flex; gap: 20px; margin-top: 20px; }
.lang-col { flex: 1; background: white; padding: 20px; border: 1px solid #e8e0d8; }
.lang-col h3 { margin-top: 0; color: #332317; border-bottom: 2px solid #cdac91; padding-bottom: 8px; }
.actions-col { display: flex; align-items: center; justify-content: center; width: 150px; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.88rem; color: #555; }
.form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; box-sizing: border-box; border-radius: 0; }
.form-group input:focus, .form-group textarea:focus { outline: none; border-color: #cdac91; }
.translated-input { background: #fffbf5; border-color: #ddd; }
.form-actions { margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end; }
.pulse { animation: pulseAnim 2s infinite; }
@keyframes pulseAnim {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
</style>
