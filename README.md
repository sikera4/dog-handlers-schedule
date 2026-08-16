# Диалог с собакой

Russian-first application for booking individual and group sessions with a dog
handler. One Next.js application serves the regular web booking flow, Telegram
Mini App entry point, and responsive administrator dashboard.

## What works

- session type → available day → time → contact details → review → confirmation
- anonymous booking without a client account
- normalized phone/Telegram contact with at least one contact method required
- pending bookings with atomic capacity enforcement
- local admin login, booking list/status changes, contact links, and recurring
  weekly slot creation
- Supabase/PostgreSQL migrations with RLS, sanitized availability RPC, audit
  events, and a row-locking booking transaction
- shared `/` and `/telegram` booking components with Telegram theme variables

Payments, client cancellation/rescheduling, Telegram `initData` verification,
bot notifications, and production deployment remain outside this slice.

## Requirements

- Node.js 22.12.0 or newer
- Corepack with `pnpm@10.34.5`
- Google Chrome for the configured Playwright suite
- Docker only when running the local Supabase stack

## Run immediately with the development repository

The isolated development repository persists data in `.data/dev-db.json`. It is
for a single local Next.js process only; production always uses PostgreSQL.

```bash
cp .env.example .env.local
corepack pnpm@10.34.5 install
corepack pnpm@10.34.5 dev
```

Set a private `DEV_ADMIN_PASSWORD` and a random `ADMIN_SESSION_SECRET` of at
least 32 characters in `.env.local`. Then open:

- `http://localhost:3000/` — client booking
- `http://localhost:3000/telegram` — Telegram-themed shared entry point
- `http://localhost:3000/admin` — administrator login and operations

The development repository seeds one handler and future Moscow-time slots on
first access. Deleting `.data/dev-db.json` resets only this local dataset.

## Run with local Supabase

Start Docker, then use the Supabase CLI without installing it globally:

```bash
corepack pnpm@10.34.5 db:start
corepack pnpm@10.34.5 db:reset
corepack pnpm@10.34.5 dlx supabase@2.113.0 status
```

Copy the local API URL and anonymous key into `.env.local`, and set:

```dotenv
DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Create an Auth user in Supabase Studio, then allow that user to administer the
app:

```sql
insert into public.admin_users (user_id)
values ('the-auth-user-uuid');
```

The schema is in
`supabase/migrations/202608110001_initial_schema.sql`; development slots are in
`supabase/seed.sql`. Anonymous users receive only slot ID, type, timestamps, and
remaining capacity. Booking/contact rows remain behind RLS.

## Verification

```bash
corepack pnpm@10.34.5 lint
corepack pnpm@10.34.5 typecheck
corepack pnpm@10.34.5 test
corepack pnpm@10.34.5 build
corepack pnpm@10.34.5 test:e2e
```

Unit tests include simultaneous attempts for the last individual place and
capacity release after cancellation. The production build uses webpack because
the Codex execution sandbox blocks Turbopack's internal PostCSS worker port.

## Before accepting real client data

- use the Supabase backend, never the development JSON repository
- configure an appropriate production Supabase project and admin allowlist
- add endpoint rate limiting and abuse monitoring
- define retention/deletion procedures and final consent/privacy text
- verify Russian personal-data and data-localization requirements and choose
  compliant hosting
- configure backups, error monitoring, and secret rotation
