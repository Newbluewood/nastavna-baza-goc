(Moved from backend/CHAT_HISTORY_IMPLEMENTATION.md)

# Persistent Chat History Implementation

## Overview

This document summarizes the implementation of persistent chat history for the AI assistant, including all backend and frontend changes, database schema, and integration points.

---

## 1. Database Schema

### Table: `chat_messages`

- `id` (INT, primary key, auto-increment)
- `guest_id` (INT, foreign key to `guests.id`, nullable)
- `role` (ENUM: 'user', 'assistant')
- `message` (TEXT)
- `created_at` (TIMESTAMP, default now)
- `session_id` (VARCHAR, optional, for grouping messages)
- `meta` (JSON, optional)

**Purpose:** Stores all chat messages, linked to users (guests) when available. Enables analytics, personalization, and full chat history retrieval.

---

## 2. Backend Changes

### Service: `services/chatService.js`

- `saveChatMessage({ guest_id, role, message, session_id, meta })`: Stores a chat message.
- `getChatMessages(guest_id, session_id, limit)`: Retrieves chat messages for a user (optionally by session).

### Controller: `controllers/chatHistoryController.js`

- `saveMessage(req, res)`: POST `/api/chat/history` — Save a chat message (auth optional).
- `getHistory(req, res)`: GET `/api/chat/history` — Retrieve chat history for logged-in user.

### Routes: `routes/chat.js`

- `POST /api/chat/history` — Save chat message (uses `optionalGuestAuthMiddleware`).
- `GET /api/chat/history` — Get chat history (uses `optionalGuestAuthMiddleware`).

### Middleware

- `optionalGuestAuthMiddleware` allows endpoints to work for both authenticated and guest users.

---

## 3. Frontend Changes

### API: `frontend/src/services/api.js`
- `getChatHistory(session_id, limit)`: Fetches chat history for the current user/session.
- `saveChatMessage({ role, message, session_id, meta })`: Saves a chat message to the backend.

### Component: `StayAssistantPanel.vue`
- (Planned) For logged-in users, loads and saves chat history via API.
- For guests, continues to use localStorage.

---

## 4. Best Practices & Extension Points
- All chat messages are linked to users when possible (via `guest_id`).
- Session grouping is supported via `session_id`.
- Meta/context can be stored for analytics or advanced features.
- Endpoints are secured for user privacy.
- Easily extendable for admin tools, analytics, or chat export.

---

## 5. Next Steps
- Integrate frontend chat UI with new API for logged-in users.
- Add tests for chat history endpoints.
- (Optional) Add admin endpoints for chat analytics or moderation.

---

**Author:** GitHub Copilot — April 2026
