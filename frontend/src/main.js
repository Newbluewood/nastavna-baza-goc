import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { initPosthog, capturePageview } from './analytics/posthog'

initPosthog()

const app = createApp(App)

app.use(createPinia())
app.use(router)

router.afterEach((to) => {
  capturePageview(to)
})

app.mount('#app')
