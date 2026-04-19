import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useGuestStore } from './stores/guest'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Restore guest profile from token on page refresh
const guestStore = useGuestStore()
if (guestStore.isLoggedIn) guestStore.fetchMe()

app.mount('#app')
