<script setup>
import { computed } from 'vue'

const props = defineProps({
  html: String
})

const mapHtml = computed(() => {
  // Ako nemamo HTML iz baze, prikazujemo default mapu Nastavne baze Goč (Vila Horizont područje)
  return props.html || '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d11585.397637825313!2d20.806667!3d43.557500!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47565780ebbe518d%3A0xe2f1f46adbf58ae0!2sGo%C4%8D!5e0!3m2!1sen!2srs!4v1700000000000!5m2!1sen!2srs" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>'
})
</script>

<template>
  <div class="map-block-container">
    <div class="map-inner">
      <h2 class="map-title">📍 {{ $lang === 'sr' ? 'Локација' : 'Location' }}</h2>
      <div class="map-frame-wrapper" v-html="mapHtml"></div>
    </div>
  </div>
</template>

<style scoped>
.map-block-container {
  width: 100%;
  padding-bottom: 60px;
}
.map-inner {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 0 20px;
}
.map-title {
  margin-bottom: 25px;
  border-left: 4px solid #332317;
  padding-left: 12px;
  font-size: 1.6rem;
  color: #332317;
}
.map-frame-wrapper {
  width: 100%;
  height: 450px;
  background: #f1f1f1;
  box-shadow: 0 10px 30px rgba(0,0,0,0.1);
  overflow: hidden;
}
.map-frame-wrapper :deep(iframe) {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
