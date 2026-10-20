-- Email/password accounts can be attached to an existing guest player without losing its history.
create table player_accounts (
  player_id uuid primary key references players(id) on delete cascade,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index player_accounts_email_unique on player_accounts(lower(email));

-- Unranked practice and solo-vs-bot results are saved to personal history, never public competitive leaderboards.
create table solo_game_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  game_mode text not null,
  play_type text not null check (play_type in ('solo','bots','saboteur')),
  score int not null default 0,
  correct int not null default 0,
  total_questions int not null default 0,
  total_ms int not null default 0,
  outcome text,
  details jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index solo_game_history on solo_game_results(player_id, created_at desc);

-- These tables are only accessed by the backend using server-side credentials.
alter table player_accounts enable row level security;
alter table solo_game_results enable row level security;
