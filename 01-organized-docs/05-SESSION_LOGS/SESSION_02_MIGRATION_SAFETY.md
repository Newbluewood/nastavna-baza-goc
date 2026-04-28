(Moved from docs/refactor-docs/SESSION_02_MIGRATION_SAFETY.md)

# Session 02 - Migration Safety

## Kontekst

`setupDb.js` je destruktivan i nije bezbedan za aktivnu Aiven bazu.

## Cilj

Uvesti non-destructive migracioni tok koji ne gubi podatke i moze da se pokrece vise puta.

## Implementacija

- Dodat `backend/migrateDb.js`.
- Dodata 2 nacina pokretanja u `backend/package.json`:
  - `migrate:dry` -> samo plan i SQL preview
  - `migrate:run` -> stvarna primena

## Principi skripte

- Idempotentna provera pre svake izmene (`information_schema`).
- Nema `DROP/TRUNCATE/DELETE` operacija.
- Tabela/kolona/index/FK se dodaje samo ako nedostaje.

## Uskladjivanja

- Kolone:
  - `guests.vouchers`
  - `inquiries.guest_id`
  - `reservations.guest_id`
  - `reservations.cancel_token`
  - `reservations.inquiry_id`
  - `news.slug`
  - `news.likes`
- Indeksi:
  - `idx_reservations_room_dates`
  - `idx_inquiries_guest_id`
  - `uq_news_slug`
- Foreign keys:
  - `fk_inquiries_guest_id`
  - `fk_reservations_guest_id`
  - `fk_reservations_inquiry_id`

## Evidence

- `npm run migrate:dry` -> uspeh, prikazan plan SQL izmena.
- `npm run migrate:run` -> uspeh, primenjene izmene bez greske.

## Deployment pravilo

1. Backup/snapshot baze.
2. Pokreni `migrate:dry`.
3. Ako plan izgleda korektno, pokreni `migrate:run`.
4. Posle migracije uradi smoke test glavnih API tokova.
