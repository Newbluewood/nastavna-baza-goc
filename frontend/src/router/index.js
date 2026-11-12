import { createRouter, createWebHistory } from 'vue-router'
import { isReservedPageSlug } from '../utils/pageRoutes'
import {
  ROUTE_PERMISSIONS,
  canAccess,
  defaultAdminRouteName,
  getStoredAdminRole,
} from '../auth/permissions'

/**
 * Vue Router 4 style (Vue School):
 * - named routes
 * - lazy-loaded page components
 * - dynamic :slug + props: true (or props fn)
 * - linkActiveClass / linkExactActiveClass
 */

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  linkActiveClass: 'router-link-active',
  linkExactActiveClass: 'router-link-exact-active',
  routes: [
    // --- Public ---
    {
      path: '/',
      name: 'home',
      component: () => import('../views/public/HomeView.vue'),
    },
    {
      path: '/smestaj',
      name: 'smestaj',
      component: () => import('../views/public/SmestajView.vue'),
    },
    {
      path: '/smestaj/:slug',
      name: 'smestaj-single',
      component: () => import('../views/public/SmestajSingleView.vue'),
      props: true,
    },
    {
      path: '/restoran',
      name: 'restoran',
      component: () => import('../views/public/RestoranView.vue'),
    },
    {
      path: '/vesti',
      name: 'vesti',
      component: () => import('../views/public/VestiView.vue'),
    },
    {
      path: '/vesti/:slug',
      name: 'single-news',
      component: () => import('../views/public/SingleNewsView.vue'),
      props: true,
    },
    {
      path: '/kontakt',
      name: 'kontakt',
      component: () => import('../views/public/ContactView.vue'),
    },
    {
      path: '/edukacija',
      name: 'edukacija',
      component: () => import('../views/public/PageView.vue'),
      props: () => ({ slug: 'edukacija' }),
    },
    {
      path: '/istrazivanje',
      name: 'istrazivanje',
      component: () => import('../views/public/PageView.vue'),
      props: () => ({ slug: 'istrazivanje' }),
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('../views/public/PageView.vue'),
      props: () => ({ slug: 'faq' }),
    },
    {
      path: '/istrazi',
      name: 'istrazi',
      component: () => import('../views/public/IstraziView.vue'),
    },
    {
      path: '/istrazi/:slug',
      name: 'tema-detail',
      component: () => import('../views/public/TemaDetailView.vue'),
      props: true,
    },
    {
      path: '/cancel/:token',
      name: 'cancel',
      component: () => import('../views/public/CancelView.vue'),
      props: true,
    },

    // --- Guest ---
    {
      path: '/prijava',
      name: 'prijava',
      component: () => import('../views/guest/LoginView.vue'),
    },
    {
      path: '/moj-nalog',
      name: 'moj-nalog',
      component: () => import('../views/guest/DashboardView.vue'),
      meta: { requiresGuestAuth: true },
    },
    {
      path: '/reset-lozinka/:token',
      name: 'reset-lozinka',
      component: () => import('../views/guest/ResetPasswordView.vue'),
      props: true,
    },

    // --- Admin ---
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/admin/LoginView.vue'),
    },
    {
      path: '/admin/vesti',
      name: 'admin-news',
      component: () => import('../views/admin/NewsView.vue'),
      meta: { requiresAuth: true, permission: 'news' },
    },
    {
      path: '/admin/stranice',
      name: 'admin-pages',
      component: () => import('../views/admin/PagesView.vue'),
      meta: { requiresAuth: true, permission: 'pages' },
    },
    {
      path: '/admin/meni',
      name: 'admin-nav',
      component: () => import('../views/admin/NavView.vue'),
      meta: { requiresAuth: true, permission: 'pages' },
    },
    {
      path: '/admin/projekti',
      name: 'admin-projects',
      component: () => import('../views/admin/ProjectsView.vue'),
      meta: { requiresAuth: true, permission: 'projects' },
    },
    {
      path: '/admin/osoblje',
      name: 'admin-staff',
      component: () => import('../views/admin/StaffView.vue'),
      meta: { requiresAuth: true, permission: 'staff' },
    },
    {
      path: '/admin/rezervacije',
      name: 'admin-reservations',
      component: () => import('../views/admin/ReservationsView.vue'),
      meta: { requiresAuth: true, permission: 'inquiries' },
    },
    {
      path: '/admin/gosti',
      name: 'admin-guests',
      component: () => import('../views/admin/GuestsView.vue'),
      meta: { requiresAuth: true, permission: 'guests' },
    },
    {
      path: '/admin/mapa-soba',
      name: 'admin-room-map',
      component: () => import('../views/admin/RoomMapView.vue'),
      meta: { requiresAuth: true, permission: 'room_map' },
    },
    {
      path: '/admin/sobe',
      name: 'admin-rooms',
      component: () => import('../views/admin/RoomsView.vue'),
      meta: { requiresAuth: true, permission: 'rooms' },
    },
    {
      path: '/admin/statistike',
      name: 'admin-stats',
      component: () => import('../views/admin/SiteStatsView.vue'),
      meta: { requiresAuth: true, permission: 'stats' },
    },
    {
      path: '/admin/ai',
      name: 'admin-ai',
      component: () => import('../views/admin/AiUsageView.vue'),
      meta: { requiresAuth: true, permission: 'ai_usage' },
    },
    {
      path: '/admin/restoran',
      name: 'admin-restaurant',
      component: () => import('../views/admin/RestaurantView.vue'),
      meta: { requiresAuth: true, permission: 'restaurant' },
    },
    {
      path: '/admin/podesavanja',
      name: 'admin-settings',
      component: () => import('../views/admin/SettingsView.vue'),
      meta: { requiresAuth: true, permission: 'settings' },
    },
    {
      path: '/admin/teme',
      name: 'admin-themes',
      component: () => import('../views/admin/ThemesView.vue'),
      meta: { requiresAuth: true, permission: 'themes' },
    },
    {
      path: '/admin/korisnici',
      name: 'admin-cms-users',
      component: () => import('../views/admin/CmsUsersView.vue'),
      meta: { requiresAuth: true, permission: 'cms_users' },
    },

    // Legacy CMS prefix → short /{slug}
    {
      path: '/stranica/:slug',
      redirect: (to) => ({ name: 'page', params: { slug: to.params.slug } }),
    },
    {
      path: '/:slug',
      name: 'page',
      component: () => import('../views/public/PageView.vue'),
      props: true,
      beforeEnter: (to) => {
        const slug = String(to.params.slug || '')
        if (isReservedPageSlug(slug)) {
          return { name: 'not-found', params: { pathMatch: [slug] }, replace: true }
        }
        return true
      },
    },

    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/public/NotFoundView.vue'),
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

router.beforeEach((to) => {
  const adminToken = localStorage.getItem('admin_token')
  const guestToken = localStorage.getItem('guest_token')

  if (to.meta.requiresAuth && !adminToken) return { name: 'admin-login' }
  if (to.name === 'admin-login' && adminToken) {
    return { name: defaultAdminRouteName(getStoredAdminRole()) }
  }
  if (to.meta.requiresAuth) {
    const role = getStoredAdminRole()
    const permission = to.meta.permission || ROUTE_PERMISSIONS[to.name]
    if (permission && !canAccess(role, permission)) {
      return { name: defaultAdminRouteName(role) }
    }
  }
  if (to.meta.requiresGuestAuth && !guestToken) return { name: 'prijava' }
  return true
})

export default router
