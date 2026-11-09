<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found-page">
    <div class="content-box">
      <div class="icon-area">
        <div class="big-icon">404</div>
      </div>

      <h1>Страница није пронађена</h1>

      <p>
        Страница коју тражите не постоји или је премештена.<br>
        Проверите адресу или се вратите на почетну страну.
      </p>

      <div class="actions">
        <button class="btn-primary" @click="router.push({ name: 'home' })">
          ← Почетна страна
        </button>
        <button class="btn-secondary" @click="router.back()">
          Назад
        </button>
      </div>

      <div class="quick-links">
        <span>Или посетите:</span>
        <router-link :to="{ name: 'smestaj' }">Смештај</router-link>
        <router-link :to="{ name: 'vesti' }">Вести</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: linear-gradient(180deg, #fdfaf7 0%, #f5f0ea 100%);
}
.content-box {
  text-align: center;
  max-width: 480px;
}
.big-icon {
  font-size: 4rem;
  font-weight: 800;
  color: #cdac91;
  letter-spacing: 4px;
  margin-bottom: 16px;
}
h1 {
  color: #332317;
  font-size: 1.6rem;
  margin: 0 0 12px;
}
p {
  color: #67462e;
  line-height: 1.6;
  margin: 0 0 24px;
}
.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 28px;
}
.btn-primary, .btn-secondary {
  border: none;
  padding: 10px 18px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
}
.btn-primary { background: #332317; color: #cdac91; }
.btn-secondary { background: #f5f0ea; color: #332317; border: 1px solid #cdac91; }
.quick-links {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.88rem;
  color: #999;
}
.quick-links a { color: #9a714e; font-weight: 600; text-decoration: none; }
.quick-links a:hover { text-decoration: underline; }
</style>
