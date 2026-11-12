# First-boot content seed

`content-seed.json` is exported from the live CMS (MySQL) and used only to fill **empty** content tables.

```bash
npm run seed:content:export          # refresh this file from DB (read-only)
npm run seed:content:first-boot      # dry-run
npm run seed:content:first-boot:run  # insert only where tables are empty
```

Production backup remains **Aiven**. See `backend/docs/CONTENT_SEED_AND_BACKUP.md`.
