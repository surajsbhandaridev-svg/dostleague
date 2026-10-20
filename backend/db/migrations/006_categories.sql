-- Per-category points for category rankings.
alter table challenge_attempts add column category_scores jsonb not null default '{}'::jsonb;
