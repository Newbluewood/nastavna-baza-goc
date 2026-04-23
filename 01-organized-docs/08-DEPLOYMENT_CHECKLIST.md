# Deployment Checklist

Use this checklist to ensure the project is ready for deployment and production use.

---

## 1. Database
- [x] Migration scripts run successfully (migrate:run)
- [x] Seed scripts run successfully (db:seed:presentation:run)
- [x] Admin user seeded (admin/admin123 or as in .env)
- [x] All tables and relations present (see migration logs)

## 2. Backend
- [x] All smoke tests pass (smoke:all)
- [x] All Jest tests pass (npm test)
- [x] All standalone tests pass (manual if needed)
- [x] .env configured for production (Aiven DB, correct secrets, allowed origins)
- [x] Logging and error handling enabled
- [x] Email and AI API keys set

## 3. Frontend
- [ ] Build runs without errors (npm run build)
- [ ] All pages/components render as expected
- [ ] API endpoints configured for production backend
- [ ] Manual UI/UX check (chat, reservations, admin, guest flows)

## 4. Integration
- [ ] Frontend and backend communicate (API calls work in deployed environment)
- [ ] CORS and allowed origins set correctly
- [ ] Email sending works (contact, registration, notifications)
- [ ] AI/embedding server reachable (if used)

## 5. Deployment
- [ ] Backend deployed (e.g. Render, Docker, etc.)
- [ ] Frontend deployed (e.g. Netlify, Vercel, etc.)
- [ ] .env files set on all platforms
- [ ] Database credentials secured
- [ ] SSL/HTTPS enabled

## 6. Post-Deploy
- [ ] Manual smoke test in production
- [ ] Admin login and CRUD actions
- [ ] Guest registration and reservation
- [ ] Chat and AI features
- [ ] Error/exception monitoring
- [ ] Backup and rollback plan

---

**Update this checklist for your environment and mark items as completed.**
