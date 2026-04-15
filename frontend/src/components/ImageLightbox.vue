<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  isOpen: Boolean,
  images: Array,
  initialIndex: { type: Number, default: 0 }
})

const emit = defineEmits(['update:isOpen'])
const currentIndex = ref(props.initialIndex)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    currentIndex.value = props.initialIndex;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
})

const close = () => {
  emit('update:isOpen', false)
}

const next = () => {
  if (currentIndex.value < props.images.length - 1) {
    currentIndex.value++
  }
}

const prev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const handleKeydown = (e) => {
  if (!props.isOpen) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="isOpen" class="lightbox-overlay" @click.self="close">
    <button class="close-btn" @click="close">&times;</button>
    
    <div class="lightbox-content">
      <button class="nav-btn prev" @click="prev" v-if="currentIndex > 0">&#10094;</button>
      
      <div class="image-wrapper" @click.stop>
        <img :src="images[currentIndex]" :key="images[currentIndex]" />
      </div>
      
      <button class="nav-btn next" @click="next" v-if="currentIndex < images.length - 1">&#10095;</button>
    </div>
    
    <div class="lightbox-counter">{{ currentIndex + 1 }} / {{ images.length }}</div>
  </div>
</template>

<style scoped>
.lightbox-overlay {
  position: fixed;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}
.close-btn {
  position: absolute;
  top: 20px; right: 30px;
  background: none; border: none; color: white;
  font-size: 40px; cursor: pointer; z-index: 10000;
}
.lightbox-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 90%;
  max-width: 1200px;
  height: 80%;
  position: relative;
}
.image-wrapper img {
  max-height: 80vh;
  max-width: 100%;
  object-fit: contain;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  animation: fadeIn 0.3s ease;
}
.nav-btn {
  background: rgba(255,255,255,0.1);
  border: none; color: white;
  font-size: 30px; padding: 15px; cursor: pointer;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  border-radius: 0;
  transition: background 0.3s;
}
.nav-btn:hover { background: rgba(255,255,255,0.3); }
.prev { left: 5px; }
.next { right: 5px; }
.lightbox-counter {
  position: absolute;
  bottom: 20px;
  color: white;
  font-family: inherit;
  font-size: 1.2rem;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 768px) {
  .nav-btn { padding: 10px; font-size: 20px; }
  .close-btn { top: 10px; right: 15px; }
}
</style>
