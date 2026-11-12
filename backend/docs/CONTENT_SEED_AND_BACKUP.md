# Content seed vs production backup

## Production backup

**Aiven MySQL** is the source of truth and the disaster-recovery backup for the live site (CMS, guests, reservations, schema). Restore the whole database from Aiven when the DB fails or data is lost by mistake. After a DB restore, refresh chat knowledge with the CMS button **Освежи знање AI чет агента**.

## First-boot seed

`backend/data/seed/content-seed.json` is a **factory snapshot** of CMS content (themes, pages, news, attractions, menu). It is for empty databases (local from scratch, staging without a dump), not a substitute for Aiven.

```bash
# Refresh the seed from the current DB (read-only; does not change MySQL)
npm run seed:content:export

# See what would happen (always safe on a populated DB: all skip)
npm run seed:content:first-boot

# Insert only into empty content tables
npm run seed:content:first-boot:run
```

First-boot **never overwrites** existing CMS rows. If `themes` / `pages` / `news` / `attractions` / `restaurant_menu_items` already have data, that section is skipped.

## Legacy Firecrawl importers

`scripts/master-sync.js`, `scripts/migrate-json-to-db.js`, and `scripts/sync-restaurant-data.js` can overwrite live content from outdated JSON. They are locked unless `ALLOW_LEGACY_CONTENT_IMPORT=1`.

Historical crawl files live under `backend/data/archive-firecrawl/` and are not used for boot.
