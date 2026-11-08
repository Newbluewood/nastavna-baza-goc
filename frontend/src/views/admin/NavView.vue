<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => {
  router.replace('/admin/stranice')
})
</script>

<template>
  <div />
</template>
