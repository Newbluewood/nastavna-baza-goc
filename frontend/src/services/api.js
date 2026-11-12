import { assertApiPayload } from '../utils/apiPayload'

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class ApiService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  async request(endpoint, options = {}) {
    const { authMode = 'any', ...requestOptions } = options;
    const url = `${this.baseURL}${endpoint}`;
    const headers = { ...requestOptions.headers };
    if (headers['Content-Type'] === null) {
      delete headers['Content-Type'];
    } else if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const config = {
      ...requestOptions,
      headers
    };

    // Add auth token based on endpoint auth mode
    const token = authMode === 'guest'
      ? this.getGuestToken()
      : (authMode === 'none' ? null : this.getAuthToken());

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      const error = new Error(errorData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      if (response.status === 401) {
        // Stale/expired token — clear it so the router guard doesn't bounce
        // the redirect-to-login straight back to an admin page in a loop.
        if (authMode === 'guest') {
          localStorage.removeItem('guest_token');
        } else {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_role');
        }
      }
      throw error;
    }

    const data = await response.json();
    return assertApiPayload(data);
  }

  getAuthToken() {
    // Check both admin and guest tokens
    return this.normalizeToken(localStorage.getItem('admin_token'))
      || this.normalizeToken(localStorage.getItem('guest_token'));
  }

  getGuestToken() {
    return this.normalizeToken(localStorage.getItem('guest_token'));
  }

  normalizeToken(token) {
    const value = String(token || '').trim();
    if (!value || value === 'undefined' || value === 'null') {
      return null;
    }
    return value;
  }

  // Public endpoints
  async getHome(lang = 'sr') {
    return this.request(`/api/home?lang=${lang}`);
  }

  async getFacilities(lang = 'sr') {
    return this.request(`/api/smestaj?lang=${lang}`);
  }

  async getFacility(idOrSlug, lang = 'sr') {
    return this.request(`/api/smestaj/${encodeURIComponent(idOrSlug)}?lang=${lang}`);
  }

  async checkAvailability(roomId, startDate, endDate) {
    if (startDate && endDate) {
      return this.request(`/api/rooms/${roomId}/availability?start=${startDate}&end=${endDate}`);
    }
    return this.request(`/api/rooms/${roomId}/availability`);
  }

  async submitInquiry(data) {
    return this.request('/api/inquiries', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify(data)
    });
  }

  async getNews(lang = 'sr') {
    return this.request(`/api/news?lang=${lang}`);
  }

  async getNewsItem(slugOrId, lang = 'sr') {
    return this.request(`/api/news/${encodeURIComponent(slugOrId)}?lang=${lang}`);
  }

  async getContactPage(lang = 'sr') {
    return this.request(`/api/kontakt?lang=${lang}`);
  }

  async getPageBySlug(slug, lang = 'sr') {
    return this.request(`/api/stranica/${slug}?lang=${lang}`);
  }

  async getNav(lang = 'sr') {
    return this.request(`/api/nav?lang=${lang}`);
  }

  async getHealth() {
    return this.request('/api/health', { authMode: 'none' });
  }

  async getAdminNav() {
    return this.request('/api/admin/nav');
  }

  async updateNavItem(id, data) {
    return this.request(`/api/admin/nav/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createNavItem(data) {
    return this.request('/api/admin/nav', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteNavItem(id) {
    return this.request(`/api/admin/nav/${id}`, { method: 'DELETE' });
  }

  async reorderNav(ids) {
    return this.request('/api/admin/nav/reorder', {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    });
  }

  async getThemes(lang = 'sr') {
    return this.request(`/api/themes?lang=${lang}`);
  }

  async getThemeDetail(slugOrId, lang = 'sr') {
    return this.request(`/api/themes/${encodeURIComponent(slugOrId)}?lang=${lang}`);
  }

  async getRestaurantsPublic(lang = 'sr') {
    return this.request(`/api/restorani?lang=${lang}`);
  }

  async getRestaurantMenu(id, lang = 'sr') {
    return this.request(`/api/restorani/${id}/meni?lang=${lang}`);
  }

  async getAIStatus() {
    return this.request('/api/ai/ping');
  }

  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/api/admin/upload', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': null }
    });
  }

  async aiProofread(text, lang = 'sr') {
    return this.request('/api/ai/proofread', {
      method: 'POST',
      body: JSON.stringify({ text, lang })
    });
  }

  async aiRewrite(text, lang = 'sr', tone = 'professional') {
    return this.request('/api/ai/rewrite', {
      method: 'POST',
      body: JSON.stringify({ text, lang, tone })
    });
  }

  async chatReserveStay(payload) {
    return this.request('/api/chat/reserve-stay', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify(payload || {})
    });
  }

  async likeNews(slugOrId) {
    return this.request(`/api/news/${encodeURIComponent(slugOrId)}/like`, {
      method: 'POST'
    });
  }

  async getChatHistory(session_id = null, limit = 100) {
    const params = [];
    if (session_id) params.push(`session_id=${encodeURIComponent(session_id)}`);
    if (limit) params.push(`limit=${limit}`);
    const query = params.length ? `?${params.join('&')}` : '';
    return this.request(`/api/chat/history${query}`, {
      method: 'GET',
      authMode: 'guest'
    });
  }

  async saveChatMessage({ role, message, session_id = null, meta = null }) {
    return this.request('/api/chat/history', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify({ role, message, session_id, meta })
    });
  }

  // Admin endpoints
  async adminLogin(credentials) {
    const response = await this.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    localStorage.setItem('admin_token', response.token);
    localStorage.setItem('admin_role', response.admin?.role || 'admin');
    return response;
  }

  async getCmsUsers() {
    return this.request('/api/admin/cms-users');
  }

  async createCmsUser(data) {
    return this.request('/api/admin/cms-users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCmsUser(id, data) {
    return this.request(`/api/admin/cms-users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCmsUser(id) {
    return this.request(`/api/admin/cms-users/${id}`, {
      method: 'DELETE',
    });
  }

  async getInquiries() {
    return this.request('/api/admin/inquiries');
  }

  async createAdminReservation(payload) {
    return this.request('/api/admin/reservations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getInquiryActivity(id) {
    return this.request(`/api/admin/inquiries/${id}/activity`);
  }

  async updateInquiryStatus(id, status) {
    return this.request(`/api/admin/inquiries/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  }

  async createNews(data) {
    return this.request('/api/admin/news', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateNews(id, data) {
    return this.request(`/api/admin/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteNews(id) {
    return this.request(`/api/admin/news/${id}`, { method: 'DELETE' });
  }

  async translateNews(id, lang) {
    return this.request('/api/admin/translate', {
      method: 'POST',
      body: JSON.stringify({ id, lang })
    });
  }

  async aiAssist(path, payload) {
    return this.request(`/api/ai/${path}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Admin — Staff
  async getAdminStaff() {
    return this.request('/api/admin/staff');
  }

  async createStaff(data) {
    return this.request('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateStaff(id, data) {
    return this.request(`/api/admin/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteStaff(id) {
    return this.request(`/api/admin/staff/${id}`, { method: 'DELETE' });
  }

  // Admin — Projects
  async getAdminProjects() {
    return this.request('/api/admin/projects');
  }

  async createProject(data) {
    return this.request('/api/admin/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateProject(id, data) {
    return this.request(`/api/admin/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteProject(id) {
    return this.request(`/api/admin/projects/${id}`, { method: 'DELETE' });
  }

  // Admin — Pages
  async getAdminPages() {
    return this.request('/api/admin/pages');
  }

  async updatePage(id, data) {
    return this.request(`/api/admin/pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deletePage(id) {
    return this.request(`/api/admin/pages/${id}`, { method: 'DELETE' });
  }

  // Admin — Themes (Istraži Goč)
  async getAdminThemes() {
    return this.request('/api/admin/themes');
  }

  async getAdminThemeById(id) {
    return this.request(`/api/admin/themes/${id}`);
  }

  async createTheme(data) {
    return this.request('/api/admin/themes', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateTheme(id, data) {
    return this.request(`/api/admin/themes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteTheme(id) {
    return this.request(`/api/admin/themes/${id}`, { method: 'DELETE' });
  }

  // Public — Site Settings
  async getSiteSettings(lang = 'sr') {
    return this.request(`/api/settings?lang=${lang}`);
  }

  // Admin — Site Settings
  async getAdminSettings() {
    return this.request('/api/admin/settings');
  }

  async updateSettings(settings) {
    return this.request('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings })
    });
  }

  // Admin — Hero Slides
  async getAdminHeroSlides(pageSlug) {
    return this.request(`/api/admin/hero-slides?page_slug=${pageSlug}`);
  }

  async createHeroSlide(data) {
    return this.request('/api/admin/hero-slides', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateHeroSlide(id, data) {
    return this.request(`/api/admin/hero-slides/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteHeroSlide(id) {
    return this.request(`/api/admin/hero-slides/${id}`, { method: 'DELETE' });
  }

  // Admin — Room Map
  async getRoomMap(date) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/api/admin/room-map${query}`);
  }

  // Admin — AI Usage
  async getAdminAiUsage() {
    return this.request('/api/admin/ai/usage');
  }

  // Admin — Chat analytics (site guide top / miss)
  async getAdminChatAnalyticsTop({ days = 30, limit = 15 } = {}) {
    const params = new URLSearchParams({
      days: String(days),
      limit: String(limit)
    });
    return this.request(`/api/admin/chat-analytics/top?${params}`);
  }

  async getAdminChatAnalyticsMiss({ days = 30, limit = 15 } = {}) {
    const params = new URLSearchParams({
      days: String(days),
      limit: String(limit)
    });
    return this.request(`/api/admin/chat-analytics/miss?${params}`);
  }

  async getAdminSiteStats({ days = 30 } = {}) {
    const params = new URLSearchParams({ days: String(days) });
    return this.request(`/api/admin/site-stats?${params}`);
  }

  // Admin — Cache
  async purgeCache() {
    return this.request('/api/admin/system/purge-cache', { method: 'POST' });
  }

  async refreshAgentKnowledge() {
    return this.request('/api/admin/ai/refresh-knowledge', { method: 'POST' });
  }

  async getGuests() {
    return this.request('/api/admin/guests');
  }

  // Admin — Facilities & Rooms
  async getAdminFacilities() {
    return this.request('/api/admin/facilities');
  }

  async updateFacility(facilityId, data) {
    return this.request(`/api/admin/facilities/${facilityId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getAdminRooms(facilityId) {
    return this.request(`/api/admin/facilities/${facilityId}/rooms`);
  }

  async updateRoom(roomId, data) {
    return this.request(`/api/admin/rooms/${roomId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getAdminRestaurants() {
    return this.request('/api/admin/restaurants');
  }

  async updateRestaurant(id, data) {
    return this.request(`/api/admin/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async getAdminMenuItems(restaurantId) {
    return this.request(`/api/admin/restaurants/${restaurantId}/menu`);
  }

  async createMenuItem(data) {
    return this.request('/api/admin/menu-items', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateMenuItem(id, data) {
    return this.request(`/api/admin/menu-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteMenuItem(id) {
    return this.request(`/api/admin/menu-items/${id}`, {
      method: 'DELETE'
    });
  }

  async addVoucher(guestId, voucherData) {
    return this.request(`/api/admin/guests/${guestId}/vouchers`, {
      method: 'POST',
      body: JSON.stringify(voucherData)
    });
  }

  // Guest endpoints
  async guestLogin(credentials) {
    const response = await this.request('/api/guests/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    localStorage.setItem('guest_token', response.token);
    return response;
  }

  async guestRegister(payload) {
    const response = await this.request('/api/guests/register', {
      method: 'POST',
      authMode: 'none',
      body: JSON.stringify(payload)
    });
    localStorage.setItem('guest_token', response.token);
    return response;
  }

  async getGuestProfile() {
    return this.request('/api/guests/me');
  }

  async redeemVoucher(voucherId) {
    return this.request(`/api/guests/vouchers/${voucherId}/redeem`, {
      method: 'POST'
    });
  }

  async getGuestReservations() {
    return this.request('/api/guests/reservations', { authMode: 'guest' });
  }

  async updateReservationDates(inquiryId, checkIn, checkOut) {
    return this.request(`/api/guests/reservations/${inquiryId}`, {
      method: 'PATCH',
      authMode: 'guest',
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut })
    });
  }

  async forgotPassword(email) {
    return this.request('/api/guests/forgot-password', {
      method: 'POST',
      authMode: 'none',
      body: JSON.stringify({ email })
    });
  }

  async resetPassword(token, password) {
    return this.request(`/api/guests/reset-password/${token}`, {
      method: 'POST',
      authMode: 'none',
      body: JSON.stringify({ password })
    });
  }

  async updateGuestPassword(data) {
    return this.request('/api/guests/password', {
      method: 'PUT',
      authMode: 'guest',
      body: JSON.stringify(data)
    });
  }

  // Cancel endpoints
  async getCancelInfo(token) {
    return this.request(`/api/cancel/${token}`, { authMode: 'none' });
  }

  async cancelReservation(token) {
    return this.request(`/api/cancel/${token}`, {
      method: 'POST',
      authMode: 'none'
    });
  }

  // Admin News (full list with auth — different from public getNews)
  async getAdminNews() {
    return this.request('/api/admin/news');
  }

  async getAdminNewsItem(id) {
    return this.request(`/api/admin/news/${id}`);
  }

  // Translation
  async translateText(text, targetLang = 'EN', options = {}) {
    return this.request('/api/admin/translate', {
      method: 'POST',
      body: JSON.stringify({
        text,
        target_lang: targetLang,
        html: !!options.html
      })
    });
  }

  // Vouchers
  async addVoucher(guestId, data) {
    return this.request(`/api/admin/guests/${guestId}/vouchers`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Utility
  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('guest_token');
  }
}

export default new ApiService();