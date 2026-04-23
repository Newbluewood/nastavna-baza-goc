# Project Context (English)

(Moved from .baza-goc-context.md)

Nastavna baza Goč - Project Context

## Project Overview
"Nastavna baza Goč" (Teaching Base Goč) is a web platform for the University of Belgrade Faculty of Forestry. It provides dynamic content management, accommodation bookings, guest CRM, and a portal for visitors.

## Tech Stack
- Frontend: Vue 3 (Composition API, <script setup>), Vue Router, Pinia
- Backend: Node.js, Express, MySQL (Aiven cloud), Nodemailer (Brevo SMTP via API keys)
- Styling: Custom CSS (Modular, embedded in Vue SFCs), strict square flat design (no rounded corners), #332317 (Nav/Text) and #cdac91 (Accents)

## Architecture
- Public Portal: Home (/), Accommodation (/smestaj), News (/vesti), Contact/About (pointing to Under Construction templates via NotFoundView.vue).
- Guest Portal: /prijava and /moj-nalog. Guests can view reservations, cancel (up to 7 days before), and redeem Loyalty Vouchers on-the-fly.
- CMS / Admin: /admin/login, /admin/vesti, /admin/rezervacije, /admin/gosti. Secured via JWT (admin_token).

## Database Schema (Key Tables)
1. pages: Dynamic page translations (page_slug, title, text_content, lang).
2. hero_slides: Carousel content linked per page (page_slug, image_url, target_link).
3. news: Dynamic news listings (id, title, content_text, image_url).
4. inquiries: Holds booking requests. Statuses check against availability.
5. guests: (id, email, password_hash, name, phone, reservation_count, vouchers JSON, created_at). Tracks loyalty and vouchers.

## Phase 3 Completion Status
We successfully implemented the CRM, Vouchers and Guest Portal system.
- [x] The guests table now tracks reservation_count and holds a vouchers JSON column.
- [x] Admin panel (/admin/gosti) lists guests and allows distributing custom digital vouchers via a pop-up.
- [x] Guest dashboard (/moj-nalog) displays My Reservations, Change Password and My Vouchers.
- [x] Vouchers are redeemed directly by the Guest on their phone in front of Staff ("Samo-poništavanje"). No Staff tablets needed.
- [x] Upsell / Recommendation box implemented for loyal users.

## Recent Features & Fixes
- Smart Under Construction Pages: Links for /kontakt, /o-nama, /edukacija, /istrazivanje route to NotFoundView.vue which smartly displays an "Under Construction" template. 
- Vesti Page: Created /vesti view to map news to the public.
- Slider Fixes: Fixed Hero slider overlapping bugs (Z-index issue) and implemented interval-resets on manual changes to avoid double-jumping.

## Next Steps / Future Ideas
- Expand .vesti content: Render detailed single-page views for News if needed.
- Further Refinement: Continue tracking visual tweaks based on client feedback.
