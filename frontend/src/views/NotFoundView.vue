<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// Proveri da li je ruta "pod gradnjom" (ima rute ali komponenta nije implementirana)
const underConstructionPaths = ['/kontakt', '/o-nama', '/projekti', '/istrazivanje', '/edukacija']
const isUnderConstruction = underConstructionPaths.some(p => route.path.startsWith(p))
</script>

<template>
  <div class="not-found-page">
    <div class="content-box">

      <!-- Ikonica / Ilustracija -->
      <div class="icon-area">
        <div v-if="isUnderConstruction" class="big-icon">🚧</div>
        <div v-else class="big-icon">404</div>
      </div>

      <!-- Naslov -->
      <h1 v-if="isUnderConstruction">Страница је у изградњи</h1>
      <h1 v-else>Страница није пронађена</h1>

      <!-- Opis -->
      <p v-if="isUnderConstruction">
        Ова секција је тренутно у припреми.<br>
        Ускоро ће бити доступна. Хвала на стрпљењу.
      </p>
      <p v-else>
        Страница коју тражите не постоји или је премештена.<br>
        Проверите адресу или се вратите на почетну страну.
      </p>

      <!-- Akcije -->
      <div class="actions">
        <button class="btn-primary" @click="router.push('/')">
          ← Почетна страна
        </button>
        <button class="btn-secondary" @click="router.back()">
          Назад
        </button>
      </div>

      <!-- Korisni linkovi -->
      <div class="quick-links">
        <span>Или посетите:</span>
        <router-link to="/smestaj">Смештај</router-link>
        <router-link to="/vesti">Вести</router-link>
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
  background: #fff;
}

.content-box {
  text-align: center;
  max-width: 520px;
  width: 100%;
}

.icon-area {
  margin-bottom: 30px;
}

.big-icon {
  font-size: 5rem;
  line-height: 1;
  color: var(--color-nav, #332317);
  font-weight: 900;
  letter-spacing: -2px;
  /* Tanki dekorativni underline */
  display: inline-block;
  border-bottom: 4px solid #cdac91;
  padding-bottom: 10px;
}

h1 {
  font-size: 1.8rem;
  color: var(--color-nav, #332317);
  margin: 0 0 15px 0;
}

p {
  color: #777;
  font-size: 1rem;
  line-height: 1.7;
  margin: 0 0 35px 0;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}

.btn-primary {
  background: var(--color-nav, #332317);
  color: #fff;
  border: none;
  padding: 12px 24px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
  border-radius: 0;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.85; }

.btn-secondary {
  background: transparent;
  color: var(--color-nav, #332317);
  border: 2px solid var(--color-nav, #332317);
  padding: 10px 22px;
  font-size: 0.95rem;
  font-weight: bold;
  cursor: pointer;
  border-radius: 0;
  transition: all 0.2s;
}
.btn-secondary:hover {
  background: var(--color-nav, #332317);
  color: #fff;
}

.quick-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  font-size: 0.9rem;
  color: #aaa;
  flex-wrap: wrap;
}
.quick-links a {
  color: #cdac91;
  text-decoration: none;
  font-weight: bold;
  border-bottom: 1px solid #cdac91;
  padding-bottom: 2px;
}
.quick-links a:hover { color: var(--color-nav, #332317); border-color: var(--color-nav, #332317); }
</style>
