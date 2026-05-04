<script setup>
import { useLangStore } from '../../stores/lang'

const langStore = useLangStore()
</script>

<template>
  <div class="ticker-block">
     <div class="ticker-content">
       <span class="ticker-label">INFO:</span>
       <div class="ticker-scroll-wrapper">
         <div class="ticker-scroll-text">
           {{ langStore.currentLang === 'sr' ? 'Добродошли на планину Гоч! Смештајни капацитети су доступни за резервацију.' : 'Welcome to Mt. Goč! Accommodation is available for booking.' }}
           &nbsp;&bull;&nbsp;
           {{ langStore.currentLang === 'sr' ? 'Добродошли на планину Гоч! Смештајни капацитети су доступни за резервацију.' : 'Welcome to Mt. Goč! Accommodation is available for booking.' }}
         </div>
       </div>
     </div>
  </div>
</template>

<style scoped>
.ticker-block {
  background: #332317; color: white; padding: 10px 0; border-radius: 6px; overflow: hidden;
}
.ticker-content { display: flex; align-items: center; gap: 15px; }
.ticker-scroll-wrapper { flex-grow: 1; overflow: hidden; position: relative; }
.ticker-scroll-text {
  display: inline-block; white-space: nowrap; padding-left: 100%;
  animation: ticker-scroll 25s linear infinite;
}
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}
.ticker-label {
  background: #cdac91; color: #332317; padding: 2px 10px; font-weight: bold; font-size: 0.8rem; margin-left: 10px;
}
</style>
