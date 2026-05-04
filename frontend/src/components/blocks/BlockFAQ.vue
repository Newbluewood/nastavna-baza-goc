<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  content: String // Legacy content for parsing
})

const faqItems = ref([])

onMounted(() => {
  if (props.content) {
    const parts = props.content.split('### ').filter(p => p.trim())
    faqItems.value = parts.map(p => {
      const lines = p.split('\n')
      return {
        question: lines[0].trim(),
        answer: lines.slice(1).join('\n').trim(),
        isOpen: false
      }
    })
  }
})

const toggleFaq = (index) => {
  faqItems.value[index].isOpen = !faqItems.value[index].isOpen
}
</script>

<template>
  <div class="faq-block">
    <div v-for="(item, index) in faqItems" :key="index" class="faq-item" :class="{ 'faq-open': item.isOpen }">
      <div class="faq-question" @click="toggleFaq(index)">
        <span>{{ item.question }}</span>
        <span class="faq-icon">{{ item.isOpen ? '−' : '+' }}</span>
      </div>
      <transition name="faq-slide">
        <div v-if="item.isOpen" class="faq-answer">
          <p>{{ item.answer }}</p>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.faq-item {
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  background: #fdfcfb;
  transition: all 0.3s ease;
}
.faq-open {
  background: #fff;
  box-shadow: 0 4px 15px rgba(51, 35, 23, 0.05);
  border-left: 4px solid #332317;
}
.faq-question {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: bold;
  color: #332317;
}
.faq-answer {
  padding: 0 20px 20px;
  color: #666;
  line-height: 1.6;
}
/* Transitions */
.faq-slide-enter-active, .faq-slide-leave-active {
  transition: max-height 0.3s ease, opacity 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}
.faq-slide-enter-from, .faq-slide-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
