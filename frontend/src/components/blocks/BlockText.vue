<script setup>
defineProps({
  content: String
})
</script>

<template>
  <div class="text-block-container">
    <div class="text-content" v-html="content"></div>
  </div>
</template>

<style scoped>
.text-block-container {
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: 20px;
}
.text-content {
  line-height: 1.8;
  color: #332317;
  font-size: 1.05rem;
}
.text-content :deep(p) { margin-bottom: 20px; }
.text-content :deep(h2) { margin-top: 40px; margin-bottom: 20px; color: #332317; border-left: 4px solid #cdac91; padding-left: 12px; }
</style>
