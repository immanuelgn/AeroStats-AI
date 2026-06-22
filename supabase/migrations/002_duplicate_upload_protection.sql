-- Reject duplicate source files by SHA-256, even when a file is renamed.

create extension if not exists "pgcrypto";

create table if not exists public.flight_uploads (
  id uuid primary key default gen_random_uuid(),
  content_sha256 text not null,
  source_filename text not null,
  raw_file_path text,
  status text not null default 'processing',
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  constraint flight_uploads_content_sha256_format
    check (content_sha256 ~ '^[0-9a-f]{64}$')
);

create unique index if not exists flight_uploads_content_sha256_uidx
  on public.flight_uploads(content_sha256);

alter table public.flights
  add column if not exists upload_id uuid
  references public.flight_uploads(id) on delete cascade;

create index if not exists flights_upload_id_idx
  on public.flights(upload_id);

alter table public.flight_uploads enable row level security;

-- No anonymous policies are created. FastAPI uses the backend-only service role.
