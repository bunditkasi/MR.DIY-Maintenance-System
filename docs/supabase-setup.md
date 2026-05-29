# Supabase Setup

This project is prepared for Supabase, but secrets are not committed.

## Tables

Run `supabase/migrations/202605290001_initial_maintenance_schema.sql` in Supabase SQL Editor or through Supabase CLI.

The schema creates:

- `lark_ticket_snapshots`
- `maintenance_cases`
- `documents`
- `import_batches`
- `import_changes`
- `import_conflicts`
- `price_master`

## Environment

Create `.env.local` locally and Vercel Environment Variables in production:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Security

RLS is enabled on all tables. The first policy allows authenticated users to manage records. Do not use service role keys in the frontend.
