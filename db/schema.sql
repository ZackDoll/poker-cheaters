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

-- Card tracker -------------------------------------------------------------------------
-- Everything below belongs to one user. Opponents are labels the user types in, not accounts.
-- Only derived numbers are stored. Video, audio and face landmarks never reach the server.

create table if not exists tracker_opponents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create unique index if not exists tracker_opponents_user_name_idx
  on tracker_opponents(user_id, lower(name));

create table if not exists tracker_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  label       text,
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create index if not exists tracker_sessions_user_idx on tracker_sessions(user_id, created_at desc);

create table if not exists tracker_hands (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references tracker_sessions(id) on delete cascade,
  number      int not null,
  board       jsonb not null default '[]',   -- up to 5 cards, e.g. ["Ks","9h","4d"]
  my_cards    jsonb not null default '[]',   -- the user's own hole cards, optional
  shown       jsonb not null default '{}',   -- { "<opponent id>": ["As","Kd"] } revealed at showdown
  created_at  timestamptz not null default now(),
  ended_at    timestamptz,
  unique (session_id, number)
);

create table if not exists tracker_actions (
  id              uuid primary key default gen_random_uuid(),
  hand_id         uuid not null references tracker_hands(id) on delete cascade,
  session_id      uuid not null references tracker_sessions(id) on delete cascade,
  opponent_id     uuid not null references tracker_opponents(id) on delete cascade,
  street          text not null check (street in ('preflop', 'flop', 'turn', 'river')),
  action          text not null check (action in ('fold', 'check', 'call', 'bet', 'raise')),
  bet_size        numeric not null default 0,
  pot_size        numeric not null default 0,
  active_players  int,
  position        text check (position in ('early', 'middle', 'late')),
  board           jsonb not null default '[]',  -- board showing when the action happened
  face            jsonb,                        -- derived face scores only
  probability     real check (probability between 0 and 1),  -- uncalibrated bluff estimate (bets and raises)
  reasons         jsonb not null default '[]',
  tells           jsonb not null default '[]',
  was_bluff       boolean,                      -- set from the cards shown at showdown
  labeled_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists tracker_actions_hand_idx on tracker_actions(hand_id, created_at);
create index if not exists tracker_actions_opponent_idx on tracker_actions(opponent_id);
create index if not exists tracker_actions_session_idx on tracker_actions(session_id);
