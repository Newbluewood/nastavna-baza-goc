<script setup>
import { useLangStore } from '../../stores/lang'

const langStore = useLangStore()
</script>

<template>
  <div class="contact-block-wrapper">
    <div class="contact-container">
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
    </div>
  </div>
</template>

<style scoped>
.contact-block-wrapper {
  width: 100%;
}
.contact-container {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 20px;
}
.contact-container h2 {
  font-size: 1.4rem;
  color: #332317;
  border-left: 4px solid #cdac91;
  padding-left: 12px;
  margin: 0 0 20px;
}
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

@media (max-width: 640px) {
  .info-cards { grid-template-columns: 1fr; }
}
</style>
