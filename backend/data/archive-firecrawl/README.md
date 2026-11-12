# Archive: early Firecrawl / static content dumps

These files were used to bootstrap the site before the CMS was the source of truth.

Do **not** import them into a live database. Use:

- Aiven for production backup/restore
- `npm run seed:content:export` / `seed:content:first-boot` for empty-DB factory seed

Legacy importers (`master-sync.js`, `migrate-json-to-db.js`, `sync-restaurant-data.js`) are locked unless `ALLOW_LEGACY_CONTENT_IMPORT=1`.
