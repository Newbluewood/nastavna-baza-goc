<script setup>
import { useLangStore } from '../../stores/lang'

defineProps({
  projects: Array
})

const langStore = useLangStore()

const statusLabel = (s) => ({
  активан: langStore.currentLang === 'sr' ? 'Активан' : 'Active',
  планиран: langStore.currentLang === 'sr' ? 'Планиран' : 'Planned',
  завршен: langStore.currentLang === 'sr' ? 'Завршен' : 'Completed'
}[s] || s)

const statusClass = (s) => ({
  активан: 'active',
  планиран: 'planned',
  завршен: 'completed'
}[s] || 'unknown')
</script>

<template>
  <div class="projects-block-wrapper">
    <div class="projects-container">
      <h2>{{ langStore.currentLang === 'sr' ? 'Активни пројекти' : 'Active Projects' }}</h2>
      <div class="projects-list">
        <div v-for="project in projects" :key="project.id" class="project-card">
          <div class="project-header">
            <strong>{{ project.title }}</strong>
            <span class="project-status" :class="statusClass(project.status)">{{ statusLabel(project.status) }}</span>
          </div>
          <p>{{ project.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.projects-block-wrapper { width: 100%; }
.projects-container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.projects-container h2 {
  font-size: 1.4rem; color: #332317; border-left: 4px solid #cdac91; padding-left: 12px; margin: 0 0 20px;
}
.projects-list { display: flex; flex-direction: column; gap: 14px; }
.project-card { padding: 18px; border: 1px solid #e8ddd2; background: #fdfaf7; }
.project-header {
  display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;
}
.project-header strong { color: #332317; font-size: 1rem; }
.project-status {
  font-size: 0.75rem; font-weight: 700; padding: 3px 10px; text-transform: uppercase; letter-spacing: 0.5px;
}
.project-status.active { background: #e8f5e9; color: #27ae60; }
.project-status.planned { background: #fff3e0; color: #e67e22; }
.project-status.completed { background: #eceff1; color: #607d8b; }
.project-card p { margin: 0; color: #67462e; font-size: 0.88rem; line-height: 1.5; }

@media (max-width: 640px) {
  .project-header { flex-direction: column; align-items: flex-start; gap: 6px; }
}
</style>
