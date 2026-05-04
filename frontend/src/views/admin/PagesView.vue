<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const pages = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const defaultBlocks = [
  { id: 'text', type: 'text', label: 'Основни текст', enabled: true },
  { id: 'discover', type: 'discover', label: 'Откријте Гоч (Grid)', enabled: false },
  { id: 'news_slider', type: 'news_slider', label: 'Актуелности (Slajder)', enabled: false },
  { id: 'facilities', type: 'facilities', label: 'Објекти (Смештај/Ресторан)', enabled: false },
  { id: 'gallery', type: 'gallery', label: 'Галериja салика', enabled: false, gallery_id: null },
  { id: 'video', type: 'video', label: 'Видео снимак (YouTube)', enabled: false, video_url: '' },
  { id: 'staff', type: 'staff', label: 'Наш тим', enabled: false },
  { id: 'projects', type: 'projects', label: 'Активни пројекти', enabled: false },
  { id: 'faq', type: 'faq', label: 'ФАК (Питања)', enabled: false },
  { id: 'contact', type: 'contact', label: 'Контакт форма', enabled: false },
  { id: 'map', type: 'map', label: 'Google Мапа', enabled: false, google_map_html: '' },
  { id: 'ticker', type: 'ticker', label: 'ТВ Кајрон (Вести)', enabled: false }
];

const form = ref({ 
  slug: '', title: '', content: '',
  metadata: { blocks: JSON.parse(JSON.stringify(defaultBlocks)) }
})

const fetchPages = async () => {
  isLoading.value = true
  try {
    const rawPages = await api.getAdminPages()
    pages.value = rawPages.map(p => {
      let meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {})
      if (!meta.blocks) {
        meta.blocks = JSON.parse(JSON.stringify(defaultBlocks))
      } else {
        // Sinhronizacija: Dopuni nazive i dodaj nove blokove koji nedostaju
        meta.blocks = meta.blocks.map(existingBlock => {
          const match = defaultBlocks.find(db => db.type === existingBlock.type);
          if (match) {
            return { ...match, ...existingBlock, label: match.label }; // Prioritet ima label iz koda
          }
          return existingBlock;
        });

        defaultBlocks.forEach(db => {
          if (!meta.blocks.find(b => b.type === db.type)) {
            meta.blocks.push(JSON.parse(JSON.stringify(db)));
          }
        });
      }
      return { ...p, metadata: meta }
    })
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
    console.error('Failed to load pages:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { slug: '', title: '', content: '', metadata: { blocks: JSON.parse(JSON.stringify(defaultBlocks)) } }
  isEditing.value = false; editingId.value = null;
}

const moveBlock = (index, direction) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= form.value.metadata.blocks.length) return
  const blocks = [...form.value.metadata.blocks]
  const [movedBlock] = blocks.splice(index, 1)
  blocks.splice(newIndex, 0, movedBlock)
  form.value.metadata.blocks = blocks
}

const startCreate = () => { resetForm(); isEditing.value = true }
const startEdit = (page) => {
  form.value = { 
    slug: page.slug, title: page.title || '', content: page.content || '',
    metadata: JSON.parse(JSON.stringify(page.metadata))
  }
  editingId.value = page.id; isEditing.value = true;
}

const savePage = async () => {
  try {
    if (editingId.value) await api.updatePage(editingId.value, form.value)
    else await api.request('/api/admin/pages', { method: 'POST', body: JSON.stringify(form.value) })
    resetForm(); await fetchPages();
  } catch (err) { alert(err.data?.error || 'Greška pri čuvanju') }
}

const deletePage = async (id) => {
  if (!confirm('Пажња! Да ли сте сигурни да желите да обришете ову страницу?')) return
  try {
    await api.deletePage(id)
    await fetchPages()
  } catch (err) {
    alert('Greška pri brisanju: ' + err.message)
  }
}

onMounted(() => fetchPages())
</script>

<template>
  <AdminLayout>
      <div class="page-header">
        <div>
          <h1 class="green-text">Управљање страницама</h1>
          <p class="subtitle">Уредите изглед и редослед модула на сајту</p>
        </div>
        <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Нова страница</button>
      </div>

      <!-- EDIT OVERLAY -->
      <div v-if="isEditing" class="edit-overlay">
        <div class="edit-card">
          <div class="card-header">
            <h2 class="green-title">{{ editingId ? 'Уреди: ' + form.title : 'Nova stranica' }}</h2>
            <div class="header-btns">
              <button class="save-btn" @click="savePage">Сачувај све</button>
              <button class="cancel-btn" @click="resetForm">Затвори</button>
            </div>
          </div>

          <div class="editor-layout">
            <div class="editor-sidebar">
               <div class="s-group">
                 <label>Наслов (Header/Hero)</label>
                 <input v-model="form.title" type="text" />
               </div>
               <div class="s-group">
                 <label>Slug (npr. smestaj)</label>
                 <input v-model="form.slug" type="text" :disabled="!!editingId" />
               </div>

               <div class="blocks-manager">
                  <label class="green-text">🧱 Редослед и видљивост модула</label>
                  <div class="blocks-stack">
                    <div v-for="(block, index) in form.metadata.blocks" :key="block.id" class="b-row" :class="{ off: !block.enabled }">
                       <div class="b-drag">
                         <button @click="moveBlock(index, -1)" :disabled="index === 0">▲</button>
                         <button @click="moveBlock(index, 1)" :disabled="index === form.metadata.blocks.length - 1">▼</button>
                       </div>
                       <div class="b-info">
                         <input type="checkbox" v-model="block.enabled" :id="'b-'+index" />
                         <label :for="'b-'+index" class="b-name">{{ block.label }}</label>
                       </div>
                    </div>
                  </div>
               </div>

               <div class="s-group" v-if="form.metadata.blocks.find(b => b.type === 'text' && b.enabled)">
                 <label>Текстуални садржај (HTML)</label>
                 <textarea v-model="form.content" rows="8"></textarea>
               </div>
            </div>

            <!-- DETAILED PREVIEW -->
            <div class="editor-preview">
               <div class="mock-device">
                  <div class="mock-top-bar">Live Preview Mode - Mt. Goč Portal</div>
                  <div class="mock-scroller">
                    <div class="mock-hero">
                       <div class="mock-hero-blur">
                          <h1 class="green-text">{{ form.title || 'Naslov' }}</h1>
                          <p>Goč / {{ form.title || '...' }}</p>
                       </div>
                    </div>
                    <template v-for="block in form.metadata.blocks" :key="block.id">
                      <div v-if="block.enabled" class="mock-rendered">
                         <div v-if="block.type === 'text'" class="m-text" v-html="form.content || '<p>Unesite tekst...</p>'"></div>
                         
                         <div v-if="block.type === 'discover'" class="m-block m-discover">
                            <span class="m-tag green-bg">Otkrijte Goč</span>
                            <div class="m-grid"><div v-for="i in 3" :key="i" class="m-item"></div></div>
                         </div>

                         <div v-if="block.type === 'news_slider'" class="m-block m-news">
                            <span class="m-tag green-bg">Aktivnosti (Slajder)</span>
                            <div class="m-slide-mock"></div>
                         </div>

                         <div v-if="block.type === 'facilities'" class="m-block m-fac">
                            <span class="m-tag green-bg">Objekti (Smeštaj/Restoran)</span>
                            <div class="m-grid"><div v-for="i in 2" :key="i" class="m-item"></div></div>
                         </div>

                         <div v-if="block.type === 'gallery'" class="m-block m-gal">
                            <span class="m-tag green-bg">Galerija slika</span>
                            <div class="m-grid-mini"><div v-for="i in 6" :key="i" class="m-dot"></div></div>
                         </div>

                         <div v-if="block.type === 'video'" class="m-block m-video">
                            <span class="m-tag green-bg">Video: {{ block.video_url || '...' }}</span>
                            <div class="m-video-rect"></div>
                         </div>

                         <div v-if="block.type === 'map'" class="m-block m-map">
                            <span class="m-tag green-bg">Google Mapa</span>
                            <div class="m-map-rect"></div>
                         </div>

                         <div v-if="block.type === 'staff'" class="m-block m-staff">
                            <span class="m-tag green-bg">Naš tim</span>
                            <div class="m-grid-mini"><div v-for="i in 4" :key="i" class="m-dot"></div></div>
                         </div>

                         <div v-if="block.type === 'faq'" class="m-block m-faq">
                            <span class="m-tag green-bg">Česta pitanja (FAQ)</span>
                            <div class="m-faq-lines"><div v-for="i in 3" :key="i" class="m-line"></div></div>
                         </div>

                         <div v-if="block.type === 'ticker'" class="m-ticker">★★★ TV KAJRON VESTI AKTIVAN ★★★</div>
                      </div>
                    </template>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DATA TABLE (RESTORED VERSION) -->
      <div v-if="isLoading" class="loading">Učitavam...</div>
      <div v-else class="table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Putanja</th>
              <th>Naslov</th>
              <th>Aktivni moduli</th>
              <th style="text-align: right;">Akcije</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pages" :key="p.id">
              <td><small>{{ p.id }}</small></td>
              <td><code>/{{ p.slug }}</code></td>
              <td><strong>{{ p.title }}</strong></td>
              <td>
                <div class="badges-row">
                  <span v-for="b in p.metadata.blocks.filter(x => x.enabled)" :key="b.id" class="m-badge">
                    {{ b.type }}
                  </span>
                </div>
              </td>
              <td class="actions-cell">
                <button class="btn-edit" @click="startEdit(p)">Уреди</button>
                <button class="btn-del" @click="deletePage(p.id)">Обриши</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
  </AdminLayout>
</template>

<style scoped>
.green-text { color: #2d5a27 !important; }
.green-title { color: #ffffff; }
.green-bg { background: #2d5a27 !important; }

.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.add-btn { background: #332317; color: white; border: none; padding: 10px 20px; cursor: pointer; font-weight: bold; }

.edit-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.edit-card { background: #f4f1ee; width: 100%; max-width: 1400px; height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; }

.card-header { background: #2d5a27; color: white; padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; }
.header-btns { display: flex; gap: 10px; }
.save-btn { background: #cdac91; color: white; border: none; padding: 8px 20px; cursor: pointer; font-weight: bold; }
.cancel-btn { background: rgba(255,255,255,0.1); color: white; border: 1px solid white; padding: 8px 20px; cursor: pointer; }

.editor-layout { display: grid; grid-template-columns: 450px 1fr; flex: 1; overflow: hidden; }
.editor-sidebar { padding: 25px; overflow-y: auto; background: white; border-right: 1px solid #ddd; }
.s-group { margin-bottom: 20px; }
.s-group label { display: block; font-weight: bold; margin-bottom: 5px; color: #332317; font-size: 0.85rem; }
.s-group input, .s-group textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }

.blocks-manager { margin-bottom: 20px; background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
.blocks-stack { display: flex; flex-direction: column; gap: 5px; }
.b-row { display: flex; align-items: center; gap: 10px; background: white; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
.b-row.off { opacity: 0.4; }
.b-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.b-name { font-size: 0.8rem; font-weight: bold; cursor: pointer; }
.b-drag { display: flex; gap: 2px; }
.b-drag button { padding: 2px 5px; font-size: 8px; cursor: pointer; }

.editor-preview { padding: 40px; background: #e0d9d1; overflow-y: auto; display: flex; justify-content: center; }
.mock-device { width: 100%; max-width: 800px; background: white; border-radius: 10px; box-shadow: 0 30px 60px rgba(0,0,0,0.3); }
.mock-top-bar { background: #332317; padding: 8px; text-align: center; font-size: 0.7rem; color: #cdac91; font-weight: bold; border-radius: 10px 10px 0 0; }
.mock-scroller { height: 500px; overflow-y: auto; }

.mock-hero { height: 180px; background: url('https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=2070') center/cover; position: relative; }
.mock-hero-blur { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); padding: 15px 30px; }
.mock-hero-blur h1 { margin: 0; font-size: 1.4rem; }

.m-text { padding: 25px 30px; font-size: 0.85rem; color: #444; line-height: 1.6; }
.m-block { margin: 10px 30px 20px; padding: 15px; border-radius: 4px; border: 1px solid #eee; background: #fafafa; position: relative; }
.m-tag { position: absolute; top: -10px; left: 10px; color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; }
.m-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
.m-item { height: 40px; background: #ddd; border-radius: 4px; }
.m-ticker { background: #2d5a27; color: white; padding: 8px; text-align: center; font-size: 0.65rem; font-weight: bold; }

.table-container { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th { text-align: left; padding: 15px; background: #fdfaf7; color: #332317; border-bottom: 2px solid #2d5a27; font-size: 0.9rem; }
.admin-table td { padding: 15px; border-bottom: 1px solid #eee; font-size: 0.9rem; }

.badges-row { display: flex; flex-wrap: wrap; gap: 5px; }
.m-badge { background: #e8f5e9; color: #2d5a27; font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; font-weight: bold; border: 1px solid #c8e6c9; }

.actions-cell { text-align: right; display: flex; justify-content: flex-end; gap: 8px; }
.btn-edit { background: #2d5a27; color: white; border: none; padding: 6px 15px; cursor: pointer; font-weight: bold; border-radius: 4px; }
.btn-del { background: #f44336; color: white; border: none; padding: 6px 15px; cursor: pointer; font-weight: bold; border-radius: 4px; }
.btn-del:hover { background: #d32f2f; }
</style>
