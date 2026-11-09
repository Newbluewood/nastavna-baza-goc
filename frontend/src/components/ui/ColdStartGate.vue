<script setup>
import { computed } from 'vue'
import { useBootstrapStore } from '../../stores/bootstrap'
import { useLangStore } from '../../stores/lang'

const bootstrap = useBootstrapStore()
const langStore = useLangStore()

const title = computed(() => langStore.t('coldStart.title'))
const subtitle = computed(() => langStore.t('coldStart.subtitle'))
const waiting = computed(() =>
  langStore.t('coldStart.waiting').replace('{n}', String(bootstrap.elapsedSec))
)
const timeoutTitle = computed(() => langStore.t('coldStart.timeoutTitle'))
const timeoutBody = computed(() => langStore.t('coldStart.timeoutBody'))
const retryLabel = computed(() => langStore.t('coldStart.retry'))
</script>

<template>
  <div class="cold-start" role="status" aria-live="polite">
    <div class="cold-card">
      <img src="/logo.svg" alt="Наставна база Гоч" class="cold-logo" />

      <template v-if="bootstrap.status === 'loading'">
        <div class="spinner" aria-hidden="true" />
        <h1>{{ title }}</h1>
        <p class="lead">{{ subtitle }}</p>
        <p class="meta">{{ waiting }}</p>
      </template>

      <template v-else>
        <h1>{{ timeoutTitle }}</h1>
        <p class="lead">{{ timeoutBody }}</p>
        <button type="button" class="retry-btn" @click="bootstrap.retry()">
          {{ retryLabel }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cold-start {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at top, #f7f1ea 0%, #f5f3f0 45%, #ebe4dc 100%);
  color: #332317;
}

.cold-card {
  width: 100%;
  max-width: 440px;
  text-align: center;
  background: #fff;
  border: 1px solid #e8e0d8;
  padding: 36px 28px 32px;
}

.cold-logo {
  width: 220px;
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto 28px;
}

.spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 18px;
  border: 3px solid #e8e0d8;
  border-top-color: #332317;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

h1 {
  margin: 0 0 10px;
  font-size: 1.35rem;
  font-weight: 700;
  color: #332317;
}

.lead {
  margin: 0 0 14px;
  color: #666;
  font-size: 0.98rem;
  line-height: 1.5;
}

.meta {
  margin: 0;
  color: #999;
  font-size: 0.85rem;
}

.retry-btn {
  margin-top: 8px;
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 12px 22px;
  font-weight: bold;
  letter-spacing: 0.5px;
  cursor: pointer;
}

.retry-btn:hover {
  opacity: 0.9;
}
</style>
