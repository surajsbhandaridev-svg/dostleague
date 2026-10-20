-- Playable community questions need 3 wrong options; older rows (empty list) are never played.
alter table community_submissions add column wrong_options jsonb not null default '[]'::jsonb;
