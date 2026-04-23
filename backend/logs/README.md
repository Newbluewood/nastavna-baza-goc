# Logging Structure

- `requests-YYYY-MM-DD.log`: All HTTP requests (global, guests and users)
- `qa-YYYY-MM-DD.log`: All AI Q&A (global, guests)
- `qa-user-USERID-YYYY-MM-DD.log`: All AI Q&A for a specific authenticated user (personalized)

Personal logs are created only if a user is authenticated and a user ID is available. This enables separation of global and personal recommendations/logging.

## Best Practice

- Never mix personal and global logs.
- Use user ID from `req.user.id` or similar for personal logs.
- Rotate and compress logs for privacy and performance.
