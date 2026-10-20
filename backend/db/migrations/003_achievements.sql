insert into achievements(code,title,description) values
('first_dangal','First Dangal','Complete your first ranked Daily Dangal'),
('streak_3','On a Roll','Play the daily challenge 3 days in a row'),
('streak_7','Week Warrior','Play the daily challenge 7 days in a row'),
('high_scorer','High Scorer','Score 500 or more in a daily challenge'),
('first_battle','First Battle','Finish a live friend battle'),
('first_win','Victory','Win a live friend battle'),
('contributor','Contributor','Have a community challenge approved')
on conflict do nothing;
create index submissions_by_author on community_submissions(author_id, created_at desc);
