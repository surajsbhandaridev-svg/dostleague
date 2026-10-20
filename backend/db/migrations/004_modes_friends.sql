-- Generated-mode matches have no stored pack/question rows.
alter table matches add column mode text not null default 'daily';
alter table matches alter column pack_id drop not null;
alter table answers drop constraint if exists answers_question_id_fkey;
-- Friends are created automatically when two players complete a challenge.
create table friendships(player_a uuid references players(id) on delete cascade, player_b uuid references players(id) on delete cascade, created_at timestamptz not null default now(), primary key(player_a,player_b), check(player_a < player_b));
create index friendships_b on friendships(player_b);
alter table friendships enable row level security;
