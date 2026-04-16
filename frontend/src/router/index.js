import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SmestajView from '../views/SmestajView.vue'
import SmestajSingleView from '../views/SmestajSingleView.vue'
import SingleNewsView from '../views/SingleNewsView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminNewsView from '../views/AdminNewsView.vue'
import AdminReservationsView from '../views/AdminReservationsView.vue'
import NotFoundView from '../views/NotFoundView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/smestaj',
      name: 'smestaj',
      component: SmestajView
    },
    {
      path: '/smestaj/:id',
      name: 'smestaj-single',
      component: SmestajSingleView
    },
    {
      path: '/vesti/:id',
      name: 'single-news',
      component: SingleNewsView
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: AdminLoginView
    },
    {
      path: '/admin/vesti',
      name: 'admin-news',
      component: AdminNewsView,
      meta: { requiresAuth: true }
    },
    {
      path: '/admin/rezervacije',
      name: 'admin-reservations',
      component: AdminReservationsView,
      meta: { requiresAuth: true }
    },
    {
      // Catch-all: sve nepostojece rute -> NotFoundView
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token');
  if (to.meta.requiresAuth && !token) {
    next({ name: 'admin-login' });
  } else if (to.name === 'admin-login' && token) {
    next({ name: 'admin-news' });
  } else {
    next();
  }
})

export default router
