# ReferralLink: NGO and Hospital Referral Tracking System

ReferralLink is a web-based feedback and referral tracking system for NGOs and hospitals. It now uses a multi-level administration model:

- Platform Administrator: governs organisations, organisation admins, settings, audit logs, and aggregate platform statistics.
- Organisation Administrator: manages staff users and organisation-level reports for one NGO or hospital.
- NGO Social Worker: creates beneficiary profiles and referrals for their own NGO.
- Hospital Records Keeper: processes referrals received by their hospital and submits feedback.

Platform administrators are intentionally blocked from referral creation, referral updates, beneficiary details, and feedback submission.

## Tech Stack

- Frontend: React.js with Vite
- Backend: Node.js and Express
- Database: MySQL
- Authentication: JWT with bcrypt password hashing

## Project Structure

```text
.
|-- database/
|   |-- schema.sql
|   `-- seed.sql
|-- server/
|   |-- scripts/
|   |   |-- init-db.js
|   |   |-- reset-db.js
|   |   `-- seed-db.js
|   `-- src/
|       |-- routes/
|       |-- auth.js
|       |-- db.js
|       `-- index.js
|-- src/
|   |-- api/
|   |-- styles/
|   `-- main.jsx
|-- tests/
|-- .env.example
|-- package.json
`-- vite.config.js
```

## Prerequisites

- Node.js 20 or newer
- npm
- MySQL Server 8 or newer

Check your versions:

```bash
node --version
npm --version
mysql --version
```

## Step-by-Step Setup

1. Install dependencies.

```bash
npm install
```

2. Create a local environment file.

```bash
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

3. Edit `.env` with your MySQL credentials.

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ngo_referral_tracker
JWT_SECRET=replace-with-a-long-random-secret
PORT=4000
CLIENT_ORIGIN=http://127.0.0.1:5173
```

4. Initialize the database.

```bash
npm run db:init
```

If you previously initialized the older prototype schema, recreate the local database before this step:

```bash
npm run db:reset
```

This drops the local database named by `DB_NAME`, recreates it with the current schema, and loads demo data. Use it when you see errors such as `Unknown column 'users.organisation_id'`.

5. Seed demo data.

```bash
npm run db:seed
```

All demo accounts use `password123`.

| Role | Email |
| --- | --- |
| Platform Administrator | `platform@demo.test` |
| NGO Organisation Administrator | `orgadmin@demo.test` |
| Hospital Organisation Administrator | `hospitaladmin@demo.test` |
| NGO Social Worker | `ngo@demo.test` |
| Hospital Records Keeper | `hospital@demo.test` |

6. Start the API and frontend together.

```bash
npm run dev
```

7. Open the app.

```text
http://127.0.0.1:5173
```

The API runs at:

```text
http://127.0.0.1:4000/api
```

## Useful Commands

Run the backend only:

```bash
npm run dev:api
```

Run the frontend only:

```bash
npm run dev:web
```

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## API Overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `GET` | `/api/dashboard` | Role-specific dashboard data |
| `GET` | `/api/admin/organisations` | Platform admin organisation directory |
| `POST` | `/api/admin/organisations` | Platform admin creates NGO or hospital |
| `PATCH` | `/api/admin/organisations/:id` | Platform admin edits or changes organisation status |
| `POST` | `/api/admin/organisations/:id/admins` | Platform admin creates first organisation admin |
| `GET` | `/api/admin/staff` | Organisation admin lists own staff |
| `POST` | `/api/admin/staff` | Organisation admin creates own staff user |
| `PATCH` | `/api/admin/staff/:id` | Organisation admin edits own staff user |
| `GET` | `/api/beneficiaries` | NGO worker lists own NGO case profiles |
| `POST` | `/api/beneficiaries` | NGO worker creates own NGO case profile |
| `GET` | `/api/referrals` | NGO or hospital user lists scoped referrals |
| `POST` | `/api/referrals` | NGO worker creates referral |
| `PATCH` | `/api/referrals/:id/status` | Hospital records keeper updates received referral status |
| `POST` | `/api/referrals/:id/feedback` | Hospital records keeper submits feedback |
| `GET` | `/api/reports/summary` | Role-specific reporting summary |

## Review Notes

- The code has not been pushed to Git.
- `.env` is ignored by Git and should not be committed.
- `database/seed.sql` is only a note; use `npm run db:seed` for runnable seed data.
