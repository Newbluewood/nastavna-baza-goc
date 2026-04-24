const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class ApiService {
  constructor() {
    this.baseURL = BASE_URL;
  }

  async request(endpoint, options = {}) {
    const { authMode = 'any', ...requestOptions } = options;
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...requestOptions.headers
      },
      ...requestOptions
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

  async getAIStatus() {
    return this.request('/api/ai/ping');
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

  async getGuests() {
    return this.request('/api/admin/guests');
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
    return this.request('/api/guests/reservations');
  }

  async updateReservationDates(inquiryId, checkIn, checkOut) {
    return this.request(`/api/guests/reservations/${inquiryId}`, {
      method: 'PATCH',
      body: JSON.stringify({ check_in: checkIn, check_out: checkOut })
    });
  }

  // Cancel endpoints
  async getCancelInfo(token) {
    return this.request(`/api/cancel/${token}`);
  }

  async cancelReservation(token) {
    return this.request(`/api/cancel/${token}`, {
      method: 'POST'
    });
  }

  // Utility
  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('guest_token');
  }
}

export default new ApiService();