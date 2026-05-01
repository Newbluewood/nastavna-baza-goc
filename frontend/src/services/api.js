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
      throw error;
    }

    return response.json();
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

  async getFacility(id, lang = 'sr') {
    return this.request(`/api/smestaj/${id}?lang=${lang}`);
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

  async getNewsItem(id, lang = 'sr') {
    return this.request(`/api/news/${id}?lang=${lang}`);
  }

  async getContactPage() {
    return this.request('/api/kontakt');
  }

  async getThemes() {
    return this.request('/api/themes');
  }

  async getThemeDetail(id) {
    return this.request(`/api/themes/${id}`);
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

  async chatPlanStay(payload) {
    return this.request('/api/chat/plan-stay', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }

  async chatSiteGuideTurn({ message, lang = 'sr' }) {
    return this.request('/api/chat/site-guide-turn', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify({ message, lang })
    });
  }

  async chatSuggestVisit(payload) {
    return this.request('/api/chat/suggest-visit', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }

  async chatReserveStay(payload) {
    return this.request('/api/chat/reserve-stay', {
      method: 'POST',
      authMode: 'guest',
      body: JSON.stringify(payload || {})
    });
  }

  async likeNews(id) {
    return this.request(`/api/news/${id}/like`, {
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
    return response;
  }

  async getInquiries() {
    return this.request('/api/admin/inquiries');
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

  // Admin — Room Map
  async getRoomMap(date) {
    const query = date ? `?date=${date}` : '';
    return this.request(`/api/admin/room-map${query}`);
  }

  // Admin — AI Usage
  async getAdminAiUsage() {
    return this.request('/api/admin/ai/usage');
  }

  // Admin — Cache
  async purgeCache() {
    return this.request('/api/admin/system/purge-cache', { method: 'POST' });
  }

  async getGuests() {
    return this.request('/api/admin/guests');
  }

  // Admin — Facilities & Rooms
  async getAdminFacilities() {
    return this.request('/api/admin/facilities');
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
  async translateText(text, targetLang = 'EN') {
    return this.request('/api/admin/translate', {
      method: 'POST',
      body: JSON.stringify({ text, target_lang: targetLang })
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
    localStorage.removeItem('guest_token');
  }
}

export default new ApiService();