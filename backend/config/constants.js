module.exports = {
  INQUIRY_STATUS: {
    NEW: 'novo',
    APPROVED: 'obradjeno',
    REJECTED: 'odbijeno',
    CANCELLED: 'otkazano',
    EXPIRED: 'isteklo'
  },
  INQUIRY_SOURCE: {
    WEB: 'web',
    ADMIN_CMS: 'admin_cms'
  },
  /** Pending (novo) inquiries older than this many days auto-expire. */
  INQUIRY_PENDING_MAX_DAYS: Number(process.env.INQUIRY_PENDING_MAX_DAYS) || 14,
  LANGUAGES: {
    SERBIAN: 'sr',
    ENGLISH: 'en'
  },
  USER_ROLES: {
    ADMIN: 'admin',
    GUEST: 'guest'
  },
  EMAIL_TEMPLATES: {
    APPROVED: 'approved.html',
    REJECTED: 'rejected.html',
    CONFIRMATION: 'confirmation.html',
    RESET_PASSWORD: 'reset_password.html'
  }
};