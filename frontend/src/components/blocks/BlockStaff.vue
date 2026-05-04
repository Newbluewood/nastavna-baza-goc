<script setup>
import { useLangStore } from '../../stores/lang'

defineProps({
  members: Array
})

const langStore = useLangStore()
</script>

<template>
  <div class="staff-block-wrapper">
    <div class="staff-container">
      <h2>{{ langStore.currentLang === 'sr' ? 'Наш тим' : 'Our Team' }}</h2>
      <div class="staff-grid">
        <div v-for="member in members" :key="member.id" class="staff-card">
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
    </div>
  </div>
</template>

<style scoped>
.staff-block-wrapper { width: 100%; }
.staff-container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.staff-container h2 {
  font-size: 1.4rem; color: #332317; border-left: 4px solid #cdac91; padding-left: 12px; margin: 0 0 20px;
}
.staff-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px;
}
.staff-card {
  border: 1px solid #e8ddd2; background: #fff; overflow: hidden; display: flex; flex-direction: column;
}
.staff-photo img {
  width: 100%; height: 180px; object-fit: cover; object-position: top center; display: block; background: #f1ede8;
}
.staff-info { padding: 14px; display: flex; flex-direction: column; gap: 4px; }
.staff-info strong { color: #332317; font-size: 0.95rem; }
.staff-role { color: #67462e; font-size: 0.82rem; }
.staff-email { color: #9a714e; font-size: 0.8rem; text-decoration: none; border-bottom: 1px solid transparent; }
.staff-email:hover { border-bottom-color: #cdac91; }

@media (max-width: 640px) {
  .staff-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .staff-photo img { height: 140px; }
}
</style>
