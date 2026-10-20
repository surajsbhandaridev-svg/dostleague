-- One attempt per player per friend challenge; fast history paging.
create unique index one_attempt_per_challenge on challenge_attempts(player_id, friend_challenge_id) where friend_challenge_id is not null;
create index match_results_by_player on match_results(player_id);
