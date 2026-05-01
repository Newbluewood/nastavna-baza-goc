import { createRouter, createWebHistory } from 'vue-router'

// Public site
import HomeView from '../views/public/HomeView.vue'
import SmestajView from '../views/public/SmestajView.vue'
import SmestajSingleView from '../views/public/SmestajSingleView.vue'
import VestiView from '../views/public/VestiView.vue'
import SingleNewsView from '../views/public/SingleNewsView.vue'
import ContactView from '../views/public/ContactView.vue'
import PageView from '../views/public/PageView.vue'
import CancelView from '../views/public/CancelView.vue'
import NotFoundView from '../views/public/NotFoundView.vue'
import IstraziView from '../views/public/IstraziView.vue'
import TemaDetailView from '../views/public/TemaDetailView.vue'

// Guest (user)
import GuestLoginView from '../views/guest/LoginView.vue'
import GuestDashboardView from '../views/guest/DashboardView.vue'
import ResetPasswordView from '../views/guest/ResetPasswordView.vue'

// Admin
import AdminLoginView from '../views/admin/LoginView.vue'
import AdminNewsView from '../views/admin/NewsView.vue'
import AdminPagesView from '../views/admin/PagesView.vue'
import AdminProjectsView from '../views/admin/ProjectsView.vue'
import AdminStaffView from '../views/admin/StaffView.vue'
import AdminReservationsView from '../views/admin/ReservationsView.vue'
import AdminGuestsView from '../views/admin/GuestsView.vue'
import AdminRoomMapView from '../views/admin/RoomMapView.vue'
import AdminRoomsView from '../views/admin/RoomsView.vue'
import AdminAiUsageView from '../views/admin/AiUsageView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // --- Public ---
    { path: '/', name: 'home', component: HomeView },
    { path: '/smestaj', name: 'smestaj', component: SmestajView },
    { path: '/smestaj/:id', name: 'smestaj-single', component: SmestajSingleView },
    { path: '/vesti', name: 'vesti', component: VestiView },
    { path: '/vesti/:id', name: 'single-news', component: SingleNewsView },
    { path: '/kontakt', name: 'kontakt', component: ContactView },
    { path: '/stranica/:slug', name: 'page', component: PageView },
    { path: '/istrazi', name: 'istrazi', component: IstraziView },
    { path: '/istrazi/:id', name: 'tema-detail', component: TemaDetailView },
    { path: '/cancel/:token', name: 'cancel', component: CancelView },

    // --- Guest ---
    { path: '/prijava', name: 'prijava', component: GuestLoginView },
    { path: '/moj-nalog', name: 'moj-nalog', component: GuestDashboardView, meta: { requiresGuestAuth: true } },
    { path: '/reset-lozinka/:token', name: 'reset-lozinka', component: ResetPasswordView },

    // --- Admin ---
    { path: '/admin/login', name: 'admin-login', component: AdminLoginView },
    { path: '/admin/vesti', name: 'admin-news', component: AdminNewsView, meta: { requiresAuth: true } },
    { path: '/admin/stranice', name: 'admin-pages', component: AdminPagesView, meta: { requiresAuth: true } },
    { path: '/admin/projekti', name: 'admin-projects', component: AdminProjectsView, meta: { requiresAuth: true } },
    { path: '/admin/osoblje', name: 'admin-staff', component: AdminStaffView, meta: { requiresAuth: true } },
    { path: '/admin/rezervacije', name: 'admin-reservations', component: AdminReservationsView, meta: { requiresAuth: true } },
    { path: '/admin/gosti', name: 'admin-guests', component: AdminGuestsView, meta: { requiresAuth: true } },
    { path: '/admin/mapa-soba', name: 'admin-room-map', component: AdminRoomMapView, meta: { requiresAuth: true } },
    { path: '/admin/sobe', name: 'admin-rooms', component: AdminRoomsView, meta: { requiresAuth: true } },
    { path: '/admin/ai', name: 'admin-ai', component: AdminAiUsageView, meta: { requiresAuth: true } },

    // --- Fallback ---
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView }
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

router.beforeEach((to) => {
  const adminToken = localStorage.getItem('admin_token')
  const guestToken = localStorage.getItem('guest_token')

  if (to.meta.requiresAuth && !adminToken) return { name: 'admin-login' }
  if (to.name === 'admin-login' && adminToken) return { name: 'admin-news' }
  if (to.meta.requiresGuestAuth && !guestToken) return { name: 'prijava' }
  return true
})

export default router
