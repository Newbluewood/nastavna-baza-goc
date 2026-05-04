<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  slides: Array
})

const currentSlide = ref(0)
let slideTimer = null
const SLIDE_DELAY_MS = 6000

const nextSlide = () => {
  if (props.slides && props.slides.length > 0) {
    currentSlide.value = (currentSlide.value + 1) % props.slides.length
  }
}
const stopAutoSlide = () => {
  if (slideTimer) { clearTimeout(slideTimer); slideTimer = null; }
}
const scheduleNextSlide = () => {
  stopAutoSlide()
  if (!props.slides || props.slides.length <= 1) return
  slideTimer = setTimeout(() => {
    nextSlide(); scheduleNextSlide()
  }, SLIDE_DELAY_MS)
}

watch(() => props.slides, () => {
  currentSlide.value = 0
  scheduleNextSlide()
}, { immediate: true })

onMounted(scheduleNextSlide)
onUnmounted(stopAutoSlide)
</script>

<template>
  <div v-if="slides && slides.length > 0" class="hero-airy">
    <div v-for="(slide, index) in slides" :key="index" 
         class="hero-view"
         :style="{ 
           opacity: index === currentSlide ? 1 : 0, 
           transform: index === currentSlide ? 'scale(1)' : 'scale(1.05)',
           zIndex: index === currentSlide ? 2 : 1 
         }">
      <img :src="slide.image_url" class="hero-photo" />
      <div class="hero-light-overlay"></div>
      
      <!-- SUBTLE TEXT OVERLAY (Minimalist) -->
      <div class="hero-caption" :class="{ 'caption-in': index === currentSlide }">
         <div class="caption-inner">
           <h1 class="fof-main-title">{{ slide.title }}</h1>
           <p v-if="slide.subtitle" class="fof-sub">{{ slide.subtitle }}</p>
         </div>
      </div>
    </div>
    
    <div class="hero-dots-minimal" v-if="slides.length > 1">
      <span v-for="(s, i) in slides" :key="i" 
            class="dot-min" :class="{ active: i === currentSlide }"
            @click="currentSlide = i"></span>
    </div>
  </div>
</template>

<style scoped>
.hero-airy {
  position: relative; width: 100%; height: 600px; overflow: hidden; background: #000;
  margin-bottom: 0;
}
.hero-view {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  transition: opacity 1.5s ease, transform 10s linear;
}
.hero-photo { width: 100%; height: 100%; object-fit: cover; }

.hero-light-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%);
}

.hero-caption {
  position: absolute; bottom: 0; left: 0; width: 100%;
  padding: 40px 0 60px;
  background: rgba(255, 255, 255, 0.05); /* Extremely subtle white tint */
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  mask-image: linear-gradient(to top, black 50%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 50%, transparent 100%);
  
  opacity: 0; transform: translateY(10px);
  transition: all 1s ease-out 0.5s;
}
.hero-caption.caption-in {
  opacity: 1; transform: translateY(0);
}

.caption-inner {
  max-width: var(--content-max-width); margin: 0 auto; width: 100%; padding: 0 60px;
}

.fof-main-title {
  margin: 0; font-family: "FOF24", sans-serif; font-size: 3rem; color: #fff; font-weight: 700;
  text-shadow: 0 4px 15px rgba(0,0,0,0.5); /* Boost readability on transparent background */
  line-height: 1.1;
}
.fof-sub {
  margin: 10px 0 0 0; font-family: "FOF24", sans-serif; font-size: 1.3rem; color: #fff;
  font-weight: 300; opacity: 0.9; text-shadow: 0 2px 8px rgba(0,0,0,0.4);
}

.hero-dots-minimal {
  position: absolute; bottom: 30px; right: 60px; display: flex; gap: 10px; z-index: 10;
}
.dot-min {
  width: 10px; height: 10px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.5);
  background: transparent; cursor: pointer; transition: all 0.3s;
}
.dot-min.active { background: #fff; transform: scale(1.2); border-color: #fff; }

@media (max-width: 1023px) {
  .hero-airy { height: 450px; }
  .caption-inner { padding: 0 25px; text-align: center; }
  .fof-main-title { font-size: 1.8rem; }
  .fof-sub { font-size: 1.1rem; }
  .hero-caption { padding: 30px 0 40px; }
}
</style>
