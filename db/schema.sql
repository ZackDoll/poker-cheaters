-- Run this once against your Postgres database (Neon SQL editor, Supabase SQL editor, or psql).

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  google_sub    text not null unique,   -- stable Google account id (emails can change)
  email         text unique,
  name          text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token_hash  text not null unique,     -- sha256 of the cookie token; the raw token is never stored
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists auth_sessions_user_id_idx on auth_sessions(user_id);
