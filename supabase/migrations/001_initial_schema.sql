-- AeroStats AI initial Supabase schema.
-- Run this in Supabase SQL Editor. Tables are private by default; backend service role performs writes.

create extension if not exists "pgcrypto";

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  name text,
  source_filename text,
  source_type text,
  raw_file_path text,
  normalized_file_path text,
  location_name text,
  takeoff_latitude double precision,
  takeoff_longitude double precision,
  started_at timestamp with time zone,
  ended_at timestamp with time zone,
  duration_seconds integer,
  total_distance_meters double precision,
  battery_used_percent double precision,
  max_altitude_meters double precision,
  average_speed_mps double precision,
  max_speed_mps double precision,
  telemetry_point_count integer,
  parser_confidence double precision,
  status text not null default 'parsed',
  privacy_mode text not null default 'private'
);

create table if not exists public.telemetry_points (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete cascade,
  timestamp timestamp with time zone not null,
  latitude double precision not null,
  longitude double precision not null,
  altitude_meters double precision,
  speed_mps double precision,
  battery_percent double precision,
  distance_from_home_meters double precision,
  heading_degrees double precision,
  vertical_speed_mps double precision,
  gps_satellites integer,
  signal_strength_percent double precision,
  event_type text,
  is_downsampled boolean not null default false
);

create table if not exists public.flight_metrics (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete cascade,
  hover_ratio double precision,
  altitude_gain_meters double precision,
  battery_drain_per_minute double precision,
  battery_drain_per_100m double precision,
  route_efficiency double precision,
  aggressive_movement_score double precision,
  signal_stability_score double precision,
  return_margin_score double precision,
  wind_impact_score double precision,
  feature_completeness_score double precision,
  derived_at timestamp with time zone default now()
);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete cascade,
  timestamp timestamp with time zone not null,
  latitude double precision not null,
  longitude double precision not null,
  temperature_celsius double precision,
  wind_speed_kph double precision,
  wind_gust_kph double precision,
  wind_direction_degrees double precision,
  precipitation_probability double precision,
  cloud_cover_percent double precision,
  visibility_meters double precision,
  provider text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.feature_vectors (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete cascade,
  segment_start timestamp with time zone,
  segment_end timestamp with time zone,
  feature_json jsonb not null,
  label_json jsonb,
  feature_type text not null,
  feature_completeness_score double precision,
  created_at timestamp with time zone default now()
);

create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  model_name text not null,
  model_type text not null,
  target_name text not null,
  training_rows integer not null default 0,
  training_flights integer not null default 0,
  validation_strategy text not null,
  metrics_json jsonb not null default '{}'::jsonb,
  feature_importance_json jsonb not null default '[]'::jsonb,
  confidence_json jsonb not null default '{}'::jsonb,
  artifact_path text,
  status text not null default 'created',
  notes text
);

create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete set null,
  model_run_id uuid references public.model_runs(id) on delete set null,
  prediction_type text not null,
  input_json jsonb not null,
  output_json jsonb not null,
  explanation_json jsonb not null default '{}'::jsonb,
  confidence_label text not null,
  uncertainty_json jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.parser_diagnostics (
  id uuid primary key default gen_random_uuid(),
  flight_id uuid references public.flights(id) on delete set null,
  source_filename text,
  parser_name text not null,
  status text not null,
  confidence double precision not null default 0,
  missing_fields text[] not null default '{}',
  warnings text[] not null default '{}',
  created_at timestamp with time zone default now()
);

create table if not exists public.weather_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text unique not null,
  latitude double precision not null,
  longitude double precision not null,
  requested_start timestamp with time zone,
  requested_end timestamp with time zone,
  provider text not null,
  response_json jsonb not null,
  created_at timestamp with time zone default now()
);

create index if not exists telemetry_points_flight_time_idx on public.telemetry_points(flight_id, timestamp);
create index if not exists feature_vectors_flight_type_idx on public.feature_vectors(flight_id, feature_type);
create index if not exists predictions_type_created_idx on public.predictions(prediction_type, created_at desc);
create index if not exists weather_cache_key_idx on public.weather_cache(cache_key);

alter table public.flights enable row level security;
alter table public.telemetry_points enable row level security;
alter table public.flight_metrics enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.feature_vectors enable row level security;
alter table public.model_runs enable row level security;
alter table public.predictions enable row level security;
alter table public.parser_diagnostics enable row level security;
alter table public.weather_cache enable row level security;

-- No anonymous table policies are created. Keep data private and route all writes through FastAPI service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('aerostats-flight-files', 'aerostats-flight-files', false, 52428800, array['text/csv','application/json','text/plain','application/zip','application/gzip','application/octet-stream']),
  ('aerostats-model-artifacts', 'aerostats-model-artifacts', false, 52428800, array['application/octet-stream','application/gzip'])
on conflict (id) do nothing;
