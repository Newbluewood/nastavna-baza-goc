<script setup>
defineProps({
  images: Array
})
const emit = defineEmits(['open'])
</script>

<template>
  <div class="gallery-block">
    <div class="gallery-grid">
      <div v-for="(img, idx) in images" :key="idx" class="gallery-item" @click="$emit('open', idx)">
        <img :src="img" alt="Gallery" loading="lazy" />
        <div class="gallery-overlay"><span>🔍</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}
.gallery-item {
  position: relative; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden; cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
}
.gallery-item img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.gallery-item:hover img { transform: scale(1.1); }
.gallery-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(51, 35, 23, 0.4); display: flex; justify-content: center; align-items: center;
  opacity: 0; transition: opacity 0.3s;
}
.gallery-overlay span { font-size: 2rem; }
.gallery-item:hover .gallery-overlay { opacity: 1; }
</style>
