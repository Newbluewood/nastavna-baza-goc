<script setup>
import { ref, onMounted } from 'vue'
import { useLangStore } from '../stores/lang'
import api from '../services/api.js'

const langStore = useLangStore()
const staff = ref([])
const projects = ref([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const data = await api.getContactPage()
    staff.value = data.staff || []
    projects.value = data.projects || []
  } catch (err) {
    console.error('Error loading contact page:', err)
  } finally {
    isLoading.value = false
  }
})

const statusLabel = (s) => ({
  активан: langStore.currentLang === 'sr' ? 'Активан' : 'Active',
  планиран: langStore.currentLang === 'sr' ? 'Планиран' : 'Planned',
  завршен: langStore.currentLang === 'sr' ? 'Завршен' : 'Completed'
}[s] || s)
</script>

<template>
  <div class="contact-page">
    <!-- HERO -->
    <div class="contact-hero">
      <h1>{{ langStore.currentLang === 'sr' ? 'Контакт' : 'Contact' }}</h1>
      <p>{{ langStore.currentLang === 'sr' ? 'Наставна база Гоч–Гвоздац, Шумарски факултет Универзитета у Београду' : 'Teaching Base Goč–Gvozdac, Faculty of Forestry, University of Belgrade' }}</p>
    </div>

    <div v-if="isLoading" class="loading-msg">
      {{ langStore.currentLang === 'sr' ? 'Учитавам...' : 'Loading...' }}
    </div>

    <div v-else class="contact-content">
      <!-- CONTACT INFO -->
      <section class="contact-info-section">
        <h2>{{ langStore.currentLang === 'sr' ? 'Информације' : 'Information' }}</h2>
        <div class="info-cards">
          <div class="info-card">
            <span class="info-icon">📍</span>
            <div>
              <strong>{{ langStore.currentLang === 'sr' ? 'Адреса' : 'Address' }}</strong>
              <p>{{ langStore.currentLang === 'sr' ? 'Гоч–Гвоздац, Врњачка Бања, Србија' : 'Goč–Gvozdac, Vrnjačka Banja, Serbia' }}</p>
            </div>
          </div>
          <div class="info-card">
            <span class="info-icon">📞</span>
            <div>
              <strong>{{ langStore.currentLang === 'sr' ? 'Телефон' : 'Phone' }}</strong>
              <p><a href="tel:+38136123456">+381 36 123 456</a></p>
            </div>
          </div>
          <div class="info-card">
            <span class="info-icon">✉️</span>
            <div>
              <strong>{{ langStore.currentLang === 'sr' ? 'Е-маил' : 'Email' }}</strong>
              <p><a href="mailto:info@gvozdac.rs">info@gvozdac.rs</a></p>
            </div>
          </div>
        </div>
      </section>

      <!-- STAFF -->
      <section class="staff-section" v-if="staff.length">
        <h2>{{ langStore.currentLang === 'sr' ? 'Наш тим' : 'Our Team' }}</h2>
        <div class="staff-grid">
          <div v-for="member in staff" :key="member.id" class="staff-card">
            <div class="staff-photo">
              <img :src="member.photo_url || '/placeholder.jpg'" :alt="member.full_name" />
            </div>
            <div class="staff-info">
              <strong>{{ member.full_name }}</strong>
              <span class="staff-role">{{ member.role }}</span>
              <a v-if="member.contact_email" :href="'mailto:' + member.contact_email" class="staff-email">{{ member.contact_email }}</a>
            </div>
          </div>
        </div>
      </section>

      <!-- PROJECTS -->
      <section class="projects-section" v-if="projects.length">
        <h2>{{ langStore.currentLang === 'sr' ? 'Активни пројекти' : 'Active Projects' }}</h2>
        <div class="projects-list">
          <div v-for="project in projects" :key="project.id" class="project-card">
            <div class="project-header">
              <strong>{{ project.title }}</strong>
              <span class="project-status" :class="project.status">{{ statusLabel(project.status) }}</span>
            </div>
            <p>{{ project.description }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.contact-page {
  max-width: var(--content-max-width, 1100px);
  margin: 0 auto;
  padding: 0 20px 60px;
}

.contact-hero {
  background: #332317;
  color: #cdac91;
  padding: 50px 30px;
  margin: 0 -20px 40px;
  text-align: center;
}
.contact-hero h1 {
  margin: 0 0 8px;
  font-size: 2rem;
  color: #fff;
}
.contact-hero p {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.85;
}

.loading-msg {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.contact-content {
  display: flex;
  flex-direction: column;
  gap: 50px;
}

/* SECTION HEADERS */
.contact-content h2 {
  font-size: 1.4rem;
  color: #332317;
  border-left: 4px solid #cdac91;
  padding-left: 12px;
  margin: 0 0 20px;
}

/* INFO CARDS */
.info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}
.info-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 20px;
  border: 1px solid #e8ddd2;
  background: #fdfaf7;
}
.info-icon { font-size: 1.4rem; }
.info-card strong { display: block; color: #332317; margin-bottom: 4px; font-size: 0.9rem; }
.info-card p { margin: 0; color: #67462e; font-size: 0.88rem; }
.info-card a { color: #67462e; text-decoration: none; border-bottom: 1px solid #cdac91; }
.info-card a:hover { color: #332317; }

/* STAFF */
.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}
.staff-card {
  border: 1px solid #e8ddd2;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.staff-photo img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
  background: #f1ede8;
}
.staff-info {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.staff-info strong { color: #332317; font-size: 0.95rem; }
.staff-role { color: #67462e; font-size: 0.82rem; }
.staff-email { color: #9a714e; font-size: 0.8rem; text-decoration: none; border-bottom: 1px solid transparent; }
.staff-email:hover { border-bottom-color: #cdac91; }

/* PROJECTS */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.project-card {
  padding: 18px;
  border: 1px solid #e8ddd2;
  background: #fdfaf7;
}
.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.project-header strong { color: #332317; font-size: 1rem; }
.project-status {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.project-status.активан { background: #e8f5e9; color: #27ae60; }
.project-status.планиран { background: #fff3e0; color: #e67e22; }
.project-status.завршен { background: #eceff1; color: #607d8b; }
.project-card p { margin: 0; color: #67462e; font-size: 0.88rem; line-height: 1.5; }

/* MOBILE */
@media (max-width: 640px) {
  .contact-hero { padding: 35px 20px; }
  .contact-hero h1 { font-size: 1.5rem; }
  .staff-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .staff-photo img { height: 140px; }
  .info-cards { grid-template-columns: 1fr; }
  .project-header { flex-direction: column; align-items: flex-start; gap: 6px; }
}
</style>
