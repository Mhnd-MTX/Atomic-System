# Atomic Coders Team Hub

A responsive task and points workspace for Atomic Coders. The app includes a local demo mode and a Supabase-backed deployment with name/password sign-in, leader-only tools, task scoring, activity history, and scheduled overdue checks.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```powershell
npm install
npm run dev
```

Without Supabase environment variables, the workspace opens in demo mode. Use any listed member name with `atomic2025`, or use the leader/member preview buttons. Demo changes, including creating, editing, and removing tasks, stay in memory and reset when the page reloads.

## Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and publishable (anon) key. Never put a service-role key in a `VITE_` variable.
2. Install the Supabase CLI, log in, link the project, and apply the migration:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_ID
   supabase db push
   ```

3. Create the initial leader in Supabase Authentication with a real email and password. In the SQL editor, create the matching profile (replace the sample values):

   ```sql
   insert into public.team_members (id, name, email, role, avatar)
   select id, 'Maya Chen', email, 'leader', 'MC'
   from auth.users where email = 'leader@your-team.com';
   ```

   The `password_hash` column is deliberately not exposed or populated. Supabase Auth safely hashes and verifies account passwords.
4. Set the second leader-console passphrase as an Edge Function secret. The requested initial value is shown; replace it with a private value before production:

   ```powershell
   supabase secrets set LEADER_GATE_PASSWORD=atomic2025
   ```

5. Deploy the functions:

   ```powershell
   supabase functions deploy member-login --no-verify-jwt
   supabase functions deploy leader-gate
   supabase functions deploy manage-member
   ```

   The unauthenticated login function is rate-limited by Supabase Auth's password sign-in endpoint. Keep the leader passphrase out of source control.
6. Run `npm run dev` again. Leaders create accounts from the team console; member passwords are managed by Supabase Auth, not stored in the profile table.

The migration installs a one-minute `pg_cron` job. It marks each newly overdue task once, increments that member's red points once, and records an activity event. Timely approvals award one green point; late approvals do not. The app also calls the overdue check while a member is signed in so task status stays fresh during active use.

## Build and deploy

```powershell
npm run build
```

Publish the generated `dist/` directory to any static host (for example, Vercel or Netlify), set the two `VITE_SUPABASE_*` build environment variables there, and configure SPA fallback so `/leader`, `/dashboard`, `/leaderboard`, and `/activity` serve `index.html`. Database tables, row-level security, cron scoring, and Edge Functions live in `supabase/`.

The `password_hash` profile column exists for compatibility with the requested schema, but passwords must only be handled by Supabase Auth. The supplied `Logo.png` provides the workspace branding and blue color palette.