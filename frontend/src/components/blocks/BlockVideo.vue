<script setup>
const props = defineProps({
  videoUrl: String,
  title: String
})

const getEmbedUrl = (url) => {
  if (!url) return ''
  // Convert standard YT link to embed link
  let id = ''
  if (url.includes('v=')) id = url.split('v=')[1].split('&')[0]
  else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0]
  else id = url
  return `https://www.youtube.com/embed/${id}`
}
</script>

<template>
  <div class="video-block-container">
    <div class="video-inner">
      <h2 v-if="title" class="video-title">{{ title }}</h2>
      <div class="video-ratio-wrap">
         <iframe 
           :src="getEmbedUrl(videoUrl)" 
           frameborder="0" 
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
           allowfullscreen>
         </iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-block-container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.video-title { border-left: 4px solid #332317; padding-left: 12px; margin-bottom: 25px; color: #332317; }
.video-ratio-wrap {
  position: relative; padding-bottom: 56.25%; /* 16:9 ratio */
  height: 0; overflow: hidden; background: #000; box-shadow: 0 15px 35px rgba(0,0,0,0.2);
}
.video-ratio-wrap iframe {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;
}
</style>
