# nastavna-baza-goc

Monorepozitorijum za nastavnu / obrazovnu veb platformu (Goč projekat).

## Struktura

| Folder | Sadržaj |
|--------|---------|
| `frontend/` | **Vue 3** + **Vite** + Pinia, Vue Router, Markdown (`marked`), date picker |
| `backend/` | **Node.js** + **Express**, **MySQL** (`mysql2`), **Qdrant** (vektor), **OpenAI** API, JWT, e‑pošta (Nodemailer), migracije i test skripte |
| `01-organized-docs/` | Organizovana dokumentacija |
| `backend/docs/` | Dodatna backend dokumentacija |

Detaljnije uputstvo za front je u [`frontend/README.md`](frontend/README.md).

## Brzi start

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Potreban **Node** v20.19+ ili ≥22.12 (pogledaj `frontend/package.json` → `engines`).

### Backend

```bash
cd backend
npm install
```

Kopiraj `.env` iz `backend/.env.example`, popuni promenljive (baza, JWT, OpenAI, Qdrant, SMTP, itd.), zatim:

```bash
npm run dev
```

Na Windows-u `dev` koristi `start:win` (oslobađa port 3000 i pokreće `server.js`). Na Linux/macOS prilagodi ili koristi `node server.js` ako imaš ekvivalent.

Korisne npm skripte: migracije (`migrate:*`), smoke testovi, Jest (`test`), restart sajta, seed‑ovanje—itd. — vidi `backend/package.json` → `scripts`.

## Tehnologije (kratko)

- **Frontend:** Vue 3, Vite, Pinia, Vue Router  
- **Backend:** Express 5, MySQL, Qdrant, OpenAI, Joi, bcrypt, JWT, Multer  

---

*README generisan za GitHub koren repozitorijuma; izmene po želji.*
