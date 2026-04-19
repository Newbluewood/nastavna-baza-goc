import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import SmestajView from '../views/SmestajView.vue'
import SmestajSingleView from '../views/SmestajSingleView.vue'
import VestiView from '../views/VestiView.vue'
import SingleNewsView from '../views/SingleNewsView.vue'
import AdminLoginView from '../views/AdminLoginView.vue'
import AdminNewsView from '../views/AdminNewsView.vue'
import AdminReservationsView from '../views/AdminReservationsView.vue'
import NotFoundView from '../views/NotFoundView.vue'
import CancelView from '../views/CancelView.vue'
import GuestLoginView from '../views/GuestLoginView.vue'
import GuestDashboardView from '../views/GuestDashboardView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import AdminGuestsView from '../views/AdminGuestsView.vue'
import AdminRoomMapView from '../views/AdminRoomMapView.vue'
import ContactView from '../views/ContactView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/smestaj', name: 'smestaj', component: SmestajView },
    { path: '/smestaj/:id', name: 'smestaj-single', component: SmestajSingleView },
    { path: '/vesti', name: 'vesti', component: VestiView },
    { path: '/vesti/:id', name: 'single-news', component: SingleNewsView },
    { path: '/kontakt', name: 'kontakt', component: ContactView },
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    { path: '/admin/vesti', name: 'admin-news', component: AdminNewsView, meta: { requiresAuth: true } },
    { path: '/admin/rezervacije', name: 'admin-reservations', component: AdminReservationsView, meta: { requiresAuth: true } },
    { path: '/admin/gosti', name: 'admin-guests', component: AdminGuestsView, meta: { requiresAuth: true } },
    { path: '/admin/mapa-soba', name: 'admin-room-map', component: AdminRoomMapView, meta: { requiresAuth: true } },
    { path: '/cancel/:token', name: 'cancel', component: CancelView },
    { path: '/prijava', name: 'prijava', component: GuestLoginView },
    { path: '/moj-nalog', name: 'moj-nalog', component: GuestDashboardView, meta: { requiresGuestAuth: true } },
    { path: '/reset-lozinka/:token', name: 'reset-lozinka', component: ResetPasswordView },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
  ]
})

router.beforeEach((to, from, next) => {
  const adminToken = localStorage.getItem('admin_token');
  const guestToken = localStorage.getItem('guest_token');

  if (to.meta.requiresAuth && !adminToken) {
    next({ name: 'admin-login' });
  } else if (to.name === 'admin-login' && adminToken) {
    next({ name: 'admin-news' });
  } else if (to.meta.requiresGuestAuth && !guestToken) {
    next({ name: 'prijava' });
  } else {
    next();
  }
})

export default router
