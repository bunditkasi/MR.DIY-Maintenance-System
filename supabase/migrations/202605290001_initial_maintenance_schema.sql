create extension if not exists pgcrypto;

create table if not exists public.lark_ticket_snapshots (
  ticket_no text primary key,
  record_id text,
  store_code text not null,
  store_name text,
  category text,
  ticket_status text,
  senior_name text,
  supplier_name text,
  created_date text,
  quotation_no text,
  po_no text,
  raw_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_cases (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique references public.lark_ticket_snapshots(ticket_no) on delete restrict,
  job_detail_status text not null default 'missing' check (job_detail_status in ('missing', 'uploaded', 'validated', 'approved')),
  quotation_status text not null default 'missing' check (quotation_status in ('missing', 'uploaded', 'validated', 'approved')),
  po_status text not null default 'missing' check (po_status in ('missing', 'uploaded', 'validated', 'approved')),
  invoice_status text not null default 'missing' check (invoice_status in ('missing', 'uploaded', 'validated', 'approved')),
  archive_status text not null default 'missing' check (archive_status in ('missing', 'uploaded', 'validated', 'approved')),
  amount_check text not null default 'not_started' check (amount_check in ('not_started', 'passed', 'warning', 'blocked')),
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.maintenance_cases(id) on delete cascade,
  document_type text not null check (document_type in ('job_detail', 'quotation', 'po', 'invoice', 'archive', 'evidence')),
  status text not null default 'uploaded' check (status in ('missing', 'uploaded', 'validated', 'approved')),
  file_name text not null,
  file_url text,
  version_no integer not null default 1,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_case_count integer not null default 0,
  new_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  conflict_count integer not null default 0,
  invalid_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.import_changes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  ticket_no text not null,
  field_name text not null,
  before_value text not null default '',
  after_value text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.import_conflicts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  ticket_no text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.price_master (
  id uuid primary key default gen_random_uuid(),
  price_year integer not null,
  source_sheet text not null,
  item_code text,
  diy_code text,
  description text not null,
  quantity_rule text,
  material_price numeric(12,2) not null default 0,
  labor_price numeric(12,2) not null default 0,
  unit text,
  total_price numeric(12,2) not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  unique (price_year, source_sheet, diy_code, description)
);

create index if not exists idx_lark_ticket_snapshots_store_code on public.lark_ticket_snapshots(store_code);
create index if not exists idx_lark_ticket_snapshots_supplier on public.lark_ticket_snapshots(supplier_name);
create index if not exists idx_maintenance_cases_ticket_no on public.maintenance_cases(ticket_no);
create index if not exists idx_documents_case_type on public.documents(case_id, document_type);
create index if not exists idx_import_changes_batch on public.import_changes(batch_id);
create index if not exists idx_import_conflicts_batch on public.import_conflicts(batch_id);
create index if not exists idx_price_master_search on public.price_master(price_year, source_sheet, diy_code);

alter table public.lark_ticket_snapshots enable row level security;
alter table public.maintenance_cases enable row level security;
alter table public.documents enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_changes enable row level security;
alter table public.import_conflicts enable row level security;
alter table public.price_master enable row level security;

create policy "authenticated users can manage ticket snapshots"
  on public.lark_ticket_snapshots for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage maintenance cases"
  on public.maintenance_cases for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage documents"
  on public.documents for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage import batches"
  on public.import_batches for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage import changes"
  on public.import_changes for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage import conflicts"
  on public.import_conflicts for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated users can manage price master"
  on public.price_master for all
  to authenticated
  using (true)
  with check (true);
